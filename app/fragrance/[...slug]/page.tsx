import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ImagePanel from "@/components/ImagePanel";
import AccordSection from "@/components/AccordSection";
import SeasonRadar from "@/components/SeasonRadar";
import PerformanceGauges from "@/components/PerformanceGauges";
import { getFragranceBySlug } from "@/lib/data";
import {
  formatVotes,
  genderLabel,
  normalizeSeasons,
  getHue,
} from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ fixture?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const useGolden =
    process.env.NODE_ENV !== "production" && sp.fixture === "golden";
  const slugStr = slug.join("/");
  const f = getFragranceBySlug(slugStr, useGolden);
  if (!f) return { title: "Not found" };
  return {
    title: `${f.name} by ${f.brand}`,
    description: `${f.name} by ${f.brand}, ${f.year ?? ""}. Accord analysis, note pyramid, season suitability, longevity and sillage ratings.`,
  };
}

export default async function FragrancePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const useGolden =
    process.env.NODE_ENV !== "production" && sp.fixture === "golden";
  const slugStr = slug.join("/");
  const f = getFragranceBySlug(slugStr, useGolden);

  if (!f) notFound();

  const hue = getHue(f);
  const seasons = normalizeSeasons(f.seasons);
  const gLabel = genderLabel(f.gender);

  // Build notes rows: Top | Heart | Base
  const topNotes = f.notes.top || [];
  const heartNotes = f.notes.heart || [];
  const baseNotes = f.notes.base || [];
  const maxNotes = Math.max(topNotes.length, heartNotes.length, baseNotes.length);
  const noteRows: Array<[string, string, string]> = [];
  for (let i = 0; i < maxNotes; i++) {
    noteRows.push([
      topNotes[i] || "",
      heartNotes[i] || "",
      baseNotes[i] || "",
    ]);
  }

  const metaParts: string[] = [f.brand];
  if (f.year) metaParts.push(String(f.year));
  metaParts.push(gLabel);
  if (f.rating !== null) {
    metaParts.push(`${f.rating.toFixed(2)} (${formatVotes(f.voteCount)} votes)`);
  }

  return (
    <>
      <Navbar />
      <div className="det">
        {/* Left Panel */}
        <div className="pan">
          <Link href="/" className="back" style={{ margin: 0 }}>
            ← All fragrances
          </Link>

          {/* Accords */}
          <AccordSection accords={f.accords} />

          {/* Season Radar */}
          <div>
            <h3>Season</h3>
            <SeasonRadar seasons={seasons} />
          </div>

          {/* Performance Gauges */}
          <PerformanceGauges longevity={f.longevity} sillage={f.sillage} />
        </div>

        {/* Right Panel */}
        <div className="pan2">
          <div>
            <h2>{f.name}</h2>
            <p className="br" style={{ font: "13px var(--fm, monospace)", color: "var(--tx2)", marginTop: 4 }}>
              {metaParts.join(" · ")}
            </p>
          </div>

          {/* Max-width 260px image panel */}
          <div style={{ maxWidth: 260 }}>
            <ImagePanel
              src={f.imageUrl}
              alt={`${f.brand} ${f.name} bottle`}
              hue={hue}
              priority={true}
            />
          </div>

          {/* Notes table */}
          <div>
            <h3>Notes</h3>
            {noteRows.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Top</th>
                    <th>Heart</th>
                    <th>Base</th>
                  </tr>
                </thead>
                <tbody>
                  {noteRows.map((r, idx) => (
                    <tr key={idx}>
                      <td>{r[0]}</td>
                      <td>{r[1]}</td>
                      <td>{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : f.notes.flat && f.notes.flat.length > 0 ? (
              <p style={{ fontFamily: "var(--fm, monospace)", fontSize: 13, color: "var(--tx2)" }}>
                {f.notes.flat.join(", ")}
              </p>
            ) : (
              <p style={{ fontFamily: "var(--fm, monospace)", fontSize: 13, color: "var(--tx2)" }}>
                No note data recorded.
              </p>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
