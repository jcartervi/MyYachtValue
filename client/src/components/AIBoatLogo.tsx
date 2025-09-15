// Legacy component - use HullPriceLogo instead
import HullPriceLogo from "@/components/HullPriceLogo";

interface AIBoatLogoProps {
  size?: number;
  className?: string;
}

export default function AIBoatLogo({ size = 28, className = "text-primary" }: AIBoatLogoProps) {
  return <HullPriceLogo size={size} className={className} />;
}