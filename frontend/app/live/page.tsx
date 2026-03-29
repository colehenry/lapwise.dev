import LivePage from "./LivePage";

export const metadata = {
  title: "Live & Replay — Lapwise",
  description:
    "Watch race replays with animated driver positions on track maps, or follow live race data during active F1 sessions.",
};

export default function LivePageRoute() {
  return <LivePage />;
}
