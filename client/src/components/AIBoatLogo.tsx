// Legacy component - use MyYachtValueLogo instead
import MyYachtValueLogo from "@/components/MyYachtValueLogo";

interface AIBoatLogoProps {
  size?: number;
  className?: string;
}

export default function AIBoatLogo({ size = 28, className = "text-primary" }: AIBoatLogoProps) {
  return <MyYachtValueLogo size={size} className={className} />;
}