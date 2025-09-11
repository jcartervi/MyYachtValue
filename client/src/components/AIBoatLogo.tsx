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
      {/* Modern luxury hull - sleek and angular */}
      <path
        d="M6 20 L8 18 L24 18 L26 20 L25 24 C25 25 24 26 22 26 L10 26 C8 26 7 25 7 24 L6 20 Z"
        fill="currentColor"
      />
      
      {/* Upper deck/flybridge - modern angular design */}
      <path
        d="M10 14 L11 12 L21 12 L22 14 L22 18 L10 18 L10 14 Z"
        fill="currentColor"
        opacity="0.8"
      />
      
      {/* Pilot house/bridge - sleek modern cabin */}
      <path
        d="M12 8 L13 6 L19 6 L20 8 L20 12 L12 12 L12 8 Z"
        fill="currentColor"
        opacity="0.6"
      />
      
      {/* Modern bow detail */}
      <path
        d="M24 18 L28 19 L26 20 L24 18 Z"
        fill="currentColor"
        opacity="0.7"
      />
      
      {/* Subtle wake/water lines */}
      <path
        d="M6 28 Q16 26 26 28"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M8 30 Q16 28.5 24 30"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
    </svg>
  );
}