import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface ValuationGaugeProps {
  wholesale: number;
  market: number;
  replacement: number;
}

const TRACK_COLOR = "#E9EEF3";
const TICK_COLOR = "rgba(203, 213, 225, 0.35)";
const STROKE_WIDTH = 16;
const START_ANGLE = -180;
const END_ANGLE = 0;
const TICK_COUNT = 5;

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const angleRad = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    1,
    end.x,
    end.y,
  ].join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function useAnimatedNumber(target: number, disabled: boolean) {
  const [value, setValue] = useState(target);
  const previous = useRef(target);

  useEffect(() => {
    if (disabled) {
      setValue(target);
      previous.current = target;
      return;
    }

    const startValue = previous.current;
    const delta = target - startValue;
    if (delta === 0) {
      return;
    }

    const duration = 500;
    const startTime = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(startValue + delta * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        previous.current = target;
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, disabled]);

  useEffect(() => {
    if (disabled) {
      setValue(target);
    }
  }, [target, disabled]);

  return value;
}

export function ValuationGauge({ wholesale, market, replacement }: ValuationGaugeProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const minValue = Math.min(wholesale, replacement);
  const maxValue = Math.max(wholesale, replacement);
  const safeRange = maxValue - minValue;
  const clampedMarket = clamp(market, minValue, maxValue);
  const progress = safeRange === 0 ? 0 : (clampedMarket - minValue) / safeRange;
  const gaugeAngle = START_ANGLE + (END_ANGLE - START_ANGLE) * progress;
  const targetRotation = gaugeAngle - START_ANGLE;

  const cardLabel = useMemo(() => {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
    return `Wholesale value ${formatter.format(wholesale)}, Market value ${formatter.format(market)}, Replacement cost ${formatter.format(replacement)}`;
  }, [market, replacement, wholesale]);

  const formattedValues = useMemo(() => {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

    return {
      wholesale: formatter.format(wholesale),
      market: formatter.format(market),
      replacement: formatter.format(replacement),
    };
  }, [market, replacement, wholesale]);

  const animatedMarket = useAnimatedNumber(market, shouldReduceMotion);
  const animatedFormattedMarket = useMemo(() => {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
    return formatter.format(Math.round(animatedMarket));
  }, [animatedMarket]);

  const width = 320;
  const height = 200;
  const centerX = width / 2;
  const centerY = height - STROKE_WIDTH / 2;
  const radius = width / 2 - STROKE_WIDTH;

  const arcPath = describeArc(centerX, centerY, radius, START_ANGLE, END_ANGLE);
  const activeArcPath = describeArc(centerX, centerY, radius, START_ANGLE, gaugeAngle);

  const tickAngles = Array.from({ length: TICK_COUNT }, (_, index) => {
    const denominator = Math.max(TICK_COUNT - 1, 1);
    const ratio = index / denominator;
    return START_ANGLE + (END_ANGLE - START_ANGLE) * ratio;
  });

  const arcEnd = polarToCartesian(centerX, centerY, radius, gaugeAngle);

  const initialAngle = shouldReduceMotion ? targetRotation : 0;
  const [isFirstRender, setIsFirstRender] = useState(true);

  useEffect(() => {
    setIsFirstRender(false);
  }, []);

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : isFirstRender
      ? { type: "spring", stiffness: 120, damping: 14 }
      : { duration: 0.25, ease: "easeOut" };

  return (
    <div className="rounded-2xl shadow-sm bg-white p-6 md:p-8">
      <div className="flex flex-col items-center gap-6">
        <div className="w-full flex justify-center">
          <svg
            role="img"
            aria-label={cardLabel}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="max-w-full"
          >
            <defs>
              <filter id="valuationGaugeGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <path d={arcPath} fill="none" stroke={TRACK_COLOR} strokeWidth={STROKE_WIDTH} strokeLinecap="round" />

            {tickAngles.map((angle, index) => {
              const outer = polarToCartesian(centerX, centerY, radius - STROKE_WIDTH / 2, angle);
              const inner = polarToCartesian(centerX, centerY, radius - STROKE_WIDTH * 1.2, angle);
              return (
                <line
                  key={angle + index}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke={TICK_COLOR}
                  strokeWidth={1}
                  strokeLinecap="round"
                />
              );
            })}

            <path
              d={activeArcPath}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeOpacity={0.8}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
            />

            <motion.g
              initial={{ rotate: initialAngle }}
              animate={{ rotate: targetRotation }}
              transition={transition}
              style={{ originX: centerX, originY: centerY }}
            >
              <line
                x1={centerX}
                y1={centerY}
                x2={polarToCartesian(centerX, centerY, radius - STROKE_WIDTH * 1.4, START_ANGLE).x}
                y2={polarToCartesian(centerX, centerY, radius - STROKE_WIDTH * 1.4, START_ANGLE).y}
                stroke="hsl(var(--primary))"
                strokeWidth={4}
                strokeLinecap="round"
              />
              <circle cx={centerX} cy={centerY} r={6} fill="hsl(var(--primary))" fillOpacity={0.9} />
            </motion.g>

            <circle
              cx={arcEnd.x}
              cy={arcEnd.y}
              r={8}
              fill="hsl(var(--primary))"
              fillOpacity={0.25}
              filter="url(#valuationGaugeGlow)"
            />
          </svg>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <div className="rounded-xl border border-transparent bg-white/60 p-4 transition-transform duration-150 ease-out hover:-translate-y-px hover:shadow-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Wholesale</div>
            <div className="text-3xl font-semibold tabular-nums" data-testid="value-wholesale">
              {formattedValues.wholesale}
            </div>
          </div>
          <div className="rounded-xl border border-transparent bg-white/60 p-4 transition-transform duration-150 ease-out hover:-translate-y-px hover:shadow-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Market</div>
            <div className="text-3xl font-semibold tabular-nums" data-testid="value-market">
              {animatedFormattedMarket}
            </div>
          </div>
          <div className="rounded-xl border border-transparent bg-white/60 p-4 transition-transform duration-150 ease-out hover:-translate-y-px hover:shadow-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Replacement</div>
            <div className="text-3xl font-semibold tabular-nums" data-testid="value-replacement">
              {formattedValues.replacement}
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Range shown from Wholesale to Replacement Cost. Needle marks Market Value.
        </p>
      </div>
    </div>
  );
}
