# Lumina Backend

A comprehensive AI-powered backend API for solar energy analysis and rooftop solar panel optimization. Lumina processes aerial and satellite imagery to automatically detect rooftops, estimate solar panel capacity, and provide predictive analytics for renewable energy planning.

## 🌟 Features

### Core Functionality
- **AI-Powered Rooftop Detection**: Advanced computer vision models (ResAttUNet, SegFormer) for automatic rooftop segmentation from aerial imagery
- **Smart Image Tiling**: Intelligent preprocessing for large images with configurable tile sizes
- **Solar Panel Optimization**: Bin-packing algorithms for optimal panel placement within detected rooftop polygons
- **Weather Integration**: Real-time weather data and solar irradiance forecasting
- **Multi-Model Support**: Support for multiple pre-trained segmentation models (INRIA, NACALA, WHU datasets)

### Technical Features
- **RESTful API**: FastAPI-based backend with automatic OpenAPI documentation
- **Authentication**: JWT-based user authentication and authorization
- **Database**: MongoDB with Motor async driver
- **File Management**: Secure file upload and static file serving
- **CORS Support**: Configured for frontend integration
- **Background Processing**: Asynchronous task handling for heavy computations

## 🛠 Tech Stack

- **Backend Framework**: FastAPI
- **Database**: MongoDB with Motor
- **Authentication**: JWT (JSON Web Tokens)
- **AI/ML**: PyTorch, OpenCV, Albumentations
- **Image Processing**: Pillow, OpenCV
- **Geospatial**: Shapely
- **HTTP Client**: HTTPX
- **Data Science**: Scikit-learn, Matplotlib
- **Development Server**: Uvicorn

## 📋 Prerequisites

- Python 3.8+
- MongoDB
- Git

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lumina_backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=lumina_db
   SECRET_KEY=your-secret-key-here
   ```

5. **Start MongoDB**
   Ensure MongoDB is running on your system.

6. **Run the application**
   ```bash
   uvicorn main:app --reload
   ```

The API will be available at `http://localhost:8000`

## 📖 Usage

### API Documentation
Once running, visit `http://localhost:8000/docs` for interactive API documentation powered by Swagger UI.

### Key Endpoints

#### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

#### Projects
- `GET /projects/` - List user projects
- `POST /projects/` - Create new project
- `POST /projects/{project_id}/upload` - Upload images to project
- `GET /projects/{project_id}/inference` - Get AI inference results

#### File Serving
- `GET /uploads/{file_path}` - Access uploaded files

## 🏗 Project Structure

```
lumina_backend/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── idea.md                 # Project concept and workflow
├── app/
│   ├── core/
│   │   ├── config.py       # Application settings
│   │   └── security.py     # JWT utilities
│   ├── db/
│   │   └── mongodb.py      # Database connection
│   ├── models/
│   │   ├── user.py         # User data models
│   │   └── project.py      # Project data models
│   ├── routers/
│   │   ├── auth.py         # Authentication endpoints
│   │   ├── projects.py     # Project management
│   │   └── user.py         # User management
│   ├── schemas/
│   │   ├── user.py         # Pydantic schemas for users
│   │   ├── project.py      # Pydantic schemas for projects
│   │   └── token.py        # JWT token schemas
│   ├── services/
│   │   ├── image_service.py      # Image processing
│   │   ├── inference_service.py  # AI model inference
│   │   ├── solar_service.py      # Solar calculations
│   │   ├── weather_service.py    # Weather data
│   │   ├── forecasting_service.py # Predictive analytics
│   │   └── project_service.py    # Project operations
│   └── utils/
│       ├── file_utils.py         # File operations
│       ├── polygons.py           # Geometric utilities
│       └── smart_retiling.py     # Image tiling logic
├── deep_learning_models/   # Pre-trained AI models
│   ├── resattunet_models/
│   └── segformer_models/
├── inference/              # Inference scripts
├── model_scripts/          # Model training utilities
├── panel_placement/        # Solar panel algorithms
├── centroids/              # Geographic centroids
└── user_data/              # Uploaded user files
```

## 🤖 AI Models

Lumina supports multiple state-of-the-art segmentation models:

- **ResAttUNet**: Residual Attention U-Net for precise rooftop detection
- **SegFormer**: Transformer-based segmentation for complex roof structures
- **YOLO-based Segmentation**: Real-time object detection integration

Models are pre-trained on datasets including:
- INRIA Aerial Image Dataset
- WHU Building Dataset
- NACALA Dataset
- AIRS Dataset

## 🔧 Configuration

Key configuration options in `app/core/config.py`:

- `PROJECT_NAME`: Application name
- `MONGO_URL`: MongoDB connection string
- `DB_NAME`: Database name
- `SECRET_KEY`: JWT signing key
- `UPLOAD_DIR`: File upload directory
- `PROFILE_PICS`: Default user avatars

## 🌦 Weather Integration

The system integrates with weather APIs to provide:
- Solar irradiance data
- Historical weather patterns
- Future yield predictions
- Location-based weather analysis

## 📊 Data Flow

1. **Image Upload**: Users upload aerial/satellite images
2. **Preprocessing**: Images are tiled if necessary for optimal AI processing
3. **AI Inference**: Deep learning models detect rooftop polygons
4. **Post-processing**: Masks and polygons are generated and stored
5. **Analysis**: Solar panel capacity calculations and placement optimization
6. **Visualization**: Results presented through interactive dashboard

## 🔒 Security

- JWT-based authentication
- Password hashing with bcrypt
- CORS configuration for frontend integration
- Secure file upload handling
- Input validation with Pydantic

## 🔄 Future Enhancements

- Real-time processing with WebSockets
- Integration with satellite APIs (Planet, Sentinel)
- Advanced 3D roof modeling
- Energy storage optimization
- Carbon footprint calculations
- Mobile app API support</content>
<parameter name="filePath">c:\Users\acer\Desktop\lumina\lumina_backend\README.md