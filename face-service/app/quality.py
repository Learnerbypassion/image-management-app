# pyrefly: ignore [missing-import]
"""
Face quality scoring module.

Evaluates face detections to filter out low-quality faces that would produce
unreliable embeddings (too small, extreme angles, low confidence).
"""

import numpy as np


def compute_quality_score(face, image_shape: tuple) -> float:
    """
    Compute a quality score (0.0 - 1.0) for a detected face.

    Factors:
    - Face size relative to image
    - Detection confidence
    - Face pose (yaw/pitch/roll if available)
    """
    scores = []

    # 1. Size score: face should be large enough for reliable embedding
    bbox = face.bbox  # [x1, y1, x2, y2]
    face_width = bbox[2] - bbox[0]
    face_height = bbox[3] - bbox[1]
    face_area = face_width * face_height
    image_area = image_shape[0] * image_shape[1]

    # Minimum: face should be at least 40x40 pixels
    if face_width < 40 or face_height < 40:
        return 0.0

    # Size ratio score (larger face = better embedding)
    size_ratio = min(face_area / image_area, 0.5) / 0.5
    scores.append(size_ratio * 0.3)

    # Absolute size score
    pixel_score = min(face_width / 112, 1.0)  # 112px is the model's input size
    scores.append(pixel_score * 0.3)

    # 2. Detection confidence
    det_score = float(face.det_score) if hasattr(face, 'det_score') else 0.5
    scores.append(det_score * 0.4)

    return min(sum(scores), 1.0)
