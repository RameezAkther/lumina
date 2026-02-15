import { useState, useEffect } from 'react';
import { UploadCloud, X, FileImage, Trash2, AlertCircle, Loader2, Settings2, Lock, Unlock } from 'lucide-react';
import { createProject, analyzeFiles } from '../api/axios';

const CreateProjectModal = ({ isOpen, onClose, onProjectCreated }) => {
  // Steps: 'upload' -> 'analyzing' -> 'configure' -> 'submitting'
  const [status, setStatus] = useState('upload'); 
  
  const [projectName, setProjectName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  
  // Analysis & Config Data
  const [analysisResults, setAnalysisResults] = useState([]);
  const [tilingConfig, setTilingConfig] = useState({}); // { "img1.tif": "1024" }
  
  // Global Control States
  const [globalOptions, setGlobalOptions] = useState([]); // Intersection of all allowed sizes
  const [globalSize, setGlobalSize] = useState('');
  const [isIndividualMode, setIsIndividualMode] = useState(false); // Controls the Lock

  // Reset on open
  useEffect(() => {
    if (!isOpen) {
      setProjectName('');
      setSelectedFiles([]);
      setAnalysisResults([]);
      setTilingConfig({});
      setStatus('upload');
      setIsIndividualMode(false);
      setGlobalOptions([]);
      setGlobalSize('');
    }
  }, [isOpen]);

  // --- Handlers ---

  const handleFileSelect = (e) => {
    if (e.target.files?.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (idx) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // --- Phase 1: Analysis ---
  const handleAnalyze = async () => {
    if (!projectName || selectedFiles.length === 0) return;
    
    setStatus('analyzing');
    try {
      const response = await analyzeFiles(selectedFiles);
      const results = response.data.results;
      setAnalysisResults(results);
      
      // Filter images that actually need tiling
      const tilingNeededImages = results.filter(r => r.needs_tiling);

      if (tilingNeededImages.length === 0) {
        handleSubmitProject({});
        return;
      }

      // 1. Calculate Intersection
      let commonSizes = tilingNeededImages[0].recommended_sizes;
      
      for (let i = 1; i < tilingNeededImages.length; i++) {
        const currentOptions = tilingNeededImages[i].recommended_sizes;
        commonSizes = commonSizes.filter(size => currentOptions.includes(size));
      }

      setGlobalOptions(commonSizes);

      // --- LOGIC CHANGE START ---
      const initialConfig = {};
      
      if (commonSizes.length === 0) {
        // SCENARIO: CONFLICT DETECTED (No common sizes)
        // 1. Force Individual Mode
        setIsIndividualMode(true); 
        setGlobalSize(''); // No valid global size

        // 2. Set every image to its OWN valid default (first option)
        results.forEach(res => {
          if (res.needs_tiling && res.recommended_sizes.length > 0) {
            initialConfig[res.filename] = String(res.recommended_sizes[0]);
          }
        });
      } else {
        // SCENARIO: STANDARD (Common sizes exist)
        const initialGlobal = String(commonSizes[commonSizes.length - 1]); // Default to largest
        setGlobalSize(initialGlobal);
        setIsIndividualMode(false); // Lock by default

        // Set all to global
        results.forEach(res => {
          if (res.needs_tiling) {
            initialConfig[res.filename] = initialGlobal;
          }
        });
      }
      // --- LOGIC CHANGE END ---

      setTilingConfig(initialConfig);
      setStatus('configure');

    } catch (err) {
      alert("Analysis failed: " + err.message);
      setStatus('upload');
    }
  };

  // --- Phase 2: Configuration Logic ---

  // Handle switching between Global (Locked) and Individual (Unlocked)
  const toggleIndividualMode = () => {
    const newMode = !isIndividualMode;
    setIsIndividualMode(newMode);

    if (newMode === true) {
      // UNLOCKED: Set every image to its OWN first recommended value
      const newConfig = { ...tilingConfig };
      analysisResults.forEach(res => {
        if (res.needs_tiling && res.recommended_sizes.length > 0) {
          newConfig[res.filename] = String(res.recommended_sizes[0]);
        }
      });
      setTilingConfig(newConfig);
    } else {
      // LOCKED: Reset every image to the current Global Value
      const newConfig = { ...tilingConfig };
      analysisResults.forEach(res => {
        if (res.needs_tiling) {
          newConfig[res.filename] = globalSize;
        }
      });
      setTilingConfig(newConfig);
    }
  };

  // Handle changing the Global Dropdown
  const handleGlobalChange = (val) => {
    setGlobalSize(val);
    // If locked, propagate to all images immediately
    if (!isIndividualMode) {
      const newConfig = { ...tilingConfig };
      Object.keys(newConfig).forEach(key => {
        newConfig[key] = val;
      });
      setTilingConfig(newConfig);
    }
  };

  // Handle changing a single dropdown (only works if Unlocked)
  const updateImageConfig = (filename, size) => {
    setTilingConfig(prev => ({
      ...prev,
      [filename]: size
    }));
  };

  // --- Phase 3: Submission ---
  const handleSubmitProject = async (finalConfig) => {
    setStatus('submitting');
    try {
      const formData = new FormData();
      formData.append('project_name', projectName);
      
      // Use config passed in args, or current state
      const configToSend = finalConfig || tilingConfig;
      formData.append('tiling_config_str', JSON.stringify(configToSend));
      
      selectedFiles.forEach(f => formData.append('files', f));

      await createProject(formData);
      onProjectCreated();
      onClose();
    } catch (err) {
      alert("Creation failed: " + (err.response?.data?.detail || err.message));
      setStatus('upload');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">
            {status === 'configure' ? 'Configure Processing' : 'Create New Project'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* --- VIEW 1: UPLOAD & NAME --- */}
        {status === 'upload' && (
          <div className="p-6 space-y-6 overflow-y-auto">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Project Name</label>
              <input 
                type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-lumina-500 outline-none"
                placeholder="e.g., Downtown Analysis" value={projectName} onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div 
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:bg-gray-50"
              onClick={() => document.getElementById('fileInput').click()}
            >
              <input id="fileInput" type="file" multiple accept=".jpg,.jpeg,.png,.tif,.tiff" className="hidden" onChange={handleFileSelect} />
              <UploadCloud size={32} className="mx-auto text-lumina-600 mb-2" />
              <p className="text-gray-900 font-medium">Click to upload imagery</p>
              <p className="text-gray-500 text-sm">Supports TIFF, JPG, PNG</p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-48 overflow-y-auto">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Files ({selectedFiles.length})</h4>
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                    <span className="text-sm truncate text-gray-700 w-3/4">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VIEW 2: ANALYZING SPINNER --- */}
        {status === 'analyzing' && (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 size={48} className="animate-spin text-lumina-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Analyzing Imagery...</h3>
            <p className="text-gray-500">Checking dimensions and formats</p>
          </div>
        )}

        {/* --- VIEW 3: CONFIGURATION (TILING) --- */}
        {status === 'configure' && (
          <div className="p-6 overflow-y-auto bg-gray-50/50 flex-1">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex gap-2 items-start text-amber-900 font-bold text-sm mb-4">
                <AlertCircle size={18} /> Large Images Detected
              </div>
              {/* --- GLOBAL CONTROLS --- */}
              <div className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm space-y-4">
                
                {/* 1. Global Dropdown */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-gray-700">Global Tile Size:</label>
                  
                  {/* LOGIC CHANGE: Check if we have options */}
                  {globalOptions.length > 0 ? (
                    <select 
                      className="border border-gray-300 rounded px-3 py-1.5 bg-gray-50 text-sm font-medium focus:ring-2 focus:ring-lumina-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      value={globalSize}
                      onChange={(e) => handleGlobalChange(e.target.value)}
                      disabled={isIndividualMode} 
                    >
                      {globalOptions.map(size => (
                        <option key={size} value={size}>{size}px</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1 rounded border border-red-100">
                      N/A (Varied Requirements)
                    </span>
                  )}
                </div>

                {/* 2. Individual Setup Toggle */}
                <div 
                  className={`flex items-center justify-between p-3 rounded-md border transition-colors 
                    ${globalOptions.length === 0 
                       ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-80' // Look disabled if forced
                       : 'cursor-pointer ' + (isIndividualMode ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200')
                    }`}
                  onClick={() => {
                    // Prevent locking if no common sizes exist
                    if (globalOptions.length > 0) toggleIndividualMode();
                  }}
                >
                  <div className="flex items-center gap-3">
                    {isIndividualMode ? <Unlock size={18} className="text-blue-600" /> : <Lock size={18} className="text-gray-500" />}
                    <div>
                      <p className={`text-sm font-bold ${isIndividualMode ? 'text-blue-800' : 'text-gray-700'}`}>Individual Setup</p>
                      <p className="text-xs text-gray-500">
                        {globalOptions.length === 0 
                          ? 'Required: Images have conflicting constraints' 
                          : (isIndividualMode ? 'Customizing each image separately' : 'All images locked to global setting')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Visual Toggle Switch */}
                  {/* Hide toggle if forced, or just show it active/disabled */}
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${isIndividualMode ? 'bg-blue-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isIndividualMode ? 'left-6' : 'left-1'}`}></div>
                  </div>
                </div>

              </div>
            </div>

            {/* --- INDIVIDUAL IMAGE LIST --- */}
            <div className="space-y-3">
              {analysisResults.map((res) => (
                <div key={res.filename} className={`bg-white p-4 rounded-lg border ${res.needs_tiling ? 'border-lumina-200 shadow-sm' : 'border-gray-200 opacity-70'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <FileImage size={20} className={res.needs_tiling ? "text-lumina-600" : "text-gray-400"} />
                      <div>
                        <p className="text-sm font-bold text-gray-800 truncate w-48" title={res.filename}>{res.filename}</p>
                        <p className="text-xs text-gray-500">{res.width} x {res.height} px</p>
                      </div>
                    </div>

                    {res.needs_tiling ? (
                      <div className="flex items-center gap-2">
                        {/* Lock Icon for individual row feedback */}
                        {!isIndividualMode && <Lock size={14} className="text-gray-300" />}
                        
                        <select 
                          className={`text-sm border rounded px-2 py-1 outline-none transition-colors
                            ${isIndividualMode 
                              ? 'bg-white border-gray-300 focus:ring-2 focus:ring-lumina-500' 
                              : 'bg-gray-100 border-transparent text-gray-500 cursor-not-allowed'}`}
                          value={tilingConfig[res.filename] || ''}
                          onChange={(e) => updateImageConfig(res.filename, e.target.value)}
                          disabled={!isIndividualMode}
                        >
                          {/* Show specific options for this image */}
                          {res.recommended_sizes.map(s => <option key={s} value={s}>{s}px Tiles</option>)}
                          {/* Option to skip tiling? Could add if needed */}
                          {/* <option value="0">Do Not Tile</option> */}
                        </select>
                      </div>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                        <Loader2 size={12} className="opacity-0" /> {/* Spacer */}
                        Standard
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- VIEW 4: SUBMITTING --- */}
        {status === 'submitting' && (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 size={48} className="animate-spin text-green-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Creating Project...</h3>
            <p className="text-gray-500">Processing images and generating tiles</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          {status !== 'submitting' && (
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-white">
              Cancel
            </button>
          )}
          
          {status === 'upload' && (
            <button 
              onClick={handleAnalyze} 
              disabled={!projectName || selectedFiles.length === 0}
              className="px-6 py-2 bg-lumina-600 text-white rounded-lg hover:bg-lumina-700 disabled:bg-gray-300 font-medium"
            >
              Analyze Files
            </button>
          )}

          {status === 'configure' && (
            <button 
              onClick={() => handleSubmitProject(null)} 
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
            >
              <Settings2 size={16} /> Create Project
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default CreateProjectModal;