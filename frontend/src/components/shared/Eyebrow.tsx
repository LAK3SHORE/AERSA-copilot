import type { CSSProperties, ReactNode } from "react";

export function Eyebrow({
  children,
  style,
  className = "",
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[9.5px] tracking-wide2 text-accent-2 font-semibold uppercase ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}
