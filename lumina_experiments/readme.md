# Lumina Experiments

## Overview

This repository contains experiments for rooftop segmentation using deep learning models on various aerial imagery datasets. The project focuses on developing and evaluating models for accurate roof detection and segmentation from satellite and aerial images, which is crucial for applications like solar panel placement, urban planning, and disaster management.

## Project Structure

```
lumina_experiments/
├── notebooks/
│   ├── dataset_eda/                 # Exploratory Data Analysis for datasets
│   │   ├── airs-dataset-eda.ipynb
│   │   ├── ghandinagar-dataset-eda.ipynb
│   │   ├── inria-rooftop-dataset-eda.ipynb
│   │   ├── nakala-dataset-eda.ipynb
│   │   └── whu-dataset-eda.ipynb
│   ├── model_training/              # Model training notebooks
│   │   ├── aero-p2-net/             # Aero-P2 Net experiments
│   │   └── resatt-unet/             # ResAtt-UNet experiments
│   │       ├── enhanced-unet-for-rooftop-segmentation-1.ipynb
│   │       ├── enhanced-unet-for-rooftop-segmentation-2.ipynb
│   │       ├── enhanced-unet-for-rooftop-segmentation-3.ipynb
│   │       ├── enhanced-unet-for-rooftop-segmentation-4.ipynb
│   │       └── enhanced-unet-for-rooftop-segmentation-5.ipynb
│   ├── centroid_distance_computation.ipynb
│   ├── forecasting.ipynb
│   ├── historical_estimation.ipynb
│   ├── intermediate_steps_of_postprocessing.ipynb
│   ├── panel_placement.ipynb
│   └── usable_area.ipynb
└── README.md
```

## Datasets

The experiments utilize the following aerial imagery datasets for rooftop segmentation:

1. **AIRS Dataset** - Aerial Imagery for Roof Segmentation
2. **Ghandinagar Dataset** - Satellite images from Ghandinagar region
3. **INRIA Dataset** - Aerial images from various cities in France
4. **Nakala Dataset** - African city rooftop data
5. **WHU Dataset** - Wuhan University building dataset

Each dataset includes aerial/satellite images and corresponding ground truth masks for roof segmentation.

## Models

Two main deep learning architectures are explored:

### ResAtt-UNet
An enhanced U-Net architecture incorporating:
- Residual blocks for better gradient flow
- Attention gates for focusing on relevant features
- Batch normalization for stable training

### Aero-P2 Net
A specialized network for aerial image segmentation (details to be added).

## Trained Models

The trained models are available as Kaggle notebook outputs:

### ResAtt-UNet Models
1. **Nakala Dataset** - [Enhanced U-Net for Rooftop Segmentation](https://www.kaggle.com/code/rameezakther/enhanced-unet-for-rooftop-segmentation-2)
2. **Ghandinagar Dataset** - [Enhanced U-Net for Rooftop Segmentation](https://www.kaggle.com/code/rameezakther/enhanced-unet-for-rooftop-segmentation-1)
3. **WHU Dataset** - [Enhanced U-Net for Rooftop Segmentation](https://www.kaggle.com/code/rameezakther314/enhanced-unet-for-rooftop-segmentation-3)
4. **INRIA Dataset** - [Enhanced U-Net for Rooftop Segmentation](https://www.kaggle.com/code/lavanyajothivel/enhanced-unet-for-rooftop-segmentation-5)
5. **AIRS Dataset** - [Enhanced U-Net for Rooftop Segmentation](https://www.kaggle.com/code/suryaks27/enhanced-unet-for-rooftop-segmentation-4)

### Aero-P2 Net Models
1. **Nakala Dataset** - <placeholder>
2. **Ghandinagar Dataset** - <placeholder>
3. **WHU Dataset** - <placeholder>
4. **INRIA Dataset** - <placeholder>
5. **AIRS Dataset** - <placeholder>

## Getting Started

### Prerequisites

- Python 3.7+
- Jupyter Notebook or JupyterLab
- PyTorch 1.7+
- Rasterio
- Pandas
- NumPy
- Matplotlib

### Installation

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd lumina_experiments
   ```

2. Install required packages:
   ```bash
   pip install torch torchvision rasterio pandas numpy matplotlib jupyter
   ```

### Running the Notebooks

1. Launch Jupyter:
   ```bash
   jupyter notebook
   ```

2. Navigate to the desired notebook in the `notebooks/` directory.

3. For dataset EDA, start with the respective dataset notebook in `dataset_eda/`.

4. For model training, use the notebooks in `model_training/`.

## Additional Notebooks

- **centroid_distance_computation.ipynb**: Computes distances between roof centroids.
- **forecasting.ipynb**: Forecasting related to rooftop analysis.
- **historical_estimation.ipynb**: Historical data estimation.
- **intermediate_steps_of_postprocessing.ipynb**: Post-processing steps for segmentation results.
- **panel_placement.ipynb**: Solar panel placement optimization.
- **usable_area.ipynb**: Calculation of usable roof areas.

## Acknowledgments

- Dataset providers for making aerial imagery data available.
- Kaggle community for computational resources and platform.