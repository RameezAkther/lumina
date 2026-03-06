"""
Projects router - orchestrates project operations using service modules
"""
import json
import os
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status, Body
from bson import ObjectId
import uuid

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.schemas.project import (
    ProjectCreateResponse, ProjectListResponse, AnalysisResponse,
    FileAnalysisResult, SolarParams, LocationParams, UserPolygonPayload,
    UserPanelPayload, ForecastParams
)

# Import services
from app.services import project_service, image_service, inference_service, solar_service, weather_service, forecasting_service
from app.utils.file_utils import analyze_file, create_image_tiles, save_uploaded_file

router = APIRouter()

# ==================== FILE ANALYSIS ====================
@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_files(files: List[UploadFile] = File(...)):
    """Analyze uploaded files for tiling requirements"""
    results = []
    
    for file in files:
        result = await analyze_file(file)
        results.append(FileAnalysisResult(**result))

    return {"results": results}


# ==================== PROJECT CRUD ====================
@router.get("/", response_model=List[ProjectListResponse])
async def get_user_projects(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get all projects for the current user"""
    user_id = str(current_user["_id"])
    return await project_service.get_user_projects(db, user_id)

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete a project and all associated files"""
    user_id = str(current_user["_id"])
    
    # Verify ownership
    project = await project_service.get_project_by_id(db, project_id, user_id)
    
    # Delete
    await project_service.delete_project(db, project_id, user_id, project["name"])
    
    return None

@router.post("/{project_id}/inference")
async def perform_inference(
    project_id: str,
    model_name: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Run inference on project images"""
    user_id = str(current_user["_id"])
    
    # Fetch project
    project = await project_service.get_project_by_id(db, project_id)
    tiling_config = project.get("config", {})
    
    # Setup paths
    paths = project_service.get_project_paths(user_id, project["name"])
    os.makedirs(paths["masks"], exist_ok=True)

    # Get source images
    source_images = await image_service.get_source_images(db, project_id)
    
    processed_count = 0

    for src_img in source_images:
        try:
            # Run inference
            print(f"Running inference on {src_img['filename']} using model: {model_name}")
            full_mask_path, full_mask_array = await inference_service.run_inference_on_image(
                db, project_id, src_img, model_name, paths["masks"]
            )
            
            # Detect tile size and apply retiling
            tile_size = await inference_service.detect_tile_size(db, project_id, src_img, tiling_config)
            
            await inference_service.apply_retiling(
                db, project_id, src_img, full_mask_path, tile_size,
                paths["images"], paths["masks"]
            )
            
            processed_count += 1

        except Exception as e:
            print(f"Failed to infer {src_img['filename']}: {e}")
            import traceback
            traceback.print_exc()

    # Update project status
    await project_service.update_project_status(
        db, project_id, "inference complete", last_model=model_name
    )

    return {
        "message": "Inference and smart retiling complete",
        "processed_sources": processed_count
    }

@router.post("/create", response_model=ProjectCreateResponse)
async def create_project(
    project_name: str = Form(...),
    tiling_config_str: str = Form("{}"),
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Create a new project with uploaded images"""
    try:
        tiling_config = json.loads(tiling_config_str)
    except:
        tiling_config = {}

    user_id = str(current_user["_id"])
    
    # Setup directories
    paths = project_service.get_project_paths(user_id, project_name)
    os.makedirs(paths["images"], exist_ok=True)
    os.makedirs(paths["masks"], exist_ok=True)

    # Create project document
    project_id = await project_service.create_project_doc(db, user_id, project_name, tiling_config)

    image_docs = []

    for file in files:
        unique_id = image_service.generate_unique_id()
        original_ext = file.filename.split('.')[-1].lower()
        base_filename = f"{project_service.sanitize_project_name(project_name)}_{unique_id}"
        
        # Save original file
        original_save_path = os.path.join(paths["images"], f"{base_filename}.{original_ext}")
        save_uploaded_file(file, original_save_path)

        # Create display copy and get dimensions
        display_filename = f"{base_filename}_view.png"
        display_save_path = os.path.join(paths["images"], display_filename)
        original_width, original_height, display_path = image_service.create_display_copy(
            original_save_path, display_save_path
        )

        # Handle tiling
        tile_size = tiling_config.get(file.filename)

        try:
            if tile_size:
                tile_size = int(tile_size)
                
                # Create tiles
                tiles_metadata, w, h = create_image_tiles(
                    original_save_path, tile_size, paths["images"], base_filename
                )
                
                # Add tile records
                for tile_meta in tiles_metadata:
                    image_docs.append({
                        "project_id": project_id,
                        "filename": tile_meta["filename"],
                        "original_filename": file.filename,
                        "path": tile_meta["path"],
                        "display_path": tile_meta["path"],
                        "is_tiled": True,
                        "tile_index": tile_meta["tile_index"],
                        "parent_image": f"{base_filename}.{original_ext}",
                        "processed": False,
                        "width": tile_meta["width"],
                        "height": tile_meta["height"]
                    })
                
                # Add parent record
                image_docs.append({
                    "project_id": project_id,
                    "filename": f"{base_filename}.{original_ext}",
                    "original_filename": file.filename,
                    "path": original_save_path,
                    "display_path": display_path,
                    "is_tiled": False,
                    "is_source": True,
                    "processed": False,
                    "width": w,
                    "height": h
                })
            else:
                # No tiling
                image_docs.append({
                    "project_id": project_id,
                    "filename": f"{base_filename}.{original_ext}",
                    "original_filename": file.filename,
                    "path": original_save_path,
                    "display_path": display_path,
                    "is_tiled": False,
                    "processed": False,
                    "width": original_width,
                    "height": original_height
                })

        except Exception as e:
            print(f"Error processing {file.filename}: {e}")
            continue

    # Insert all image documents
    await image_service.insert_image_documents(db, image_docs)

    return {
        "id": project_id,
        "name": project_name,
        "total_images": len(image_docs),
        "tiled": len(tiling_config) > 0,
        "message": "Project created successfully"
    }


# ==================== IMAGE OPERATIONS ====================
@router.get("/{project_id}/images")
async def get_project_images(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get all images for a project with URLs"""
    return await image_service.get_project_images(db, project_id)


@router.get("/{project_id}/panel_count")
async def get_project_panel_count(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Return total solar panel count across all images in the project"""
    # Sum the `solar_panel_count` field across images for the project
    cursor = db["images"].find({"project_id": project_id}, {"solar_panel_count": 1})
    images = await cursor.to_list(length=None)
    total_panels = sum([img.get("solar_panel_count", 0) for img in images])

    return {"project_id": project_id, "total_panels": int(total_panels)}

@router.post("/images/{image_id}/update_selection")
async def update_image_selection(
    image_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update excluded polygons for an image"""
    excluded_ids = payload.get("excluded_ids", [])
    excluded_count = await image_service.update_image_selection(db, image_id, excluded_ids)
    
    return {"message": "Selection updated", "excluded_count": excluded_count}

@router.post("/{project_id}/calculate_capacity")
async def calculate_capacity(
    project_id: str,
    params: SolarParams,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Calculate solar panel count for project"""
    user_id = str(current_user["_id"])
    
    # Fetch project
    project = await project_service.get_project_by_id(db, project_id)
    
    # --- NEW: Save Global Config Persistence ---
    # If running in Global Mode (image_id is None), save these params to the Project document
    # This allows the frontend to reload these settings next time the user opens the project.
    if not params.image_id:
        await db["projects"].update_one(
            {"_id": ObjectId(project_id)},
            {"$set": {"solar_config": params.dict()}}
        )
    # -------------------------------------------
    
    # Setup paths
    paths = project_service.get_project_paths(user_id, project["name"])
    os.makedirs(paths["solar"], exist_ok=True)
    
    # Get processed images
    # If params.image_id is provided, this service function returns list with 1 image
    images = await image_service.get_processed_images(db, project_id, params.image_id)
    
    # Calculate capacity
    result = await solar_service.calculate_solar_capacity(
        db, project_id, images, paths["solar"], params
    )
    
    # Update project status
    await project_service.update_project_status(db, project_id, "panel analysis complete")
    
    return result

@router.get("/{project_id}", response_model=ProjectListResponse)
async def get_project_details(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get project details"""
    user_id = str(current_user["_id"])
    project = await project_service.get_project_by_id(db, project_id, user_id)
    
    count = await db["images"].count_documents({"project_id": project_id})
    
    return {
        "id": str(project["_id"]),
        "name": project["name"],
        "created_at": project["created_at"],
        "status": project.get("status", "pending"),
        "solar_config": project.get("solar_config", {}),
        "total_images": count,
        "location_config": project.get("location_config", {}),
        "historical_results": project.get("historical_results", {})
    }

@router.post("/{project_id}/historical_analysis")
async def perform_historical_analysis(
    project_id: str,
    params: LocationParams,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    # 1. Geocoding
    lat, lon, display_name = await weather_service.get_coordinates(
        params.country, params.state, params.district, params.area
    )
    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="Could not resolve location.")

    # 2. Fetch Solar Data (NASA POWER)
    raw_nasa_data = await weather_service.fetch_nasa_solar_data(lat, lon)
    if not raw_nasa_data:
        raise HTTPException(status_code=502, detail="Failed to fetch data from NASA.")

    # 3. Determine Total Capacity & Save Config
    config_data = params.dict(exclude={"image_id"})
    
    if params.image_id:
        # --- INDIVIDUAL MODE ---
        image = await db["images"].find_one({"_id": ObjectId(params.image_id)})
        
        # Get panel count from segmentation step
        panel_count = image.get("solar_panel_count", 0)
        total_system_kw = panel_count * params.panel_capacity_kw
        
        # Calculate Metrics
        analysis_result = weather_service.calculate_historical_stats(
            raw_nasa_data, 
            system_capacity_kw=total_system_kw if total_system_kw > 0 else 1.0 
        )
        
        # Add metadata for frontend
        analysis_result["location_resolved"] = display_name
        analysis_result["total_system_kw"] = round(total_system_kw, 2)
        
        # SAVE to Database
        await db["images"].update_one(
            {"_id": ObjectId(params.image_id)},
            {"$set": {
                "location_config": config_data,
                "historical_results": analysis_result
            }}
        )
        
        # Update project status
        await project_service.update_project_status(db, project_id, "historical analysis complete")
        
    else:
        # --- GLOBAL MODE ---
        project = await db["projects"].find_one({"_id": ObjectId(project_id)})
        
        # To get global capacity, sum all panels in all images
        cursor = db["images"].find({"project_id": project_id})
        all_images = await cursor.to_list(length=None)
        
        total_panel_count = sum([img.get("solar_panel_count", 0) for img in all_images])
        total_system_kw = total_panel_count * params.panel_capacity_kw
        
        # Calculate Metrics
        analysis_result = weather_service.calculate_historical_stats(
            raw_nasa_data, 
            system_capacity_kw=total_system_kw if total_system_kw > 0 else 1.0
        )
        
        # Add metadata for frontend
        analysis_result["location_resolved"] = display_name
        analysis_result["total_system_kw"] = round(total_system_kw, 2)

        # SAVE to Database
        await db["projects"].update_one(
            {"_id": ObjectId(project_id)},
            {"$set": {
                "location_config": config_data,
                "historical_results": analysis_result 
            }}
        )
        
        # Update project status
        await project_service.update_project_status(db, project_id, "historical analysis complete")

    # 4. Return to Frontend
    return {
        "message": "Analysis complete",
        "location_resolved": display_name,
        "coordinates": {"lat": lat, "lon": lon},
        "system_size_kw": round(total_system_kw, 2),
        "metrics": analysis_result
    }

@router.post("/images/{image_id}/user_polygons")
async def save_user_polygon(
    image_id: str,
    payload: UserPolygonPayload,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Save a custom polygon drawn by the user for a specific image"""
    
    # 1. Generate a unique ID for this polygon (e.g., 'user_a1b2c3d4')
    # This allows the frontend to target it later if you add delete/edit features
    poly_id = f"user_{uuid.uuid4().hex[:8]}"
    
    polygon_doc = {
        "id": poly_id,
        "points": payload.points
    }
    
    # 2. Push the new polygon into the 'user_polygons' array in MongoDB
    result = await db["images"].update_one(
        {"_id": ObjectId(image_id)},
        {"$push": {"user_polygons": polygon_doc}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Image not found")
        
    # 3. Return the saved document so the frontend can update its state
    return {
        "message": "Polygon saved successfully", 
        "data": polygon_doc
    }

@router.delete("/images/{image_id}/user_polygons/{poly_id}")
async def remove_user_polygon(
    image_id: str,
    poly_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete a custom polygon drawn by the user"""
    
    # Use MongoDB's $pull operator to remove the item from the array
    result = await db["images"].update_one(
        {"_id": ObjectId(image_id)},
        {"$pull": {"user_polygons": {"id": poly_id}}}
    )
    
    # Optional: Also remove it from excluded_polygons if it was deselected
    await db["images"].update_one(
        {"_id": ObjectId(image_id)},
        {"$pull": {"excluded_polygons": poly_id}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Polygon or image not found")
        
    return {"message": "Polygon deleted successfully"}

# ==================== INTERACTIVE PANELS ====================

@router.post("/images/{image_id}/panels")
async def add_custom_panel(
    image_id: str,
    payload: UserPanelPayload,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Add a manually placed solar panel and increment the count"""
    
    panel_doc = payload.dict()
    
    # $push the new panel into the array, and $inc (increment) the total panel count by 1
    result = await db["images"].update_one(
        {"_id": ObjectId(image_id)},
        {
            "$push": {"panels_data": panel_doc},
            "$inc": {"solar_panel_count": 1}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Image not found")
        
    return {"message": "Panel added successfully", "data": panel_doc}

@router.delete("/images/{image_id}/panels/{panel_id}")
async def remove_custom_panel(
    image_id: str,
    panel_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Remove a specific solar panel and decrement the count"""
    
    # $pull the panel out of the array, and $inc (decrement) the total panel count by 1
    result = await db["images"].update_one(
        {"_id": ObjectId(image_id)},
        {
            "$pull": {"panels_data": {"id": panel_id}},
            "$inc": {"solar_panel_count": -1}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Panel or image not found")
        
    return {"message": "Panel deleted successfully"}

@router.delete("/images/{image_id}/panels")
async def clear_all_panels(
    image_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Clear all solar panels from the image"""
    
    # Empty the array and reset the count to 0
    result = await db["images"].update_one(
        {"_id": ObjectId(image_id)},
        {
            "$set": {
                "panels_data": [],
                "solar_panel_count": 0
            }
        }
    )
    
    return {"message": "All panels cleared successfully"}

@router.post("/{project_id}/forecast")
async def generate_forecast(
    project_id: str,
    params: ForecastParams,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    # 1. Fetch document
    doc_id = params.image_id if params.image_id else project_id
    collection = "images" if params.image_id else "projects"
    doc = await db[collection].find_one({"_id": ObjectId(doc_id)})
        
    if not doc or "historical_results" not in doc:
        raise HTTPException(status_code=400, detail="Historical analysis must be run first.")
        
    historical_results = doc["historical_results"]
    raw_historical_data = historical_results.get("raw_historical_data", [])
    if len(raw_historical_data) < 24:
        raise HTTPException(status_code=400, detail="Not enough historical data for GPR forecasting.")
        
    historical_ghi_list = [item["ghi"] for item in raw_historical_data]
    total_system_kw = historical_results.get("total_system_kw", 1.0)

    # --- 2. SMART CACHING & CONVERSION LOGIC ---
    cached_params = doc.get("forecast_params")
    cached_results = doc.get("forecast_results")

    # SCENARIO A: Page Refresh / Initial Mount
    if params.is_initial_load:
        if cached_params and cached_results:
            # Return cached DB data immediately! No recalculation.
            cached_results["applied_parameters"] = cached_params
            return cached_results
        else:
            # First time ever: Calculate localized defaults based on country
            country = doc.get("location_config", {}).get("country", "United States")
            defaults = await forecasting_service.get_localized_defaults(country)
            sys_cost = defaults["system_cost"]
            elec_rate = defaults["electricity_rate"]
            curr = defaults["currency"]
            cpp = defaults["cost_per_panel"]

    # SCENARIO B: User changed the Currency Dropdown
    elif params.target_currency_for_conversion:
        base_values = {
            "system_cost": params.system_cost,
            "electricity_rate": params.electricity_rate,
            "cost_per_panel": params.cost_per_panel
        }
        converted = await forecasting_service.convert_currency_values(params.currency, params.target_currency_for_conversion, base_values)
        sys_cost = converted["system_cost"]
        elec_rate = converted["electricity_rate"]
        cpp = converted["cost_per_panel"]
        curr = converted["currency"]

    # SCENARIO C: Standard manual update
    else:
        sys_cost = params.system_cost
        elec_rate = params.electricity_rate
        cpp = params.cost_per_panel
        curr = params.currency

    # --- 3. RUN FORECAST & SAVE TO DB ---
    try:
        report = forecasting_service.generate_advanced_solar_report(
            historical_ghi_list=historical_ghi_list,
            system_capacity_kw=total_system_kw,
            system_cost=sys_cost,
            electricity_rate=elec_rate,
            currency=curr
        )
        
        report["applied_parameters"] = {
            "system_cost": sys_cost,
            "electricity_rate": elec_rate,
            "cost_per_panel": cpp,
            "currency": curr,
            "total_system_kw": total_system_kw
        }
        
        # Overwrite DB with new cache
        await db[collection].update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {
                "forecast_results": report,
                "forecast_params": report["applied_parameters"]
            }}
        )
        
        # Update project status to analysis complete
        await project_service.update_project_status(db, project_id, "analysis complete")
        
        return report
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")