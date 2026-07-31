import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GeneratedRoute } from "@/lib/trail-engine";

export default function ElevationChart({
  route,
  onHover,
}: {
  route: GeneratedRoute;
  onHover: (i: number | null) => void;
}) {
  const data = route.points.map((p, i) => ({
    i,
    km: +(p.dist / 1000).toFixed(2),
    ele: p.ele,
  }));

  return (
    <div className="h-full w-full" onMouseLeave={() => onHover(null)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 16, left: -8, bottom: 0 }}
          onMouseMove={(s) => {
            const idx = s?.activeTooltipIndex;
            onHover(typeof idx === "number" ? idx : null);
          }}
        >
          <defs>
            <linearGradient id="eleFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="km"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            unit=" km"
            minTickGap={40}
          />
          <YAxis
            dataKey="ele"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={54}
            unit=" m"
            domain={["dataMin - 30", "dataMax + 30"]}
          />
          <Tooltip
            cursor={{ stroke: "var(--accent)", strokeWidth: 1 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "var(--foreground)",
            }}
            labelFormatter={(v) => `${v} km`}
            formatter={(v: number) => [`${v} m`, "Elevation"]}
          />
          <Area
            type="monotone"
            dataKey="ele"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#eleFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
