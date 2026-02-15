import cv2
import numpy as np
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt


# ==========================================
# 1. CONFIGURATION & METADATA
# ==========================================

# Database of Ground Sampling Distances (GSD) in meters/pixel
DATASET_GSD = {
    "AIRS": 0.075,      # 7.5 cm/pixel
    "NACALA": 0.05,     # ~5 cm/pixel (High Res Drone)
    "INRIA": 0.30,      # 30 cm/pixel (Satellite)
    "WHU_AERIAL": 0.075,# 7.5 cm/pixel (Original)
    "WHU_RASTER": 0.30  # 30 cm/pixel (Downsampled version)
}

# Standard Residential Panel Dimensions (Real World Meters)
# Format: (Length_meters, Width_meters)
REAL_PANEL_DIMS = (1.7, 1.0) 

# Required Gap between panels (clamps/spacing) in meters
REAL_GAP_METER = 0.02  # 2 cm

# ==========================================
# 2. HELPER: DYNAMIC SCALING
# ==========================================
def get_pixel_dimensions(dataset_name, real_dims, real_gap):
    """
    Converts real-world meters to image pixels based on dataset GSD.
    """
    if dataset_name not in DATASET_GSD:
        raise ValueError(f"Dataset {dataset_name} not found. Available: {list(DATASET_GSD.keys())}")
    
    gsd = DATASET_GSD[dataset_name]
    
    # Calculate pixels (Meters / GSD)
    # We use ceil/round to ensure we don't underestimate space required
    length_px = round(real_dims[0] / gsd)
    width_px = round(real_dims[1] / gsd)
    gap_px = max(1, round(real_gap / gsd)) # Minimum 1 pixel gap for visualization
    
    print(f"\n[INFO] Dataset: {dataset_name} (GSD: {gsd} m/px)")
    print(f"[INFO] Real Panel: {real_dims[0]}m x {real_dims[1]}m")
    print(f"[INFO] Pixel Panel: {length_px}px x {width_px}px (Gap: {gap_px}px)")
    
    return (length_px, width_px), gap_px

# ==========================================
# 3. SEGMENTATION LOGIC (Your Existing Code)
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
        
    _, rooftop_mask = cv2.threshold(rooftop_mask, 127, 255, cv2.THRESH_BINARY)

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
    
    # Check brightness of each cluster
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
    
    vis = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).copy()
    vis[clean_mask > 0] = [0, 255, 0]
    
    return clean_mask, vis, img

# ==========================================
# 4. PLACEMENT LOGIC
# ==========================================
def place_panels(img, placeable_mask, panel_w, panel_h, gap):
    height, width = placeable_mask.shape
    placement_vis = img.copy()
    total_panels = 0
    
    step_y = panel_h + gap
    step_x = panel_w + gap
    
    for y in range(0, height, step_y):
        for x in range(0, width, step_x):
            y2 = y + panel_h
            x2 = x + panel_w
            
            if y2 >= height or x2 >= width: continue
            
            roi = placeable_mask[y:y2, x:x2]
            area_pixels = panel_w * panel_h
            valid_pixels = cv2.countNonZero(roi)
            
            # Tolerance: 90% of the panel area must be on valid roof
            if valid_pixels > (0.90 * area_pixels):
                total_panels += 1
                # Draw Panel (Blue)
                cv2.rectangle(placement_vis, (x, y), (x2, y2), (255, 0, 0), 1)
                # Draw Cell (Dark Blue)
                if panel_w > 2 and panel_h > 2: # Only draw inner detail if large enough
                    cv2.rectangle(placement_vis, (x+1, y+1), (x2-1, y2-1), (100, 0, 0), -1)
                else:
                    cv2.rectangle(placement_vis, (x, y), (x2, y2), (100, 0, 0), -1)

    return total_panels, placement_vis

def optimize_panel_placement(img, placeable_mask, dataset_name):
    """
    Wrapper that handles the dynamic sizing and orientation check.
    """
    # 1. Calculate Pixel Dimensions dynamically
    (p_len_px, p_wid_px), gap_px = get_pixel_dimensions(dataset_name, REAL_PANEL_DIMS, REAL_GAP_METER)
    
    if p_len_px == 0 or p_wid_px == 0:
        print("[WARNING] Image resolution is too low for this panel size. Panels would be 0 pixels.")
        return 0, img

    # 2. Try Portrait (L x W)
    count1, vis1 = place_panels(img, placeable_mask, p_wid_px, p_len_px, gap_px)
    
    # 3. Try Landscape (W x L)
    count2, vis2 = place_panels(img, placeable_mask, p_len_px, p_wid_px, gap_px)
    
    print(f"  Portrait count: {count1}")
    print(f"  Landscape count: {count2}")
    
    if count1 >= count2:
        return count1, vis1
    else:
        return count2, vis2

def run_solar_placement(image_path, mask_path, gsd, panel_l, panel_w, gap_m, max_panels_limit=None):
    """
    Runs the placement logic on a single image.
    max_panels_limit: If set (e.g. 50), stops placing after 50 panels.
    """
    
    # 1. Pixel Conversions
    length_px = round(panel_l / gsd)
    width_px = round(panel_w / gsd)
    gap_px = max(1, round(gap_m / gsd))
    
    if length_px == 0 or width_px == 0:
        return 0, None

    # 2. Extract Area
    clean_mask, vis, img = extract_placeable_area_multicolor(image_path, mask_path)
    if clean_mask is None:
        return 0, None

    # 3. Orientation Logic (Try both, pick best)
    # Portrait (W x L) vs Landscape (L x W) logic based on your script
    
    # Try Portrait (width as x, length as y)
    count1, vis1 = place_panels(img, clean_mask, width_px, length_px, gap_px)
    
    # Try Landscape
    count2, vis2 = place_panels(img, clean_mask, length_px, width_px, gap_px)
    
    best_vis = vis1 if count1 >= count2 else vis2
    total_potential = max(count1, count2)
    
    # 4. Handle User Limit (if they didn't want 'max')
    final_count = total_potential
    if max_panels_limit is not None and max_panels_limit < total_potential:
        final_count = max_panels_limit
        # Note: Ideally we'd re-run placement with a stop condition, 
        # but for visualization we might just return the text count difference here.
    
    return final_count, best_vis