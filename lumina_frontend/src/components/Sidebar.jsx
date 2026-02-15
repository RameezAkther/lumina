import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Map, 
  User, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Sun
} from 'lucide-react';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const navItems = [
    { label: 'Home', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Projects', path: '/dashboard/projects', icon: Map },
  ];

  const bottomItems = [
    { label: 'Profile', path: '/dashboard/profile', icon: User },
  ];

  return (
    <div 
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } bg-lumina-900 text-white transition-all duration-300 flex flex-col relative shadow-xl h-screen`}
    >
      {/* Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-9 bg-lumina-500 text-white p-1 rounded-full shadow-lg hover:bg-lumina-600 transition z-50"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Logo Area */}
      <div className="h-20 flex items-center justify-center border-b border-lumina-800">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <Sun className="text-lumina-400" size={24} />
          {!isCollapsed && <span>Lumina</span>}
        </div>
      </div>

      {/* Navigation Links (Top) */}
      <nav className="flex-1 py-6 px-3 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group relative ${
                isActive 
                  ? 'bg-lumina-800 text-lumina-400' 
                  : 'text-gray-300 hover:bg-lumina-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              {!isCollapsed && <span className="font-medium">{item.label}</span>}
              
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions (Profile & Logout) */}
      <div className="p-3 border-t border-lumina-800 space-y-2 mb-4">
        {bottomItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group relative ${
              location.pathname === item.path
                ? 'bg-lumina-800 text-lumina-400'
                : 'text-gray-300 hover:bg-lumina-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            {!isCollapsed && <span className="font-medium">{item.label}</span>}
            
             {/* Tooltip */}
             {isCollapsed && (
                <div className="absolute left-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
          </Link>
        ))}
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-400 hover:bg-lumina-800 hover:text-red-300 transition-colors relative group"
        >
          <LogOut size={20} />
          {!isCollapsed && <span className="font-medium">Logout</span>}
          
           {/* Tooltip */}
           {isCollapsed && (
              <div className="absolute left-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50">
                Logout
              </div>
            )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;