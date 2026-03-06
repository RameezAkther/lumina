import { useState, useEffect } from 'react';
import { MapPin, Search, BarChart3, Globe, MousePointer2, AlertTriangle, CheckCircle, Loader2, Image as ImageIcon, TrendingUp, Sun, Info, Leaf } from 'lucide-react';
import { Country, State, City } from 'country-state-city';
import { getProjectImages, getProjectDetails } from '../../api/axios';
import api from '../../api/axios';
import { Tooltip } from 'react-tooltip';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';

const HistoricalAnalysis = ({ projectId }) => {
  // --- STATE ---
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('global'); 
  const [selectedImageId, setSelectedImageId] = useState(null);

  const defaultForm = { country: '', state: '', district: '', area: '', panelCapacity: 0.4 };
  const [formData, setFormData] = useState(defaultForm);
  const [globalData, setGlobalData] = useState(defaultForm);

  const [codes, setCodes] = useState({ countryCode: '', stateCode: '' });

  const [status, setStatus] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [globalResult, setGlobalResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  // Month names for charts
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const [imgRes, projRes] = await Promise.all([
          getProjectImages(projectId),
          getProjectDetails(projectId)
        ]);

        const validImages = imgRes.data.filter(i => i.is_source || !i.is_tiled);
        setImages(validImages);
        
        // Load Global Config & Results
        const projData = projRes.data;
        if (projData.location_config) {
          const mapped = {
            country: projData.location_config.country || '',
            state: projData.location_config.state || '',
            district: projData.location_config.district || '',
            area: projData.location_config.area || '',
            panelCapacity: projData.location_config.panel_capacity_kw || 0.4
          };
          setGlobalData(mapped);
          
          if (mode === 'global') {
            setFormData(mapped);
            hydrateCodes(mapped.country, mapped.state);
          }
        }
        
        // HYDRATE GLOBAL RESULTS
        if (projData.historical_results) {
          setGlobalResult(projData.historical_results);
          if (mode === 'global') setAnalysisResult(projData.historical_results);
        }

      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [projectId]);

  const hydrateCodes = (countryName, stateName) => {
    if (!countryName) return;
    const c = Country.getAllCountries().find(c => c.name === countryName);
    if (c) {
      let sCode = '';
      if (stateName) {
        const s = State.getStatesOfCountry(c.isoCode).find(s => s.name === stateName);
        if (s) sCode = s.isoCode;
      }
      setCodes({ countryCode: c.isoCode, stateCode: sCode });
    }
  };

  // --- 2. HANDLERS ---
  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setStatus(null);

    if (newMode === 'global') {
      setSelectedImageId(null);
      setFormData(globalData);
      hydrateCodes(globalData.country, globalData.state);
      setAnalysisResult(globalResult);
    } else {
      setFormData(defaultForm);
      setCodes({ countryCode: '', stateCode: '' });
      setAnalysisResult(null);
    }
  };

  const handleImageSelect = (id) => {
    setSelectedImageId(id);
    setStatus(null);
    const img = images.find(i => i.id === id);
    
    // Restore Form Data
    if (img?.location_config) {
      const conf = img.location_config;
      setFormData({
        country: conf.country,
        state: conf.state,
        district: conf.district,
        area: conf.area || '',
        panelCapacity: conf.panel_capacity_kw || 0.4
      });
      hydrateCodes(conf.country, conf.state);
    } else {
      setFormData(globalData);
      hydrateCodes(globalData.country, globalData.state);
    }

    // Restore Analysis Results for this image
    if (img?.historical_results) {
        setAnalysisResult(img.historical_results);
    } else {
        setAnalysisResult(null); 
    }
  };

  const handleCountryChange = (e) => {
    const isoCode = e.target.value;
    const countryData = Country.getCountryByCode(isoCode);
    setCodes({ countryCode: isoCode, stateCode: '' });
    setFormData(prev => ({ ...prev, country: countryData?.name || '', state: '', district: '' }));
  };

  const handleStateChange = (e) => {
    const isoCode = e.target.value;
    const stateData = State.getStateByCodeAndCountry(isoCode, codes.countryCode);
    setCodes(prev => ({ ...prev, stateCode: isoCode }));
    setFormData(prev => ({ ...prev, state: stateData?.name || '', district: '' }));
  };

  const handleCityChange = (e) => setFormData(prev => ({ ...prev, district: e.target.value }));
  const handleSimpleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const runAnalysis = async () => {
    if (!formData.country || !formData.state || !formData.district) {
      setStatus({ type: 'error', text: 'Please fill all mandatory location fields.' });
      return;
    }

    setIsAnalyzing(true);
    setStatus(null);

    try {
      const payload = {
        country: formData.country,
        state: formData.state,
        district: formData.district,
        area: formData.area,
        panel_capacity_kw: parseFloat(formData.panelCapacity),
        image_id: mode === 'individual' ? selectedImageId : null
      };

      const response = await api.post(`/projects/${projectId}/historical_analysis`, payload);
      const data = response.data;
      
      // The backend now returns { message, location_resolved, coordinates, system_size_kw, metrics }
      const newResult = data.metrics;

      if (mode === 'global') {
          setGlobalData(formData);
          setGlobalResult(newResult);
      } else {
          setImages(prev => prev.map(img => 
            img.id === selectedImageId 
            ? { ...img, location_config: formData, historical_results: newResult } 
            : img
          ));
      }
      
      setAnalysisResult(newResult);
      setStatus({ type: 'success', text: `Analysis complete. Sys Size: ${data.system_size_kw.toFixed(1)} kWp` });

    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: err.response?.data?.detail || 'Analysis failed. Check connection.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- CHART DATA FORMATTING ---
  const getMonthlyBarData = () => {
    if (!analysisResult?.monthly_chart_data) return [];
    return analysisResult.monthly_chart_data.map((val, index) => ({
      month: monthNames[index],
      kwh: val
    }));
  };

  const getHistoricalLineData = () => {
    if (!analysisResult?.raw_historical_data) return [];
    
    // Group raw data by month/year to create continuous timeline
    return analysisResult.raw_historical_data.map(item => ({
      time: `${monthNames[item.month - 1]} '${item.year.toString().slice(-2)}`,
      ghi: item.ghi
    }));
  };

  if (loading) return <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto custom-scrollbar">
      
      {/* Initialize tooltips globally */}
      <Tooltip id="info-tooltip" className="max-w-xs z-50 text-xs text-center" />

      {/* ==================== TOP: CONFIGURATION ==================== */}
      <div className="p-4 flex-shrink-0">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <MapPin className="text-lumina-600" size={20} /> 
              Historical Solar Analysis
            </h2>

            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => handleModeSwitch('global')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'global' ? 'bg-white text-lumina-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Globe size={14} /> Global
              </button>
              <button 
                onClick={() => handleModeSwitch('individual')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'individual' ? 'bg-white text-lumina-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <MousePointer2 size={14} /> Individual
              </button>
            </div>
          </div>

          {/* Individual Image Selector */}
          {mode === 'individual' && (
            <div className="mb-5 animate-in fade-in slide-in-from-top-2">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Select Target Image</label>
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {images.map(img => (
                  <div 
                    key={img.id}
                    onClick={() => handleImageSelect(img.id)}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer min-w-[180px] transition-all hover:shadow-sm ${selectedImageId === img.id ? 'bg-blue-50 border-blue-200 text-blue-800 ring-1 ring-blue-200' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <div className="p-1 bg-white rounded border border-gray-100">
                      <ImageIcon size={14} className="text-gray-400" />
                    </div>
                    <span className="text-xs font-medium truncate">{img.filename}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5-Column Input Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
            
            {/* 1. Country Select */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Country</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-lumina-500 outline-none"
                value={codes.countryCode}
                onChange={handleCountryChange}
              >
                <option value="">Select...</option>
                {Country.getAllCountries().map(c => (
                  <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* 2. State Select */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">State</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-lumina-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                value={codes.stateCode}
                onChange={handleStateChange}
                disabled={!codes.countryCode}
              >
                <option value="">Select...</option>
                {State.getStatesOfCountry(codes.countryCode).map(s => (
                  <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* 3. City/District Select */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">City / District</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-lumina-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                value={formData.district} 
                onChange={handleCityChange}
                disabled={!codes.stateCode}
              >
                <option value="">Select...</option>
                {City.getCitiesOfState(codes.countryCode, codes.stateCode).map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* 4. Area Input (Optional) */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Area / Zip (Opt)</label>
              <input 
                type="text" 
                placeholder="e.g. Anna Nagar"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-lumina-500"
                value={formData.area}
                onChange={e => handleSimpleChange('area', e.target.value)}
              />
            </div>

            {/* 5. Panel Capacity */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Panel Cap. (kW)</label>
              <input 
                type="number" 
                step="0.1" 
                className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-lumina-500"
                value={formData.panelCapacity}
                onChange={e => handleSimpleChange('panelCapacity', e.target.value)}
                placeholder="0.4"
              />
            </div>

            {/* Action Button (Full Width in Grid) */}
            <div className="lg:col-span-5 flex justify-end mt-2">
               <button 
                onClick={runAnalysis}
                disabled={isAnalyzing || (mode === 'individual' && !selectedImageId)}
                className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-black transition flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                {isAnalyzing ? 'Analyzing...' : 'Perform Analysis'}
              </button>
            </div>
          </div>

          {status && (
            <div className={`mt-4 p-3 rounded-lg text-sm flex gap-2 items-center ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {status.type === 'error' ? <AlertTriangle size={16}/> : <CheckCircle size={16}/>}
              {status.text}
            </div>
          )}
        </div>
      </div>

      {/* ==================== BOTTOM: RESULTS SECTION ==================== */}
      <div className="flex-1 px-4 pb-4">
        {analysisResult && analysisResult.summary ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4">
            
            {/* 4 Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: GHI */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between group">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1">
                     <p className="text-[10px] font-bold text-gray-400 uppercase">Avg. Daily GHI</p>
                     <Info size={12} className="text-gray-300 cursor-help" data-tooltip-id="info-tooltip" data-tooltip-content="Global Horizontal Irradiance. The total solar radiation hitting a horizontal surface. Higher is better." />
                  </div>
                  <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg group-hover:bg-yellow-100 transition-colors">
                    <Sun size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{analysisResult.summary.ghi}</h3>
                  <p className="text-xs text-gray-500">kWh/m²/day</p>
                </div>
              </div>

              {/* Card 2: Annual Yield */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between group">
                 <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1">
                     <p className="text-[10px] font-bold text-gray-400 uppercase">Annual Yield</p>
                     <Info size={12} className="text-gray-300 cursor-help" data-tooltip-id="info-tooltip" data-tooltip-content="Total estimated energy your panels will generate in one year, accounting for standard losses." />
                  </div>
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 transition-colors">
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{analysisResult.summary.annual_yield_kwh}</h3>
                  <p className="text-xs text-gray-500">Total kWh / Year</p>
                </div>
              </div>

              {/* Card 3: CO2 Saved */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between group">
                 <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1">
                     <p className="text-[10px] font-bold text-gray-400 uppercase">CO2 Offset</p>
                     <Info size={12} className="text-gray-300 cursor-help" data-tooltip-id="info-tooltip" data-tooltip-content="Estimated kilograms of Carbon Dioxide emissions prevented by using solar energy instead of fossil fuels." />
                  </div>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">
                    <Leaf size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{analysisResult.summary.co2_saved_kg}</h3>
                  <p className="text-xs text-gray-500">kg CO2 / Year</p>
                </div>
              </div>

               {/* Card 4: Trees Equivalent */}
               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between group">
                 <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1">
                     <p className="text-[10px] font-bold text-gray-400 uppercase">Trees Equivalent</p>
                     <Info size={12} className="text-gray-300 cursor-help" data-tooltip-id="info-tooltip" data-tooltip-content="The environmental impact translated into the number of mature trees needed to absorb that much CO2." />
                  </div>
                  <div className="p-2 bg-teal-50 text-teal-600 rounded-lg group-hover:bg-teal-100 transition-colors">
                    <Leaf size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{analysisResult.summary.trees_planted_equiv}</h3>
                  <p className="text-xs text-gray-500">Trees Planted / Year</p>
                </div>
              </div>

            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Monthly Bar Chart */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-base font-bold text-gray-800">Monthly Average Generation</h3>
                      <p className="text-xs text-gray-500">Estimated output based on 6-year NASA averages</p>
                    </div>
                  </div>
                  
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getMonthlyBarData()} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <RechartsTooltip 
                          cursor={{fill: '#F3F4F6'}}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="kwh" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Energy (kWh)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Historical Line Chart */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-base font-bold text-gray-800">Historical Irradiance Variability</h3>
                      <p className="text-xs text-gray-500">Raw monthly GHI observations over time</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        {analysisResult.summary.variability} Variance
                    </span>
                  </div>
                  
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getHistoricalLineData()} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis 
                            dataKey="time" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#6B7280' }} 
                            minTickGap={30}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line type="monotone" dataKey="ghi" stroke="#F59E0B" strokeWidth={2} dot={false} name="GHI (kWh/m²)" activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="h-full min-h-[250px] flex flex-col items-center justify-center text-center bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 m-2">
            <div className="w-12 h-12 bg-blue-50 text-blue-200 rounded-full flex items-center justify-center mb-3">
              <Globe size={24} className="text-blue-400" />
            </div>
            <h3 className="text-base font-bold text-gray-700 mb-1">Ready for Analysis</h3>
            <p className="text-xs text-gray-500 max-w-sm">
              Configure the location settings above to retrieve historical solar irradiance data.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

export default HistoricalAnalysis;