import axios from 'axios';

const api = axios.create({
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

export default api;