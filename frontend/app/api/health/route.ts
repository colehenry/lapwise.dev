import { NextResponse } from "next/server";
import { missingClutchEnvironment } from "@/lib/ai/clutch-runtime";

export function GET() {
  if (process.env.CLUTCH_RUNTIME !== "true") {
    return NextResponse.json({ status: "ok", service: "frontend" });
  }
  const missing = missingClutchEnvironment();
  if (missing.length > 0) {
    return NextResponse.json(
      { status: "misconfigured", service: "clutch", missing },
      { status: 503 },
    );
  }
  return NextResponse.json({ status: "ok", service: "clutch" });
}
