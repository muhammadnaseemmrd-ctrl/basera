// Shared logo mark for the public navbar/footer, matching "The Gold Standard"
// design system: a building/institution glyph (same concept as Material Symbols
// "corporate_fare") on a Deep Teal badge, paired with the "Basera" wordmark in
// Plus Jakarta Sans. Rendered as inline SVG (not a Material Symbols font glyph)
// so it stays crisp at any size and needs no extra network request.
export function LogoMark({ size = 40, className = "" }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={`shrink-0 rounded-xl shadow-card ${className}`}
      aria-hidden="true"
    >
      <rect x="0" y="0" width="40" height="40" rx="10" fill="#00535B" />
      <polygon points="8,16.5 20,7 32,16.5" fill="#FFFFFF" />
      <rect x="10" y="16" width="20" height="16" rx="1.5" fill="#FFFFFF" />
      <rect x="13.5" y="19.5" width="3" height="6" rx="0.75" fill="#00535B" />
      <rect x="18.5" y="19.5" width="3" height="6" rx="0.75" fill="#00535B" />
      <rect x="23.5" y="19.5" width="3" height="6" rx="0.75" fill="#00535B" />
      <rect x="7" y="30.5" width="26" height="3" rx="1" fill="#FFFFFF" />
    </svg>
  );
}

export function Logo({ size = 40, wordmarkClassName = "", className = "" }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      <span className={`font-display font-bold tracking-tight text-primary-600 ${wordmarkClassName}`}>Basera</span>
    </span>
  );
}
