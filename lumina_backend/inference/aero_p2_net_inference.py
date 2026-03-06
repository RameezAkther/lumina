import torch
import numpy as np
import cv2
import os
from pathlib import Path
from ultralytics import YOLO
import torch.nn.functional as F

# --- IMPORTS ---
# Assuming ModelSelector is available in your backend just like in ResAttUNet
from inference.best_model import ModelSelector 

# --- CONFIGURATION ---
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CENTROIDS_DIR = "centroids" 

YOLO_REGISTRY = {
    "inria": {
        "path": os.path.join(os.getcwd(), "deep_learning_models", "seg_yolo_models", "inria.pt"),
        "imgsz": 640,
        "conf": 0.25
    },
    "nacala": {
        "path": os.path.join(os.getcwd(), "deep_learning_models", "seg_yolo_models", "nacala.pt"),
        "imgsz": 1024,
        "conf": 0.25
    },
    "whu": {
        "path": os.path.join(os.getcwd(), "deep_learning_models", "seg_yolo_models", "whu.pt"),
        "imgsz": 1024,
        "conf": 0.3
    },
    # --- PLACEHOLDERS FOR FUTURE MODELS ---
    "placeholder_model_1": {
        "path": os.path.join(os.getcwd(), "deep_learning_models", "yolo_models", "placeholder_1.pt"),
        "imgsz": 1024, # Adjust as needed
        "conf": 0.25
    },
    "placeholder_model_2": {
        "path": os.path.join(os.getcwd(), "deep_learning_models", "yolo_models", "placeholder_2.pt"),
        "imgsz": 1024, # Adjust as needed
        "conf": 0.25
    }
}

# --- 2. INFERENCE UTILS ---

def load_yolo_model(checkpoint_path):
    print(f"Loading YOLO weights from {checkpoint_path}...")
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")
        
    model = YOLO(checkpoint_path)
    model.to(DEVICE)
    return model

# --- 3. STRATEGIES ---

def predict_yolo_mask(model, image, imgsz, conf):
    """
    Runs YOLO inference and combines all instance segmentation masks 
    into a single 2D binary semantic mask matching the original image dimensions.
    """
    original_h, original_w = image.shape[:2]
    
    # YOLO handles its own preprocessing/resizing internally via the imgsz argument
    results = model.predict(
        source=image,
        imgsz=imgsz,
        conf=conf,
        verbose=False
    )
    
    result = results[0]
    combined_mask = np.zeros((original_h, original_w), dtype=np.uint8)
    
    # If the model detects objects and has masks
    if result.masks is not None:
        # Get raw mask tensors (N, H, W)
        masks = result.masks.data 
        
        # Interpolate masks back to original image size
        masks = F.interpolate(
            masks.unsqueeze(1), 
            size=(original_h, original_w), 
            mode="bilinear", 
            align_corners=False
        ).squeeze(1)
        
        # Convert to boolean, then collapse all instance masks into one semantic mask
        masks = (masks > 0.5).cpu().numpy()
        combined_mask = np.any(masks, axis=0).astype(np.uint8) * 255
        
    return combined_mask

# --- 3.5 SMART POST-PROCESSING ---

def refine_mask_with_image(mask, image, poly_epsilon=0.003):
    """
    Uses the original image's texture/color (via GrabCut) to snap mask edges 
    to real object boundaries, then applies polygonal approximation to 
    produce sharp, straight lines (ideal for buildings).
    """
    # 1. Format correction
    if mask.max() <= 1.0:
        mask = (mask * 255).astype(np.uint8)
    else:
        mask = mask.astype(np.uint8)
        
    if image.dtype != np.uint8:
        image = image.astype(np.uint8)

    # 2. Create GrabCut Trimap (Foreground, Background, Unknown)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    sure_fg = cv2.erode(mask, kernel, iterations=2)
    sure_bg = cv2.dilate(mask, kernel, iterations=2)
    unknown = cv2.subtract(sure_bg, sure_fg)

    # GrabCut markers: 0=Bg, 1=Fg, 2=ProbBg, 3=ProbFg
    markers = np.ones(mask.shape, dtype=np.uint8) * cv2.GC_PR_BGD 
    markers[sure_fg == 255] = cv2.GC_FGD     
    markers[unknown == 255] = cv2.GC_PR_FGD  

    # 3. Run GrabCut
    bgdModel = np.zeros((1, 65), np.float64)
    fgdModel = np.zeros((1, 65), np.float64)
    
    try:
        cv2.grabCut(image, markers, None, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return mask

    refined_mask = np.where((markers == cv2.GC_FGD) | (markers == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    # 4. Polygonal Approximation (Sharpening Lines)
    final_canvas = np.zeros_like(refined_mask)
    contours, _ = cv2.findContours(refined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for cnt in contours:
        if cv2.contourArea(cnt) < 50:
            continue
            
        epsilon = poly_epsilon * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        cv2.drawContours(final_canvas, [approx], -1, 255, -1)

    return final_canvas

# --- 4. MAIN CONTROLLER ---

def run_yolo_inference(requested_mode, input_image_path, output_dir):
    """
    Backend controller for YOLO models.
    
    Args:
        requested_mode (str): 'YOLO' (Auto-select) OR a specific dataset key like 'whu'.
        input_image_path (str): Path to image.
        output_dir (str): Output folder.
    Returns:
        tuple: (final_mask (np.ndarray), selected_dataset (str))
    """
    
    # 1. Determine which Dataset Weights to use
    selected_dataset = None
    
    if requested_mode in ["YOLO", "Optimal Model", "auto"]:
        print(f"[{requested_mode}] Calculating centroid distance to find best weights...")
        selector = ModelSelector(CENTROIDS_DIR)
        selected_dataset = selector.find_best_dataset_match(input_image_path)
        
        if not selected_dataset or selected_dataset not in YOLO_REGISTRY:
            print("Auto-selection failed or model not in YOLO registry. Defaulting to 'whu'.")
            selected_dataset = "whu"
    else:
        selected_dataset = requested_mode.lower()

    # 2. Load Configuration
    if selected_dataset not in YOLO_REGISTRY:
        print(f"Weights for '{selected_dataset}' not found in registry. Using default (whu).")
        selected_dataset = "whu"
        
    config = YOLO_REGISTRY[selected_dataset]
    print(f"Running Inference using YOLO weights trained on: {selected_dataset.upper()}")

    # 3. Load Image & Model
    if not os.path.exists(input_image_path):
        raise FileNotFoundError(f"Image not found: {input_image_path}")
        
    # OpenCV loads in BGR. YOLO handles BGR internally, but GrabCut works better 
    # when visual boundaries align, so we keep standard BGR for the image.
    original_img = cv2.imread(input_image_path)
    
    model = load_yolo_model(config["path"])

    # 4. Predict (Extract combined binary mask)
    print("Performing YOLO inference...")
    raw_mask = predict_yolo_mask(model, original_img, config["imgsz"], config["conf"])

    # 5. Smart Post-Processing
    print("Applying smart refinement (GrabCut & Polygonal Sharpening)...")
    final_mask = refine_mask_with_image(raw_mask, original_img)

    # Note: Saving to output_dir can be handled here or passed back to the backend endpoint.
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        out_name = Path(input_image_path).stem + "_mask.png"
        cv2.imwrite(os.path.join(output_dir, out_name), final_mask)

    # return mask plus dataset key actually used
    return final_mask, selected_dataset