import torch
import numpy as np
import cv2
import os
import albumentations as A
from albumentations.pytorch import ToTensorV2
from pathlib import Path

# --- IMPORTS ---
from model_scripts.resattunet_model import ResAttUNet 
from inference.best_model import ModelSelector 

# --- CONFIGURATION ---
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CENTROIDS_DIR = "centroids" 

RESATTUNET_REGISTRY = {
    "ghandinagar": {
        "path": os.path.join(os.getcwd(), "deep_learning_models", "resattunet_models", "best_checkpoint_ghandhinagar_dataset.pth.tar"),
        "strategy": "resize",
        "input_size": 256
    },
    "nacala": {
        "path": os.path.join(os.getcwd(), "deep_learning_models", "resattunet_models", "best_checkpoint_nacala_dataset.pth.tar"),
        "strategy": "resize",
        "input_size": 256
    },
    "whu": {
        "path": os.path.join(os.getcwd(), "deep_learning_models", "resattunet_models", "best_checkpoint.pth_whu_dataset.tar"),
        "strategy": "resize",
        "input_size": 256
    },
    "airs": {
        "path": os.path.join(os.getcwd(), "deep_learning_models", "resattunet_models", "best_checkpoint.pth_airs_dataset.tar"),
        "strategy": "sliding",
        "patch_size": 512
    },
    "inria": {
        "path": os.path.join(os.getcwd(), "deep_learning_models", "resattunet_models", "best_checkpoint.pth_inria_dataset.tar"),
        "strategy": "sliding",
        "patch_size": 512
    }
}

# --- 2. INFERENCE UTILS ---

def load_model(checkpoint_path, in_channels=3, out_channels=1):
    print(f"Loading ResAttUNet weights from {checkpoint_path}...")
    model = ResAttUNet(in_channels=in_channels, out_channels=out_channels).to(DEVICE)
    
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")
        
    checkpoint = torch.load(checkpoint_path, map_location=DEVICE)
    if "state_dict" in checkpoint:
        model.load_state_dict(checkpoint["state_dict"])
    else:
        model.load_state_dict(checkpoint)
        
    model.eval()
    return model

# --- 3. STRATEGIES ---

def predict_resize(model, image, input_size):
    original_h, original_w = image.shape[:2]
    transform = A.Compose([
        A.Resize(height=input_size, width=input_size),
        A.Normalize(mean=[0.0, 0.0, 0.0], std=[1.0, 1.0, 1.0], max_pixel_value=255.0),
        ToTensorV2(),
    ])
    augmented = transform(image=image)
    img_tensor = augmented["image"].unsqueeze(0).to(DEVICE)
    
    with torch.no_grad():
        outputs = model(img_tensor)
        logits = outputs[0] if isinstance(outputs, (list, tuple)) else outputs
        probs = torch.sigmoid(logits)
        mask = (probs > 0.5).float()
        
    mask_np = mask.squeeze().cpu().numpy()
    mask_final = cv2.resize(mask_np, (original_w, original_h), interpolation=cv2.INTER_NEAREST)
    return mask_final

def predict_sliding_window(model, image, patch_size):
    h, w, _ = image.shape
    # Pad logic
    pad_h = (patch_size - h % patch_size) % patch_size
    pad_w = (patch_size - w % patch_size) % patch_size
    if pad_h == patch_size: pad_h = 0
    if pad_w == patch_size: pad_w = 0
    
    padded_img = np.pad(image, ((0, pad_h), (0, pad_w), (0, 0)), mode='constant', constant_values=0)
    new_h, new_w, _ = padded_img.shape
    full_mask = np.zeros((new_h, new_w), dtype=np.float32)
    
    transform = A.Compose([
        A.Normalize(mean=[0.0, 0.0, 0.0], std=[1.0, 1.0, 1.0], max_pixel_value=255.0),
        ToTensorV2(),
    ])
    
    with torch.no_grad():
        for y in range(0, new_h, patch_size):
            for x in range(0, new_w, patch_size):
                patch = padded_img[y:y+patch_size, x:x+patch_size]
                aug = transform(image=patch)
                patch_tensor = aug["image"].unsqueeze(0).to(DEVICE)
                
                outputs = model(patch_tensor)
                logits = outputs[0] if isinstance(outputs, (list, tuple)) else outputs
                probs = torch.sigmoid(logits)
                
                full_mask[y:y+patch_size, x:x+patch_size] = probs.squeeze().cpu().numpy()
                
    final_mask = full_mask[:h, :w]
    binary_mask = (final_mask > 0.5).astype(np.uint8)
    return binary_mask

# --- 3.5 SMART POST-PROCESSING ---

def refine_mask_with_image(mask, image, poly_epsilon=0.003, 
                           min_building_area_thresh=1500, 
                           max_acceptable_elongation=1.5):
    """
    Uses the original image's texture/color (via GrabCut) to snap mask edges 
    to real object boundaries, then applies polygonal approximation to 
    produce sharp, straight lines (ideal for buildings).
    
    Enhanced with noise removal targeting cars and artifacts:
    - Filters small contours by absolute area
    - Removes elongated small objects (likely cars)
    """
    # 1. Format correction
    if mask.max() <= 1.0:
        mask = (mask * 255).astype(np.uint8)
    else:
        mask = mask.astype(np.uint8)
        
    # Ensure image is uint8
    if image.dtype != np.uint8:
        image = image.astype(np.uint8)

    # 2. Create GrabCut Trimap (Foreground, Background, Unknown)
    # We define 'Unknown' as the band around the model's predicted edges.
    # The model is mostly right, so we trust the core, but doubt the edges.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    
    # Erode -> definitely foreground
    sure_fg = cv2.erode(mask, kernel, iterations=2)
    # Dilate -> definitely background (inverse)
    sure_bg = cv2.dilate(mask, kernel, iterations=2)
    # The area in between is "unknown" (the edge region)
    unknown = cv2.subtract(sure_bg, sure_fg)

    # GrabCut markers: 0=Bg, 1=Fg, 2=ProbBg, 3=ProbFg
    # Initialize with Probable Background (2)
    markers = np.ones(mask.shape, dtype=np.uint8) * cv2.GC_PR_BGD 
    
    markers[sure_fg == 255] = cv2.GC_FGD     # Sure Foreground (1)
    markers[unknown == 255] = cv2.GC_PR_FGD  # Probable Foreground (3) - let GrabCut decide
    # We actually don't set strict Background (0) to allow for error correction, 
    # relying on GC_PR_BGD everywhere else.

    # 3. Run GrabCut
    # This uses Gaussian Mixture Models on the image colors to separate fg/bg
    bgdModel = np.zeros((1, 65), np.float64)
    fgdModel = np.zeros((1, 65), np.float64)
    
    # Run 5 iterations of GrabCut
    try:
        cv2.grabCut(image, markers, None, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        # Fallback if GrabCut fails (e.g., tiny image)
        return mask

    # Create new mask where markers are Foreground (1) or Probable Foreground (3)
    refined_mask = np.where((markers == cv2.GC_FGD) | (markers == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    # 4. Polygonal Approximation with Enhanced Noise Filtering
    # GrabCut fixes the edge location, but it can still be pixelated/jagged.
    # We convert contours to geometric polygons while filtering out cars and artifacts.
    final_canvas = np.zeros_like(refined_mask)
    contours, _ = cv2.findContours(refined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        
        # 4a. Absolute Area Filter (extremely small speckle noise)
        if area < 30:
            continue
            
        # 4b. Geometric/Elongation Filter (Targeting Cars)
        # Cars are small and highly elongated (high Length/Width ratio).
        # We calculate the Minimum Enclosing Rectangle (rotated)
        rect = cv2.minAreaRect(cnt)  # Returns (center, (width, height), angle)
        (dim1, dim2) = rect[1]
        
        # Avoid division by zero
        if dim1 == 0 or dim2 == 0:
            continue
            
        width = min(dim1, dim2)
        length = max(dim1, dim2)
        aspect_ratio = length / width if width > 0 else 0

        # DEFINE NOISE: Small AND elongated (likely cars/vehicles)
        is_small = area < min_building_area_thresh
        is_elongated = aspect_ratio > max_acceptable_elongation
        
        if is_small and is_elongated:
            # Skip this contour - high probability it's a car or artifact
            continue

        # Proceed with Polygonal Sharpening for valid building contours
        # Epsilon determines how much deviation from the curve is allowed.
        # Higher number = straighter lines (more abstract).
        # Lower number = follows curves more closely.
        epsilon = poly_epsilon * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        
        cv2.drawContours(final_canvas, [approx], -1, 255, -1)

    return final_canvas

# --- 4. MAIN CONTROLLER ---

def run_resattunet_inference(requested_mode, input_image_path, output_dir):
    """
    Args:
        requested_mode (str): 'ResAttUNet' (Auto-select) OR a specific dataset key like 'whu'.
        input_image_path (str): Path to image.
        output_dir (str): Output folder.
    Returns:
        tuple: (final_mask: np.ndarray, selected_dataset: str)
    """
    
    # 1. Determine which Dataset Weights to use
    selected_dataset = None
    
    if requested_mode in ["ResAttUNet", "Optimal Model", "auto"]:
        print(f"[{requested_mode}] Calculating centroid distance to find best weights...")
        selector = ModelSelector(CENTROIDS_DIR)
        selected_dataset = selector.find_best_dataset_match(input_image_path)
        
        if not selected_dataset:
            print("Auto-selection failed. Defaulting to 'ghandinagar'.")
            selected_dataset = "ghandinagar"
    else:
        selected_dataset = requested_mode.lower()

    # 2. Load Configuration
    if selected_dataset not in RESATTUNET_REGISTRY:
        print(f"Weights for '{selected_dataset}' not found in registry. Using default.")
        selected_dataset = "ghandinagar"
        
    config = RESATTUNET_REGISTRY[selected_dataset]
    print(f"Running Inference using ResAttUNet weights trained on: {selected_dataset.upper()}")

    # 3. Load Image & Model
    if not os.path.exists(input_image_path):
        raise FileNotFoundError(f"Image not found: {input_image_path}")
    original_img = cv2.imread(input_image_path)
    original_rgb = cv2.cvtColor(original_img, cv2.COLOR_BGR2RGB)

    model = load_model(config["path"])

    # 4. Predict
    print("Performing inference...")
    if config["strategy"] == "resize":
        raw_mask = predict_resize(model, original_rgb, config["input_size"])
    elif config["strategy"] == "sliding":
        raw_mask = predict_sliding_window(model, original_rgb, config["patch_size"])
    else:
        raise ValueError(f"Unknown strategy: {config['strategy']}")

    # 5. Smart Post-Processing
    print("Applying smart refinement (GrabCut & Polygonal Sharpening)...")
    # Note: We pass original_img (BGR) to GrabCut as OpenCV expects BGR by default for some ops
    final_mask = refine_mask_with_image(raw_mask, original_img)

    # return both mask and which dataset was used for transparency
    return final_mask, selected_dataset