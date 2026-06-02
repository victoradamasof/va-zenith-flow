"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type AnimatedDashboardCardProps = {
  title?: string;
  totalLabel?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryValue?: number;
  secondaryValue?: number;
  primaryDelta?: string;
  secondaryDelta?: string;
  actionLabel?: string;
  className?: string;
  enableAnimations?: boolean;
  onMoreDetails?: () => void;
};

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function generateDots(count: number, radius: number, centerX: number, centerY: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * 2 * Math.PI;
    return {
      x: Math.round((centerX + radius * Math.cos(angle)) * 1000) / 1000,
      y: Math.round((centerY + radius * Math.sin(angle)) * 1000) / 1000,
      delay: index * 0.02,
    };
  });
}

export function AnimatedDashboardCard({
  title = "Composicao financeira",
  totalLabel = "Total",
  primaryLabel = "Recebido",
  secondaryLabel = "Previsto",
  primaryValue = 0,
  secondaryValue = 0,
  primaryDelta = "+15,2%",
  secondaryDelta = "+8,7%",
  actionLabel = "Ver detalhes",
  className,
  enableAnimations = true,
  onMoreDetails,
}: AnimatedDashboardCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = enableAnimations && !shouldReduceMotion;
  const outerDots = generateDots(48, 184, 224, 212);
  const innerDots = generateDots(36, 148, 224, 212);
  const total = primaryValue + secondaryValue;

  return (
    <motion.div
      className={cn("w-full", className)}
      initial={shouldAnimate ? { opacity: 0, y: 18, scale: 0.96 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-card/65 shadow-glow">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_44%)]" />
        <div className="relative px-5 pt-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary/80">
              Dashboard
            </p>
            <h3 className="mt-1 font-display text-base font-semibold">{title}</h3>
          </div>
        </div>

        <div className="relative -mt-6 h-80 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2">
            <svg className="h-full w-full" viewBox="0 0 448 448" aria-hidden="true">
              <g className={shouldAnimate ? "dashboard-orbit dashboard-orbit-cw" : undefined}>
                {outerDots.map((dot, index) => (
                  <motion.circle
                    key={`outer-${index}`}
                    cx={dot.x}
                    cy={dot.y}
                    r="8.5"
                    fill="currentColor"
                    className="text-primary"
                    initial={shouldAnimate ? { opacity: 0, scale: 0 } : false}
                    animate={
                      shouldAnimate
                        ? { opacity: [0, 0.72, 0.52], scale: [0, 1.12, 0.92] }
                        : { opacity: 0.55, scale: 1 }
                    }
                    transition={
                      shouldAnimate
                        ? { delay: dot.delay, duration: 0.55, ease: "easeOut" }
                        : undefined
                    }
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      filter: "drop-shadow(0 0 10px color-mix(in oklab, var(--primary) 45%, transparent))",
                    }}
                  />
                ))}
              </g>
              <g className={shouldAnimate ? "dashboard-orbit dashboard-orbit-ccw" : undefined}>
                {innerDots.map((dot, index) => (
                  <motion.circle
                    key={`inner-${index}`}
                    cx={dot.x}
                    cy={dot.y}
                    r="7.5"
                    fill="currentColor"
                    className="text-success"
                    initial={shouldAnimate ? { opacity: 0, scale: 0 } : false}
                    animate={
                      shouldAnimate
                        ? { opacity: [0, 0.68, 0.48], scale: [0, 1.08, 0.9] }
                        : { opacity: 0.5, scale: 1 }
                    }
                    transition={
                      shouldAnimate
                        ? { delay: 0.18 + dot.delay, duration: 0.55, ease: "easeOut" }
                        : undefined
                    }
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      filter: "drop-shadow(0 0 8px color-mix(in oklab, var(--success) 36%, transparent))",
                    }}
                  />
                ))}
              </g>
            </svg>
          </div>

          <div className="absolute inset-0 flex items-center justify-center pb-16">
            <div className="text-center">
              <motion.p
                className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground"
                initial={shouldAnimate ? { opacity: 0, y: -10, scale: 0.95 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: 0.3,
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                  mass: 0.6,
                }}
              >
                {totalLabel}
              </motion.p>
              <motion.p
                className="mt-2 font-display text-4xl font-semibold text-gradient-primary"
                initial={shouldAnimate ? { opacity: 0, y: 14, filter: "blur(4px)" } : false}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  delay: 0.5,
                  type: "spring",
                  stiffness: 300,
                  damping: 28,
                  mass: 0.8,
                }}
              >
                {formatBRL(total)}
              </motion.p>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-card via-card/95 to-transparent" />
        </div>

        <div className="relative -mt-20 px-5 pb-5">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <MetricBlock
              label={primaryLabel}
              value={primaryValue}
              delta={primaryDelta}
              tone="primary"
              delay={0.45}
              animate={shouldAnimate}
            />
            <MetricBlock
              label={secondaryLabel}
              value={secondaryValue}
              delta={secondaryDelta}
              tone="success"
              delay={0.58}
              animate={shouldAnimate}
            />
          </div>
          <motion.button
            type="button"
            className="h-10 w-full rounded-lg border border-primary/20 bg-primary/10 text-sm font-medium text-primary transition hover:bg-primary/15"
            onClick={onMoreDetails}
            initial={shouldAnimate ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.72 }}
            whileHover={shouldAnimate ? { scale: 1.01 } : undefined}
            whileTap={shouldAnimate ? { scale: 0.99 } : undefined}
          >
            {actionLabel}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function MetricBlock({
  label,
  value,
  delta,
  tone,
  delay,
  animate,
}: {
  label: string;
  value: number;
  delta: string;
  tone: "primary" | "success";
  delay: number;
  animate: boolean;
}) {
  return (
    <motion.div
      className="rounded-lg border border-border/60 bg-background/35 p-3"
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn("h-4 w-0.5 rounded-full", tone === "primary" ? "bg-primary" : "bg-success")}
        />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums">{formatBRL(value)}</p>
      <p
        className={cn("text-xs font-medium", tone === "primary" ? "text-primary" : "text-success")}
      >
        {delta}
      </p>
    </motion.div>
  );
}
