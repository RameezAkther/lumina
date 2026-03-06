import { useState, useEffect, useRef } from 'react';
import { 
  Eye, EyeOff, MousePointer2, Save, Loader2, Zap, 
  PenTool, Move, Maximize, Minimize, ZoomIn, ZoomOut, Lock, Unlock, Eraser,
  PlusSquare, MinusSquare, Trash2, RotateCw
} from 'lucide-react';
import axios from 'axios';
import { updateImageSelection, saveUserPolygon, deleteUserPolygon, addUserPanel, deleteUserPanel, clearAllUserPanels } from '../../api/axios'; 

const ImageCanvas = ({ selectedImage }) => {
  // --- STATE ---
  
  const [showMask, setShowMask] = useState(true);
  const [showSolar, setShowSolar] = useState(true);
  const [polygons, setPolygons] = useState([]);
  const [excludedIds, setExcludedIds] = useState(new Set()); 
  const [loadingPoly, setLoadingPoly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef(null);

  // --- NEW STATE: TOOLS & DRAWING ---
  // Added 'add-panel' and 'remove-panel' to active tools
  
  const [activeTool, setActiveTool] = useState('select'); 
  const [restrictToRooftop, setRestrictToRooftop] = useState(true);
  const [currentDrawing, setCurrentDrawing] = useState([]); 
  const [userPolygons, setUserPolygons] = useState([]); 
  const [isSavingDrawing, setIsSavingDrawing] = useState(false);
  const [currentPanelRotation, setCurrentPanelRotation] = useState(0);

  // --- NEW STATE: INTERACTIVE PANELS ---
  const [panels, setPanels] = useState([]); // Array of { id, x, y, w, h }

  // --- NEW STATE: VIEWPORT ---
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // --- 1. LOAD DATA ---
  useEffect(() => {
    if (selectedImage?.polygons_url) {
      setLoadingPoly(true);
      const savedExclusions = new Set(selectedImage.excluded_polygons || []);
      setExcludedIds(savedExclusions);
      
      setTransform({ scale: 1, x: 0, y: 0 });
      setCurrentDrawing([]);
      setUserPolygons(selectedImage.user_polygons || []); 

      // Load interactive panels if the backend provides them
      setPanels(selectedImage.panels_data || []);

      axios.get(selectedImage.polygons_url)
        .then(res => setPolygons(res.data))
        .catch(err => console.error("Failed to load polygons", err))
        .finally(() => setLoadingPoly(false));
    } else {
      setPolygons([]);
      setUserPolygons([]);
      setPanels([]);
      setExcludedIds(new Set());
    }
  }, [selectedImage]);

  // --- 2. SELECTION & DELETION HANDLERS ---
  const handlePolygonClick = (id, type, e) => {
    e.stopPropagation();

    if (activeTool === 'select') {
      setExcludedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        triggerSave(next);
        return next;
      });
    } else if (activeTool === 'erase' && type === 'user') {
      handleDeleteUserPolygon(id);
    }
  };

  const handleSelectAll = () => {
    setExcludedIds(new Set()); 
    triggerSave(new Set());
  };

  const handleDeselectAll = () => {
    const allIds = [
      ...polygons.map(p => p.id),
      ...userPolygons.map(p => p.id)
    ];
    const next = new Set(allIds);
    setExcludedIds(next);
    triggerSave(next);
  };

  const handleDeleteUserPolygon = async (polyId) => {
    if (!window.confirm("Are you sure you want to delete this custom shape?")) return;
    setIsSavingDrawing(true);
    try {
      await deleteUserPolygon(selectedImage.id, polyId);
      setUserPolygons(prev => prev.filter(p => p.id !== polyId));
      setExcludedIds(prev => {
        const next = new Set(prev);
        if (next.has(polyId)) {
          next.delete(polyId);
          triggerSave(next); 
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to delete polygon", err);
      alert("Could not delete polygon.");
    } finally {
      setIsSavingDrawing(false);
      setActiveTool('select'); 
    }
  };

  const triggerSave = (currentExcludedIds) => {
    if (!selectedImage) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateImageSelection(selectedImage.id, Array.from(currentExcludedIds));
      } catch (err) {
        console.error("Failed to save selection", err);
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  };

  const pointsToString = (points) => points.map(p => p.join(',')).join(' ');

  // --- 3. MATH & DRAWING LOGIC ---
  const isPointInsideAnyPolygon = (point, polygonsList) => {
    const [x, y] = point;
    for (const poly of polygonsList) {
      if (excludedIds.has(poly.id)) continue; 
      
      let inside = false;
      const vs = poly.points;
      for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1];
        let xj = vs[j][0], yj = vs[j][1];
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  };

  const handleSvgInteraction = (e) => {
    if (!selectedImage || !svgRef.current) return;

    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursorPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    const newPoint = [cursorPt.x, cursorPt.y];

    // --- A. Pan Mode ---
    if (activeTool === 'pan' && e.type === 'mousedown') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      return;
    }

    // --- B. Draw Polygon Mode ---
    if (activeTool === 'draw' && e.type === 'mousedown') {
      if (restrictToRooftop && polygons.length > 0 && !isPointInsideAnyPolygon(newPoint, polygons)) {
        alert("Restriction enabled: You must draw inside an active rooftop.");
        return;
      }

      if (currentDrawing.length >= 3) {
        const firstPt = currentDrawing[0];
        const dist = Math.hypot(firstPt[0] - newPoint[0], firstPt[1] - newPoint[1]);
        const threshold = (selectedImage.width || 2048) * 0.02; 
        if (dist < threshold) {
          saveCurrentDrawing();
          return;
        }
      }
      setCurrentDrawing([...currentDrawing, newPoint]);
    }

    // --- C. Add Panel Mode ---
    if (activeTool === 'add-panel' && e.type === 'mousedown') {
      if (restrictToRooftop && polygons.length > 0 && !isPointInsideAnyPolygon(newPoint, polygons)) {
        alert("Must place panel inside an active rooftop.");
        return;
      }

      // 1. Extract Config or Fallback to Defaults
      // Handle both snake_case (backend) and camelCase (frontend) just to be safe
      const config = selectedImage?.solar_config || {};
      const gsd = config.gsd || 0.075;
      const realLength = config.panel_length || config.panelLength || 1.7; 
      const realWidth = config.panel_width || config.panelWidth || 1.0;

      // 2. Convert real-world meters to image pixels using GSD
      // Defaulting to portrait orientation (height = length, width = width)
      const pw = Math.max(1, Math.round(realWidth / gsd));
      const ph = Math.max(1, Math.round(realLength / gsd));
      
      // 3. Create the new panel object centered on the mouse click
      const newPanel = {
        id: `manual_${Date.now()}`,
        x: Math.round(cursorPt.x - (pw / 2)),
        y: Math.round(cursorPt.y - (ph / 2)),
        w: pw,
        h: ph,
        rotation: currentPanelRotation
      };
      
      // 4. Optimistic UI Update (Immediate visual feedback)
      setPanels(prev => [...prev, newPanel]);
      
      // 5. Background API Call
      addUserPanel(selectedImage.id, newPanel)
        .catch(err => {
          console.error("Failed to save panel", err);
          // Rollback UI if API fails
          setPanels(prev => prev.filter(p => p.id !== newPanel.id));
          alert("Failed to save panel to database.");
        });
    }
  };

  // --- D. Delete Panel Interaction ---
  const handlePanelClick = (e, panelId) => {
    e.stopPropagation();
    if (activeTool === 'remove-panel') {
      // 1. Optimistic UI Update
      const panelToRestore = panels.find(p => p.id === panelId);
      setPanels(prev => prev.filter(p => p.id !== panelId));
      
      // 2. Background API Call
      deleteUserPanel(selectedImage.id, panelId)
        .catch(err => {
          console.error("Failed to delete panel", err);
          // Rollback UI if API fails
          if (panelToRestore) setPanels(prev => [...prev, panelToRestore]);
          alert("Failed to delete panel from database.");
        });
    }
  };

  const handleClearAllPanels = async () => {
    if (!window.confirm("Are you sure you want to delete ALL solar panels?")) return;
    
    // 1. Optimistic UI Update
    const previousPanels = [...panels];
    setPanels([]);
    
    // 2. API Call (Using await here since it's a major destructive action)
    try {
      await clearAllUserPanels(selectedImage.id);
    } catch (err) {
      console.error("Failed to clear panels", err);
      // Rollback UI if API fails
      setPanels(previousPanels);
      alert("Failed to clear panels from database.");
    }
  };

  const saveCurrentDrawing = async () => {
    if (currentDrawing.length < 3) return;
    setIsSavingDrawing(true);
    try {
      const res = await saveUserPolygon(selectedImage.id, currentDrawing);

      // Backend returns: { message: ..., data: { id: <id>, points: [...] } }
      const newId = res?.data?.data?.id || res?.data?.id || res?.id || `user_temp_${Date.now()}`;

      setUserPolygons(prev => [...prev, { id: newId, points: currentDrawing }]);
      setCurrentDrawing([]);
      setActiveTool('select');
    } catch (err) {
      console.error("Error saving polygon", err);
      alert("Failed to save polygon.");
    } finally {
      setIsSavingDrawing(false);
    }
  };

  // --- 4. PAN & ZOOM LOGIC ---
  const handleMouseMove = (e) => {
    if (isDragging && activeTool === 'pan') {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }));
    }
  };

  const handleMouseUp = () => { if (isDragging) setIsDragging(false); };

  const handleZoom = (direction) => {
    setTransform(prev => {
      const newScale = direction === 'in' ? prev.scale * 1.2 : prev.scale / 1.2;
      return { ...prev, scale: Math.max(0.5, Math.min(newScale, 5)) };
    });
  };

  // --- RENDER HELPERS ---
  const contentWrapperClass = isFullscreen 
    ? "fixed inset-0 z-50 bg-slate-900 flex flex-col" 
    : "flex-1 bg-slate-100 relative flex flex-col h-full min-w-0 border-l border-gray-200";

  const renderToolbar = () => {
    const totalPolygonsCount = polygons.length + userPolygons.length;
    let selectionState = 'custom';
    
    if (totalPolygonsCount === 0) selectionState = 'all';
    else if (excludedIds.size === 0) selectionState = 'all';
    else if (excludedIds.size >= totalPolygonsCount) selectionState = 'none';

    return (
      <div className={`min-h-[56px] h-auto border-b flex items-center px-4 py-2 justify-between flex-wrap gap-x-4 gap-y-2 flex-shrink-0 z-30 ${isFullscreen ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200'}`}>
        <span className="font-semibold truncate max-w-[200px]">
          {selectedImage ? selectedImage.filename : 'No image selected'}
        </span>
        
        <div className="flex items-center flex-wrap gap-2">
          
          {isFullscreen && (
            <div className="flex items-center gap-1 bg-slate-700 p-1 rounded-md">
              <button onClick={() => handleZoom('in')} className="p-1.5 hover:bg-slate-600 rounded text-slate-300" title="Zoom In"><ZoomIn size={16} /></button>
              <span className="text-xs text-slate-300 w-10 text-center">{Math.round(transform.scale * 100)}%</span>
              <button onClick={() => handleZoom('out')} className="p-1.5 hover:bg-slate-600 rounded text-slate-300" title="Zoom Out"><ZoomOut size={16} /></button>
              <div className="w-px h-4 bg-slate-600 mx-1"></div>
              <button onClick={() => {setTransform({scale: 1, x:0, y:0})}} className="p-1.5 hover:bg-slate-600 rounded text-xs font-medium text-slate-300">Reset</button>
            </div>
          )}

          {/* POLYGON SELECTION */}
          {(polygons.length > 0 || userPolygons.length > 0) && activeTool === 'select' && (
            <div className={`flex items-center gap-3 px-2 py-1.5 rounded-md border text-xs ${isFullscreen ? 'bg-slate-700 border-slate-600' : 'bg-gray-100 border-gray-200'}`}>
               <span className="font-medium text-gray-500 mr-1">Rooftops:</span>
               <label className="flex items-center gap-1 cursor-pointer hover:opacity-80">
                 <input type="radio" checked={selectionState === 'all'} onChange={handleSelectAll} className="w-3 h-3 text-lumina-600 cursor-pointer" /> All
               </label>
               <label className="flex items-center gap-1 cursor-not-allowed opacity-60" title="Click individual shapes">
                 <input type="radio" checked={selectionState === 'custom'} readOnly className="w-3 h-3 text-lumina-600 pointer-events-none" /> Custom
               </label>
               <label className="flex items-center gap-1 cursor-pointer hover:opacity-80">
                 <input type="radio" checked={selectionState === 'none'} onChange={handleDeselectAll} className="w-3 h-3 text-lumina-600 cursor-pointer" /> None
               </label>
            </div>
          )}

          <div className="w-px h-6 bg-gray-300 mx-1"></div>

          {/* BASE TOOLS */}
          <div className="flex bg-gray-100 rounded-md p-1 border border-gray-200 text-gray-800">
            <button onClick={() => setActiveTool('select')} className={`px-2 py-1.5 rounded-sm text-xs font-medium flex items-center gap-1.5 ${activeTool === 'select' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} title="Select Rooftops">
              <MousePointer2 size={14} /> 
            </button>
            <button onClick={() => setActiveTool('pan')} className={`px-2 py-1.5 rounded-sm text-xs font-medium flex items-center gap-1.5 ${activeTool === 'pan' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} title="Pan Image">
              <Move size={14} />
            </button>
            <button onClick={() => setActiveTool('draw')} className={`px-2 py-1.5 rounded-sm text-xs font-medium flex items-center gap-1.5 ${activeTool === 'draw' ? 'bg-lumina-100 shadow-sm text-lumina-700' : 'text-gray-500 hover:text-gray-700'}`} title="Draw Rooftop">
              <PenTool size={14} /> 
            </button>
            {userPolygons.length > 0 && (
              <button onClick={() => setActiveTool('erase')} className={`px-2 py-1.5 rounded-sm text-xs font-medium flex items-center gap-1.5 ${activeTool === 'erase' ? 'bg-red-100 shadow-sm text-red-700' : 'text-gray-500 hover:text-red-600'}`} title="Erase Drawn Rooftop">
                <Eraser size={14} />
              </button>
            )}
          </div>

          <div className="w-px h-6 bg-gray-300 mx-1"></div>

          {/* PANEL TOOLS */}
          <div className="flex bg-blue-50 rounded-md p-1 border border-blue-200 text-blue-800">
            <button onClick={() => setActiveTool('add-panel')} className={`px-2 py-1.5 rounded-sm text-xs font-medium flex items-center gap-1.5 ${activeTool === 'add-panel' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-600 hover:bg-blue-100'}`} title="Add Panel">
              <PlusSquare size={14} /> Add Panel
            </button>
            {activeTool === 'add-panel' && (
              <button 
                onClick={() => setCurrentPanelRotation(prev => (prev + 45) % 360)} 
                className="px-2 py-1.5 rounded-sm text-xs font-medium flex items-center gap-1.5 text-blue-600 hover:bg-blue-200 transition-colors" 
                title="Rotate Next Panel (45° steps)"
              >
                <RotateCw size={14} /> {currentPanelRotation}°
              </button>
            )}
            <button onClick={() => setActiveTool('remove-panel')} className={`px-2 py-1.5 rounded-sm text-xs font-medium flex items-center gap-1.5 ${activeTool === 'remove-panel' ? 'bg-red-500 text-white shadow-sm' : 'text-blue-600 hover:bg-red-100 hover:text-red-700'}`} title="Remove Panel">
              <MinusSquare size={14} />
            </button>
            <button onClick={handleClearAllPanels} className={`px-2 py-1.5 rounded-sm text-xs font-medium flex items-center gap-1.5 text-blue-600 hover:bg-red-100 hover:text-red-700`} title="Clear All Panels">
              <Trash2 size={14} />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-300 mx-1"></div>

          {/* VISIBILITY TOGGLES */}
          {(polygons.length > 0 || userPolygons.length > 0) && (
            <button onClick={() => setShowMask(!showMask)} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-bold transition-colors ${showMask ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {showMask ? <Eye size={14} /> : <EyeOff size={14} />} Masks
            </button>
          )}

          {(selectedImage?.solar_url || panels.length > 0) && (
            <button onClick={() => setShowSolar(!showSolar)} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-bold transition-colors ${showSolar ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              <Zap size={14} fill={showSolar ? "currentColor" : "none"} /> Panels ({panels.length || selectedImage?.solar_panel_count || 0})
            </button>
          )}

          {/* RESTRICTION TOGGLE: Draw inside rooftop only */}
          <button onClick={() => setRestrictToRooftop(prev => !prev)} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-bold transition-colors ${restrictToRooftop ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-500'}`} title="Toggle drawing restriction to rooftops">
            {restrictToRooftop ? <Lock size={14} /> : <Unlock size={14} />} {restrictToRooftop ? 'Inside Only' : 'Anywhere'}
          </button>

          {/* FULLSCREEN TOGGLE */}
          <button onClick={() => setIsFullscreen(!isFullscreen)} className={`p-1.5 rounded-md transition-colors ml-auto ${isFullscreen ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>

        </div>
      </div>
    );
  };

  return (
    <div className={contentWrapperClass}>
      {renderToolbar()}

      {/* --- CANVAS --- */}
      <div 
        ref={containerRef}
        className={`flex-1 relative overflow-hidden flex items-center justify-center 
          ${activeTool === 'pan' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 
            (activeTool === 'draw' ? 'cursor-crosshair' : 
            (activeTool === 'erase' ? 'cursor-pointer' : 
            (activeTool === 'add-panel' ? 'cursor-crosshair' : 
            (activeTool === 'remove-panel' ? 'cursor-pointer' : 'cursor-default'))))}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {selectedImage ? (
          <div 
            className="relative transition-transform duration-75 ease-out origin-center"
            style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
          >
            {/* LAYER 1: Base Image */}
            <img 
              src={selectedImage.url} 
              alt="Base" 
              className="max-w-full max-h-[80vh] md:max-h-full object-contain shadow-md bg-white block pointer-events-none"
              draggable="false"
            />

            {/* LAYER 2: Solar Panels (Legacy Backend PNG - Will be replaced by interactive layer) */}
            {selectedImage.solar_url && showSolar && panels.length === 0 && (
               <img 
                 src={`${selectedImage.solar_url}${selectedImage.solar_url.includes('?') ? '&' : '?'}cb=${Date.now()}`}
                 alt="Solar Panels" 
                 className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10 opacity-70"
               />
            )}

            {/* LAYER 3: Interactive SVG Overlay */}
            <svg 
              ref={svgRef}
              viewBox={`0 0 ${selectedImage.width || 2048} ${selectedImage.height || 2048}`} 
              className="absolute inset-0 w-full h-full z-20"
              preserveAspectRatio="xMidYMid meet"
              onMouseDown={handleSvgInteraction}
            >
              {/* SYSTEM Polygons */}
              {showMask && polygons.map((poly) => {
                const isExcluded = excludedIds.has(poly.id);
                return (
                  <polygon
                    key={`sys-${poly.id}`}
                    points={pointsToString(poly.points)}
                    onClick={(e) => handlePolygonClick(poly.id, 'system', e)}
                    className="transition-all duration-200 ease-in-out hover:opacity-80"
                    style={{
                      fill: showSolar ? 'transparent' : (isExcluded ? 'rgba(100, 116, 139, 0.3)' : 'rgba(16, 185, 129, 0.4)'), 
                      stroke: isExcluded ? '#94a3b8' : '#059669',
                      strokeWidth: 3,
                      vectorEffect: "non-scaling-stroke",
                      cursor: activeTool === 'select' ? 'pointer' : (activeTool === 'erase' ? 'not-allowed' : 'inherit')
                    }}
                  />
                );
              })}

              {/* USER Polygons */}
              {showMask && userPolygons.map((poly) => {
                const isExcluded = excludedIds.has(poly.id);
                const isEraseMode = activeTool === 'erase';
                return (
                  <polygon
                    key={`usr-${poly.id}`}
                    points={pointsToString(poly.points)}
                    onClick={(e) => handlePolygonClick(poly.id, 'user', e)}
                    className={`transition-all duration-200 ease-in-out ${isEraseMode ? 'hover:fill-red-500/50 hover:stroke-red-500' : 'hover:opacity-80'}`}
                    style={{
                      // FIX: Removed 'transparent' override so custom polygons are ALWAYS visible
                      fill: isExcluded ? 'rgba(100, 116, 139, 0.4)' : 'rgba(139, 92, 246, 0.4)', 
                      stroke: isExcluded ? '#94a3b8' : '#8b5cf6',
                      strokeWidth: isEraseMode ? 5 : 3, 
                      vectorEffect: "non-scaling-stroke",
                      cursor: isEraseMode ? 'pointer' : (activeTool === 'select' ? 'pointer' : 'inherit')
                    }}
                  />
                );
              })}

              {/* INTERACTIVE PANELS LAYER */}
              {/* INTERACTIVE PANELS LAYER */}
              {showSolar && panels.map((panel) => {
                const cx = panel.x + panel.w / 2;
                const cy = panel.y + panel.h / 2;
                const rotation = panel.rotation || 0;

                return (
                  <g 
                    key={panel.id} 
                    onClick={(e) => handlePanelClick(e, panel.id)} 
                    className={activeTool === 'remove-panel' ? 'cursor-pointer hover:opacity-50' : 'cursor-default'}
                    transform={`rotate(${rotation} ${cx} ${cy})`} // <-- APPLIES ROTATION
                  >
                    <rect 
                      x={panel.x} 
                      y={panel.y} 
                      width={panel.w} 
                      height={panel.h} 
                      fill="rgba(37, 99, 235, 0.8)" // Blue-600
                      stroke="#1d4ed8" // Blue-700
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                    
                    {/* Inner grid styling to look like a panel */}
                    {panel.w > 4 && panel.h > 4 && (
                      <rect 
                        x={panel.x + 2} 
                        y={panel.y + 2} 
                        width={panel.w - 4} 
                        height={panel.h - 4} 
                        fill="rgba(30, 64, 175, 0.9)" // Darker blue inside
                        vectorEffect="non-scaling-stroke"
                      />
                    )}

                    {/* ORIENTATION INDICATOR: A bright strip at the "Top" of the panel */}
                  </g>
                );
              })}

              {/* Current Drawing Line */}
              {currentDrawing.length > 0 && (
                <>
                  <polyline points={pointsToString(currentDrawing)} fill="rgba(245, 158, 11, 0.3)" stroke="#f59e0b" strokeWidth={4} vectorEffect="non-scaling-stroke" />
                  <circle cx={currentDrawing[0][0]} cy={currentDrawing[0][1]} r={(selectedImage.width || 2048) * 0.015} fill="#ef4444" className="animate-pulse" />
                  {currentDrawing.map((pt, i) => ( <circle key={i} cx={pt[0]} cy={pt[1]} r={(selectedImage.width || 2048) * 0.005} fill="#f59e0b" /> ))}
                </>
              )}
            </svg>
            
          </div>
        ) : (
          <div className="text-center text-gray-400 select-none">
            <MousePointer2 size={64} className="mx-auto mb-4 opacity-30" />
            <p>Select an image to view rooftops</p>
          </div>
        )}
      </div>
      
      {isSavingDrawing && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <Loader2 size={32} className="animate-spin text-lumina-600 mb-2" />
          <p className="font-medium text-gray-700">Updating workspace...</p>
        </div>
      )}
    </div>
  );
};

export default ImageCanvas;