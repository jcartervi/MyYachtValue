import * as React from "react";

type Props = { className?: string; title?: string };

export default function MyYachtValueLogo({ className = "h-8 w-auto", title = "MyYachtValue" }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 640 120"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <text
        x="0"
        y="82"
        fontFamily="Inter, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        fontSize="72"
        fontWeight="700"
        letterSpacing="-1"
      >
        MyYachtValue
      </text>
    </svg>
  );
}
