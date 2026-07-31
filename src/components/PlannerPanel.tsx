import { useState } from "react";
import {
  Bike,
  Compass,
  Download,
  ExternalLink,
  Gauge,
  Loader2,
  MapPin,
  Mountain,
  Route as RouteIcon,
  Send,
  Star,
  Timer,
  TrendingUp,
} from "lucide-react";
import type { GeneratedRoute, Vehicle } from "@/lib/trail-engine";
import { downloadGPX } from "@/lib/trail-engine";

const EXAMPLES = [
  "Rocky singletrack with high elevation gain near Chiang Mai",
  "Long flowy forest loop near Innsbruck",
  "Technical hard enduro green lanes near Málaga",
];

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="stat-tile">
      <div className="flex items-center gap-1.5 text-[10px] tracking-widest text-muted-foreground uppercase">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-1 font-display text-lg leading-none">{value}</div>
    </div>
  );
}

export default function PlannerPanel({
  prompt,
  setPrompt,
  vehicle,
  setVehicle,
  onGenerate,
  loading,
  route,
  locationLabel,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  vehicle: Vehicle;
  setVehicle: (v: Vehicle) => void;
  onGenerate: () => void;
  loading: boolean;
  route: GeneratedRoute | null;
  locationLabel: string;
}) {
  const [tab, setTab] = useState<"brief" | "beta">("brief");

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-border bg-sidebar">
      {/* Header */}
      <header className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Compass className="size-5 text-primary" />
          <h1 className="font-display text-lg font-semibold tracking-tight">TrailMind AI</h1>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3 text-accent" />
          {locationLabel}
        </p>
      </header>

      {/* Composer */}
      <div className="border-b border-border px-5 py-4">
        <div className="mb-3 inline-flex rounded-sm border border-border p-0.5">
          {(
            [
              ["mtb", "Mountain bike", Bike],
              ["moto", "Motorcycle", Gauge],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              onClick={() => setVehicle(v)}
              className={`flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-xs font-medium transition-colors ${
                vehicle === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onGenerate();
          }}
          rows={3}
          placeholder="Rocky singletrack with high elevation gain near Chiang Mai"
          className="w-full resize-none rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-ring"
        />

        <button
          onClick={onGenerate}
          disabled={loading || !prompt.trim()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {loading ? "Plotting the line…" : "Plan my route"}
        </button>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => setPrompt(e)}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              {e.split(" near ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!route ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            <RouteIcon className="mx-auto mb-3 size-8 opacity-40" />
            Describe the ride you want. TrailMind drafts a loop on OpenStreetMap, profiles the
            climbing, and hands you a .gpx.
          </div>
        ) : (
          <div className="px-5 py-4">
            <h2 className="font-display text-xl leading-tight">{route.name}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-sm bg-secondary px-2 py-0.5 text-secondary-foreground">
                {route.difficulty}
              </span>
              <span className="rounded-sm bg-secondary px-2 py-0.5 text-secondary-foreground">
                {route.surface}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat icon={RouteIcon} label="Distance" value={`${route.distanceKm.toFixed(1)} km`} />
              <Stat icon={TrendingUp} label="Ascent" value={`${route.ascent} m`} />
              <Stat icon={Mountain} label="High point" value={`${route.maxEle} m`} />
              <Stat
                icon={Timer}
                label="Moving time"
                value={`${Math.floor(route.estMinutes / 60)}h ${route.estMinutes % 60}m`}
              />
            </div>

            <button
              onClick={() => downloadGPX(route)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm bg-accent px-4 py-3 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-px"
            >
              <Download className="size-4" />
              Download .GPX
            </button>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              Loads straight into Garmin, Wahoo, Trail Tech or Gaia.
            </p>

            {/* Tabs */}
            <div className="mt-5 flex gap-4 border-b border-border text-xs">
              {(
                [
                  ["brief", "Route brief"],
                  ["beta", "Trail beta"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`-mb-px border-b-2 pb-2 font-medium transition-colors ${
                    tab === k
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "brief" ? (
              <div className="py-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {route.description}
                </p>
                <ul className="mt-4 space-y-2">
                  {route.highlights.map((h) => (
                    <li key={h} className="flex gap-2 text-sm text-foreground/90">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                      {h}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Descent", `${route.descent} m`],
                    ["Avg grade", `${route.avgGrade.toFixed(1)}%`],
                    ["Low point", `${route.minEle} m`],
                  ].map(([l, v]) => (
                    <div key={l} className="stat-tile">
                      <div className="text-[10px] tracking-wider text-muted-foreground uppercase">
                        {l}
                      </div>
                      <div className="font-display text-sm">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-4">
                <p className="text-xs text-muted-foreground">
                  Reference trails pulled in for planning context. Verify access and conditions on
                  the source before riding.
                </p>
                {route.refs.map((r) => (
                  <a
                    key={r.source + r.name}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-sm border border-border bg-card p-3 transition-colors hover:border-primary"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{r.name}</span>
                      <span
                        className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                          r.source === "Trailforks"
                            ? "bg-moss/20 text-moss"
                            : "bg-clay/20 text-clay"
                        }`}
                      >
                        {r.source}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{r.difficulty}</span>
                      <span>{r.length} km</span>
                      <span className="flex items-center gap-0.5">
                        <Star className="size-3 fill-summit text-summit" />
                        {r.rating}
                      </span>
                      <ExternalLink className="size-3" />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{r.note}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
