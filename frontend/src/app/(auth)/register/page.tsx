"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", slug: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function change(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "name" && !prev.slug
        ? { slug: value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") }
        : {}),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Registration failed. Try a different workspace ID.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-sm text-text placeholder:text-muted outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15";

  return (
    <div className="w-full mx-auto">
      <div className="text-center mb-7">
        <div className="inline-flex w-11 h-11 rounded-xl bg-accent items-center justify-center mb-4 shadow-lg shadow-accent/25">
          <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-lg font-semibold text-text mb-1">Create account</h1>
        <p className="text-sm text-muted">Start your free voice agent</p>
      </div>

      <div className="bg-surface border border-white/10 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-medium text-muted">Organization name</label>
            <input id="name" name="name" value={form.name} onChange={change} placeholder="Acme Corp" required className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="slug" className="text-xs font-medium text-muted">
              Workspace ID{" "}
              <span className="text-muted/50 font-normal">(lowercase, no spaces)</span>
            </label>
            <input
              id="slug" name="slug" value={form.slug} onChange={change}
              placeholder="acme-corp" pattern="[a-z0-9-]+"
              title="Lowercase letters, numbers, and hyphens only"
              required className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted">Email</label>
            <input
              id="email" name="email" type="email" autoComplete="email"
              value={form.email} onChange={change} placeholder="you@example.com"
              required className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-muted">Password</label>
            <input
              id="password" name="password" type="password" autoComplete="new-password"
              value={form.password} onChange={change} placeholder="Min. 8 characters"
              minLength={8} required className={inputClass}
            />
          </div>

          {error && (
            <p className="text-xs text-danger text-center bg-danger/8 border border-danger/18 rounded-lg py-2 px-3">
              {error}
            </p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full h-9 flex items-center justify-center gap-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-0.5 shadow-sm shadow-accent/20"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-muted mt-5">
        Already have an account?{" "}
        <Link href="/login" className="text-accent-light hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
