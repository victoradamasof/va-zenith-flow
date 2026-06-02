import * as React from "react";
import { CheckCircle2, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type InteractiveBrokerCardProps = {
  logoSrc: string;
  name: string;
  tradableAssets: string[];
  rating: number;
  ratingText: string;
  reviewsCount: string;
  accountsCount: string;
  learnMoreUrl: string;
  className?: string;
};

const StatItem = ({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) => (
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
    <Icon className="h-3.5 w-3.5 text-primary" />
    <span>{label}</span>
  </div>
);

export function InteractiveBrokerCard({
  logoSrc,
  name,
  tradableAssets,
  rating,
  ratingText,
  reviewsCount,
  accountsCount,
  learnMoreUrl,
  className,
}: InteractiveBrokerCardProps) {
  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-center gap-8 overflow-hidden rounded-2xl border border-primary/20 bg-card/65 p-6 text-card-foreground shadow-glow backdrop-blur md:flex-row md:justify-between md:gap-12 md:p-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute right-0 top-1/2 h-[350px] w-[350px] -translate-y-1/2 translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_28%,transparent)_0%,transparent_68%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_38%)]" />

      <div className="relative z-10 flex flex-col items-center text-center md:items-start md:text-left">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary/80">Sistema conectado</p>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">{name}</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Módulos ativos: {tradableAssets.join(", ")}
        </p>

        <div className="my-6 flex flex-wrap items-center justify-center gap-4 md:justify-start">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center">
              {Array.from({ length: 5 }, (_, index) => (
                <Star
                  key={index}
                  className={cn(
                    "h-4 w-4",
                    index < Math.floor(rating) ? "text-primary" : "text-muted-foreground/45",
                  )}
                  fill="currentColor"
                />
              ))}
            </div>
            <span className="text-xs font-medium text-foreground">
              {rating.toFixed(1)} &bull; {ratingText}
            </span>
          </div>
          <StatItem icon={CheckCircle2} label={reviewsCount} />
          <StatItem icon={Users} label={accountsCount} />
        </div>

        <a
          href={learnMoreUrl}
          className="inline-flex h-10 items-center justify-center rounded-md border border-primary/25 bg-primary/10 px-6 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Ver operação
        </a>
      </div>

      <div className="relative z-10 flex-shrink-0 [perspective:800px]">
        <div className="group relative h-44 w-44 transition-transform duration-500 ease-in-out [transform-style:preserve-3d] hover:[transform:rotateY(-20deg)_rotateX(15deg)_scale(1.05)] md:h-52 md:w-52">
          <div className="absolute h-full w-full rounded-3xl bg-primary/15 transition-transform duration-500 ease-in-out group-hover:[transform:translateZ(-28px)]" />
          <div className="absolute h-full w-full rounded-3xl bg-primary/10 transition-transform duration-500 ease-in-out group-hover:[transform:translateZ(-14px)]" />
          <div className="absolute flex h-full w-full items-center justify-center rounded-3xl border border-primary/30 bg-black shadow-2xl transition-transform duration-500 ease-in-out [transform:translateZ(0)]">
            <img
              src={logoSrc}
              alt={`${name} logo`}
              className="h-2/3 w-2/3 object-contain drop-shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_42%,transparent)]"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
