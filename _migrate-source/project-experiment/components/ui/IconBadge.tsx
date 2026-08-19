// IconBadge — reusable icon wrapped in a colored circle badge.
// Background uses --status-*-bg, icon color uses --status-* solid.
// Size: 40px circle, 20px icon by default.

import React from "react";

type StatusVariant = "good" | "warn" | "bad" | "info" | "neutral";

interface IconBadgeProps {
  icon: React.ReactNode;
  variant?: StatusVariant;
  size?: number;        // circle diameter in px, default 40
  className?: string;
  style?: React.CSSProperties;
}

const variantStyles: Record<StatusVariant, React.CSSProperties> = {
  good:    { background: "var(--status-good-bg)",    color: "var(--status-good)"    },
  warn:    { background: "var(--status-warn-bg)",    color: "var(--status-warn)"    },
  bad:     { background: "var(--status-bad-bg)",     color: "var(--status-bad)"     },
  info:    { background: "var(--status-info-bg)",    color: "var(--status-info)"    },
  neutral: { background: "var(--panel-2)",            color: "var(--muted)"          },
};

export function IconBadge({
  icon,
  variant = "neutral",
  size = 40,
  className = "",
  style,
}: IconBadgeProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        transition: "background 0.2s, color 0.2s",
        ...variantStyles[variant],
        ...style,
      }}
    >
      {icon}
    </span>
  );
}
