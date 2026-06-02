import * as React from "react";
import { cn } from "@/lib/utils";

type HolographicItemProps = React.HTMLAttributes<HTMLDivElement> & {
  enableTilt?: boolean;
};

function applyHolographicMove(item: HTMLDivElement, event: React.MouseEvent<HTMLDivElement>) {
  const rect = item.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const rotateX = ((y - rect.height / 2) / rect.height) * -3;
  const rotateY = ((x - rect.width / 2) / rect.width) * 3;

  item.style.setProperty("--mouse-x", `${x}px`);
  item.style.setProperty("--mouse-y", `${y}px`);
  item.style.setProperty("--tilt-x", `${rotateX}deg`);
  item.style.setProperty("--tilt-y", `${rotateY}deg`);
}

export const HolographicItem = React.forwardRef<HTMLDivElement, HolographicItemProps>(
  ({ className, enableTilt = true, onMouseMove, onMouseLeave, children, ...props }, ref) => {
    const innerRef = React.useRef<HTMLDivElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
      if (innerRef.current && enableTilt) {
        applyHolographicMove(innerRef.current, event);
      }
      onMouseMove?.(event);
    };

    const handleMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
      const item = innerRef.current;
      if (item) {
        item.style.setProperty("--tilt-x", "0deg");
        item.style.setProperty("--tilt-y", "0deg");
      }
      onMouseLeave?.(event);
    };

    return (
      <div
        ref={setRefs}
        className={cn("holographic-card", className)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <span className="holographic-border" aria-hidden="true" />
        {children}
      </div>
    );
  },
);
HolographicItem.displayName = "HolographicItem";

export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="holographic-grid" />
    </div>
  );
}

export default HolographicItem;
