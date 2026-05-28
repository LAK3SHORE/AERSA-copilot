export function SectionNum({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span
      className={`font-mono text-[9.5px] tracking-widish text-accent-2/55 ${className}`}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}
