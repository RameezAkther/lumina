import cv2
import numpy as np
import json
import os

def generate_polygons_from_mask(mask_path, output_json_path):
    """
    Reads a binary mask image and saves contours as a JSON file.
    Returns the list of polygons.
    """
    # 1. Read Mask (Grayscale)
    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    if mask is None:
        return []

    # 2. Find Contours
    # RETR_EXTERNAL: We only care about the outer shape of the roof
    # CHAIN_APPROX_SIMPLE: Compresses horizontal, vertical, and diagonal segments
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    polygons = []
    for i, cnt in enumerate(contours):
        # 3. Simplify Contours (Optional but recommended for performance)
        # Reduces the number of points in the polygon while keeping the shape
        epsilon = 0.005 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)

        # 4. Filter small noise
        if cv2.contourArea(cnt) > 20: 
            # Flatten to list of [x, y] lists
            # OpenCv contours are [[[x,y]], [[x,y]]] -> squeeze to [[x,y], [x,y]]
            points = approx.squeeze().tolist()
            
            # Handle cases where shape is simple (e.g. triangle) or complex
            if isinstance(points, list) and len(points) >= 3:
                polygons.append({
                    "id": i,
                    "points": points 
                })
    
    # 5. Save to JSON
    with open(output_json_path, 'w') as f:
        json.dump(polygons, f)
    
    return polygons
