import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// Import Auth Pages
import Login from './pages/Login';
import Signup from './pages/Signup';

// Import Dashboard Pages
import Home from './pages/Home';
import Projects from './pages/Projects';
import Profile from './pages/Profile';

// Import Sidebar Component
import Sidebar from './components/Sidebar';

import ProjectWorkspace from './pages/workspace/ProjectWorkspace';

// 1. Dashboard Layout Wrapper
// This component stays consistent while the <Outlet /> changes based on the URL
const DashboardLayout = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar is always visible */}
      <Sidebar />
      
      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* This is where Home, Projects, or Profile will render */}
          <Outlet />
        </div>
      </div>
    </div>
  );
};

// 2. Protected Route Wrapper
// Checks for authentication token before allowing access
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Dashboard Routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Default Page (renders at /dashboard) */}
          <Route index element={<Home />} />

          <Route path="projects" element={<Projects />} />
          
          {/* Nested Pages (render at /dashboard/projects, etc.) */}
          <Route path="projects/:id" element={<ProjectWorkspace />} /> 
          <Route path="profile" element={<Profile />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;