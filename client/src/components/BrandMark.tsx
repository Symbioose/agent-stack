export default function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-label="Agent Deck"
      role="img"
      className="inline-flex items-center justify-center rounded-[7px] border border-white/10 bg-white/[0.035] text-white"
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="58%"
        height="58%"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M5 8.25 12 4l7 4.25L12 12.5 5 8.25Z" />
        <path d="m5 12 7 4.25L19 12" />
        <path d="m5 15.75 7 4.25 7-4.25" />
      </svg>
    </span>
  );
}
