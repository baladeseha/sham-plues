export function QrFallback({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700/70 bg-white p-4 text-slate-900">
      <svg
        viewBox="0 0 120 120"
        className="h-36 w-36 text-[#080C14]"
        role="img"
        aria-label={label}
      >
        <rect width="120" height="120" fill="#ffffff" />
        {/* Finder squares */}
        <path
          fill="currentColor"
          d="M10,10 h32 v32 h-32 z M16,16 v20 h20 v-20 z M21,21 h10 v10 h-10 z"
        />
        <path
          fill="currentColor"
          d="M78,10 h32 v32 h-32 z M84,16 v20 h20 v-20 z M89,21 h10 v10 h-10 z"
        />
        <path
          fill="currentColor"
          d="M10,78 h32 v32 h-32 z M16,84 v20 h20 v-20 z M21,89 h10 v10 h-10 z"
        />
        {/* Deterministic data matrix */}
        <path
          fill="currentColor"
          d="M50,12 h6 v6 h-6 z M60,12 h6 v12 h-6 z M50,26 h6 v6 h-6 z M68,26 h6 v6 h-6 z
             M12,50 h6 v6 h-6 z M24,50 h12 v6 h-12 z M42,48 h10 v10 h-10 z M58,48 h6 v6 h-6 z M70,50 h12 v6 h-12 z M90,48 h16 v6 h-16 z
             M16,62 h14 v6 h-14 z M36,64 h6 v6 h-6 z M48,64 h12 v6 h-12 z M66,62 h6 v12 h-6 z M80,62 h10 v6 h-10 z M96,62 h10 v12 h-10 z
             M50,78 h6 v10 h-6 z M62,80 h14 v6 h-14 z M84,78 h12 v6 h-12 z M102,80 h6 v10 h-6 z
             M50,96 h12 v12 h-12 z M68,94 h6 v6 h-6 z M80,94 h16 v6 h-16 z M72,104 h8 v6 h-8 z M96,104 h12 v6 h-12 z"
        />
      </svg>
      <span className="mt-2 text-xs font-bold text-slate-700">{label}</span>
    </div>
  );
}
