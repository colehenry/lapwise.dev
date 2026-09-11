import { NextResponse } from "next/server";
import { missingClutchEnvironment } from "@/lib/ai/clutch-runtime";

export function GET() {
  if (process.env.CLUTCH_RUNTIME !== "true") {
    return NextResponse.json({ status: "ok", service: "frontend" });
  }
  const configured = missingClutchEnvironment().length === 0;
  return NextResponse.json(
    { status: configured ? "ok" : "misconfigured", service: "clutch" },
    { status: configured ? 200 : 503 },
  );
}
