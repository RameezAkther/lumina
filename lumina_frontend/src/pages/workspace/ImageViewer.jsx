import { useState, useEffect } from 'react';
import { Folder, Image as ImageIcon, Cpu, CheckCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { getProjectImages, performInference } from '../../api/axios';
import ImageCanvas from './ImageCanvas'; // <--- Import the new component

const ImageViewer = ({ projectId }) => {
  const [loading, setLoading] = useState(true);
  const [groupedImages, setGroupedImages] = useState([]); 
  
  // State for the ImageCanvas
  const [selectedImage, setSelectedImage] = useState(null); 
  
  // State for the Sidebar List
  const [expandedGroups, setExpandedGroups] = useState({}); 
  const [selectedModel, setSelectedModel] = useState('ResAttUNet');
  const [isInferencing, setIsInferencing] = useState(false);

  // --- 1. Data Fetching & Processing ---
  useEffect(() => {
    fetchImages();
  }, [projectId]);

  const fetchImages = async () => {
    try {
      const response = await getProjectImages(projectId);
      processGroups(response.data);
    } catch (err) {
      console.error("Error fetching images:", err);
    } finally {
      setLoading(false);
    }
  };

  const processGroups = (rawList) => {
    const groups = [];
    const parentMap = {};

    // Grouping Logic (Same as before)
    rawList.forEach(img => {
      if (img.is_source) {
        const group = { ...img, type: 'mosaic', children: [] };
        parentMap[img.filename] = group;
        groups.push(group);
      } else if (!img.is_tiled) {
        groups.push({ ...img, type: 'standalone' });
      }
    });

    rawList.forEach(img => {
      if (img.is_tiled && img.parent_image) {
        if (parentMap[img.parent_image]) parentMap[img.parent_image].children.push(img);
        else groups.push({ ...img, type: 'standalone' });
      }
    });

    setGroupedImages(groups);
    // Auto-select first image if none selected
    if (groups.length > 0 && !selectedImage) setSelectedImage(groups[0]);
  };

  // --- 2. Action Handlers ---
  const handleInference = async () => {
    setIsInferencing(true);
    try {
      await performInference(projectId, selectedModel);
      alert("Inference complete!");
      fetchImages(); 
    } catch (err) {
      alert("Inference failed: " + err.message);
    } finally {
      setIsInferencing(false);
    }
  };

  const toggleGroup = (filename) => {
    setExpandedGroups(prev => ({ ...prev, [filename]: !prev[filename] }));
  };

  if (loading) return <div className="h-full flex items-center justify-center text-gray-500">Loading imagery...</div>;

  return (
    // Main Container: Fixed height calculation to force scrolling within
    <div className="flex w-full overflow-hidden border border-gray-200 rounded-lg bg-white h-[calc(100vh-180px)]">
      
      {/* --- LEFT SIDEBAR (List & Controls) --- */}
      <div className="w-80 flex-shrink-0 bg-gray-50 flex flex-col h-full">
        
        {/* Header Controls */}
        <div className="p-4 bg-white border-b border-gray-200 shadow-sm z-10 flex-shrink-0">
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Model Selection</label>
          <div className="space-y-3">
            <div>
              <select 
                className="w-full text-sm border border-gray-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-lumina-500"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isInferencing}
              >
                <option value="ResAttUNet">ResAttUNet</option>
                <option value="Aero-P2 Net">Aero-P2 Net</option>
                <option value="SegFormer">SegFormer</option>
                <option value="Optimal Model">Optimal Model (Auto)</option>
              </select>
              
              {/* --- NEW: Last used model info --- */}
              <p className="text-[11px] text-gray-500 mt-1.5 ml-1">
                Last used model: <span className="font-semibold text-gray-700">{selectedImage?.model_used || 'nill'}</span>
              </p>
            </div>
            
            <button 
              onClick={handleInference}
              disabled={isInferencing}
              className="w-full bg-lumina-600 text-white py-2 rounded-md text-sm font-medium hover:bg-lumina-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              {isInferencing ? <Loader2 size={16} className="animate-spin" /> : <Cpu size={16} />}
              {isInferencing ? 'Processing...' : 'Perform Inference'}
            </button>
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-0">
          {groupedImages.map((item) => (
            <div key={item.id} className="select-none">
              
              {/* Parent Item */}
              <div 
                onClick={() => { setSelectedImage(item); if(item.type === 'mosaic') toggleGroup(item.filename); }}
                className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors border
                  ${selectedImage?.id === item.id ? 'bg-white border-lumina-400 shadow-sm' : 'border-transparent hover:bg-gray-200'}
                `}
              >
                {item.type === 'mosaic' ? (
                  <div className="text-amber-500 flex items-center">
                    {expandedGroups[item.filename] ? <ChevronDown size={14} className="mr-1"/> : <ChevronRight size={14} className="mr-1"/>}
                    <Folder size={18} />
                  </div>
                ) : <ImageIcon size={18} className="text-blue-500 ml-5" />}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{item.filename}</p>
                  <p className="text-xs text-gray-400">
                    {item.type === 'mosaic' ? `${item.children.length} Tiles` : 'Original'}
                  </p>
                </div>
                {item.status === 'processed' && <CheckCircle size={14} className="text-green-500" />}
              </div>

              {/* Children (Scrollable Tile List) */}
              {item.type === 'mosaic' && expandedGroups[item.filename] && (
                <div className="ml-6 pl-3 border-l-2 border-gray-200 mt-1 space-y-1 max-h-60 overflow-y-auto custom-scrollbar-thin">
                  {item.children.map((tile) => (
                    <div 
                      key={tile.id}
                      onClick={() => setSelectedImage(tile)}
                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-sm
                        ${selectedImage?.id === tile.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}
                      `}
                    >
                      <ImageIcon size={14} className="flex-shrink-0" />
                      <span className="truncate">Tile {tile.tile_index}</span>
                      {tile.status === 'processed' && <CheckCircle size={12} className="text-green-500 ml-auto flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* --- RIGHT SIDE: MODULAR IMAGE CANVAS --- */}
      <ImageCanvas selectedImage={selectedImage} />

    </div>
  );
};

export default ImageViewer;