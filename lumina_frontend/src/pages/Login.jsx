import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/axios';

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await loginUser(formData.username, formData.password);
      // Store token
      localStorage.setItem('token', response.data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex">
      
      {/* Left Side - Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-white px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-lumina-900 tracking-tight">Lumina</h1>
            <p className="mt-2 text-gray-500">Log in to access your solar analytics</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && <div className="text-red-500 text-sm text-center">{error}</div>}
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Username"
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-lumina-500 focus:border-transparent outline-none transition"
                onChange={(e) => setFormData({...formData, username: e.target.value})}
              />
              <input
                type="password"
                placeholder="Password"
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-lumina-500 focus:border-transparent outline-none transition"
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-lumina-600 to-lumina-500 hover:from-lumina-700 hover:to-lumina-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lumina-500 transform transition hover:-translate-y-0.5"
            >
              Sign In
            </button>

            <div className="text-center text-sm">
              <span className="text-gray-500">Don't have an account? </span>
              <Link to="/signup" className="font-medium text-lumina-600 hover:text-lumina-500">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Right Side - Visuals (UPDATED) */}
      <div className="hidden md:flex w-1/2 relative bg-lumina-900">
        
        {/* Background Image */}
        <img 
          src="solar_panels_on_rooftops_1.jpg" 
          alt="Rooftop Solar Panels" 
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Dark Overlay (Gradient) - Ensures text is readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-lumina-900/90 via-lumina-900/50 to-lumina-900/30 mix-blend-multiply"></div>
        
        {/* Text Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white px-12 text-center w-full">
          <h2 className="text-4xl font-bold mb-6 drop-shadow-md">Intelligent Rooftop Segmentation</h2>
          <p className="text-lumina-50 text-lg max-w-lg drop-shadow-sm">
            Geospatial Analysis of Photovoltaic Deployment for Renewable Energy Prediction
          </p>
        </div>
      </div>

    </div>
  );
};

export default Login;