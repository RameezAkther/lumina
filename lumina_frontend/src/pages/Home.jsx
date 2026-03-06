import { useEffect, useState } from 'react';
import { getProjects, getProjectDetails } from '../api/axios';
import { 
  FolderKanban, 
  Hourglass, 
  Zap, 
  Images, 
  ChevronRight,
  Activity
} from 'lucide-react';

const Home = () => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState({ totalProjects: 0, processing: 0, energyPotential: 0, totalImages: 0 });

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await getProjects();
        const list = res?.data || [];

        // Fetch details for each project
        const detailsPromises = list.map(p => getProjectDetails(p.id).then(r => r.data).catch(() => null));
        const details = await Promise.all(detailsPromises);

        // Compute summary metrics
        const totalProjects = list.length;
        const processing = details.filter(d => d && d.status && d.status.toLowerCase() !== 'analysis complete').length;
        const energyPotential = details.reduce((s, d) => s + (d?.historical_results?.total_system_kw || d?.solar_config?.estimated_system_kw || 0), 0);
        const totalImages = details.reduce((s, d) => s + (d?.total_images || 0), 0);

        // Combine basic list with details for UI
        const combined = list.map((p, idx) => ({ ...p, ...(details[idx] || {}) }));

        if (!mounted) return;
        setProjects(combined);
        setSummary({ totalProjects, processing, energyPotential: Math.round(energyPotential * 100) / 100, totalImages });
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, []);

  const recent = [...projects].sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  }).slice(0, 6);

  // Helper for status badge styling
  const getStatusStyle = (status) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'analysis complete') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'failed' || s === 'error') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="flex items-center space-x-3 mb-8">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
          <Activity size={24} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Projects Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-500 text-sm font-semibold tracking-wide uppercase">Total Projects</p>
              <p className="text-4xl font-extrabold text-gray-900 mt-2">{loading ? '-' : summary.totalProjects}</p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <FolderKanban size={24} />
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-4">Owned or collaborated</p>
        </div>

        {/* Processing Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-500 text-sm font-semibold tracking-wide uppercase">Processing</p>
              <p className="text-4xl font-extrabold text-blue-600 mt-2">{loading ? '-' : summary.processing}</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Hourglass size={24} />
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-4">Pending analysis</p>
        </div>

        {/* Energy Potential Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-500 text-sm font-semibold tracking-wide uppercase">Energy Potential</p>
              <div className="flex items-baseline space-x-1 mt-2">
                <p className="text-4xl font-extrabold text-emerald-600">{loading ? '-' : summary.energyPotential || 0}</p>
                <span className="text-emerald-600 font-medium">kW</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Zap size={24} />
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-4">Historical estimates</p>
        </div>

        {/* Total Images Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-500 text-sm font-semibold tracking-wide uppercase">Total Images</p>
              <p className="text-4xl font-extrabold text-purple-600 mt-2">{loading ? '-' : summary.totalImages}</p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Images size={24} />
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-4">Across all projects</p>
        </div>
      </div>

      {/* Recent Projects Section */}
      <div className="mt-10 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Recent Projects</h2>
        </div>

        <div className="p-0">
          {loading ? (
            // Skeleton Loading State
            <div className="divide-y divide-gray-100">
              {[1, 2, 3].map((skeleton) => (
                <div key={skeleton} className="px-6 py-4 flex justify-between items-center animate-pulse">
                  <div className="space-y-3 w-1/3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full w-24"></div>
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            // Empty State
            <div className="px-6 py-12 text-center flex flex-col items-center">
              <div className="bg-gray-50 p-4 rounded-full mb-4 text-gray-400">
                <FolderKanban size={32} />
              </div>
              <h3 className="text-sm font-medium text-gray-900">No projects found</h3>
              <p className="text-sm text-gray-500 mt-1">Get started by creating a new project.</p>
            </div>
          ) : (
            // Populated List
            <div className="divide-y divide-gray-50">
              {recent.map((p) => (
                <div 
                  key={p.id} 
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors duration-150 group cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {p.name}
                    </span>
                    <span className="text-sm text-gray-500 mt-1">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      }) : '—'}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <div className="text-right hidden sm:block">
                      <div className="text-sm text-gray-500 font-medium">{p.total_images || 0} Images</div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(p.status)} capitalize`}>
                      {p.status || 'Pending'}
                    </span>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;