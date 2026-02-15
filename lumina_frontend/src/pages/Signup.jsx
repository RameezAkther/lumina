import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signupUser } from '../api/axios';

const Signup = () => {
  const [formData, setFormData] = useState({ 
    username: '', 
    email: '', 
    password: '', 
    confirmPassword: '' 
  });
  
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0); 
  const navigate = useNavigate();

  // Real-time password strength checker
  useEffect(() => {
    const pwd = formData.password;
    if (!pwd) {
      setPasswordStrength(0);
      return;
    }
    let score = 0;
    if (pwd.length > 7) score += 1; // Length > 7
    if (/[A-Z]/.test(pwd)) score += 1; // Uppercase
    if (/[0-9]/.test(pwd)) score += 1; // Number
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1; // Special Char

    setPasswordStrength(score);
  }, [formData.password]);

  const validate = () => {
    const newErrors = {};
    if (formData.username.length < 3) newErrors.username = "Username must be at least 3 characters";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    if (passwordStrength < 3) newErrors.password = "Password is too weak";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const { confirmPassword, ...submitData } = formData;
      await signupUser(submitData);
      alert('Account created! Please login.');
      navigate('/');
    } catch (err) {
      alert('Error creating account: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Helper to get color based on strength
  const getStrengthColor = () => {
    if (passwordStrength === 0) return 'bg-gray-200';
    if (passwordStrength < 2) return 'bg-red-500';
    if (passwordStrength < 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (formData.password.length === 0) return 'Enter password'; // Changed default text
    if (passwordStrength < 2) return 'Weak';
    if (passwordStrength < 3) return 'Medium';
    return 'Strong';
  };

  const getStrengthTextColor = () => {
    if (formData.password.length === 0) return 'text-gray-400';
    if (passwordStrength < 2) return 'text-red-500';
    if (passwordStrength < 3) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="h-screen flex overflow-hidden">
      
      {/* LEFT SIDE - Image */}
      <div className="hidden md:flex w-1/2 relative bg-lumina-900">
        <img 
          src="solar_panels_on_rooftops.jpg" 
          alt="Solar Panels" 
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="relative z-10 w-full flex flex-col justify-end p-12 text-white">
          <h2 className="text-4xl font-bold mb-4">Powering the Future</h2>
          <p className="text-lg text-lumina-100 max-w-md">
            Join the Lumina network to analyze rooftop potential and optimize renewable energy deployment.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE - Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-white px-8 h-full">
        <div className="w-full max-w-md">
          
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-lumina-900 mb-2">Create Account</h1>
            <p className="text-gray-500">Get started with your Lumina account.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                className={`w-full px-4 py-3 rounded-lg bg-gray-50 border ${errors.username ? 'border-red-500' : 'border-gray-200'} focus:border-lumina-500 focus:bg-white focus:ring-0 outline-none transition`}
                placeholder="Surya Vaazhga"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
              />
              {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-lumina-500 focus:bg-white focus:ring-0 outline-none transition"
                placeholder="suryavaazhga@something.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className={`w-full px-4 py-3 rounded-lg bg-gray-50 border ${errors.password ? 'border-red-500' : 'border-gray-200'} focus:border-lumina-500 focus:bg-white focus:ring-0 outline-none transition`}
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
              
              {/* Strength Meter - Always Visible */}
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">Strength</span>
                    <span className={`text-xs font-medium ${getStrengthTextColor()}`}>
                      {getStrengthText()}
                    </span>
                </div>
                {/* Gray background bar */}
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  {/* Colored progress bar */}
                  <div 
                    className={`h-full transition-all duration-300 ${getStrengthColor()}`} 
                    style={{ width: formData.password ? `${(passwordStrength / 4) * 100}%` : '0%' }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Must contain uppercase, number & special char.
                </p>
              </div>
              
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                className={`w-full px-4 py-3 rounded-lg bg-gray-50 border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-200'} focus:border-lumina-500 focus:bg-white focus:ring-0 outline-none transition`}
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              />
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3 px-4 bg-lumina-500 hover:bg-lumina-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lumina-500 mt-4"
            >
              Sign Up
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/" className="font-semibold text-lumina-600 hover:text-lumina-700 transition">
              Log in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;