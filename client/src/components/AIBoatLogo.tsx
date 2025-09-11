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
      {/* Main boat hull */}
      <path
        d="M8 18c0-1 1-2 3-2h10c2 0 3 1 3 2v4c0 2-2 4-5 4H13c-3 0-5-2-5-4v-4z"
        fill="currentColor"
      />
      
      {/* Boat cabin/superstructure */}
      <path
        d="M12 14c0-1 1-2 2-2h4c1 0 2 1 2 2v4h-8v-4z"
        fill="currentColor"
        opacity="0.7"
      />
      
      {/* Mast */}
      <line x1="16" y1="12" x2="16" y2="6" stroke="currentColor" strokeWidth="2" />
      
      {/* Wave elements beneath */}
      <path
        d="M4 26c2-1 4-1 6 0s4 1 6 0s4-1 6 0s4 1 6 0"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M6 28c2-1 4-1 6 0s4 1 6 0s4-1 6 0"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
    </svg>
  );
}