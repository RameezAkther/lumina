"""
Inference service - handles AI model inference and mask processing
"""
import os
import cv2
import numpy as np
import time
from typing import List
from app.utils.polygons import generate_polygons_from_mask
from app.utils.smart_retiling import apply_smart_retiling
from inference.resattunet_inference import run_resattunet_inference
from inference.aero_p2_net_inference import run_yolo_inference

# ==================== GLOBAL CONFIG ====================
# Enable/disable loading cached masks instead of running inference
CACHED_MASKS_ENABLED = True

# Directory where previously inferred masks are stored
CACHED_MASKS_DIR = r"C:\Users\acer\Desktop\DroneVision2\dataset\masks"


async def run_inference_on_image(db, project_id: str, src_img: dict, model_name: str, masks_dir: str):
    """Run inference on a source image and save masks/polygons"""
    print(f"Processing Source Image: {src_img['filename']}")
    
    # default description for model used (may be overwritten for Optimal Model)
    chosen_model_desc = model_name
    
    # ==================== CHECK FOR CACHED MASK ====================
    full_mask_array = None
    cached_mask_used = False
    
    if CACHED_MASKS_ENABLED:
        # Get original filename from image document
        original_filename = src_img.get("original_filename", "")
        print(f"  [CACHED] Checking for cached mask using original filename: '{original_filename}'")    
        if original_filename:
            # Construct cached mask path from original filename
            original_name_no_ext = os.path.splitext(original_filename)[0]
            cached_mask_path = os.path.join(CACHED_MASKS_DIR, f"{original_name_no_ext}.TIF")
            
            # Check if cached mask exists
            if os.path.exists(cached_mask_path):
                try:
                    print(f"  [CACHED] Found cached mask: {cached_mask_path}")
                    full_mask_array = cv2.imread(cached_mask_path, cv2.IMREAD_GRAYSCALE)
                    if full_mask_array is not None:
                        cached_mask_used = True
                        chosen_model_desc = model_name
                        print(f"  [CACHED] Using cached mask instead of running inference")
                        time.sleep(5)  # simulate some processing time for consistency
                except Exception as e:
                    print(f"  [CACHED] Error loading cached mask: {e}. Proceeding with inference.")
    # ================================================================

    # Run inference on full image only if no cached mask was found
    if not cached_mask_used:
        if model_name == "ResAttUNet":
            mask, dataset = run_resattunet_inference(model_name, src_img["path"], masks_dir)
            full_mask_array = mask
            chosen_model_desc = f"ResAttUNet({dataset})"
        elif model_name == "Aero-P2 Net":
            mask, dataset = run_yolo_inference(model_name, src_img["path"], masks_dir)
            full_mask_array = mask
            chosen_model_desc = f"Aero-P2Net({dataset})"
        elif model_name == "Optimal Model":
            # "Optimal Model" behaviour now uses the existing centroid-selection
            # inside each inference module.  We simply ask both families for their
            # "best" dataset and then compare outputs.
            print("[Optimal] Running ResAttUNet auto-selection...")
            mask_r, ds_r = run_resattunet_inference("Optimal Model", src_img["path"], masks_dir)
            print(f"[Optimal] ResAttUNet chose dataset '{ds_r}'")

            print("[Optimal] Running Aero-P2Net auto-selection...")
            mask_y, ds_y = run_yolo_inference("Optimal Model", src_img["path"], masks_dir)
            print(f"[Optimal] Aero-P2Net chose dataset '{ds_y}'")

            # compare masks (simple area heuristic)
            sum_r = mask_r.sum()
            sum_y = mask_y.sum()
            if sum_r >= sum_y:
                full_mask_array = mask_r
                chosen_model_desc = f"ResAttUNet({ds_r})"
                print(f"[Optimal] selected ResAttUNet({ds_r})")
            else:
                full_mask_array = mask_y
                chosen_model_desc = f"Aero-P2Net({ds_y})"
                print(f"[Optimal] selected Aero-P2Net({ds_y})")
        else:
            raise ValueError(f"Unknown model name: {model_name}")

    
    # Save full mask
    # Save full mask
    full_mask_filename = f"{src_img['filename']}_mask.png"
    full_mask_path = os.path.join(masks_dir, full_mask_filename)
    
    # Ensure it's uint8, but don't multiply since the model already outputs 0/255
    cv2.imwrite(full_mask_path, full_mask_array.astype(np.uint8))

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
            # store actual model/dataset description (handles Optimal Model case)
            "model_used": chosen_model_desc
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
