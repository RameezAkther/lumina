"""
Solar service - handles solar panel placement and capacity calculation
"""
import os
import cv2
from panel_placement.panel_placement import run_solar_placement
from app.core.config import settings
import time

async def calculate_solar_capacity(db, project_id: str, images: list, solar_dir: str, params) -> dict:
    """Calculate solar capacity for a list of images"""
    total_panels = 0
    results = []

    config_dict = params.dict()
    
    for img in images:
        user_polygons = img.get("user_polygons", [])

        # --- NEW: Unpack the new panels_data array ---
        count, vis_img, panels_data = run_solar_placement(
            img["path"],
            img["mask_path"],
            params.gsd,
            params.panel_length,
            params.panel_width,
            params.gap,
            params.max_panels,                 
            img.get("polygons_path"),         
            img.get("excluded_polygons", []), 
            user_polygons                     
        )
        
        solar_url = None
        
        if vis_img is not None:
            solar_url, solar_path = await save_solar_visualization(
                img, vis_img, solar_dir
            )
            
            # --- NEW: Save panels_data to the database ---
            await db["images"].update_one(
                {"_id": img["_id"]},
                {"$set": {
                    "solar_path": solar_path,
                    "solar_panel_count": count,
                    "solar_config": config_dict,
                    "panels_data": panels_data # Make interactive panels persistent
                }}
            )

        # --- NEW: Send panels_data to the frontend via the API response ---
        results.append({
            "id": str(img["_id"]),
            "filename": img["filename"],
            "panels": count,
            "solar_url": solar_url,
            "solar_config": config_dict,
            "panels_data": panels_data 
        })
        
        total_panels += count
    
    return {
        "total_panels": total_panels,
        "results": results
    }

async def save_solar_visualization(img: dict, vis_img, solar_dir: str) -> tuple:
    """Save solar visualization and return URL and path"""
    base_name = os.path.splitext(img['filename'])[0]
    solar_filename = f"solar_{base_name}.png" 
    solar_path = os.path.join(solar_dir, solar_filename)
    
    # Save as PNG
    cv2.imwrite(solar_path, vis_img)
    
    # Generate URL
    solar_url = None
    try:
        rel_path = os.path.relpath(solar_path, settings.UPLOAD_DIR)
        rel_path_url = rel_path.replace("\\", "/")
        
        timestamp = int(time.time())
        solar_url = f"http://localhost:8000/uploads/{rel_path_url}?t={timestamp}"
        
    except ValueError:
        solar_url = None
    
    return solar_url, solar_path