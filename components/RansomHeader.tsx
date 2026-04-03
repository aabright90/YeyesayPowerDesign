// Reusable ransom-note header component.
// Pass a space-separated string; each word becomes a cut-out block with
// alternating brand colours, borders, shadows, and slight rotations.
//
// Usage:
//   <RansomHeader text="OOPS WORK BENCH" />
//   <RansomHeader text="LIVE INVEN TORY" size="sm" />

interface RansomHeaderProps {
  text: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Full class strings required so Tailwind JIT includes them at build time.
const WORD_STYLES = [
  {
    bg:     "bg-[#dc2626]",
    color:  "text-white",
    shadow: "shadow-[4px_4px_0_0_#111111]",
    rotate: "-rotate-2",
  },
  {
    bg:     "bg-[#facc15]",
    color:  "text-[#111111]",
    shadow: "shadow-[4px_4px_0_0_#111111]",
    rotate: "rotate-[3deg]",
  },
  {
    bg:     "bg-[#111111]",
    color:  "text-[#facc15]",
    shadow: "shadow-[4px_4px_0_0_#facc15]",
    rotate: "-rotate-1",
  },
  {
    bg:     "bg-white",
    color:  "text-[#111111]",
    shadow: "shadow-[4px_4px_0_0_#111111]",
    rotate: "rotate-2",
  },
] as const;

const SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-xl sm:text-2xl",
  lg: "text-2xl sm:text-3xl",
} as const;

export default function RansomHeader({
  text,
  size = "md",
  className = "",
}: RansomHeaderProps) {
  const words = text.split(" ").filter(Boolean);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {words.map((word, i) => {
        const s = WORD_STYLES[i % WORD_STYLES.length];
        return (
          <span
            key={`${word}-${i}`}
            className={[
              "inline-block border-2 border-[#111111]",
              "px-3 py-2 font-mono font-black tracking-[0.1em]",
              SIZE_CLASSES[size],
              s.bg,
              s.color,
              s.shadow,
              s.rotate,
            ].join(" ")}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}
