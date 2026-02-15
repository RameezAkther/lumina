"""
Inference service - handles AI model inference and mask processing
"""
import os
import cv2
import numpy as np
from typing import List
from app.utils.polygons import generate_polygons_from_mask
from app.utils.smart_retiling import apply_smart_retiling
from inference.resattunet_inference import run_resattunet_inference


async def run_inference_on_image(db, project_id: str, src_img: dict, model_name: str, masks_dir: str):
    """Run inference on a source image and save masks/polygons"""
    print(f"Processing Source Image: {src_img['filename']}")
    
    # Run inference on full image
    full_mask_array = run_resattunet_inference(model_name, src_img["path"], masks_dir)
    
    # Save full mask
    full_mask_filename = f"{src_img['filename']}_mask.png"
    full_mask_path = os.path.join(masks_dir, full_mask_filename)
    cv2.imwrite(full_mask_path, (full_mask_array * 255).astype(np.uint8))

    # Generate and save polygons
    full_poly_filename = f"{src_img['filename']}_polygons.json"
    full_poly_path = os.path.join(masks_dir, full_poly_filename)
    generate_polygons_from_mask(full_mask_path, full_poly_path)
    
    # Update image record in database
    await db["images"].update_one(
        {"_id": src_img["_id"]},
        {"$set": {
            "status": "processed",
            "mask_path": full_mask_path,
            "polygons_path": full_poly_path,
            "model_used": model_name
        }}
    )
    
    return full_mask_path, full_mask_array


async def detect_tile_size(db, project_id: str, src_img: dict, tiling_config: dict) -> int:
    """Detect tile size from database or config"""
    tile_size = None
    
    # Find any child tile to get actual dimensions
    sample_child = await db["images"].find_one({
        "project_id": project_id,
        "parent_image": src_img["filename"],
        "is_tiled": True
    })
    
    if sample_child:
        tile_size = sample_child.get("width")
        print(f"  -> Detected user tile preference from DB: {tile_size}px")
    
    # Fallback to config
    if not tile_size:
        val = tiling_config.get(src_img["filename"])
        if not val:
            for k, v in tiling_config.items():
                if k in src_img["filename"]:
                    val = v
                    break
        if val:
            tile_size = int(val)
    
    return tile_size


async def apply_retiling(db, project_id: str, src_img: dict, full_mask_path: str,
                        tile_size: int, images_dir: str, masks_dir: str):
    """Apply smart retiling to inference results"""
    if tile_size:
        print(f"  -> Applying Smart Retiling with base size: {tile_size}px")
        
        await apply_smart_retiling(
            db=db,
            project_id=project_id,
            parent_img_doc=src_img,
            full_mask_path=full_mask_path,
            base_tile_size=tile_size,
            images_dir=images_dir,
            masks_dir=masks_dir
        )
    else:
        print("  -> No tiling configuration found. Skipping retiling.")
