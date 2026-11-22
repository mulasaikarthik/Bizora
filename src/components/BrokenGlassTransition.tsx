import { useEffect, useState, useMemo } from "react";
import { useTheme } from "../context/ThemeContext";

interface Shard {
  id: number;
  clipPath: string;
  delay: number;
  dx: number;
  dy: number;
  rot: number;
  tint: string;
}

export function BrokenGlassTransition() {
  const { isTransitioning, shatterOrigin, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isTransitioning) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), 850);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  // Generate dynamic fracture shards based on shatterOrigin
  const shards = useMemo<Shard[]>(() => {
    const ox = shatterOrigin.x * 100;
    const oy = shatterOrigin.y * 100;

    return [
      {
        id: 1,
        clipPath: `polygon(${ox}% ${oy}%, 0% 0%, 35% 0%, 25% ${Math.min(100, oy + 25)}%)`,
        delay: 0,
        dx: -8,
        dy: -6,
        rot: -1.8,
        tint: "rgba(0, 240, 255, 0.12)",
      },
      {
        id: 2,
        clipPath: `polygon(${ox}% ${oy}%, 35% 0%, 75% 0%, ${Math.min(100, ox + 20)}% ${Math.max(0, oy - 20)}%)`,
        delay: 30,
        dx: 4,
        dy: -8,
        rot: 1.2,
        tint: "rgba(255, 0, 119, 0.10)",
      },
      {
        id: 3,
        clipPath: `polygon(${ox}% ${oy}%, 75% 0%, 100% 0%, 100% 45%, ${Math.min(100, ox + 35)}% ${oy}%)`,
        delay: 50,
        dx: 8,
        dy: -4,
        rot: 2.1,
        tint: "rgba(154, 124, 244, 0.14)",
      },
      {
        id: 4,
        clipPath: `polygon(${ox}% ${oy}%, 100% 45%, 100% 85%, ${Math.min(100, ox + 30)}% ${Math.min(100, oy + 35)}%)`,
        delay: 40,
        dx: 9,
        dy: 5,
        rot: 1.5,
        tint: "rgba(0, 240, 255, 0.10)",
      },
      {
        id: 5,
        clipPath: `polygon(${ox}% ${oy}%, 100% 85%, 100% 100%, 65% 100%, ${Math.max(0, ox - 10)}% ${Math.min(100, oy + 45)}%)`,
        delay: 70,
        dx: 6,
        dy: 8,
        rot: -1.4,
        tint: "rgba(255, 0, 119, 0.12)",
      },
      {
        id: 6,
        clipPath: `polygon(${ox}% ${oy}%, 65% 100%, 20% 100%, 0% 85%, ${Math.max(0, ox - 35)}% ${Math.min(100, oy + 25)}%)`,
        delay: 60,
        dx: -6,
        dy: 9,
        rot: -2.3,
        tint: "rgba(154, 124, 244, 0.15)",
      },
      {
        id: 7,
        clipPath: `polygon(${ox}% ${oy}%, 0% 85%, 0% 35%, ${Math.max(0, ox - 25)}% ${Math.max(0, oy - 20)}%)`,
        delay: 80,
        dx: -9,
        dy: 2,
        rot: 1.7,
        tint: "rgba(0, 240, 255, 0.12)",
      },
      {
        id: 8,
        clipPath: `polygon(${ox}% ${oy}%, 0% 35%, 0% 0%, 25% ${Math.min(100, oy + 25)}%)`,
        delay: 20,
        dx: -7,
        dy: -5,
        rot: -1.1,
        tint: "rgba(255, 255, 255, 0.15)",
      },
    ];
  }, [shatterOrigin]);

  if (!mounted && !isTransitioning) return null;

  const ox = shatterOrigin.x * 100;
  const oy = shatterOrigin.y * 100;

  return (
    <div
      className={`broken-glass-overlay ${isTransitioning ? "is-active" : "is-dissolving"}`}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* 1. Flash Shockwave */}
      <div
        className="glass-shockwave"
        style={{
          position: "absolute",
          inset: 0,
          background:
            theme === "dark"
              ? "radial-gradient(circle at " + ox + "% " + oy + "%, rgba(255, 255, 255, 0.45) 0%, rgba(154, 124, 244, 0.25) 40%, transparent 80%)"
              : "radial-gradient(circle at " + ox + "% " + oy + "%, rgba(255, 255, 255, 0.7) 0%, rgba(90, 56, 140, 0.2) 40%, transparent 80%)",
        }}
      />

      {/* 2. Glass Polygonal Facets & Refraction Shards */}
      {shards.map((s) => (
        <div
          key={s.id}
          className="glass-facet"
          style={{
            position: "absolute",
            inset: 0,
            clipPath: s.clipPath,
            backdropFilter: "blur(7px) contrast(140%) brightness(115%) saturate(130%)",
            WebkitBackdropFilter: "blur(7px) contrast(140%) brightness(115%) saturate(130%)",
            backgroundColor: s.tint,
            boxShadow: "inset 0 0 25px rgba(255, 255, 255, 0.35)",
            transform: isTransitioning
              ? `translate(${s.dx}px, ${s.dy}px) rotate(${s.rot}deg)`
              : "translate(0px, 0px) rotate(0deg)",
            transition: "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease",
          }}
        />
      ))}

      {/* 3. SVG Crack Vector Network with Chromatic Aberration */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <filter id="glass-chromatic-glow">
            <feDropShadow dx="-1" dy="0" stdDeviation="0.4" floodColor="#00F0FF" floodOpacity="0.8" />
            <feDropShadow dx="1" dy="0" stdDeviation="0.4" floodColor="#FF0077" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Primary Radial Cracks */}
        <g filter="url(#glass-chromatic-glow)">
          <path
            d={`M ${ox} ${oy} L ${ox - 18} ${Math.max(0, oy - 22)} L 0 0`}
            stroke="#FFFFFF"
            strokeWidth="0.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M ${ox} ${oy} L ${Math.min(100, ox + 14)} ${Math.max(0, oy - 25)} L 35 0`}
            stroke="#FFFFFF"
            strokeWidth="0.6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M ${ox} ${oy} L ${Math.min(100, ox + 28)} ${Math.max(0, oy - 15)} L 75 0`}
            stroke="#FFFFFF"
            strokeWidth="0.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M ${ox} ${oy} L ${Math.min(100, ox + 32)} ${oy} L 100 45`}
            stroke="#FFFFFF"
            strokeWidth="0.65"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M ${ox} ${oy} L ${Math.min(100, ox + 22)} ${Math.min(100, oy + 28)} L 100 85`}
            stroke="#FFFFFF"
            strokeWidth="0.55"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M ${ox} ${oy} L ${Math.max(0, ox + 5)} ${Math.min(100, oy + 35)} L 65 100`}
            stroke="#FFFFFF"
            strokeWidth="0.6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M ${ox} ${oy} L ${Math.max(0, ox - 20)} ${Math.min(100, oy + 26)} L 20 100`}
            stroke="#FFFFFF"
            strokeWidth="0.55"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M ${ox} ${oy} L ${Math.max(0, ox - 32)} ${Math.max(0, oy + 8)} L 0 85`}
            stroke="#FFFFFF"
            strokeWidth="0.65"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M ${ox} ${oy} L ${Math.max(0, ox - 24)} ${Math.max(0, oy - 18)} L 0 35`}
            stroke="#FFFFFF"
            strokeWidth="0.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Concentric Spiderweb Fracture Rings */}
        <g stroke="rgba(255, 255, 255, 0.75)" strokeWidth="0.35" fill="none">
          <polygon
            points={`
              ${ox - 8},${oy - 6}
              ${ox + 6},${oy - 9}
              ${ox + 12},${oy}
              ${ox + 8},${oy + 8}
              ${ox - 4},${oy + 10}
              ${ox - 10},${oy + 2}
            `}
          />
          <polygon
            points={`
              ${ox - 18},${oy - 15}
              ${ox + 14},${oy - 20}
              ${ox + 26},${oy + 2}
              ${ox + 16},${oy + 22}
              ${ox - 12},${oy + 24}
              ${ox - 22},${oy + 6}
            `}
          />
        </g>

        {/* Impact Center Glint */}
        <circle cx={ox} cy={oy} r="1.5" fill="#FFFFFF" />
        <circle cx={ox} cy={oy} r="3" fill="none" stroke="#00F0FF" strokeWidth="0.4" opacity="0.8" />
        <circle cx={ox} cy={oy} r="5" fill="none" stroke="#FF0077" strokeWidth="0.3" opacity="0.7" />
      </svg>

      {/* 4. Prismatic Light Streaks */}
      <div className="glass-interference-bands" />
    </div>
  );
}
