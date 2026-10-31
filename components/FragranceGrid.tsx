"use client";

import { Fragrance, GenderFilter, SortOption, SortOrder } from "@/types";
import FragranceCard from "@/components/FragranceCard";
import FragranceDetail from "@/components/FragranceDetail";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import fixtureData from "@/fixtures/fragrances.json";

const ALL: Fragrance[] = fixtureData as Fragrance[];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popularity", label: "Most Popular" },
  { value: "rating", label: "Highest Rated" },
  { value: "year", label: "Year (newest)" },
  { value: "name", label: "Name A–Z" },
  { value: "longevity", label: "Longevity" },
  { value: "sillage", label: "Sillage" },
];

const GENDER_OPTIONS: { value: GenderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "male", label: "Men" },
  { value: "female", label: "Women" },
  { value: "unisex", label: "Unisex" },
];

const PAGE_SIZE = 48;

function sortFragrances(list: Fragrance[], sort: SortOption, order: SortOrder): Fragrance[] {
  const factor = order === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    switch (sort) {
      case "popularity": return factor * (b.voteCount - a.voteCount);
      case "rating":     return factor * ((b.rating ?? 0) - (a.rating ?? 0));
      case "year":       return factor * ((b.year ?? 0) - (a.year ?? 0));
      case "name":       return factor * a.name.localeCompare(b.name);
      case "longevity":  return factor * ((b.longevity ?? 0) - (a.longevity ?? 0));
      case "sillage":    return factor * ((b.sillage ?? 0) - (a.sillage ?? 0));
      default: return 0;
    }
  });
}

export default function FragranceGrid() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [sort, setSort] = useState<SortOption>("popularity");
  const [order] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Fragrance | null>(null);
  const [showBackTop, setShowBackTop] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  // Keyboard shortcut: press / to focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Scroll → back-to-top
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const onScroll = () => setShowBackTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filtered = useMemo(() => {
    let list = ALL;
    if (gender !== "all") list = list.filter((f) => f.gender === gender);
    if (debouncedQuery.trim()) {
      const tokens = debouncedQuery.toLowerCase().trim().split(/\s+/);
      list = list.filter((f) => {
        const haystack = `${f.name} ${f.brand} ${f.accords.map((a) => a.name).join(" ")}`.toLowerCase();
        return tokens.every((t) => haystack.includes(t));
      });
    }
    return sortFragrances(list, sort, order);
  }, [debouncedQuery, gender, sort, order]);

  const pageItems = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = filtered.length > page * PAGE_SIZE;

  const loadMore = useCallback(() => setPage((p) => p + 1), []);

  return (
    <section id="catalog" aria-label="Fragrance catalog">
      {/* Stats strip */}
      <div
        style={{
          borderTop: "1px solid var(--bg-border)",
          borderBottom: "1px solid var(--bg-border)",
          background: "var(--bg-surface)",
        }}
      >
        <div className="container">
          <div className="stat-strip">
            <div className="stat-item">
              <span className="stat-value">131,930</span>
              <span className="stat-label">fragrances</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">92</span>
              <span className="stat-label">accord types</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">2,521</span>
              <span className="stat-label">notes catalogued</span>
            </div>
            <div className="stat-item" style={{ marginLeft: "auto" }}>
              <span className="stat-value" style={{ color: "var(--accent)" }}>
                {filtered.length.toLocaleString()}
              </span>
              <span className="stat-label">matching</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--bg-border)", position: "sticky", top: 52, zIndex: 30 }}>
        <div className="container" style={{ paddingBlock: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            {/* Search */}
            <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
              <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                className="search-input"
                placeholder="Search fragrances, brands, notes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search fragrances"
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button
                  className="search-clear"
                  onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                  aria-label="Clear search"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Gender chips */}
            <div style={{ display: "flex", gap: "0.35rem" }} role="group" aria-label="Filter by gender">
              {GENDER_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  className={`filter-chip${gender === g.value ? " filter-chip--active" : ""}`}
                  onClick={() => { setGender(g.value); setPage(1); }}
                  aria-pressed={gender === g.value}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div style={{ position: "relative" }}>
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
                aria-label="Sort by"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.04em",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: 2,
                  color: "var(--text-secondary)",
                  padding: "0.35rem 2rem 0.35rem 0.7rem",
                  cursor: "pointer",
                  minHeight: 32,
                  appearance: "none",
                  WebkitAppearance: "none",
                  outline: "none",
                }}
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <svg style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="container" ref={gridRef} style={{ paddingBlock: "1.5rem" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "4rem 2rem",
              textAlign: "center",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.8rem",
            }}
            role="status"
          >
            No fragrances match your search.
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))",
                gap: "1px",
                background: "var(--bg-border)",
                border: "1px solid var(--bg-border)",
                borderRadius: 4,
                overflow: "hidden",
              }}
              role="list"
              aria-label={`${filtered.length} fragrances`}
            >
              {pageItems.map((f, i) => (
                <div key={f.id} role="listitem" style={{ background: "var(--bg-base)" }}>
                  <FragranceCard
                    fragrance={f}
                    onClick={setSelected}
                    priority={i < 8}
                  />
                </div>
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div style={{ display: "flex", justifyContent: "center", padding: "2rem 0" }}>
                <button
                  className="btn btn--outline"
                  onClick={loadMore}
                  style={{ minWidth: 160 }}
                >
                  Load more
                  <span style={{ color: "var(--text-muted)", marginLeft: 4, fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>
                    ({filtered.length - pageItems.length} remaining)
                  </span>
                </button>
              </div>
            )}

            {/* Result count */}
            <div style={{ paddingTop: "0.75rem", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--text-muted)" }}>
              {pageItems.length} of {filtered.length} results {debouncedQuery && `for "${debouncedQuery}"`}
            </div>
          </>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <FragranceDetail fragrance={selected} onClose={() => setSelected(null)} />
      )}

      {/* Back to top */}
      {showBackTop && (
        <button
          className="back-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      )}
    </section>
  );
}
