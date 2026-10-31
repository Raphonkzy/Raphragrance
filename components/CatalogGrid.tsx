"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Fragrance } from "@/lib/types";
import FragranceCard from "./FragranceCard";

type Gender = "all" | "male" | "female" | "unisex";
type SortBy = "popularity" | "rating" | "name" | "year";

const PAGE_SIZE = 24;

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "all", label: "All" },
  { value: "male", label: "Men" },
  { value: "female", label: "Women" },
  { value: "unisex", label: "Unisex" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "popularity", label: "Popularity" },
  { value: "rating", label: "Rating" },
  { value: "name", label: "Name" },
  { value: "year", label: "Year" },
];

function sortList(list: Fragrance[], by: SortBy): Fragrance[] {
  return [...list].sort((a, b) => {
    switch (by) {
      case "popularity": return b.voteCount - a.voteCount;
      case "rating": return (b.rating ?? 0) - (a.rating ?? 0);
      case "name": return a.name.localeCompare(b.name);
      case "year": return (b.year ?? 0) - (a.year ?? 0);
    }
  });
}

interface Props {
  fragrances: Fragrance[];
}

export default function CatalogGrid({ fragrances }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [gender, setGender] = useState<Gender>("all");
  const [sortBy, setSortBy] = useState<SortBy>("popularity");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeaheadOpen, setTypeaheadOpen] = useState(false);
  const [typeaheadIndex, setTypeaheadIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  // / and Ctrl+K focus search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        (e.key === "/" || (e.key === "k" && (e.ctrlKey || e.metaKey))) &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    let list = fragrances;
    if (gender !== "all") list = list.filter((f) => f.gender === gender);
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.brand.toLowerCase().includes(q) ||
          f.accords.some((a) => a.name.toLowerCase().includes(q))
      );
    }
    return sortList(list, sortBy);
  }, [fragrances, gender, sortBy, debouncedQuery]);

  const pageItems = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = filtered.length > page * PAGE_SIZE;

  const loadMore = useCallback(() => setPage((p) => p + 1), []);

  // Typeahead: top 6 name matches
  const typeaheadItems = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return fragrances
      .filter((f) => f.name.toLowerCase().includes(q) || f.brand.toLowerCase().includes(q))
      .slice(0, 6);
  }, [fragrances, query]);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!typeaheadOpen || typeaheadItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setTypeaheadIndex((i) => Math.min(i + 1, typeaheadItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setTypeaheadIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setTypeaheadOpen(false);
      setTypeaheadIndex(-1);
    } else if (e.key === "Enter" && typeaheadIndex >= 0) {
      const f = typeaheadItems[typeaheadIndex];
      window.location.href = `/fragrance/${f.slug}`;
    }
  }

  return (
    <>
      {/* Search row */}
      <div className="d3-search-row">
        <div style={{ position: "relative" }}>
          <input
            ref={searchRef}
            type="search"
            className="d3-search-input"
            placeholder="Search 131,930 fragrances…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setTypeaheadOpen(true);
              setTypeaheadIndex(-1);
            }}
            onFocus={() => setTypeaheadOpen(true)}
            onBlur={() => setTimeout(() => setTypeaheadOpen(false), 150)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search fragrances"
            aria-autocomplete="list"
            aria-controls="d3-typeahead"
            aria-expanded={typeaheadOpen && typeaheadItems.length > 0}
            autoComplete="off"
            spellCheck={false}
          />
          {typeaheadOpen && typeaheadItems.length > 0 && (
            <ul
              id="d3-typeahead"
              className="d3-typeahead"
              role="listbox"
              aria-label="Search suggestions"
            >
              {typeaheadItems.map((f, i) => (
                <li key={f.id} role="option" aria-selected={i === typeaheadIndex}>
                  <button
                    className="d3-typeahead-item"
                    onClick={() => { window.location.href = `/fragrance/${f.slug}`; }}
                    tabIndex={-1}
                  >
                    <strong>{f.name}</strong> · {f.brand}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Filters disclosure */}
        <div className="d3-filters">
          <button
            className="d3-filters-toggle"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            aria-controls="d3-filters-panel"
          >
            {filtersOpen ? "Hide filters" : "Filter"}
          </button>
          {filtersOpen && (
            <div id="d3-filters-panel" className="d3-filters-panel" role="group" aria-label="Filters">
              {/* Gender */}
              <div className="d3-filter-group" role="group" aria-label="Gender">
                <div className="d3-filter-label">Gender</div>
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className="d3-filter-option"
                    aria-pressed={gender === opt.value}
                    onClick={() => { setGender(opt.value); setPage(1); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* Sort */}
              <div className="d3-filter-group">
                <div className="d3-filter-label">Sort</div>
                <select
                  className="d3-sort-select"
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value as SortBy); setPage(1); }}
                  aria-label="Sort fragrances by"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <main id="catalog" aria-label="Fragrance catalog">
        {filtered.length === 0 ? (
          <div className="d3-empty" role="status">
            No fragrances match &ldquo;{debouncedQuery}&rdquo;.{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setQuery("");
                setGender("all");
              }}
            >
              Clear filters
            </a>
          </div>
        ) : (
          <>
            <div className="d3-cards" role="list">
              {pageItems.map((f, i) => (
                <div key={f.id} role="listitem" style={{ contain: "layout" }}>
                  <FragranceCard fragrance={f} priority={i < 3} />
                </div>
              ))}
            </div>
            {hasMore && (
              <button className="d3-load-more" onClick={loadMore}>
                Load more · {filtered.length - pageItems.length} remaining
              </button>
            )}
          </>
        )}
      </main>
    </>
  );
}
