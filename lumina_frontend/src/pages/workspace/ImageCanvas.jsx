import { useState, useEffect, useRef } from 'react';
import { Layers, Eye, EyeOff, MousePointer2, Save, Loader2, Zap } from 'lucide-react';
import axios from 'axios';
import { updateImageSelection } from '../../api/axios';

const ImageCanvas = ({ selectedImage }) => {
  // --- STATE ---
  const [showMask, setShowMask] = useState(true);
  const [showSolar, setShowSolar] = useState(true); // <--- FIXED: Added missing state
  const [polygons, setPolygons] = useState([]);
  const [excludedIds, setExcludedIds] = useState(new Set()); 
  const [loadingPoly, setLoadingPoly] = useState(false);
  
  // Saving State
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef(null);

  // --- 1. LOAD DATA ---
  useEffect(() => {
    if (selectedImage?.polygons_url) {
      setLoadingPoly(true);
      
      // Load saved exclusions from the image object
      // (Backend must return 'excluded_polygons' array in the image object)
      const savedExclusions = new Set(selectedImage.excluded_polygons || []);
      setExcludedIds(savedExclusions);

      axios.get(selectedImage.polygons_url)
        .then(res => {
          setPolygons(res.data);
        })
        .catch(err => console.error("Failed to load polygons", err))
        .finally(() => setLoadingPoly(false));
    } else {
      setPolygons([]);
      setExcludedIds(new Set());
    }
  }, [selectedImage]);

  // --- 2. HANDLERS ---

  // Toggle Rooftop Logic with Auto-Save
  const toggleRooftop = (id) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      
      // Trigger Auto-Save
      triggerSave(next);
      
      return next;
    });
  };

  const triggerSave = (currentExcludedIds) => {
    if (!selectedImage) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setIsSaving(true);

    // Debounce: Wait 1s before sending to backend
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateImageSelection(selectedImage.id, currentExcludedIds);
      } catch (err) {
        console.error("Failed to save selection", err);
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  };

  const pointsToString = (points) => {
    return points.map(p => p.join(',')).join(' ');
  };

  return (
    <div className="flex-1 bg-slate-100 relative flex flex-col h-full min-w-0 border-l border-gray-200">
      
      {/* --- TOOLBAR --- */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 justify-between flex-shrink-0">
        <span className="font-semibold text-gray-700 truncate">
          {selectedImage ? selectedImage.filename : 'No image selected'}
        </span>
        
        {/* Controls Container */}
        <div className="flex items-center gap-4">
           
           {/* Save Indicator */}
           {polygons.length > 0 && (
             <div className="flex items-center gap-2 min-w-[80px]">
               {isSaving ? (
                 <span className="text-xs text-amber-600 flex items-center gap-1">
                   <Loader2 size={12} className="animate-spin" /> Saving...
                 </span>
               ) : (
                 <span className="text-xs text-green-600 flex items-center gap-1">
                   <Save size={12} /> Saved
                 </span>
               )}
             </div>
           )}

           {/* Stats */}
           {polygons.length > 0 && (
             <div className="text-xs font-medium text-gray-500 border-l pl-4 border-gray-200">
               {polygons.length - excludedIds.size} / {polygons.length} Active
             </div>
           )}
           
           {/* Buttons */}
           <div className="flex gap-2">
             {/* Mask Toggle */}
             {polygons.length > 0 && (
               <button 
                 onClick={() => setShowMask(!showMask)}
                 className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-colors
                   ${showMask ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
               >
                 {showMask ? <Eye size={14} /> : <EyeOff size={14} />}
                 Masks
               </button>
             )}

             {/* Solar Toggle (Only if available) */}
             {selectedImage?.solar_url && (
               <button 
                 onClick={() => setShowSolar(!showSolar)}
                 className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-colors
                   ${showSolar ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
               >
                 <Zap size={14} fill={showSolar ? "currentColor" : "none"} />
                 Panels
               </button>
             )}
           </div>
        </div>
      </div>

      {/* --- CANVAS --- */}
      <div className="flex-1 relative bg-slate-100/50 p-4 flex items-center justify-center overflow-hidden">
        {selectedImage ? (
          <div className="relative w-full h-full flex items-center justify-center">
            
            {/* LAYER 1: Base Image */}
            <img 
              src={selectedImage.url} 
              alt="Base" 
              className="max-w-full max-h-full object-contain shadow-md bg-white rounded-sm absolute z-10"
            />

            {/* LAYER 2: Solar Panels (If Generated & Toggled On) */}
            {selectedImage.solar_url && showSolar && (
               <img 
                 src={selectedImage.solar_url} 
                 alt="Solar Panels" 
                 className="max-w-full max-h-full object-contain absolute z-20"
               />
            )}

            {/* LAYER 3: Interactive Polygons */}
            {showMask && polygons.length > 0 && (
              <svg 
                viewBox={`0 0 ${selectedImage.width || 2048} ${selectedImage.height || 2048}`} 
                className="max-w-full max-h-full absolute z-30"
                preserveAspectRatio="xMidYMid meet"
              >
                {polygons.map((poly) => {
                  const isExcluded = excludedIds.has(poly.id);
                  return (
                    <polygon
                      key={poly.id}
                      points={pointsToString(poly.points)}
                      onClick={() => toggleRooftop(poly.id)}
                      className="cursor-pointer transition-all duration-200 ease-in-out hover:opacity-80"
                      style={{
                        // FIXED: showSolar is now defined
                        fill: showSolar ? 'transparent' : (isExcluded ? 'rgba(100, 116, 139, 0.3)' : 'rgba(16, 185, 129, 0.4)'), 
                        stroke: isExcluded ? '#94a3b8' : '#059669',
                        strokeWidth: 2,
                        vectorEffect: "non-scaling-stroke"
                      }}
                    />
                  );
                })}
              </svg>
            )}
            
          </div>
        ) : (
          <div className="text-center text-gray-400 select-none">
            <MousePointer2 size={64} className="mx-auto mb-4 opacity-30" />
            <p>Select an image to view rooftops</p>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default ImageCanvas;