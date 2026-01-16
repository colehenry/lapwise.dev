"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiUrl, apiHeaders } from "@/lib/api";

interface SeasonHistory {
  year: number;
  championship_position: number | null;
  total_points: number;
  team_name: string;
  team_color: string | null;
}

interface DriverSeasonHistoryResponse {
  driver_code: string;
  full_name: string;
  seasons: SeasonHistory[];
}

interface RaceHistory {
  year: number;
  round: number;
  race_name: string;
  position: number | null;
  points: number | null;
  team_name: string;
  team_color: string | null;
  status: string;
}

interface DriverRaceHistoryResponse {
  driver_code: string;
  full_name: string;
  races: RaceHistory[];
  available_years: number[];
}

interface DriverSeasonHistoryGraphProps {
  driverCode: string;
}

type GraphMode = "season" | "race";
type DataMode = "position" | "points";

// Season Range Selector Modal
interface RangeSelectorProps {
  availableYears: number[];
  currentStart: number;
  currentEnd: number;
  onRangeSelect: (start: number, end: number) => void;
  onClose: () => void;
}

function RangeSelector({
  availableYears,
  currentStart,
  currentEnd,
  onRangeSelect,
  onClose,
}: RangeSelectorProps) {
  const [startYear, setStartYear] = useState(currentStart);
  const [endYear, setEndYear] = useState(currentEnd);
  const [error, setError] = useState("");

  const handleApply = () => {
    if (endYear - startYear > 4) {
      setError("Maximum range is 5 years");
      return;
    }
    if (startYear > endYear) {
      setError("Start year must be before end year");
      return;
    }
    onRangeSelect(startYear, endYear);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1e1e28] border border-[#2a2a35] rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-white mb-4">Select Year Range</h3>
        <p className="text-sm text-gray-400 mb-4">Maximum 5 years</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Start Year
            </label>
            <select
              value={startYear}
              onChange={(e) => {
                setStartYear(Number(e.target.value));
                setError("");
              }}
              className="w-full px-3 py-2 bg-[#252530] border border-[#2a2a35] rounded text-white"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">End Year</label>
            <select
              value={endYear}
              onChange={(e) => {
                setEndYear(Number(e.target.value));
                setError("");
              }}
              className="w-full px-3 py-2 bg-[#252530] border border-[#2a2a35] rounded text-white"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-[#252530] text-gray-400 rounded-lg hover:bg-[#2a2a35] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 px-4 py-2 bg-[#a020f0] text-white rounded-lg hover:bg-[#8a1ad0] transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, graphMode }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  if (graphMode === "season") {
    // Season view tooltip
    let positionChange = null;
    let pointsChange = null;

    if (data.prevPosition !== undefined && data.championship_position) {
      positionChange = data.prevPosition - data.championship_position;
    }

    if (data.prevPoints !== undefined) {
      pointsChange = data.total_points - data.prevPoints;
    }

    return (
      <div className="bg-[#1e1e28] border border-[#2a2a35] rounded-lg p-3 shadow-xl">
        <p className="font-bold text-white mb-2">{data.year}</p>
        <div className="space-y-1">
          <p className="text-sm text-gray-300">
            <span className="font-semibold">Team:</span> {data.team_name}
          </p>
          <p className="text-sm text-gray-300">
            <span className="font-semibold">Position:</span>{" "}
            {data.championship_position
              ? `P${data.championship_position}`
              : "N/A"}
            {positionChange !== null && (
              <span
                className={`ml-2 font-semibold ${
                  positionChange > 0
                    ? "text-green-400"
                    : positionChange < 0
                      ? "text-red-400"
                      : "text-blue-400"
                }`}
              >
                {positionChange > 0
                  ? `+${positionChange}`
                  : positionChange < 0
                    ? positionChange
                    : "—"}
              </span>
            )}
          </p>
          <p className="text-sm text-gray-300">
            <span className="font-semibold">Points:</span> {data.total_points}
            {pointsChange !== null && (
              <span
                className={`ml-2 font-semibold ${
                  pointsChange > 0
                    ? "text-green-400"
                    : pointsChange < 0
                      ? "text-red-400"
                      : "text-blue-400"
                }`}
              >
                {pointsChange > 0
                  ? `+${pointsChange.toFixed(1)}`
                  : pointsChange < 0
                    ? pointsChange.toFixed(1)
                    : "—"}
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  // Race view tooltip
  return (
    <div className="bg-[#1e1e28] border border-[#2a2a35] rounded-lg p-3 shadow-xl">
      <p className="font-bold text-white mb-2">
        {data.race_name || "Race"}
      </p>
      <div className="space-y-1">
        <p className="text-sm text-gray-300">
          <span className="font-semibold">Season:</span> {data.year || "N/A"} R
          {data.round || "?"}
        </p>
        <p className="text-sm text-gray-300">
          <span className="font-semibold">Team:</span>{" "}
          {data.team_name || "Unknown"}
        </p>
        <p className="text-sm text-gray-300">
          <span className="font-semibold">Position:</span>{" "}
          {data.position ? `P${data.position}` : data.status || "N/A"}
        </p>
        <p className="text-sm text-gray-300">
          <span className="font-semibold">Points:</span>{" "}
          {data.points !== null && data.points !== undefined
            ? data.points
            : data.position && data.position <= 10
              ? "(missing data)"
              : "0"}
        </p>
      </div>
    </div>
  );
};

// Custom X-axis Tick Component for Season Mode
const CustomXAxisTickSeason = (props: any) => {
  const { x, y, payload } = props;

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#999" fontSize={12}>
        {payload.value}
      </text>
    </g>
  );
};

// Custom X-axis Tick Component for Race Mode
const CustomXAxisTickRace = (props: any) => {
  const { x, y, payload, index } = props;

  // Only show label if this is a year boundary
  if (!payload || !payload.value) return null;

  // Check if this data point should show year
  const data = props.payload;
  if (!data || !data.showYearLabel) return null;

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#999" fontSize={12}>
        {data.year}
      </text>
    </g>
  );
};

// Custom Dot Component
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  const color = payload.team_color ? `#${payload.team_color}` : "#a020f0";

  return (
    <circle cx={cx} cy={cy} r={4} fill={color} stroke={color} strokeWidth={1} />
  );
};

// Custom Active Dot Component
const CustomActiveDot = (props: any) => {
  const { cx, cy, payload } = props;
  const color = payload.team_color ? `#${payload.team_color}` : "#a020f0";

  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={color}
      stroke={color}
      strokeWidth={2}
    />
  );
};

export default function DriverSeasonHistoryGraph({
  driverCode,
}: DriverSeasonHistoryGraphProps) {
  const [seasonData, setSeasonData] = useState<DriverSeasonHistoryResponse | null>(null);
  const [raceData, setRaceData] = useState<DriverRaceHistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [graphMode, setGraphMode] = useState<GraphMode>("season");
  const [dataMode, setDataMode] = useState<DataMode>("position");
  const [showRangeSelector, setShowRangeSelector] = useState(false);
  const [yearRange, setYearRange] = useState<{ start: number; end: number } | null>(null);

  // Fetch season data
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const response = await fetch(
          apiUrl(`/api/drivers/${driverCode}/season-history`),
          {
            cache: "no-store",
            headers: apiHeaders(),
          }
        );
        const historyData = await response.json();

        // Add previous season data for change calculations
        const enrichedSeasons = historyData.seasons.map(
          (season: SeasonHistory, index: number) => {
            if (index === 0) {
              return season;
            }
            const prevSeason = historyData.seasons[index - 1];
            return {
              ...season,
              prevPosition: prevSeason.championship_position,
              prevPoints: prevSeason.total_points,
            };
          }
        );

        setSeasonData({ ...historyData, seasons: enrichedSeasons });
      } catch (error) {
        console.error("Failed to fetch driver season history:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [driverCode]);

  // Fetch race data when switching to race mode or changing year range
  useEffect(() => {
    if (graphMode === "race") {
      (async () => {
        try {
          setLoading(true);
          const params = new URLSearchParams();
          if (yearRange) {
            params.append("start_year", yearRange.start.toString());
            params.append("end_year", yearRange.end.toString());
          }

          const response = await fetch(
            apiUrl(`/api/drivers/${driverCode}/race-history?${params}`),
            {
              cache: "no-store",
              headers: apiHeaders(),
            }
          );
          const historyData = await response.json();
          setRaceData(historyData);

          // Set default year range if not set
          if (!yearRange && historyData.available_years.length > 0) {
            const endYear = historyData.available_years[0];
            const startYear = Math.max(
              endYear - 4,
              historyData.available_years[historyData.available_years.length - 1]
            );
            setYearRange({ start: startYear, end: endYear });
          }
        } catch (error) {
          console.error("Failed to fetch driver race history:", error);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [driverCode, graphMode, yearRange]);

  const handleRangeSelect = (start: number, end: number) => {
    setYearRange({ start, end });
  };

  if (loading) {
    return (
      <div className="bg-[#1e1e28] border border-[#2a2a35] rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-[#2a2a35] rounded w-1/3 mb-4" />
          <div className="h-64 bg-[#2a2a35] rounded" />
        </div>
      </div>
    );
  }

  const currentData = graphMode === "season" ? seasonData : raceData;

  if (!currentData || (graphMode === "season" && seasonData?.seasons.length === 0) || (graphMode === "race" && raceData?.races.length === 0)) {
    return (
      <div className="bg-[#1e1e28] border border-[#2a2a35] rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">
          Championship History
        </h3>
        <p className="text-gray-400">No data available</p>
      </div>
    );
  }

  // Prepare chart data based on mode
  const chartData = graphMode === "season" ? seasonData?.seasons : raceData?.races;

  // For race mode, we need to add year labels at appropriate positions
  const raceChartData = graphMode === "race" && raceData
    ? raceData.races.map((race, index) => ({
        ...race,
        raceIndex: index,
        yearLabel: race.year.toString(), // Always show year for tooltip access
        showYearLabel: index === 0 || race.year !== raceData.races[index - 1]?.year,
      }))
    : [];

  const finalChartData = graphMode === "season" ? chartData : raceChartData;

  // Get line color
  const getLineColor = () => {
    if (graphMode === "season" && seasonData) {
      const latestSeason = seasonData.seasons[seasonData.seasons.length - 1];
      return latestSeason.team_color ? `#${latestSeason.team_color}` : "#a020f0";
    }
    return "#a020f0";
  };

  return (
    <div className="bg-[#1e1e28] border border-[#2a2a35] rounded-lg shadow-lg p-6">
      {/* Header with Toggles */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Championship History</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGraphMode("season")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                graphMode === "season"
                  ? "bg-[#a020f0] text-white"
                  : "bg-[#252530] text-gray-400 hover:bg-[#2a2a35]"
              }`}
            >
              By Season
            </button>
            <button
              type="button"
              onClick={() => setGraphMode("race")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                graphMode === "race"
                  ? "bg-[#a020f0] text-white"
                  : "bg-[#252530] text-gray-400 hover:bg-[#2a2a35]"
              }`}
            >
              By Race
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDataMode("position")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                dataMode === "position"
                  ? "bg-[#a020f0] text-white"
                  : "bg-[#252530] text-gray-400 hover:bg-[#2a2a35]"
              }`}
            >
              Finishing Position
            </button>
            <button
              type="button"
              onClick={() => setDataMode("points")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                dataMode === "points"
                  ? "bg-[#a020f0] text-white"
                  : "bg-[#252530] text-gray-400 hover:bg-[#2a2a35]"
              }`}
            >
              Total Points
            </button>
          </div>

          {graphMode === "race" && yearRange && raceData && (
            <button
              type="button"
              onClick={() => setShowRangeSelector(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#252530] text-gray-300 hover:bg-[#2a2a35] transition-all"
            >
              {yearRange.start} - {yearRange.end}
            </button>
          )}
        </div>
      </div>

      {/* Graph */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={finalChartData}
          margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
          <XAxis
            dataKey={graphMode === "season" ? "year" : "raceIndex"}
            tick={graphMode === "season" ? <CustomXAxisTickSeason /> : <CustomXAxisTickRace />}
            stroke="#666"
            tickLine={false}
            interval={graphMode === "season" ? 0 : "preserveStart"}
          />
          <YAxis
            reversed={dataMode === "position"}
            domain={
              dataMode === "position"
                ? [1, (dataMax: number) => Math.max(dataMax, 20)]
                : [0, "auto"]
            }
            tick={{ fill: "#999", fontSize: 12 }}
            stroke="#666"
            tickLine={false}
            label={{
              value: dataMode === "position" ? "Finishing Position" : "Total Points",
              angle: -90,
              position: "insideLeft",
              fill: "#999",
              fontSize: 12,
            }}
          />
          <Tooltip content={<CustomTooltip graphMode={graphMode} />} />
          <Line
            type="monotone"
            dataKey={
              graphMode === "season"
                ? dataMode === "position"
                  ? "championship_position"
                  : "total_points"
                : dataMode === "position"
                  ? "position"
                  : "points"
            }
            stroke={getLineColor()}
            strokeWidth={3}
            dot={<CustomDot />}
            activeDot={<CustomActiveDot />}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Range Selector Modal */}
      {showRangeSelector && raceData && (
        <RangeSelector
          availableYears={raceData.available_years}
          currentStart={yearRange?.start || raceData.available_years[raceData.available_years.length - 1]}
          currentEnd={yearRange?.end || raceData.available_years[0]}
          onRangeSelect={handleRangeSelect}
          onClose={() => setShowRangeSelector(false)}
        />
      )}
    </div>
  );
}
