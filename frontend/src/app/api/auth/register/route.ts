import { type NextRequest, NextResponse } from "next/server";
import { createToken, SESSION_COOKIE } from "@/lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const backendRes = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!backendRes.ok) {
    const err = await backendRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: err.error ?? "Registration failed" },
      { status: backendRes.status }
    );
  }

  const data = await backendRes.json();
  const token = await createToken({
    apiKey: data.api_key,
    slug: data.slug,
    orgName: data.name,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...SESSION_COOKIE, value: token });
  return res;
}
