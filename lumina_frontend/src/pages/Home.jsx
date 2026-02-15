const Home = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric Card 1 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <p className="text-gray-500 text-sm font-medium">Total Projects</p>
          <p className="text-3xl font-bold text-lumina-600 mt-2">12</p>
        </div>

        {/* Metric Card 2 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <p className="text-gray-500 text-sm font-medium">Processing</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">3</p>
        </div>

        {/* Metric Card 3 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <p className="text-gray-500 text-sm font-medium">Energy Potential</p>
          <p className="text-3xl font-bold text-green-600 mt-2">1.2 MW</p>
        </div>
      </div>

      <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
        <p className="text-gray-500">No recent activity found.</p>
      </div>
    </div>
  );
};

export default Home;