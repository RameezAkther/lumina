import { useState } from 'react';
import { MapPin, Search, BarChart3 } from 'lucide-react';

const HistoricalAnalysis = ({ projectId }) => {
  const [coords, setCoords] = useState({ lat: '', lng: '' });
  const [hasData, setHasData] = useState(false);

  const fetchData = () => {
    // API Call to fetch GHI data
    setHasData(true);
  };

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Search Bar */}
      <div className="flex items-end gap-4 mb-8">
        <div className="flex-1">
          <label className="block text-sm font-bold text-gray-700 mb-1">Project Location</label>
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-lumina-500">
            <div className="bg-gray-50 px-3 py-2 text-gray-500 border-r border-gray-300">
              <MapPin size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Latitude, Longitude (e.g. 13.0827, 80.2707)" 
              className="flex-1 px-4 py-2 outline-none"
              value={`${coords.lat}, ${coords.lng}`}
              onChange={e => {
                 const [lat, lng] = e.target.value.split(',');
                 setCoords({ lat: lat || '', lng: lng || '' });
              }}
            />
          </div>
        </div>
        <button 
          onClick={fetchData}
          className="bg-gray-800 text-white px-6 py-2.5 rounded-lg hover:bg-gray-900 flex items-center gap-2"
        >
          <Search size={18} /> Fetch Irradiance Data
        </button>
      </div>

      {/* Charts Area */}
      {hasData ? (
        <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 p-8 flex items-center justify-center">
          <div className="text-center">
            <BarChart3 size={64} className="mx-auto text-lumina-400 mb-4" />
            <h3 className="text-xl font-bold text-gray-800">Annual Generation: 14.5 MWh</h3>
            <p className="text-gray-500">Based on historical GHI data for 2024</p>
            {/* Real Chart library (Recharts/ChartJS) would go here */}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl">
          Enter coordinates to retrieve historical solar data
        </div>
      )}
    </div>
  );
};

export default HistoricalAnalysis;