import type { CSSProperties } from "react";

export interface LogoProps {
  variant?: "full" | "mark";
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Logo({ variant = "full", size = 34, className = "", style }: LogoProps) {
  const mark = (
    <img
      src="/bizora-logo.png"
      alt="Bizora Logo"
      width={Math.round(size * 1.35)}
      height={size}
      style={{
        display: "block",
        height: size,
        width: "auto",
        maxWidth: Math.round(size * 1.55),
        objectFit: "contain",
        filter: "drop-shadow(0 2px 6px rgba(90, 56, 140, 0.22))",
        transition: "transform 0.2s ease",
      }}
    />
  );

  if (variant === "mark") {
    return (
      <span
        role="img"
        aria-label="Bizora"
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 0,
          ...style,
        }}
      >
        {mark}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label="Bizora"
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        textDecoration: "none",
        userSelect: "none",
        ...style,
      }}
    >
      {mark}
      <span
        style={{
          fontWeight: 800,
          color: "var(--c-text)",
          fontSize: Math.max(17, size * 0.65),
          letterSpacing: "-0.03em",
          lineHeight: 1,
          display: "flex",
          alignItems: "baseline",
        }}
      >
        Bizora
        <span
          style={{
            display: "inline-block",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--c-accent)",
            marginLeft: 3,
          }}
        />
      </span>
    </span>
  );
}
