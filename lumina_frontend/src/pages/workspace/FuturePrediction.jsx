import { useState } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';

const FuturePrediction = ({ projectId }) => {
  const [days, setDays] = useState(30);

  return (
    <div className="p-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="text-lumina-600" /> Future Yield Prediction
          </h2>
          <p className="text-gray-500 mt-1">AI-driven forecast based on weather patterns.</p>
        </div>

        <div className="bg-white border border-gray-200 p-2 rounded-lg shadow-sm flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-600 pl-2">Forecast Range:</span>
          <input 
            type="range" min="30" max="360" step="30" 
            value={days} onChange={(e) => setDays(e.target.value)}
            className="w-48 accent-lumina-600"
          />
          <span className="bg-lumina-100 text-lumina-700 px-3 py-1 rounded text-sm font-bold w-24 text-center">
            {days} Days
          </span>
        </div>
      </div>

      {/* Prediction Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-lumina-500 to-lumina-600 text-white p-6 rounded-xl shadow-lg">
          <p className="text-lumina-100 text-sm font-medium mb-1">Predicted Output</p>
          <p className="text-3xl font-bold">4.2 MWh</p>
          <p className="text-xs text-lumina-200 mt-2">Next {days} days</p>
        </div>
        
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
          <p className="text-gray-500 text-sm font-medium mb-1">Confidence Score</p>
          <p className="text-3xl font-bold text-gray-800">94%</p>
          <p className="text-xs text-green-600 mt-2">High Accuracy</p>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
          <p className="text-gray-500 text-sm font-medium mb-1">Best Month</p>
          <p className="text-3xl font-bold text-gray-800">May</p>
          <p className="text-xs text-gray-400 mt-2">Peak Irradiance</p>
        </div>
      </div>

      {/* Mock Chart Area */}
      <div className="h-64 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400">
        <Calendar size={32} className="mr-2" />
        Time Series Forecast Chart (kWh vs Days)
      </div>
    </div>
  );
};

export default FuturePrediction;