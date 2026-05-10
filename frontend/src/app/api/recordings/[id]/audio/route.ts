import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const upstream = await fetch(`${API_URL}/api/calls/${id}/audio`, {
    headers: { "X-API-Key": session.apiKey },
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "Not found" }, { status: upstream.status });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "no-store",
    },
  });
}
