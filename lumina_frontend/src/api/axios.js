import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:8000',
});

// Helper for Login
export const loginUser = async (username, password) => {
  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);
  return api.post('/auth/login', params);
};

// Helper for Signup
export const signupUser = async (userData) => {
  return api.post('/auth/signup', userData);
};

// --- NEW: Helper for Project Creation (File Upload) ---
export const createProject = async (projectData) => {
  // projectData must be a FormData object
  return api.post('/projects/create', projectData, {
    headers: {
      'Content-Type': 'multipart/form-data', // Crucial for file uploads
    },
  });
};

export const analyzeFiles = async (files) => {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  
  return api.post('/projects/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// Automatically add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const deleteProject = async (projectId) => {
  return api.delete(`/projects/${projectId}`);
};

export const getProjects = async () => {
  return api.get('/projects/');
};

export const getProjectImages = async (projectId) => {
  return api.get(`/projects/${projectId}/images`);
};

export const performInference = async (projectId, modelName) => {
  return api.post(`/projects/${projectId}/inference`, { model_name: modelName });
};

export const updateImageSelection = async (imageId, excludedIds) => {
  return api.post(`/projects/images/${imageId}/update_selection`, { 
    excluded_ids: Array.from(excludedIds) // Convert Set to Array
  });
};

export const getProjectDetails = async (projectId) => {
  return api.get(`/projects/${projectId}`);
};

// Add or update this function in your api/axios.js
export const saveUserPolygon = async (imageId, points) => {
  // Assuming your axios instance is named 'api' or you use 'axios' directly
  // Make sure the URL matches your router prefix (e.g., /api/projects/images/...)
  const response = await api.post(`/projects/images/${imageId}/user_polygons`, {
    points: points
  });

  // Return the full Axios response so callers can read `response.data` safely
  return response;
};

// In api/axios.js
export const deleteUserPolygon = async (imageId, polyId) => {
  // Call backend to delete the polygon and return the response data
  const response = await api.delete(`/projects/images/${imageId}/user_polygons/${polyId}`);
  return response.data;
};

// --- IN api/axios.js ---

// Add a single custom panel
export const addUserPanel = async (imageId, panelData) => {
  // Replace `api` with whatever your configured axios instance is named
  const response = await api.post(`/projects/images/${imageId}/panels`, panelData);
  return response.data;
};

// Delete a specific custom panel
export const deleteUserPanel = async (imageId, panelId) => {
  const response = await api.delete(`/projects/images/${imageId}/panels/${panelId}`);
  return response.data;
};

// Clear all panels from an image
export const clearAllUserPanels = async (imageId) => {
  const response = await api.delete(`/projects/images/${imageId}/panels`);
  return response.data;
};

export default api;