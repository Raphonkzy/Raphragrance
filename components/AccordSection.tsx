import type { FragranceAccord } from "@/lib/types";
import { accordColorVar } from "@/lib/format";

interface AccordSectionProps {
  accords: FragranceAccord[];
}

export default function AccordSection({ accords }: AccordSectionProps) {
  if (!accords || accords.length === 0) return null;

  return (
    <div>
      <h3>Accords</h3>
      {/* Stacked bar */}
      <div className="stack" role="img" aria-label="Accord strength distribution">
        {accords.map((a, i) => (
          <i
            key={a.name}
            style={{
              flex: a.strength || 1,
              background: accordColorVar(i),
            }}
            title={`${a.name} (${a.strength}%)`}
          />
        ))}
      </div>
      {/* Accord Table with swatch and percent */}
      <table>
        <tbody>
          {accords.map((a, i) => (
            <tr key={a.name}>
              <td>
                <span
                  className="sw"
                  style={{ background: accordColorVar(i) }}
                  aria-hidden="true"
                />
                {a.name}
              </td>
              <td className="n">{a.strength}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
