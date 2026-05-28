import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";
import { SectionNum } from "./SectionNum";

export function Section({
  num,
  label,
  children,
  className = "",
}: {
  num: number;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-8 ${className}`}>
      <div
        className="flex items-center justify-between mb-3 pb-2 pl-2.5 border-l-[3px] border-stepper"
        style={{ background: "rgb(134, 156, 78)" }}
      >
        <Eyebrow className="!text-cream">{label}</Eyebrow>
        <SectionNum n={num} className="!text-cream/60" />
      </div>
      {children}
    </div>
  );
}
