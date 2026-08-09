"""
Face detection and embedding module using InsightFace.

Uses the buffalo_l model pack for high-accuracy face detection,
alignment, and ArcFace embedding (512-dimensional vectors).
"""

import numpy as np
import cv2
from insightface.app import FaceAnalysis

from .quality import compute_quality_score
from .schemas import FaceDetection, BoundingBox

# Global model instance (loaded once)
_face_app = None


def get_face_app() -> FaceAnalysis:
    """Get or initialize the InsightFace model."""
    global _face_app
    if _face_app is None:
        print("[INFO] Loading InsightFace model (buffalo_l)...")
        _face_app = FaceAnalysis(
            name='buffalo_l',
            providers=['CPUExecutionProvider'],
        )
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
        print("[INFO] InsightFace model loaded.")
    return _face_app


def detect_faces(image: np.ndarray) -> list[FaceDetection]:
    """
    Detect faces in an image and return embeddings + metadata.

    Args:
        image: BGR numpy array (OpenCV format)

    Returns:
        List of FaceDetection objects with embeddings, bounding boxes,
        quality scores, and confidence values.
    """
    app = get_face_app()
    faces = app.get(image)

    results = []
    for face in faces:
        # Compute quality score
        quality = compute_quality_score(face, image.shape)

        # Extract bounding box
        bbox = face.bbox.astype(int)
        bounding_box = BoundingBox(
            x=float(bbox[0]),
            y=float(bbox[1]),
            width=float(bbox[2] - bbox[0]),
            height=float(bbox[3] - bbox[1]),
        )

        # Extract embedding (512-dim from ArcFace)
        embedding = face.embedding.tolist()

        # Detection confidence
        confidence = float(face.det_score) if hasattr(face, 'det_score') else 0.0

        results.append(FaceDetection(
            bounding_box=bounding_box,
            embedding=embedding,
            quality_score=quality,
            confidence=confidence,
        ))

    return results
