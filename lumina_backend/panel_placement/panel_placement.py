import os
import json
import cv2
import numpy as np
import uuid # <-- NEW: For generating unique panel IDs
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt

# ==========================================
# 1. CONFIGURATION & METADATA
# ==========================================

DATASET_GSD = {
    "AIRS": 0.075,      # 7.5 cm/pixel
    "NACALA": 0.05,     # ~5 cm/pixel (High Res Drone)
    "INRIA": 0.30,      # 30 cm/pixel (Satellite)
    "WHU_AERIAL": 0.075,# 7.5 cm/pixel (Original)
    "WHU_RASTER": 0.30  # 30 cm/pixel (Downsampled version)
}

REAL_PANEL_DIMS = (1.7, 1.0) 
REAL_GAP_METER = 0.02  

# ==========================================
# 2. HELPER: DYNAMIC SCALING
# ==========================================
def get_pixel_dimensions(dataset_name, real_dims, real_gap):
    """Converts real-world meters to image pixels based on dataset GSD."""
    if dataset_name not in DATASET_GSD:
        raise ValueError(f"Dataset {dataset_name} not found. Available: {list(DATASET_GSD.keys())}")
    
    gsd = DATASET_GSD[dataset_name]
    
    length_px = round(real_dims[0] / gsd)
    width_px = round(real_dims[1] / gsd)
    gap_px = max(1, round(real_gap / gsd))
    
    print(f"\n[INFO] Dataset: {dataset_name} (GSD: {gsd} m/px)")
    print(f"[INFO] Real Panel: {real_dims[0]}m x {real_dims[1]}m")
    print(f"[INFO] Pixel Panel: {length_px}px x {width_px}px (Gap: {gap_px}px)")
    
    return (length_px, width_px), gap_px

def remove_excluded_polygons(mask, polygons_path, excluded_ids):
    """Blacks out excluded polygons from the placement mask."""
    if not polygons_path or not excluded_ids or not os.path.exists(polygons_path):
        return mask

    try:
        with open(polygons_path, 'r') as f:
            polygons_data = json.load(f)

        for poly in polygons_data:
            if poly.get("id") in excluded_ids:
                points = np.array(poly.get("points"), dtype=np.int32)
                cv2.fillPoly(mask, [points], 0) 
                
    except Exception as e:
        print(f"Error removing excluded polygons: {e}")

    return mask

# ==========================================
# 3. SEGMENTATION LOGIC
# ==========================================
def extract_placeable_area_multicolor(image_path, mask_path, k_clusters=5, min_brightness=40):
    img = cv2.imread(image_path)
    if img is None: 
        print(f"Error: Could not load image at {image_path}")
        return None, None, None
    
    # --- Gamma Correction ---
    gamma = 1.5 
    lookUpTable = np.empty((1,256), np.uint8)
    for i in range(256):
        lookUpTable[0,i] = np.clip(pow(i / 255.0, 1.0 / gamma) * 255.0, 0, 255)
    img_bright = cv2.LUT(img, lookUpTable)
    
    img_rgb = cv2.cvtColor(img_bright, cv2.COLOR_BGR2RGB)
    img_hsv = cv2.cvtColor(img_bright, cv2.COLOR_BGR2HSV)
    
    rooftop_mask = cv2.imread(mask_path, 0)
    if rooftop_mask is None: 
        print(f"Error: Could not load mask at {mask_path}")
        return None, None, None

    rooftop_mask_orig = rooftop_mask.copy()
    unique_vals = np.unique(rooftop_mask_orig)
    if unique_vals.size > 8:
        print(f"[ERROR] Provided mask at {mask_path} does not look like a binary rooftop mask. Aborting.")
        return None, None, None
        
    _, rooftop_mask = cv2.threshold(rooftop_mask, 127, 255, cv2.THRESH_BINARY)

    if cv2.countNonZero(rooftop_mask) == 0:
        print(f"[INFO] Mask at {mask_path} is completely empty. No rooftops detected.")
        return None, None, rooftop_mask

    # --- Texture Analysis ---
    gray = cv2.cvtColor(img_bright, cv2.COLOR_BGR2GRAY)
    v_median = np.median(gray)
    sigma = 0.33
    lower = int(max(0, (1.0 - sigma) * v_median))
    upper = int(min(255, (1.0 + sigma) * v_median))
    edges = cv2.Canny(gray, lower, upper)
    
    kernel = np.ones((3,3), np.uint8)
    dilated_edges = cv2.dilate(edges, kernel, iterations=2)
    smoothness_mask = cv2.bitwise_not(dilated_edges)
    smooth_roof = cv2.bitwise_and(smoothness_mask, smoothness_mask, mask=rooftop_mask)

    # --- Clustering ---
    valid_pixels = img_rgb[rooftop_mask > 0]
    if len(valid_pixels) == 0: return None, None, rooftop_mask

    kmeans = KMeans(n_clusters=k_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(valid_pixels)
    
    color_mask = np.zeros_like(rooftop_mask)
    coords = np.column_stack(np.where(rooftop_mask > 0))
    
    valid_hsv_pixels = img_hsv[rooftop_mask > 0]
    cluster_brightness = {}
    
    for i in range(k_clusters):
        cluster_mask = (labels == i)
        if np.sum(cluster_mask) == 0: continue
        pixels_in_cluster = valid_hsv_pixels[cluster_mask]
        avg_v = np.mean(pixels_in_cluster[:, 2]) 
        cluster_brightness[i] = avg_v

    valid_labels = [label for label, b in cluster_brightness.items() if b > min_brightness]
            
    for (r, c), label in zip(coords, labels):
        if label in valid_labels:
            color_mask[r, c] = 255

    # --- Clean Up ---
    combined_raw = cv2.bitwise_and(color_mask, smooth_roof)
    clean_mask = cv2.morphologyEx(combined_raw, cv2.MORPH_CLOSE, kernel, iterations=3)
    clean_mask = cv2.morphologyEx(clean_mask, cv2.MORPH_OPEN, kernel, iterations=2)
    clean_mask = (clean_mask > 0).astype(np.uint8) * 255
    clean_mask = cv2.bitwise_and(clean_mask, rooftop_mask)

    vis = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).copy()
    vis[clean_mask > 0] = [0, 255, 0]
    
    return clean_mask, vis, img

# ==========================================
# 4. PLACEMENT LOGIC
# ==========================================
def get_panel_slots(binary_mask, panel_w, panel_h, gap):
    contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    rooftop_slots = []
    
    step_y = panel_h + gap
    step_x = panel_w + gap

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w < panel_w or h < panel_h: continue
        
        current_roof = []
        for yy in range(y, y + h, step_y):
            for xx in range(x, x + w, step_x):
                yy2 = yy + panel_h
                xx2 = xx + panel_w
                if yy2 >= binary_mask.shape[0] or xx2 >= binary_mask.shape[1]: continue
                    
                roi = binary_mask[yy:yy2, xx:xx2]
                valid_pixels = cv2.countNonZero(roi)
                
                if valid_pixels > (0.90 * panel_w * panel_h):
                    current_roof.append((xx, yy, xx2, yy2))
        
        if current_roof:
            rooftop_slots.append(current_roof)
            
    return rooftop_slots

def draw_scattered_panels(img, rooftop_slots, panel_w, panel_h, limit=None):
    placement_vis = img.copy()
    selected_slots = []
    panels_data = [] # <--- NEW: Store coordinate data
    
    if limit is None:
        for roof in rooftop_slots: 
            selected_slots.extend(roof)
    else:
        roofs = [list(roof) for roof in rooftop_slots] 
        remaining = limit
        
        while remaining > 0 and any(roofs):
            for roof in roofs:
                if remaining <= 0: break
                if roof: 
                    selected_slots.append(roof.pop(0))
                    remaining -= 1
                    
    for (x, y, x2, y2) in selected_slots:
        # Draw on the PNG (Legacy / Backup)
        cv2.rectangle(placement_vis, (x, y), (x2, y2), (255, 0, 0), 1)
        if panel_w > 2 and panel_h > 2:
            cv2.rectangle(placement_vis, (x+1, y+1), (x2-1, y2-1), (100, 0, 0), -1)
        else:
            cv2.rectangle(placement_vis, (x, y), (x2, y2), (100, 0, 0), -1)

        # <--- NEW: Save the coordinates for the Frontend SVG
        panels_data.append({
            "id": f"sys_{uuid.uuid4().hex[:8]}", # Unique ID for React map key and deletion
            "x": int(x),
            "y": int(y),
            "w": int(x2 - x),
            "h": int(y2 - y)
        })
            
    return len(selected_slots), placement_vis, panels_data # <--- NEW: Return data array

# ==============================================================
# MAIN FUNCTION
# ==============================================================
def run_solar_placement(image_path, mask_path, gsd, panel_l, panel_w, gap_m, max_panels_limit=None, polygons_path=None, excluded_polygons=None, user_polygons=None):
    length_px = round(panel_l / gsd)
    width_px = round(panel_w / gsd)
    gap_px = max(1, round(gap_m / gsd))
    
    if length_px == 0 or width_px == 0: 
        return 0, None, [] # <--- Return empty array for early exit
    
    clean_mask, vis, img = extract_placeable_area_multicolor(image_path, mask_path)
    
    if clean_mask is None:
        if img is None: 
            img = cv2.imread(image_path)
        clean_mask = np.zeros(img.shape[:2], dtype=np.uint8)

    if excluded_polygons is None:
        excluded_polygons = []

    if user_polygons:
        for poly in user_polygons:
            poly_id = poly.get("id")
            points = np.array(poly.get("points"), dtype=np.int32)
            
            if poly_id in excluded_polygons:
                cv2.fillPoly(clean_mask, [points], 0)
            else:
                cv2.fillPoly(clean_mask, [points], 255)

    clean_mask = remove_excluded_polygons(clean_mask, polygons_path, excluded_polygons)

    binary_mask = (clean_mask > 0).astype(np.uint8)
    
    slots_portrait = get_panel_slots(binary_mask, width_px, length_px, gap_px)
    slots_landscape = get_panel_slots(binary_mask, length_px, width_px, gap_px)
    
    count_p = sum(len(r) for r in slots_portrait)
    count_l = sum(len(r) for r in slots_landscape)
    
    if count_p >= count_l:
        best_slots = slots_portrait
        pw, ph = width_px, length_px
    else:
        best_slots = slots_landscape
        pw, ph = length_px, width_px
        
    # <--- NEW: Unpack 3 variables now
    final_count, placement_vis, panels_data = draw_scattered_panels(img, best_slots, pw, ph, max_panels_limit)
    
    return final_count, placement_vis, panels_data