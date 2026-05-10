"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

  return (
    <div style={{ width: "100%", maxWidth: 360 }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 16,
            background: "var(--color-accent)",
            marginBottom: 12,
          }}
        >
          <PhoneIcon />
        </div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--color-text)", margin: "0 0 4px" }}>
          Create account
        </h1>
        <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", margin: 0 }}>
          Start your free voice agent
        </p>
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: 16,
          padding: "1.5rem",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="name">Organization name</label>
            <input id="name" name="name" value={form.name} onChange={change} placeholder="Acme Corp" required />
          </div>
          <div>
            <label htmlFor="slug">
              Workspace ID{" "}
              <span style={{ color: "var(--color-muted)", textTransform: "none", letterSpacing: 0 }}>
                (lowercase, no spaces)
              </span>
            </label>
            <input
              id="slug"
              name="slug"
              value={form.slug}
              onChange={change}
              placeholder="acme-corp"
              pattern="[a-z0-9-]+"
              title="Lowercase letters, numbers, and hyphens only"
              required
            />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={change}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={change}
              placeholder="Min. 8 characters"
              minLength={8}
              required
            />
          </div>
          {error && (
            <p style={{ color: "var(--color-danger)", fontSize: "0.875rem", textAlign: "center", margin: 0 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px",
              background: "var(--color-accent)",
              color: "#fff",
              fontWeight: 500,
              borderRadius: 8,
            }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>

      <p style={{ textAlign: "center", color: "var(--color-muted)", fontSize: "0.875rem", marginTop: "1rem" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--color-accent-light)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
      <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.02l-2.21 2.2z" />
    </svg>
  );
}
