import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layers, Grid, History, TrendingUp, ArrowLeft, Loader2 } from 'lucide-react';
import { getProjectDetails } from '../../api/axios'; // <--- Import the new helper

// Import Modular Tabs
import ImageViewer from './ImageViewer';
import CapacityEstimator from './CapacityEstimator';
import HistoricalAnalysis from './HistoricalAnalysis';
import FuturePrediction from './FuturePrediction';

const ProjectWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('viewer');
  
  const [projectData, setProjectData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch Real Project Data
  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        const response = await getProjectDetails(id);
        setProjectData(response.data);
      } catch (err) {
        console.error("Failed to load project", err);
        setError("Project not found or access denied.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadProject();
    }
  }, [id]);

  const renderContent = () => {
    switch (activeTab) {
      case 'viewer': return <ImageViewer projectId={id} />;
      case 'capacity': return <CapacityEstimator projectId={id} />;
      case 'history': return <HistoricalAnalysis projectId={id} />;
      case 'prediction': return <FuturePrediction projectId={id} />;
      default: return <ImageViewer projectId={id} />;
    }
  };

  const tabs = [
    { id: 'viewer', label: 'Uploaded Imagery', icon: Layers },
    { id: 'capacity', label: 'Panel Capacity', icon: Grid },
    { id: 'history', label: 'Historical Analysis', icon: History },
    { id: 'prediction', label: 'Future Prediction', icon: TrendingUp },
  ];

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        <Loader2 className="animate-spin mr-2" /> Loading Project...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-red-500">
        <p className="font-bold text-lg mb-4">{error}</p>
        <button 
          onClick={() => navigate('/dashboard/projects')}
          className="text-gray-600 hover:underline flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Workspace Header */}
      <div className="flex items-center gap-4 mb-6 border-b border-gray-200 pb-4">
        <button 
          onClick={() => navigate('/dashboard/projects')}
          className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          {/* Display Actual Name */}
          <h1 className="text-2xl font-bold text-gray-900">{projectData?.name}</h1>
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400">ID: {id}</p>
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${projectData?.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
              {projectData?.status}
            </span>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="ml-auto flex bg-gray-100 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-lumina-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Content Area */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        {renderContent()}
      </div>
    </div>
  );
};

export default ProjectWorkspace;