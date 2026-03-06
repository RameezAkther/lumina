# Lumina - AI-Powered Solar Energy Analysis Platform

Lumina is an end-to-end AI-powered platform for solar energy analysis and rooftop solar panel optimization. It combines advanced computer vision, machine learning, and geospatial analysis to automatically detect rooftops from aerial/satellite imagery, estimate solar panel capacity, and provide predictive analytics for renewable energy planning.

## 📋 Project Overview

Lumina processes aerial and satellite imagery to:
- **Detect rooftops** using advanced segmentation models (ResAttUNet, SegFormer, YOLO)
- **Estimate solar panel capacity** using bin-packing algorithms for optimal panel placement
- **Analyze weather patterns** and solar irradiance for predictive analytics
- **Provide actionable insights** through an intuitive web interface

### Key Features

✨ **AI-Powered Rooftop Detection** - Advanced computer vision for automatic rooftop segmentation  
📊 **Smart Image Tiling** - Intelligent preprocessing for large satellite/aerial images  
☀️ **Solar Panel Optimization** - Bin-packing algorithms for optimal panel placement  
🌤️ **Weather Integration** - Real-time weather data and solar irradiance forecasting  
🔐 **Secure Authentication** - JWT-based user authentication and authorization  
🚀 **RESTful API** - FastAPI backend with automatic OpenAPI documentation  
💾 **MongoDB Database** - Async data persistence with Motor driver  
🎨 **Modern UI** - React + Tailwind CSS frontend with interactive workspace

## 🏗️ Project Structure

```
lumina/
├── lumina_backend/          # Python FastAPI backend
│   ├── app/                 # Main application code
│   │   ├── core/           # Configuration and security
│   │   ├── db/             # Database connections
│   │   ├── models/         # Database models
│   │   ├── routers/        # API endpoints
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic services
│   │   └── utils/          # Utility functions
│   ├── inference/          # ML inference modules
│   ├── deep_learning_models/ # Pre-trained models
│   ├── centroids/          # Model centroids
│   ├── panel_placement/    # Panel optimization
│   ├── model_scripts/      # Model training scripts
│   ├── main.py             # Application entry point
│   └── requirements.txt    # Python dependencies
│
├── lumina_frontend/         # React + Vite frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── api/            # API integration
│   │   ├── assets/         # Static assets
│   │   └── App.jsx         # Main app component
│   ├── package.json        # Node dependencies
│   └── tailwind.config.js  # Tailwind configuration
│
└── README.md              # This file
```

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI
- **Database**: MongoDB with Motor (async driver)
- **Authentication**: JWT (JSON Web Tokens)
- **ML/AI**: PyTorch, OpenCV, Albumentations
- **Image Processing**: Pillow, OpenCV
- **Geospatial**: Shapely
- **Server**: Uvicorn

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Icons**: Lucide React

## 🚀 Quick Start

### Prerequisites

- Python 3.8+ (Backend)
- Node.js 18+ (Frontend)
- MongoDB
- Git

### Backend Setup

```bash
cd lumina_backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```

The backend API will be available at `http://localhost:8000`
OpenAPI documentation: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd lumina_frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 📚 API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for interactive API documentation.

### Main Endpoints

- **Authentication**: `/api/auth/` - Login, register, token management
- **Projects**: `/api/projects/` - Create, read, update, delete projects
- **Users**: `/api/users/` - User profile management
- **Inference**: `/api/inference/` - Image processing and ML inference

## 🔑 Key Modules

### Backend Services

- **authentication_service** - JWT token management and user verification
- **project_service** - Project lifecycle management
- **image_service** - Image upload and processing
- **inference_service** - ML model inference pipeline
- **forecasting_service** - Solar energy predictions
- **weather_service** - Weather data integration
- **solar_service** - Solar calculations and optimization

### Frontend Pages

- **Login** - User authentication
- **Signup** - Account creation
- **Projects** - Project listing and management
- **ProjectWorkspace** - Main analysis interface
  - ImageViewer - Satellite imagery display
  - ImageCanvas - Annotation and visualization
  - CapacityEstimator - Power generation estimation
  - HistoricalAnalysis - Historical data analysis
  - FuturePrediction - Predictive analytics

## 🔧 Configuration

### Backend Environment Variables

Create a `.env` file in `lumina_backend/`:

```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=lumina
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Frontend Configuration

Update the API base URL in [src/api/axios.js](lumina_frontend/src/api/axios.js):

```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
```

## 📊 Workflow

1. **Project Creation** - User creates a new project and uploads aerial/satellite images
2. **Image Preprocessing** - Images are analyzed and tiled if necessary
3. **ML Inference** - Rooftop segmentation using pre-trained models
4. **Analysis** - Solar potential estimation and optimal panel placement
5. **Reporting** - Generate reports with predictions and recommendations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For issues, questions, or suggestions, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ for renewable energy innovation**
