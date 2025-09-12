interface DeckWorthLogoProps {
  size?: number;
  className?: string;
}

export default function DeckWorthLogo({ size = 28, className = "text-primary" }: DeckWorthLogoProps) {
  return (
    <i className={`fas fa-anchor ${className}`} style={{ fontSize: `${size-4}px` }} />
  );
}