import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image
import os
import glob

# --- CONFIGURATION ---
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

class FeatureExtractor(nn.Module):
    def __init__(self):
        super().__init__()
        # Using ResNet18 as the standard feature extractor for similarity checks
        weights = models.ResNet18_Weights.DEFAULT
        base = models.resnet18(weights=weights)
        self.features = nn.Sequential(*list(base.children())[:-1])
        
    def forward(self, x):
        x = self.features(x)
        return x.flatten(start_dim=1)

class ModelSelector:
    def __init__(self, centroids_folder):
        self.device = DEVICE
        self.extractor = FeatureExtractor().to(self.device)
        self.extractor.eval()
        
        # Standard ImageNet transforms for feature extraction
        self.transform = transforms.Compose([
            transforms.Resize((256, 256)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        self.centroids = self._load_centroids(centroids_folder)

    def _load_centroids(self, folder):
        centroids = {}
        # Expected files: ghandinagar_centroid.pt, whu_centroid.pt, etc.
        files = glob.glob(os.path.join(folder, "*_centroid.pt"))
        
        if not files:
            print(f"[Warning] No centroid files found in {folder}.")
            return {}

        print(f"Loading {len(files)} centroids from {folder}...")
        
        for path in files:
            try:
                # Load data (handle CPU mapping if CUDA not available)
                data = torch.load(path, map_location=self.device)
                
                # Extract name: "centroids/whu_centroid.pt" -> "whu"
                basename = os.path.basename(path)
                dataset_name = basename.replace("_centroid.pt", "")

                # Extract Vector
                vec = None
                if isinstance(data, torch.Tensor):
                    vec = data
                elif isinstance(data, dict):
                    # Check values for tensor
                    for v in data.values():
                        if isinstance(v, torch.Tensor):
                            vec = v
                            break
                
                if vec is not None:
                    # Ensure [1, 512] shape and normalize
                    if vec.dim() == 1: vec = vec.unsqueeze(0)
                    vec = F.normalize(vec, p=2, dim=1)
                    centroids[dataset_name] = vec
                else:
                    print(f"  [Skip] No valid tensor found in {basename}")

            except Exception as e:
                print(f"  [Error] Failed to load {path}: {e}")
                
        return centroids

    def find_best_dataset_match(self, image_path):
        """
        Returns the name of the dataset (e.g., 'whu', 'airs') that best matches the input image.
        """
        if not self.centroids:
            print("No centroids loaded. Cannot perform selection.")
            return None

        try:
            img = Image.open(image_path).convert('RGB')
        except Exception as e:
            print(f"Error reading image for selection: {e}")
            return None

        # 1. Get Image Feature Vector
        img_t = self.transform(img).unsqueeze(0).to(self.device)
        with torch.no_grad():
            input_vec = self.extractor(img_t)
            input_vec = F.normalize(input_vec, p=2, dim=1)

        # 2. Compare with Centroids (Cosine Similarity)
        scores = {}
        for name, centroid in self.centroids.items():
            # Dot product of normalized vectors == Cosine Similarity
            score = torch.mm(input_vec, centroid.T).item()
            scores[name] = score

        # 3. Find Max Score
        best_match = max(scores, key=scores.get)
        print(f"Auto-Selection Result: {best_match} (Score: {scores[best_match]:.4f})")
        
        return best_match