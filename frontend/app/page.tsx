import RecentRaceCard from "@/components/RecentRaceCard";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#15151e]">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            F1 Analytics
          </h1>
          <p className="text-xl text-gray-400">
            Dive deep into Formula 1 data, telemetry, and race results
          </p>
        </div>

        {/* Latest Race Card */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Latest Result</h2>
          <RecentRaceCard />
        </div>

        {/* Placeholder for future content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          <div className="bg-[#1e1e2e] rounded-lg p-6 border border-gray-800">
            <h3 className="text-xl font-bold text-white mb-2">
              Championship Standings
            </h3>
            <p className="text-gray-400">
              Track driver and constructor standings throughout the season
            </p>
          </div>
          <div className="bg-[#1e1e2e] rounded-lg p-6 border border-gray-800">
            <h3 className="text-xl font-bold text-white mb-2">
              Data Visualizations
            </h3>
            <p className="text-gray-400">
              Explore lap times, telemetry, and performance analytics
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
