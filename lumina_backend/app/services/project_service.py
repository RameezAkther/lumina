"""
Project service - handles project CRUD operations and status management
"""
from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException
from app.core.config import settings
from app.db.mongodb import serialize_doc
import os
import shutil


async def create_project_doc(db, user_id: str, project_name: str, tiling_config: dict):
    """Create a new project document in database"""
    project_doc = {
        "user_id": user_id,
        "name": project_name,
        "created_at": datetime.now(),
        "status": "processing",
        "config": tiling_config
    }
    new_project = await db["projects"].insert_one(project_doc)
    return str(new_project.inserted_id)


async def get_project_by_id(db, project_id: str, user_id: str = None):
    """Fetch project from database, optionally verify ownership"""
    if not ObjectId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid Project ID")
    
    query = {"_id": ObjectId(project_id)}
    if user_id:
        query["user_id"] = user_id
    
    project = await db["projects"].find_one(query)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def get_user_projects(db, user_id: str):
    """Fetch all projects for a user"""
    cursor = db["projects"].find({"user_id": user_id}).sort("created_at", -1)
    
    projects = []
    async for doc in cursor:
        count = await db["images"].count_documents({"project_id": str(doc["_id"])})
        
        projects.append({
            "id": str(doc["_id"]),
            "name": doc["name"],
            "created_at": doc["created_at"],
            "status": doc.get("status", "pending"),
            "total_images": count
        })
    
    return projects


async def update_project_status(db, project_id: str, status: str, **extra_fields):
    """Update project status and any additional fields"""
    update_data = {"status": status}
    update_data.update(extra_fields)
    
    await db["projects"].update_one(
        {"_id": ObjectId(project_id)},
        {"$set": update_data}
    )


async def delete_project(db, project_id: str, user_id: str, project_name: str):
    """Delete project and all associated files"""
    # 1. Delete from Filesystem
    safe_project_name = "".join([c for c in project_name if c.isalnum() or c in (' ', '_', '-')]).strip().replace(" ", "_")
    project_path = os.path.join(settings.UPLOAD_DIR, user_id, safe_project_name)
    
    if os.path.exists(project_path):
        try:
            shutil.rmtree(project_path)
        except Exception as e:
            print(f"Error deleting folder {project_path}: {e}")

    # 2. Delete from Database
    await db["images"].delete_many({"project_id": project_id})
    await db["projects"].delete_one({"_id": ObjectId(project_id)})


def get_project_paths(user_id: str, project_name: str):
    """Get standard project directory paths"""
    safe_project_name = "".join([c for c in project_name if c.isalnum() or c in (' ', '_', '-')]).strip().replace(" ", "_")
    
    project_root = os.path.join(settings.UPLOAD_DIR, user_id, safe_project_name)
    images_dir = os.path.join(project_root, "Images")
    masks_dir = os.path.join(project_root, "Masks")
    solar_dir = os.path.join(project_root, "Solar")
    
    return {
        "root": project_root,
        "images": images_dir,
        "masks": masks_dir,
        "solar": solar_dir
    }


def sanitize_project_name(project_name: str) -> str:
    """Sanitize project name for filesystem use"""
    return "".join([c for c in project_name if c.isalnum() or c in (' ', '_', '-')]).strip().replace(" ", "_")
