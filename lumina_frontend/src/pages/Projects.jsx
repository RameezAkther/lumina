import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Image as ImageIcon, ArrowRight, Loader, Trash2, AlertTriangle } from 'lucide-react';
import { getProjects, deleteProject } from '../api/axios';
import CreateProjectModal from '../components/CreateProjectModal';

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Delete State
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Projects
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await getProjects();
      setProjects(response.data);
    } catch (err) {
      console.error("Failed to load projects", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      // Remove from local state immediately
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      setProjectToDelete(null); // Close confirmation
    } catch (err) {
      alert("Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper formatting
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
          <p className="text-gray-500 mt-1">Manage and track your rooftop analysis tasks.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-lumina-600 text-white px-5 py-2.5 rounded-lg hover:bg-lumina-700 transition shadow-sm font-medium flex items-center gap-2"
        >
          <span>+ New Project</span>
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="animate-spin text-lumina-500" size={32} />
        </div>
      ) : projects.length === 0 ? (
        // --- EMPTY STATE (Modified for Full Height) ---
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
          <div className="w-20 h-20 bg-lumina-50 text-lumina-500 rounded-full flex items-center justify-center mb-6">
             <ImageIcon size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900">No projects yet</h3>
          <p className="text-gray-500 mt-2 mb-8 max-w-md mx-auto">
            Upload your aerial imagery to start segmenting rooftops and estimating solar potential.
          </p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="text-lumina-600 hover:text-lumina-700 font-semibold hover:underline"
          >
            Create your first project
          </button>
        </div>
      ) : (
        // --- PROJECTS GRID ---
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div 
              key={project.id} 
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition duration-200 flex flex-col overflow-hidden group relative"
            >
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor(project.status)}`}>
                    {project.status}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-gray-400 text-xs flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(project.created_at)}
                    </div>
                    {/* Delete Button */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setProjectToDelete(project); }}
                      className="text-gray-300 hover:text-red-500 transition p-1"
                      title="Delete Project"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-gray-800 mb-2 truncate" title={project.name}>
                  {project.name}
                </h3>
                
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <ImageIcon size={16} />
                  <span>{project.total_images} Images</span>
                </div>
              </div>

              {/* Card Footer / Action Area */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-between items-center group-hover:bg-lumina-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/dashboard/projects/${project.id}`)}>
                <span className="text-sm font-medium text-gray-600 group-hover:text-lumina-700">View Analysis</span>
                <button 
                  className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-400 flex items-center justify-center group-hover:border-lumina-300 group-hover:text-lumina-600 transition"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Component */}
      <CreateProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onProjectCreated={fetchProjects} 
      />

      {/* --- DELETE CONFIRMATION DIALOG --- */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Project?</h3>
              <p className="text-gray-500 text-sm mb-6">
                Are you sure you want to delete <span className="font-bold text-gray-800">"{projectToDelete.name}"</span>? 
                This action cannot be undone and all associated data will be lost.
              </p>
              
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => setProjectToDelete(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Projects;