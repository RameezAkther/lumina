"""
File utilities - handles file I/O and image tiling operations
"""
import os
from typing import List
from PIL import Image
from fastapi import UploadFile


async def analyze_file(file: UploadFile) -> dict:
    """Analyze image file for dimensions and tiling recommendations"""
    try:
        img = Image.open(file.file)
        w, h = img.size
        file.file.seek(0)
        
        needs_tiling = w > 2048 or h > 2048
        recommendations = []
        
        if needs_tiling:
            if w > 8000 or h > 8000:
                recommendations = [1024, 2048]
            else:
                recommendations = [512, 1024, 2048]
        
        return {
            "filename": file.filename,
            "width": w,
            "height": h,
            "needs_tiling": needs_tiling,
            "recommended_sizes": recommendations
        }
    except Exception as e:
        print(f"Skipping analysis for {file.filename}: {e}")
        return {
            "filename": file.filename,
            "width": 0,
            "height": 0,
            "needs_tiling": False,
            "recommended_sizes": []
        }


def create_image_tiles(image_path: str, tile_size: int, output_dir: str, base_filename: str) -> List[dict]:
    """Create tiles from an image and return tile metadata"""
    tiles_metadata = []
    
    with Image.open(image_path) as img:
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        
        original_width, original_height = img.size
        tile_seq = 0
        
        for i in range(0, original_width, tile_size):
            for j in range(0, original_height, tile_size):
                # Calculate tile dimensions
                current_tile_w = min(i + tile_size, original_width) - i
                current_tile_h = min(j + tile_size, original_height) - j
                
                box = (i, j, min(i + tile_size, original_width), min(j + tile_size, original_height))
                tile = img.crop(box)
                
                tile_filename = f"{base_filename}_{tile_seq}.png"
                tile_path = os.path.join(output_dir, tile_filename)
                tile.save(tile_path, format="PNG")
                
                tiles_metadata.append({
                    "filename": tile_filename,
                    "path": tile_path,
                    "tile_index": tile_seq,
                    "width": current_tile_w,
                    "height": current_tile_h
                })
                
                tile_seq += 1
    
    return tiles_metadata, original_width, original_height


def save_uploaded_file(file: UploadFile, output_path: str):
    """Save uploaded file to disk"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as buffer:
        file.file.seek(0)
        buffer.write(file.file.read())
