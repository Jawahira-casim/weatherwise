import React from 'react';
import { Sun, Cloud, CloudRain, CloudLightning, CloudFog, Snowflake } from 'lucide-react';

export function WeatherIcon({ type, size = 24 }: { type: string; size?: number }) {
  if (type === 'sun') {
    return (
      <Sun
        size={size}
        aria-hidden
        className="text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]"
      />
    );
  }
  if (type === 'partly') {
    return (
      <div className="relative h-fit w-fit" aria-hidden>
        <Sun size={size} className="text-amber-300" />
        <Cloud size={size * 0.62} className="absolute -bottom-1 -right-2 text-slate-200" />
      </div>
    );
  }
  if (type === 'cloud') return <Cloud size={size} aria-hidden className="text-slate-300" />;
  if (type === 'fog') return <CloudFog size={size} aria-hidden className="text-slate-400" />;
  if (type === 'rain') return <CloudRain size={size} aria-hidden className="text-cyan-300" />;
  if (type === 'snow') return <Snowflake size={size} aria-hidden className="text-blue-200" />;
  return <CloudLightning size={size} aria-hidden className="text-purple-300" />;
}

export function DetailCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:bg-white/[0.06]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">{title}</span>
        <span className="text-cyan-300" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="text-lg font-medium">{value}</p>
    </div>
  );
}

export function InfoBox({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="text-cyan-300" aria-hidden>
          {icon}
        </span>
        {title}
      </div>
      <p className="mt-2 text-lg font-medium">{value}</p>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-white/[0.06] ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading weather">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <div className="flex items-center gap-5">
            <Skeleton className="h-28 w-28 !rounded-full" />
            <Skeleton className="h-24 w-56" />
          </div>
          <Skeleton className="mt-6 h-12 w-72" />
          <Skeleton className="mt-4 h-10 w-full max-w-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 xl:col-span-5">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
      <Skeleton className="mt-10 h-64 w-full" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <span className="sr-only">Loading weather data…</span>
    </div>
  );
}
