"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Invalid email or password.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[360px] mx-auto">
      <div className="text-center mb-7">
        <div className="inline-flex w-11 h-11 rounded-xl bg-accent items-center justify-center mb-4 shadow-lg shadow-accent/25">
          <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-lg font-semibold text-text mb-1">Welcome back</h1>
        <p className="text-sm text-muted">Sign in to your account</p>
      </div>

      <div className="bg-surface border border-white/10 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-sm text-text placeholder:text-muted outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-muted">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-sm text-text placeholder:text-muted outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </div>

          {error && (
            <p className="text-xs text-danger text-center bg-danger/8 border border-danger/18 rounded-lg py-2 px-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 flex items-center justify-center gap-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-0.5 shadow-sm shadow-accent/20"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-muted mt-5">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-accent-light hover:underline font-medium">
          Create one
        </Link>
      </p>
    </div>
  );
}
