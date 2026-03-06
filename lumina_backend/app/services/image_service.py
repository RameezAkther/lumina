"""
Image service - handles image creation, storage, and metadata management
"""
from typing import List
from PIL import Image
import os
import shutil
import uuid
from bson import ObjectId
from fastapi import HTTPException


def generate_unique_id() -> str:
    """Generate a short unique ID"""
    return uuid.uuid4().hex[:8]


async def insert_image_documents(db, image_docs: List[dict]):
    """Insert multiple image documents into database"""
    if image_docs:
        await db["images"].insert_many(image_docs)


async def get_project_images(db, project_id: str, include_metadata: bool = True):
    """Fetch all images for a project"""
    from app.db.mongodb import serialize_doc
    
    cursor = db["images"].find({"project_id": project_id})
    images = await cursor.to_list(length=None)
    
    results = []
    for img in images:
        clean_img = serialize_doc(img)
        clean_img["id"] = clean_img["_id"]
        
        # Use 'display_path' if available, otherwise fall back to 'path'
        path_to_serve = clean_img.get("display_path", clean_img["path"])
        
        rel_path = path_to_serve.split("user_data")[-1].replace("\\", "/")
        clean_img["url"] = f"http://localhost:8000/uploads{rel_path}"
        
        if clean_img.get("status") == "processed" and "polygons_path" in clean_img:
            poly_rel_path = clean_img["polygons_path"].split("user_data")[-1].replace("\\", "/")
            clean_img["polygons_url"] = f"http://localhost:8000/uploads{poly_rel_path}"
            
        if "solar_path" in clean_img:
            solar_rel_path = clean_img["solar_path"].split("user_data")[-1].replace("\\", "/")
            clean_img["solar_url"] = f"http://localhost:8000/uploads{solar_rel_path}"
            
        results.append(clean_img)
        
    return results


async def get_source_images(db, project_id: str):
    """Get all source (non-tiled) images for a project"""
    cursor = db["images"].find({
        "project_id": project_id,
        "$or": [{"is_source": True}, {"is_tiled": False}]
    })
    return await cursor.to_list(length=None)


async def update_image_status(db, image_id: str, **update_fields):
    """Update image fields in database"""
    await db["images"].update_one(
        {"_id": ObjectId(image_id)},
        {"$set": update_fields}
    )


async def update_image_selection(db, image_id: str, excluded_ids: List[int]):
    """Update excluded polygons for an image"""
    clean_ids = [int(x) if str(x).isdigit() else str(x) for x in excluded_ids]

    result = await db["images"].update_one(
        {"_id": ObjectId(image_id)},
        {"$set": {"excluded_polygons": clean_ids}}
    )
    
    return len(clean_ids)


async def find_child_tiles(db, project_id: str, parent_image_filename: str):
    """Find all tiled children of a source image"""
    cursor = db["images"].find({
        "project_id": project_id,
        "parent_image": parent_image_filename,
        "is_tiled": True
    })
    return await cursor.to_list(length=None)


async def get_processed_images(db, project_id: str, image_id: str = None):
    """Get processed images for analysis (includes both source and tiled images)"""
    query = {
        "project_id": project_id,
        "status": "processed"
    }
    
    if image_id:
        query["_id"] = ObjectId(image_id)
    
    cursor = db["images"].find(query)
    images = await cursor.to_list(length=None)
    
    if not images:
        raise HTTPException(status_code=400, detail="No processed masks found. Please run rooftop segmentation first.")
    
    return images


def save_image_file(file_path: str, content: bytes):
    """Save file to disk"""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as buffer:
        buffer.write(content)


def create_display_copy(original_path: str, display_path: str) -> tuple:
    """Create PNG display copy of image and return dimensions"""
    original_width = 0
    original_height = 0
    
    try:
        with Image.open(original_path) as img:
            original_width, original_height = img.size
            
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")
            img.save(display_path, format="PNG")
            
        return original_width, original_height, display_path
    except Exception as e:
        print(f"Failed to create display copy: {e}")
        return original_width, original_height, original_path
