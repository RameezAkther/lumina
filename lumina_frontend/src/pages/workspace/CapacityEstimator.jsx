import { useState, useEffect } from 'react';
import { Settings, Zap, CheckCircle, AlertTriangle, Loader2, Globe, MousePointer2, X, Eye, Image as ImageIcon } from 'lucide-react';
import { getProjectImages, getProjectDetails } from '../../api/axios'; 
import api from '../../api/axios';
import ImageCanvas from './ImageCanvas'; 

// --- PANEL PRESETS ---
const PANEL_PRESETS = [
  { label: "Standard 60-cell (1.65m x 0.99m)", length: 1.65, width: 0.99 },
  { label: "Standard 72-cell (1.96m x 0.99m)", length: 1.96, width: 0.99 },
  { label: "Large Commercial (2.28m x 1.13m)", length: 2.28, width: 1.13 },
  { label: "Lumina Default (1.70m x 1.00m)", length: 1.7, width: 1.0 },
];

// --- EXTRACTED COMPONENT ---
const ConfigForm = ({ params, onParamChange }) => {
  // Determine if current dimensions match a preset
  const currentPreset = PANEL_PRESETS.find(
    p => p.length === parseFloat(params.panelLength) && p.width === parseFloat(params.panelWidth)
  ) || { label: 'Custom' };

  const handlePresetChange = (e) => {
    const selectedLabel = e.target.value;
    const preset = PANEL_PRESETS.find(p => p.label === selectedLabel);
    
    if (preset) {
      // Update both parameters sequentially
      onParamChange('panelLength', preset.length);
      onParamChange('panelWidth', preset.width);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* GSD */}
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Image Resolution (GSD)</label>
        <div className="flex gap-2">
          <input 
            type="number" step="0.001"
            value={params.gsd}
            onChange={(e) => onParamChange('gsd', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-lumina-500 outline-none"
          />
          <span className="p-2 text-xs text-gray-500 bg-gray-100 rounded">m/px</span>
        </div>
      </div>

      {/* Panels (Dropdown + Inputs) */}
      <div className="space-y-3 bg-gray-50/50 p-3 rounded border border-gray-100">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Panel Dimensions</label>
          <select
            value={currentPreset.label}
            onChange={handlePresetChange}
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-lumina-500 outline-none bg-white cursor-pointer"
          >
            <option value="Custom">Custom Dimensions...</option>
            {PANEL_PRESETS.map(p => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Length (m)</label>
            <input 
              type="number" step="0.1" value={params.panelLength}
              onChange={(e) => onParamChange('panelLength', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-lumina-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Width (m)</label>
            <input 
              type="number" step="0.1" value={params.panelWidth}
              onChange={(e) => onParamChange('panelWidth', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-lumina-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Constraints */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase">Quantity Limit</label>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={params.isMaxMode}
              onChange={(e) => onParamChange('isMaxMode', e.target.checked)}
              className="w-3 h-3 text-lumina-600 rounded cursor-pointer"
            />
            <span className="text-xs text-gray-700">Maximize</span>
          </div>
        </div>
        <input 
          type="number" 
          value={params.userPanelLimit}
          onChange={(e) => onParamChange('userPanelLimit', e.target.value)}
          disabled={params.isMaxMode}
          className="w-full p-2 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-lumina-500 outline-none"
          placeholder={params.isMaxMode ? "Auto-calculate max" : "Enter limit"}
        />
      </div>

      {/* Gap */}
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Panel Gap (m)</label>
        <input 
          type="number" step="0.01" value={params.gap}
          onChange={(e) => onParamChange('gap', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-lumina-500 outline-none"
        />
      </div>
    </div>
  );
};

const CapacityEstimator = ({ projectId }) => {
  // --- STATE ---
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection & Mode
  const [selectedImageId, setSelectedImageId] = useState(null); 
  const [configMode, setConfigMode] = useState('global'); 
  const [modalImage, setModalImage] = useState(null);

  // Parameters (Default)
  const defaultParams = {
    gsd: 0.075,
    panelLength: 1.7,
    panelWidth: 1.0,
    gap: 0.02,
    isMaxMode: true,
    userPanelLimit: 50,
  };

  const [params, setParams] = useState(defaultParams);
  const [globalParams, setGlobalParams] = useState(defaultParams);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // --- 1. LOAD DATA ---
  useEffect(() => {
    const initData = async () => {
      try {
        const imgRes = await getProjectImages(projectId);
        // Include ALL images that have been processed (both parent and tiled)
        const validImages = imgRes.data.filter(img => img.status === 'processed');
        setImages(validImages);

        const projRes = await getProjectDetails(projectId);
        const savedConfig = projRes.data.solar_config;

        if (savedConfig && Object.keys(savedConfig).length > 0) {
          const mappedConfig = {
            gsd: savedConfig.gsd ?? 0.075,
            panelLength: savedConfig.panel_length ?? 1.7,
            panelWidth: savedConfig.panel_width ?? 1.0,
            gap: savedConfig.gap ?? 0.02,
            isMaxMode: savedConfig.max_panels === null,
            userPanelLimit: savedConfig.max_panels || 50,
          };

          setGlobalParams(mappedConfig);
          
          if (configMode === 'global') {
             setParams(mappedConfig);
          }
        }

      } catch (err) {
        console.error("Failed to load workspace data", err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [projectId]);

  // --- 2. HANDLERS ---
  const handleModeSwitch = (mode) => {
    setConfigMode(mode);
    setStatusMsg(null);

    if (mode === 'global') {
      setSelectedImageId(null);
      setParams(globalParams); 
    }
  };

  const handleImageSelect = (id) => {
    setSelectedImageId(id);
    setStatusMsg(null);

    const targetImg = images.find(img => img.id === id);
    
    if (targetImg && targetImg.solar_config) {
      setParams({
        gsd: targetImg.solar_config.gsd,
        panelLength: targetImg.solar_config.panel_length,
        panelWidth: targetImg.solar_config.panel_width,
        gap: targetImg.solar_config.gap,
        isMaxMode: targetImg.solar_config.max_panels === null,
        userPanelLimit: targetImg.solar_config.max_panels || 50,
      });
    } else {
      setParams(globalParams); 
    }
  };

  const handleParamChange = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const runEstimation = async (e) => {
    if(e) e.preventDefault();

    if (configMode === 'individual') {
      if (!selectedImageId) {
        setStatusMsg({ type: 'error', text: 'Please select an image from the list first.' });
        return;
      }
      const targetImg = images.find(i => i.id === selectedImageId);
      if (targetImg?.status !== 'processed') {
        setStatusMsg({ type: 'error', text: 'Selected image has no rooftop mask. Run segmentation first.' });
        return;
      }
    }

    setIsProcessing(true);
    setStatusMsg(null);

    try {
      const payload = {
        gsd: parseFloat(params.gsd),
        panel_length: parseFloat(params.panelLength),
        panel_width: parseFloat(params.panelWidth),
        gap: parseFloat(params.gap),
        max_panels: params.isMaxMode ? null : parseInt(params.userPanelLimit),
        image_id: configMode === 'individual' ? selectedImageId : null 
      };

      const response = await api.post(`/projects/${projectId}/calculate_capacity`, payload);
      const results = response.data.results;
      
      setImages(prev => prev.map(img => {
        const res = results.find(r => r.id === img.id);
        if (res) {
          return { 
            ...img, 
            ...res, 
            solar_panel_count: res.panels, 
            solar_path: res.solar_url,     
            solar_config: payload 
          }; 
        }
        return img;
      }));

      if (configMode === 'global') {
        setGlobalParams(params);
      }

      setStatusMsg({ 
        type: 'success', 
        text: `Success! Placed ${response.data.total_panels} total panels.` 
      });

    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.response?.data?.detail || "Estimation failed." });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center text-gray-500">Loading workspace...</div>;

  return (
    <div className="flex w-full overflow-hidden border border-gray-200 rounded-lg bg-white h-[calc(100vh-180px)]">
      
      {/* --- LEFT SIDEBAR: CONFIGURATION --- */}
      <div className="w-80 flex-shrink-0 bg-gray-50 flex flex-col h-full border-r border-gray-200">
        
        {/* 1. Mode Toggle */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
            <button 
              type="button"
              onClick={() => handleModeSwitch('global')}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${configMode === 'global' ? 'bg-white text-lumina-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Globe size={14} /> Global
            </button>
            <button 
              type="button"
              onClick={() => handleModeSwitch('individual')}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${configMode === 'individual' ? 'bg-white text-lumina-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <MousePointer2 size={14} /> Individual
            </button>
          </div>

          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Settings size={16} className="text-gray-500" /> 
            {configMode === 'global' ? 'Project Parameters' : 'Single Image Settings'}
          </h3>
        </div>

        {/* 2. Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          
          {configMode === 'global' ? (
            // GLOBAL MODE
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-800">
                Settings defined here will apply to <strong>all images</strong> in this project.
              </div>
              <ConfigForm params={params} onParamChange={handleParamChange} />
            </div>
          ) : (
            // INDIVIDUAL MODE
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-xs text-amber-800">
                Select an image below to configure and run estimation for it specifically.
              </div>
              
              {/* Image Selector List */}
              <div className="border border-gray-200 rounded-lg bg-white overflow-hidden max-h-48 overflow-y-auto">
                {images.map(img => (
                  <div 
                    key={img.id}
                    onClick={() => handleImageSelect(img.id)}
                    className={`p-2 text-sm flex items-center gap-2 cursor-pointer border-b last:border-0 hover:bg-gray-50 ${selectedImageId === img.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600'}`}
                  >
                    <ImageIcon size={14} />
                    <span className="truncate flex-1">{img.filename}</span>
                    {img.status === 'processed' ? <CheckCircle size={12} className="text-green-500" /> : <AlertTriangle size={12} className="text-amber-400" />}
                  </div>
                ))}
              </div>

              {/* Form shows only if image selected */}
              {selectedImageId && (
                <div className="pt-4 border-t border-gray-200">
                  <ConfigForm params={params} onParamChange={handleParamChange} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Footer Actions */}
        <div className="p-4 border-t border-gray-200 bg-white space-y-3">
          {statusMsg && (
            <div className={`p-2 rounded text-xs flex gap-2 items-start ${statusMsg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {statusMsg.type === 'error' ? <AlertTriangle size={14} className="mt-0.5"/> : <CheckCircle size={14} className="mt-0.5"/>}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <button 
            type="button"
            onClick={runEstimation}
            disabled={isProcessing || (configMode === 'individual' && !selectedImageId)}
            className="w-full bg-lumina-600 text-white py-2.5 rounded-lg hover:bg-lumina-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
            {configMode === 'global' ? 'Estimate All' : 'Estimate Selected'}
          </button>
        </div>

      </div>

      {/* --- RIGHT SIDE: RESULTS LIST --- */}
      <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Estimation Results</h2>
          
          {images.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
              No images found in project.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {images.map(img => (
                <div key={img.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                  
                  {/* Left: Info */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                      <Zap size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">{img.filename}</h4>
                      <div className="flex gap-4 mt-1 text-xs">
                        <span className={`px-2 py-0.5 rounded-full ${img.status === 'processed' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {img.status === 'processed' ? 'Segmented' : 'Pending Segmentation'}
                        </span>
                        {img.solar_path && (
                          <span className="text-blue-600 font-medium">
                            {img.solar_panel_count} Panels
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Action */}
                  <div className="flex items-center gap-6">
                    {img.solar_path ? (
                      <button 
                        type="button"
                        onClick={() => setModalImage(img)}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition flex items-center gap-2"
                      >
                        <Eye size={14} /> View
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 italic mr-4">No estimate run</span>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL OVERLAY --- */}
      {modalImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{modalImage.filename}</h3>
                <p className="text-xs text-gray-500">
                  Total Panels: <span className="font-bold text-gray-700">{modalImage.solar_panel_count}</span>
                </p>
              </div>
              <button 
                onClick={() => setModalImage(null)}
                className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body: Reuse ImageCanvas */}
            <div className="flex-1 overflow-hidden relative">
              <ImageCanvas selectedImage={modalImage} />
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CapacityEstimator;