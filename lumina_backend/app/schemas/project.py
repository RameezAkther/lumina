# app/schemas/project.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ProjectCreateResponse(BaseModel):
    id: str
    name: str
    total_images: int
    tiled: bool
    message: str

class SolarParams(BaseModel):
    gsd: float = 0.075
    panel_length: float = 1.7
    panel_width: float = 1.0
    gap: float = 0.02
    max_panels: Optional[int] = None
    image_id: Optional[str] = None

class ImageMetadata(BaseModel):
    filename: str
    path: str
    is_tiled: bool
    parent_id: Optional[str] = None

class ProjectListResponse(BaseModel):
    id: str
    name: str
    created_at: datetime
    status: str
    total_images: Optional[int] = 0
    solar_config: Optional[dict] = {}

class FileAnalysisResult(BaseModel):
    filename: str
    width: int
    height: int
    needs_tiling: bool
    recommended_sizes: List[int] = []

class AnalysisResponse(BaseModel):
    results: List[FileAnalysisResult]