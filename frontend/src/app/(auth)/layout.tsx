export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg">
      {/* Subtle background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2  h-[400px] rounded-full opacity-[0.06] blur-3xl"
          style={{ background: "radial-gradient(ellipse, #2f81f7 0%, transparent 70%)" }}
        />
      </div>
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
