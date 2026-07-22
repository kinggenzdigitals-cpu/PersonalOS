/**
 * Tiny, dependency-free SVG sparkline. Colors by overall trend
 * (up = sage, down = terracotta, flat = muted).
 */
export function Sparkline({
  series,
  width = 96,
  height = 28,
}: {
  series: number[];
  width?: number;
  height?: number;
}) {
  if (!series || series.length < 2) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const stepX = width / (series.length - 1);
  const pad = 3;
  const usable = height - pad * 2;

  const points = series.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - (v - min) / range) * usable;
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area =
    `0,${height} ` +
    line +
    ` ${width},${height}`;

  const trend = series[series.length - 1] - series[0];
  const color =
    trend > 0 ? "var(--sage)" : trend < 0 ? "var(--money-down)" : "var(--muted-foreground)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className="w-full"
      aria-hidden
    >
      <polygon points={area} fill={color} opacity={0.1} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
