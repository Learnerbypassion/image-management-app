from pydantic import BaseModel
from typing import List, Optional


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class FaceDetection(BaseModel):
    bounding_box: BoundingBox
    embedding: List[float]
    quality_score: float
    confidence: float


class DetectionResponse(BaseModel):
    faces: List[FaceDetection]
    image_width: int
    image_height: int
    processing_time_ms: float


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
