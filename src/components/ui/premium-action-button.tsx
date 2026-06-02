import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PremiumActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: React.ReactElement<{ className?: string }>;
  title: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "rounded-xl px-3 py-2",
  md: "rounded-2xl px-4 py-3",
  lg: "rounded-3xl px-5 py-4",
};

export const PremiumActionButton = React.forwardRef<
  HTMLButtonElement,
  PremiumActionButtonProps
>(({ icon, title, subtitle, size = "md", className, type = "button", ...props }, ref) => {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "group relative inline-flex min-h-10 max-w-full cursor-pointer items-center overflow-hidden border border-primary/45 bg-gradient-to-br from-primary/95 via-primary/80 to-orange-500/95 text-primary-foreground shadow-2xl shadow-primary/15 transition-all duration-500 ease-out hover:-translate-y-0.5 hover:scale-[1.015] hover:border-primary/70 hover:shadow-primary/30 active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
        sizes[size],
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.26),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.1),transparent_52%,rgba(0,0,0,0.22))] opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/20 bg-black/20 backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-white/15">
          {React.cloneElement(icon, {
            className: cn(
              "h-4 w-4 text-white drop-shadow-lg transition-all duration-300",
              icon.props.className,
            ),
          })}
        </div>
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-bold leading-tight text-white drop-shadow-sm">
            {title}
          </p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-white/75">{subtitle}</p>}
        </div>
        <ChevronRight className="hidden h-4 w-4 shrink-0 text-white/65 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white sm:block" />
      </div>
    </button>
  );
});

PremiumActionButton.displayName = "PremiumActionButton";
