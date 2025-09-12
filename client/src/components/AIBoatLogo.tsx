// Legacy component - use DeckWorthLogo instead
import DeckWorthLogo from "@/components/DeckWorthLogo";

interface AIBoatLogoProps {
  size?: number;
  className?: string;
}

export default function AIBoatLogo({ size = 28, className = "text-primary" }: AIBoatLogoProps) {
  return <DeckWorthLogo size={size} className={className} />;
}