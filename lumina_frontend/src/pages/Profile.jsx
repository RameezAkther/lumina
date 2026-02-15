import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { User, Lock, Trash2, AlertTriangle, CheckCircle, X } from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password Modal State
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [pwdData, setPwdData] = useState({ 
    current_password: '', 
    new_password: '', 
    confirm_password: '' 
  });
  const [pwdError, setPwdError] = useState('');
  
  // Delete Account State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  // 1. Fetch Profile Data on Mount
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (err) {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Password Change
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdError('');

    if (pwdData.new_password !== pwdData.confirm_password) {
      setPwdError("New passwords do not match.");
      return;
    }

    try {
      await api.put('/auth/me/password', {
        current_password: pwdData.current_password,
        new_password: pwdData.new_password
      });
      setSuccess('Password updated successfully.');
      setIsPwdModalOpen(false); // Close modal
      setPwdData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPwdError(err.response?.data?.detail || 'Failed to update password.');
    }
  };

  // 3. Handle Account Deletion
  const handleDeleteAccount = async () => {
    try {
      await api.delete('/auth/me', {
        data: { password: deletePassword }
      });
      localStorage.removeItem('token');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete account. Wrong password?');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading profile...</div>;

  return (
    <div className="w-full max-w-5xl mx-auto pb-12">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Profile Settings</h1>

      {/* Global Notifications */}
      {error && (
        <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 border border-red-100">
          <AlertTriangle size={18} /> {error}
        </div>
      )}
      {success && (
        <div className="mb-6 bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2 border border-green-100">
          <CheckCircle size={18} /> {success}
        </div>
      )}
      
      {/* 1. VIEW PROFILE INFO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-8 border-b border-gray-100 flex items-center gap-8">
           <div className="w-24 h-24 bg-lumina-100 rounded-full flex items-center justify-center text-lumina-600 font-bold text-4xl overflow-hidden shadow-inner">
              {user?.profil_pic ? (
                 <img src={user.profil_pic} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                 "U"
              )}
           </div>
           <div>
             <h2 className="text-3xl font-bold text-gray-900">{user?.username}</h2>
             <p className="text-gray-500 text-lg">{user?.email}</p>
             <span className="inline-block mt-3 px-4 py-1 bg-lumina-100 text-lumina-700 text-sm font-medium rounded-full">
               Standard User
             </span>
           </div>
        </div>
        
        {/* Read-only Info */}
        <div className="p-8 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
              <div className="w-full px-5 py-3 border border-gray-200 rounded-lg bg-white text-gray-600 shadow-sm">
                {user?.username}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <div className="w-full px-5 py-3 border border-gray-200 rounded-lg bg-white text-gray-600 shadow-sm">
                {user?.email}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SECURITY & ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Change Password Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Lock size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Password & Security</h3>
            </div>
            <p className="text-gray-500 mb-6">
              Update your password regularly to keep your account secure.
            </p>
          </div>
          <button 
            onClick={() => setIsPwdModalOpen(true)}
            className="w-full bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition font-medium shadow-sm"
          >
            Change Password
          </button>
        </div>

        {/* Delete Account Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-50 rounded-lg text-red-600">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Delete Account</h3>
            </div>
            <p className="text-gray-500 mb-6">
              Permanently remove your account and all associated data.
            </p>
          </div>
          
          {!showDeleteConfirm ? (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full bg-red-50 text-red-600 border border-red-100 px-4 py-3 rounded-lg hover:bg-red-100 transition font-medium"
            >
              Delete Account
            </button>
          ) : (
            <div className="bg-red-50 p-4 rounded-lg border border-red-100 animate-in fade-in">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verify password to delete:
              </label>
              <div className="flex gap-2">
                <input 
                  type="password" 
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  placeholder="Password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
                <button 
                  onClick={handleDeleteAccount}
                  className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  Confirm
                </button>
                <button 
                  onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                  className="text-gray-500 hover:text-gray-700 px-2"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- PASSWORD MODAL --- */}
      {isPwdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">Change Password</h3>
              <button 
                onClick={() => { setIsPwdModalOpen(false); setPwdError(''); }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              {pwdError && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                  {pwdError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input 
                  type="password" 
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lumina-500 outline-none"
                  value={pwdData.current_password}
                  onChange={(e) => setPwdData({...pwdData, current_password: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input 
                  type="password" 
                  required
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lumina-500 outline-none"
                  value={pwdData.new_password}
                  onChange={(e) => setPwdData({...pwdData, new_password: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input 
                  type="password" 
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lumina-500 outline-none"
                  value={pwdData.confirm_password}
                  onChange={(e) => setPwdData({...pwdData, confirm_password: e.target.value})}
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsPwdModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-lumina-600 text-white rounded-lg hover:bg-lumina-700 font-medium shadow-sm"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;