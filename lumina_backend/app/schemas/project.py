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
    location_config: Optional[dict] = {}
    historical_results: Optional[dict] = {}

class FileAnalysisResult(BaseModel):
    filename: str
    width: int
    height: int
    needs_tiling: bool
    recommended_sizes: List[int] = []

class AnalysisResponse(BaseModel):
    results: List[FileAnalysisResult]

class LocationParams(BaseModel):
    country: str
    state: str
    district: str
    area: Optional[str] = None
    panel_capacity_kw: Optional[float] = 0.4
    image_id: Optional[str] = None

class UserPolygonPayload(BaseModel):
    points: List[List[float]]

class UserPanelPayload(BaseModel):
    id: str
    x: int
    y: int
    w: int
    h: int

class ForecastParams(BaseModel):
    system_cost: Optional[float] = None
    electricity_rate: Optional[float] = None
    cost_per_panel: Optional[float] = None
    currency: Optional[str] = None
    image_id: Optional[str] = None
    is_initial_load: Optional[bool] = False
    target_currency_for_conversion: Optional[str] = None