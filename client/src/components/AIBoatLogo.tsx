interface AIBoatLogoProps {
  size?: number;
  className?: string;
}

export default function AIBoatLogo({ size = 28, className = "text-primary" }: AIBoatLogoProps) {
  return (
    <i className={`fas fa-anchor ${className}`} style={{ fontSize: `${size-4}px` }} />
  );
}