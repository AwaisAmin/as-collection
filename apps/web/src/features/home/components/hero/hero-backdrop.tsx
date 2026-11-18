/** Soft cream gradient with faint arched architecture (pure CSS/SVG, no image request). */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_45%,#fdf8f3_0%,#f6ebe1_55%,#efe0d3_100%)]" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 520"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="hero-arch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* arched windows */}
        {[
          { x: 40, w: 210 },
          { x: 560, w: 230 },
          { x: 1180, w: 230 },
        ].map(({ x, w }) => (
          <g key={x}>
            <path
              d={`M${x} 520 V ${160 + w / 2} A ${w / 2} ${w / 2} 0 0 1 ${x + w} ${160 + w / 2} V 520`}
              fill="url(#hero-arch)"
              opacity="0.55"
            />
            <path
              d={`M${x - 14} 520 V ${160 + w / 2} A ${w / 2 + 14} ${w / 2 + 14} 0 0 1 ${x + w + 14} ${160 + w / 2} V 520`}
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.6"
              strokeWidth="2"
            />
          </g>
        ))}
        {/* floor glow */}
        <rect x="0" y="470" width="1440" height="50" fill="#ffffff" opacity="0.25" />
      </svg>
    </div>
  );
}
