import { lonL, silL } from "@/lib/format";

interface PerformanceGaugesProps {
  longevity: number | null;
  sillage: number | null;
}

export default function PerformanceGauges({
  longevity,
  sillage,
}: PerformanceGaugesProps) {
  const items = [
    {
      label: "Longevity",
      val: longevity,
      text: lonL(longevity),
    },
    {
      label: "Sillage",
      val: sillage,
      text: silL(sillage),
    },
  ];

  return (
    <div>
      <h3>Performance</h3>
      {items.map((item) => {
        const v = item.val ?? 0;
        const pct = Math.min(Math.max((v / 5) * 100, 0), 100);
        return (
          <div key={item.label} className="gg">
            <div className="mt">
              <span>{item.label}</span>
              <b>
                {item.val !== null ? item.val.toFixed(1) : "—"} / 5.0 · {item.text}
              </b>
            </div>
            <div className="trk">
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
