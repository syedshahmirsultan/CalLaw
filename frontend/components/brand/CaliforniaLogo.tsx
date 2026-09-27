import React from "react";

interface CaliforniaLogoProps {
  size?: number;
  className?: string;
  /** Scales gently balance and the star twinkles (used while "thinking") */
  animated?: boolean;
}

/**
 * CalLaw mark: gold scales of justice beneath the California star,
 * on a deep-navy rounded badge. Simple enough to read at 20px.
 */
export function CaliforniaLogo({ size = 40, className = "", animated = false }: CaliforniaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${animated ? "logo-sway " : ""}${className}`}
      role="img"
      aria-label="CalLaw"
    >
      <rect width="64" height="64" rx="16" fill="#0E1728" />
      <rect x="1" y="1" width="62" height="62" rx="15" stroke="#D4A43B" strokeOpacity="0.35" strokeWidth="2" />
      {/* California star */}
      <path
        className="logo-star"
        d="M32 9.5l2.06 4.6 5 .5-3.76 3.34 1.08 4.9L32 20.3l-4.38 2.54 1.08-4.9-3.76-3.34 5-.5L32 9.5z"
        fill="#DFB95F"
      />
      {/* Pillar & base */}
      <rect x="30.6" y="24" width="2.8" height="22" rx="1.2" fill="#F8F6F1" />
      <rect x="23" y="46" width="18" height="3.2" rx="1.6" fill="#F8F6F1" />
      <g className="logo-beam">
      {/* Beam */}
      <rect x="14" y="25.2" width="36" height="2.8" rx="1.4" fill="#F8F6F1" />
      {/* Strings */}
      <path d="M17 28l-4.5 11M17 28l4.5 11M47 28l-4.5 11M47 28l4.5 11" stroke="#DFB95F" strokeWidth="1.4" strokeLinecap="round" />
      {/* Pans */}
      <path d="M11 39.5h12a6 6 0 0 1-12 0z" fill="#D4A43B" />
      <path d="M41 39.5h12a6 6 0 0 1-12 0z" fill="#D4A43B" />
      </g>
    </svg>
  );
}

/** Mark + serif wordmark. */
export function CalLawWordmark({
  size = 32,
  tone = "dark",
  subtitle,
}: {
  size?: number;
  tone?: "dark" | "light";
  subtitle?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <CaliforniaLogo size={size} />
      <span className="flex flex-col leading-none">
        <span
          className={`font-display font-semibold tracking-tight ${tone === "light" ? "text-cream-50" : "text-ink-900"}`}
          style={{ fontSize: size * 0.6 }}
        >
          Cal<span className="text-gold-400">Law</span>
        </span>
        {subtitle && (
          <span className={`text-[10px] mt-1 tracking-wide ${tone === "light" ? "text-night-300" : "text-ink-400"}`}>
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
