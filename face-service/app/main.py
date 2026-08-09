"""
SnapFind Face Service — FastAPI application.

Endpoints:
  POST /detect — Accept an image, return detected faces with embeddings
  GET  /health — Health check
"""

import time
import io

import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .detector import detect_faces, get_face_app
from .schemas import DetectionResponse, HealthResponse

app = FastAPI(
    title="SnapFind Face Service",
    description="Face detection and embedding service for SnapFind",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    """Pre-load the face model on startup."""
    try:
        get_face_app()
    except Exception as e:
        print(f"[WARNING] Model pre-loading failed: {e}")
        print("Model will be loaded on first request.")


@app.post("/detect", response_model=DetectionResponse)
async def detect(file: UploadFile = File(...)):
    """
    Detect faces in an uploaded image.

    Returns bounding boxes, 512-dim embeddings, quality scores,
    and detection confidence for each face found.
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    start_time = time.time()

    try:
        # Read image bytes
        contents = await file.read()

        # Decode image using PIL (handles more formats) then convert to OpenCV
        pil_image = Image.open(io.BytesIO(contents))
        pil_image = pil_image.convert("RGB")
        image = np.array(pil_image)
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not decode image: {str(e)}")

    # Detect faces
    faces = detect_faces(image)

    processing_time = (time.time() - start_time) * 1000  # ms

    return DetectionResponse(
        faces=faces,
        image_width=image.shape[1],
        image_height=image.shape[0],
        processing_time_ms=round(processing_time, 2),
    )


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    global _face_app
    from .detector import _face_app

    return HealthResponse(
        status="ok",
        model_loaded=_face_app is not None,
    )
