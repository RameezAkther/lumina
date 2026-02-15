import os
import cv2
import json
import numpy as np
from shapely.geometry import Polygon, box

async def apply_smart_retiling(
    db, 
    project_id, 
    parent_img_doc, 
    full_mask_path, 
    base_tile_size, 
    images_dir, 
    masks_dir
):
    # 1. Load Source Data
    parent_filename = parent_img_doc["filename"]
    original_path = parent_img_doc["path"]
    
    img = cv2.imread(original_path)
    mask = cv2.imread(full_mask_path, cv2.IMREAD_GRAYSCALE)
    
    h, w = img.shape[:2]
    base_name = os.path.splitext(parent_filename)[0]

    # 2. Analyze Buildings (Contours & Centroids)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    buildings = []
    for i, cnt in enumerate(contours):
        if cv2.contourArea(cnt) < 50: continue 
        
        pts = cnt.squeeze().tolist()
        if len(pts) < 3: continue
        
        poly = Polygon(pts)
        buildings.append({
            "id": i,
            "poly": poly,
            "centroid": poly.centroid,
            "contour": cnt,
            "bounds": poly.bounds 
        })

    new_image_docs = []
    tile_seq = 0

    # 3. Iterate Logical Grid
    for y in range(0, h, base_tile_size):
        for x in range(0, w, base_tile_size):
            
            grid_box = box(x, y, x + base_tile_size, y + base_tile_size)
            
            owned_buildings = []
            intruder_buildings = []
            
            # A. Ownership Check
            for b in buildings:
                if b["poly"].intersects(grid_box):
                    if grid_box.contains(b["centroid"]):
                        owned_buildings.append(b)
                    else:
                        intruder_buildings.append(b)
            
            # B. Dynamic Crop Coordinates
            crop_x1, crop_y1 = x, y
            crop_x2 = min(x + base_tile_size, w)
            crop_y2 = min(y + base_tile_size, h)
            
            # Expand to fit OWNED buildings
            for b in owned_buildings:
                minx, miny, maxx, maxy = b["bounds"]
                crop_x1 = min(crop_x1, int(minx))
                crop_y1 = min(crop_y1, int(miny))
                crop_x2 = max(crop_x2, int(maxx))
                crop_y2 = max(crop_y2, int(maxy))
            
            crop_x1, crop_y1 = max(0, crop_x1), max(0, crop_y1)
            crop_x2, crop_y2 = min(w, crop_x2), min(h, crop_y2)
            
            # C. Crop & Clean
            tile_img = img[crop_y1:crop_y2, crop_x1:crop_x2].copy()
            tile_mask = mask[crop_y1:crop_y2, crop_x1:crop_x2].copy()
            
            offset = np.array([crop_x1, crop_y1])
            
            # Remove Intruders (Paint Black)
            for b in intruder_buildings:
                local_cnt = b["contour"] - offset
                cv2.drawContours(tile_img, [local_cnt], -1, (0,0,0), thickness=cv2.FILLED)
                cv2.drawContours(tile_mask, [local_cnt], -1, 0, thickness=cv2.FILLED)

            # --- D. Generate JSON Polygons for Frontend ---
            tile_polygons_data = []
            for b in owned_buildings:
                # Convert global coords to local tile coords
                # Shapely coords: [(x,y), (x,y)...]
                # Frontend expects: [[x,y], [x,y]...]
                local_points = []
                for gx, gy in b["poly"].exterior.coords:
                    local_points.append([gx - crop_x1, gy - crop_y1])
                
                tile_polygons_data.append({
                    "id": b["id"],
                    "points": local_points # <--- This is what React draws
                })

            # E. Save Files
            tile_filename = f"{base_name}_smart_{tile_seq}.png"
            mask_filename = f"{base_name}_smart_{tile_seq}_mask.png"
            poly_filename = f"{base_name}_smart_{tile_seq}_polygons.json"
            
            tile_path = os.path.join(images_dir, tile_filename)
            mask_path = os.path.join(masks_dir, mask_filename)
            poly_path = os.path.join(masks_dir, poly_filename)
            
            cv2.imwrite(tile_path, tile_img)
            cv2.imwrite(mask_path, tile_mask)
            
            with open(poly_path, 'w') as f:
                json.dump(tile_polygons_data, f)
            
            # F. Prepare DB Entry
            new_image_docs.append({
                "project_id": project_id,
                "filename": tile_filename,
                "path": tile_path,
                "display_path": tile_path, 
                "mask_path": mask_path,
                "polygons_path": poly_path, # <--- Now this exists!
                "is_tiled": True,
                "tile_index": tile_seq,
                "parent_image": parent_filename,
                "processed": True,
                "status": "processed",
                "width": int(tile_img.shape[1]),
                "height": int(tile_img.shape[0]),
                "crop_offset_x": crop_x1, 
                "crop_offset_y": crop_y1
            })
            
            tile_seq += 1

    # 4. Database Operations
    await db["images"].delete_many({
        "project_id": project_id,
        "parent_image": parent_filename,
        "is_tiled": True
    })
    
    if new_image_docs:
        await db["images"].insert_many(new_image_docs)
        
    return len(new_image_docs)