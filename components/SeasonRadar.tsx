// Server Component
interface SeasonRadarProps {
  seasons: [number, number, number, number]; // [Winter, Spring, Summer, Fall], each 0–4
}

export default function SeasonRadar({ seasons: s }: SeasonRadarProps) {
  const c = 90;
  const R = 70;
  const ang = (i: number) => -Math.PI / 2 + (i * Math.PI) / 2;
  const pt = (i: number, k: number) =>
    [
      (c + R * k * Math.cos(ang(i))).toFixed(1),
      (c + R * k * Math.sin(ang(i))).toFixed(1),
    ].join(",");

  const gridPolygons = [0.25, 0.5, 0.75, 1].map((k) =>
    [0, 1, 2, 3].map((i) => pt(i, k)).join(" ")
  );

  const shapePoints = s.map((v, i) => pt(i, Math.min(Math.max(v, 0), 4) / 4)).join(" ");

  return (
    <svg
      viewBox="0 0 180 180"
      width="220"
      height="220"
      role="img"
      aria-label="Season suitability"
      style={{ display: "block" }}
    >
      {gridPolygons.map((pts, idx) => (
        <polygon key={idx} points={pts} fill="none" stroke="var(--bd)" strokeWidth="1" />
      ))}
      <polygon
        points={shapePoints}
        fill="var(--ac)"
        fillOpacity="0.25"
        stroke="var(--ac)"
        strokeWidth="1.5"
      />
      <g
        fontSize="9"
        fill="var(--tx2)"
        textAnchor="middle"
        style={{ fontFamily: "var(--fm, 'IBM Plex Mono', monospace)" }}
      >
        <text x="90" y="10">WINTER</text>
        <text x="166" y="93">SPRING</text>
        <text x="90" y="178">SUMMER</text>
        <text x="18" y="93">FALL</text>
      </g>
    </svg>
  );
}
