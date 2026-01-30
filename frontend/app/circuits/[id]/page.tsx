"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";

interface Circuit {
  id: number;
  name: string;
  location: string;
  country: string;
  track_length_km: number | null;
  latitude: number | null;
  longitude: number | null;
  total_races: number;
  first_year: number;
  most_recent_year: number;
}

async function fetchCircuit(id: string): Promise<Circuit> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/circuits/${id}`,
    {
      headers: {
        "X-API-Key": apiKey,
      },
    },
  );

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Circuit not found");
    }
    throw new Error("Failed to fetch circuit");
  }

  return res.json();
}

export default function CircuitDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const {
    data: circuit,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["circuit", id],
    queryFn: () => fetchCircuit(id),
    enabled: !!id,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#15151e] p-4 md:p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#e10600]"></div>
      </div>
    );
  }

  if (error || !circuit) {
    return (
      <div className="min-h-screen bg-[#15151e] p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-white mb-4">
            Circuit Not Found
          </h1>
          <p className="text-gray-400 mb-8">
            The circuit you are looking for does not exist or could not be
            loaded.
          </p>
          <Link
            href="/circuits"
            className="inline-block px-6 py-3 bg-[#e10600] text-white rounded-lg hover:bg-[#c40500] transition-colors"
          >
            Back to Circuits
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#15151e] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="mb-8">
          <Link
            href="/circuits"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Circuits
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                {circuit.name}
              </h1>
              <div className="flex items-center gap-3 text-xl text-gray-400">
                <span className="flex items-center gap-1">
                  🏁 {circuit.location}, {circuit.country}
                </span>
              </div>
            </div>

            {/* Track Map */}
            <div className="bg-[#1e1e2e] rounded-xl p-8 border border-gray-800 flex items-center justify-center min-h-[400px]">
              <div className="relative w-full h-[300px] md:h-[400px]">
                <Image
                  src={`/track-maps/${circuit.id}.png`}
                  alt={`${circuit.name} track map`}
                  fill
                  className="object-contain"
                  // Fallback to text if image fails is handled by Next.js Image component not crashing,
                  // but we might want a placeholder. For now assuming images exist or will just show alt.
                />
              </div>
            </div>
          </div>

          {/* Sidebar Stats */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#1e1e2e] rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="text-[#e10600]">⚡</span> Circuit Stats
              </h2>

              <div className="space-y-6">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    Dimensions
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {circuit.track_length_km
                      ? `${circuit.track_length_km.toFixed(3)} km`
                      : "N/A"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    Activity
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white">
                      {circuit.total_races}
                    </span>
                    <span className="text-gray-400">Grand Prix held</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    History
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">First Race</span>
                      <span className="text-white font-medium">
                        {circuit.first_year}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Most Recent</span>
                      <span className="text-white font-medium">
                        {circuit.most_recent_year}
                      </span>
                    </div>
                  </div>
                </div>

                {(circuit.latitude || circuit.longitude) && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Coordinates
                    </div>
                    <div className="text-sm font-mono text-gray-400">
                      {circuit.latitude?.toFixed(4)},{" "}
                      {circuit.longitude?.toFixed(4)}
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${circuit.latitude},${circuit.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#e10600] hover:text-[#ff4e4e] mt-2 block"
                    >
                      View on Google Maps →
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
