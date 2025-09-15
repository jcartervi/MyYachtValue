interface HullPriceLogoProps {
  size?: number;
  className?: string;
}

export default function HullPriceLogo({ size = 40, className = "" }: HullPriceLogoProps) {
  return (
    <div
      className={`rounded-xl bg-white/90 backdrop-blur text-black font-bold grid place-items-center ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(12, size * 0.4)
      }}
    >
      HP
    </div>
  );
}