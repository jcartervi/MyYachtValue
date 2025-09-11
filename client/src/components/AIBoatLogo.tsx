interface AIBoatLogoProps {
  size?: number;
  className?: string;
}

export default function AIBoatLogo({ size = 28, className = "text-foreground" }: AIBoatLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
      {/* Boat hull */}
      <path
        d="M6 20c0-2 2-4 6-4h8c4 0 6 2 6 4v2c0 2-2 4-6 4H12c-4 0-6-2-6-4v-2z"
        fill="currentColor"
        opacity="0.8"
      />
      
      {/* AI text integrated into design */}
      <text
        x="16"
        y="14"
        textAnchor="middle"
        className="text-[10px] font-bold"
        fill="currentColor"
      >
        AI
      </text>
      
      {/* Tech dots/nodes */}
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <circle cx="22" cy="10" r="1.5" fill="currentColor" />
      <circle cx="16" cy="6" r="1.5" fill="currentColor" />
      
      {/* Connecting lines */}
      <line x1="10" y1="10" x2="16" y2="6" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="22" y1="10" x2="16" y2="6" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}