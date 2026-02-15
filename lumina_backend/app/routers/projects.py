"""
Projects router - orchestrates project operations using service modules
"""
import json
import os
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status, Body
from bson import ObjectId

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.schemas.project import (
    ProjectCreateResponse, ProjectListResponse, AnalysisResponse,
    FileAnalysisResult, SolarParams
)

# Import services
from app.services import project_service, image_service, inference_service, solar_service
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
    await project_service.update_project_status(db, project_id, "analysis complete")
    
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
        "total_images": count
    }