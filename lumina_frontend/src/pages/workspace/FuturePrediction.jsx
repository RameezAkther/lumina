import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Battery, Activity, Settings2, Zap, Globe, RefreshCw } from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, BarChart, Bar, ReferenceLine
} from 'recharts';
import { api } from '../../api/axios';
import cc from 'currency-codes'; // <-- 1. Import the package

const FuturePrediction = ({ projectId, imageId = null }) => {
  const [loading, setLoading] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [systemCost, setSystemCost] = useState("");
  const [electricityRate, setElectricityRate] = useState("");
  const [currency, setCurrency] = useState("");
  const [costPerPanel, setCostPerPanel] = useState("");
  const [panelCount, setPanelCount] = useState(0);

  // <-- 2. Get the array of currency codes dynamically
  const ALL_CURRENCIES = cc.codes(); 

  // Dynamically get the symbol using native Intl API
  const currencySymbol = (code) => {
    if (!code) return '';
    try {
      return Intl.NumberFormat('en-US', { style: 'currency', currency: code })
        .formatToParts(0)
        .find(part => part.type === 'currency').value;
    } catch (e) {
      return `${code} `;
    }
  };

  // Main fetch function handling our 3 scenarios
  const fetchForecast = async (options = {}) => {
    setLoading(true);
    try {
      const payload = { image_id: imageId };

      if (options.initialLoad) {
        // SCENARIO A: Check DB on load
        payload.is_initial_load = true;
      } else if (options.targetCurrency) {
        // SCENARIO B: Convert existing values to new currency
        payload.system_cost = Number(systemCost);
        payload.electricity_rate = Number(electricityRate);
        payload.cost_per_panel = Number(costPerPanel);
        payload.currency = currency; // Send current currency
        payload.target_currency_for_conversion = options.targetCurrency; // Send target currency
      } else {
        // SCENARIO C: Standard user update
        const totalSystemCost = panelCount > 0 ? Number(costPerPanel) * Number(panelCount) : Number(systemCost);
        payload.system_cost = Number(totalSystemCost);
        payload.electricity_rate = Number(electricityRate);
        payload.cost_per_panel = Number(costPerPanel);
        payload.currency = currency;
      }

      const response = await api.post(`/projects/${projectId}/forecast`, payload);
      
      // Synchronize UI inputs with DB/Backend values
      const applied = response.data.applied_parameters;
      if (applied) {
        setCurrency(applied.currency);
        setElectricityRate(applied.electricity_rate);
        setCostPerPanel(applied.cost_per_panel);
        setSystemCost(applied.system_cost);
      }

      setForecastData(response.data);
    } catch (error) {
      console.error("Error fetching forecast:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  // On component mount, do the initial load check
  useEffect(() => { 
    if (projectId) fetchForecast({ initialLoad: true }); 
  }, [projectId, imageId]);

  useEffect(() => {
    const getPanelCount = async () => {
      try {
        const res = await api.get(`/projects/${projectId}/panel_count`);
        setPanelCount(res.data.total_panels || 0);
      } catch (err) {
        console.warn('Could not fetch panel count', err?.response?.data || err.message);
      }
    };
    if (projectId) getPanelCount();
  }, [projectId]);

  // Handler for Currency Dropdown
  const handleCurrencyChange = (e) => {
    const newCurrency = e.target.value;
    // Don't wait for a button click, immediately fetch and convert
    fetchForecast({ targetCurrency: newCurrency });
  };

  if (!forecastData && !loading) {
    return (
      <div className="p-8 text-center">
        <button onClick={() => fetchForecast()} className="bg-lumina-600 text-white px-6 py-2 rounded-lg hover:bg-lumina-700 transition">
          Generate Advanced Forecast
        </button>
      </div>
    );
  }

  const { advanced_metrics, next_12_months_probabilistic_forecast, lifetime_financial_projection } = forecastData || {};
  const computedTotalCost = panelCount > 0 ? (Number(costPerPanel) * panelCount) : Number(systemCost);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* --- HEADER SECTION --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="text-lumina-600" size={28} /> AI Yield Prediction
          </h2>
          <p className="text-gray-500 text-sm">Probabilistic forecasting using Gaussian Process Regression.</p>
        </div>
        
        <button 
          onClick={() => fetchForecast()} // Explicitly call standard manual update
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-1.5 bg-gray-900 text-white px-3 py-1.5 rounded-md text-[10px] uppercase font-bold hover:bg-gray-800 transition-all shadow-sm disabled:opacity-50 h-fit w-auto max-w-max"
        >
          {loading ? <RefreshCw className="animate-spin" size={12} /> : <RefreshCw size={12} />}
          {loading ? 'CALCULATING...' : 'UPDATE & RECALCULATE'}
        </button>
      </div>

      {/* --- SETTINGS BAR (Condensed) --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-8">
        
        {/* FIX: Cost/Panel Input */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Cost/Panel</label>
          <div className="flex items-center w-full bg-white border border-gray-300 rounded focus-within:border-lumina-500 focus-within:ring-1 focus-within:ring-lumina-500 transition-all overflow-hidden">
            <span className="pl-2 pr-1 text-gray-400 text-xs whitespace-nowrap select-none">
              {currencySymbol(currency)}
            </span>
            <input 
              type="number" 
              value={costPerPanel} 
              onChange={(e) => setCostPerPanel(e.target.value)}
              className="w-full pr-2 py-1.5 bg-transparent text-sm outline-none" 
            />
          </div>
        </div>

        {/* Rate Input */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Rate ({currencySymbol(currency)}/kWh)</label>
          <input 
            type="number" 
            step="0.01" 
            value={electricityRate} 
            onChange={(e) => setElectricityRate(e.target.value)}
            className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-sm outline-none focus:border-lumina-500 focus:ring-1 focus:ring-lumina-500" 
          />
        </div>

        {/* Currency Dropdown - NOW TRIGGERS AUTO CONVERSION */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Currency</label>
          <select 
            value={currency} 
            onChange={handleCurrencyChange} 
            className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-sm outline-none focus:border-lumina-500 focus:ring-1 focus:ring-lumina-500 max-h-48 overflow-y-auto"
          >
            {ALL_CURRENCIES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </div>

        {/* Computed Totals */}
        <div className="flex items-center justify-between px-3 bg-white border border-dashed border-gray-300 rounded">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Computed Cost</p>
            <p className="text-sm font-bold text-gray-900">{currencySymbol(currency)}{computedTotalCost.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Panels</p>
            <p className="text-sm font-bold text-lumina-600">{panelCount}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <Activity className="animate-spin mb-4 text-lumina-500" size={48} />
          <p className="font-medium">Updating Models...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm border-l-4 border-l-lumina-500">
              <p className="text-gray-500 text-xs font-bold uppercase mb-1">Expected Yield (P50)</p>
              <p className="text-2xl font-bold text-gray-900">{advanced_metrics?.first_year_yield_p50_kwh?.toLocaleString()} <span className="text-sm font-normal text-gray-400">kWh</span></p>
            </div>
            <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm border-l-4 border-l-amber-500">
              <p className="text-gray-500 text-xs font-bold uppercase mb-1">Bankable Yield (P90)</p>
              <p className="text-2xl font-bold text-gray-900">{advanced_metrics?.first_year_yield_p90_kwh?.toLocaleString()} <span className="text-sm font-normal text-gray-400">kWh</span></p>
            </div>
            <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm border-l-4 border-l-emerald-500">
              <p className="text-gray-500 text-xs font-bold uppercase mb-1">Lifetime Savings</p>
              <p className="text-2xl font-bold text-gray-900">{currencySymbol(currency)}{advanced_metrics?.total_estimated_savings?.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm border-l-4 border-l-indigo-500">
              <p className="text-gray-500 text-xs font-bold uppercase mb-1">Payback Period</p>
              <p className="text-2xl font-bold text-gray-900">{advanced_metrics?.payback_period_years || 'N/A'} <span className="text-sm font-normal text-gray-400">Years</span></p>
            </div>
          </div>

          {/* --- CHART SECTION: FULL WIDTH GHI --- */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <div className="w-1.5 h-5 bg-amber-400 rounded-full" />
              Next 12 Months Generation Forecast (GHI)
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={next_12_months_probabilistic_forecast}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month_offset" tickFormatter={(val) => `M+${val}`} stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="top" height={36}/>
                  
                  <Area type="monotone" dataKey="P10_optimistic" fill="#FDE68A" stroke="#FBBF24" strokeWidth={2} fillOpacity={0.4} name="Upper Bound (P10)" />
                  <Area type="monotone" dataKey="P90_conservative" fill="#FFFBEB" stroke="#FB923C" strokeWidth={2} fillOpacity={0.8} name="Lower Bound (P90)" />
                  <Line type="monotone" dataKey="P50_expected" stroke="#EA580C" strokeWidth={4} dot={{ r: 4, fill: '#EA580C' }} name="Expected Forecast" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* --- CHART SECTION: TWO COLUMNS BOTTOM --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-md font-bold text-gray-800 mb-6 flex items-center gap-2">
                <div className="w-1.5 h-5 bg-lumina-500 rounded-full" />
                Lifetime Energy Generation (25Y)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lifetime_financial_projection}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="year" tickFormatter={(v) => `Y${v}`} stroke="#9CA3AF" fontSize={11} />
                    <YAxis stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="projected_kwh" stroke="#6366F1" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-md font-bold text-gray-800 mb-6 flex items-center gap-2">
                <div className="w-1.5 h-5 bg-emerald-500 rounded-full" />
                Cumulative ROI & Break-even
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lifetime_financial_projection}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="year" tickFormatter={(v) => `Y${v}`} stroke="#9CA3AF" fontSize={11} />
                    <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => `${currencySymbol(currency)}${v.toLocaleString()}`} />
                    <ReferenceLine y={computedTotalCost} stroke="#EF4444" strokeDasharray="4 4" />
                    <Bar dataKey="cumulative_savings" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FuturePrediction;