"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CatalogFragrance } from "../lib/types";
import { FragranceTile } from "./FragranceTile";
import { PAL, getColorPair } from "../lib/palette";

interface CatalogViewProps {
  initialFragrances: CatalogFragrance[];
  totalDatabaseCount: number;
  initialQuery?: string;
  initialGender?: string;
  initialSort?: string;
  initialAccords?: string[];
}

const COMMON_ACCORDS = Object.keys(PAL);

export function CatalogView({
  initialFragrances,
  totalDatabaseCount,
  initialQuery = "",
  initialGender = "All",
  initialSort = "Popular",
  initialAccords = [],
}: CatalogViewProps) {
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery);
  const [gender, setGender] = useState<string>(initialGender);
  const [sort, setSort] = useState<string>(initialSort);
  const [selectedAccords, setSelectedAccords] = useState<string[]>(initialAccords);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(initialAccords.length > 0);
  const [visibleCount, setVisibleCount] = useState(16);

  // Typeahead state
  const [typeaheadOpen, setTypeaheadOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Hydrate query params on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentParams = new URLSearchParams(window.location.search);
    const q = currentParams.get("q");
    const g = currentParams.get("gender");
    const s = currentParams.get("sort");
    const acc = currentParams.get("accord");
    if (q) setQuery(q);
    if (g) setGender(g);
    if (s) setSort(s);
    if (acc) {
      setSelectedAccords(acc.split(",").filter(Boolean));
      setMoreFiltersOpen(true);
    }
  }, []);

  // Keyboard shortcut: '/' and 'Ctrl+K' / 'Cmd+K' to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === "/" && document.activeElement !== searchInputRef.current) ||
          ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync to URL state (shallow update via history.replaceState so scroll is preserved)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentParams = new URLSearchParams(window.location.search);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (gender !== "All") params.set("gender", gender);
    if (sort !== "Popular") params.set("sort", sort);
    if (selectedAccords.length > 0) params.set("accord", selectedAccords.join(","));

    const fix = currentParams.get("fixture");
    if (fix) params.set("fixture", fix);

    const qs = params.toString();
    const targetUrl = qs ? `/?${qs}` : "/";
    const currentUrl = window.location.pathname + (window.location.search || "");
    if (targetUrl !== currentUrl) {
      window.history.replaceState(null, "", targetUrl);
    }
  }, [query, gender, sort, selectedAccords]);

  // Filtering & Sorting
  const filtered = useMemo(() => {
    let list = initialFragrances;

    if (gender !== "All") {
      const gLower = gender.toLowerCase();
      list = list.filter((f) => {
        const fg = (f.gender || "").toLowerCase();
        if (gLower === "men") return fg === "male" || fg === "men";
        if (gLower === "women") return fg === "female" || fg === "women";
        if (gLower === "unisex") return fg === "unisex";
        return true;
      });
    }

    if (selectedAccords.length > 0) {
      list = list.filter((f) =>
        selectedAccords.every((sel) =>
          f.accords.some((a) => a.name.toLowerCase() === sel.toLowerCase())
        )
      );
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.brand.toLowerCase().includes(q) ||
          f.accords.some((a) => a.name.toLowerCase().includes(q))
      );
    }

    // Sort
    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case "Rating":
          return (b.rating || 0) - (a.rating || 0);
        case "Year":
          return (b.year || 0) - (a.year || 0);
        case "Name":
          return a.name.localeCompare(b.name);
        case "Popular":
        default:
          return (b.voteCount || 0) - (a.voteCount || 0);
      }
    });

    return sorted;
  }, [initialFragrances, gender, selectedAccords, query, sort]);

  // Typeahead suggestions (top 6 matches)
  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    return initialFragrances
      .filter((f) => f.name.toLowerCase().includes(q) || f.brand.toLowerCase().includes(q))
      .slice(0, 6);
  }, [initialFragrances, query]);

  function handleTypeaheadKeyDown(e: React.KeyboardEvent) {
    if (!typeaheadOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const chosen = suggestions[selectedIndex];
      router.push(`/fragrance/${chosen.slug}`);
      setTypeaheadOpen(false);
    } else if (e.key === "Escape") {
      setTypeaheadOpen(false);
    }
  }

  function toggleAccord(acc: string) {
    setSelectedAccords((prev) =>
      prev.includes(acc) ? prev.filter((a) => a !== acc) : [...prev, acc]
    );
  }

  function clearAllFilters() {
    setQuery("");
    setGender("All");
    setSort("Popular");
    setSelectedAccords([]);
    setVisibleCount(24);
  }

  const displayed = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <>
      <div className="top">
        <div className="search-wrap">
          <input
            ref={searchInputRef}
            type="search"
            className="q"
            placeholder={`Search ${totalDatabaseCount.toLocaleString("en-US")} fragrances`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setTypeaheadOpen(true);
              setSelectedIndex(-1);
            }}
            onFocus={() => {
              if (query.length >= 2) setTypeaheadOpen(true);
            }}
            onBlur={() => {
              // Delay slightly so clicks register
              setTimeout(() => setTypeaheadOpen(false), 200);
            }}
            onKeyDown={handleTypeaheadKeyDown}
            aria-label="Search fragrances"
          />

          {typeaheadOpen && suggestions.length > 0 && (
            <div className="typeahead" role="listbox">
              {suggestions.map((item, idx) => {
                const topAcc = item.accords?.[0]?.name;
                const [fill] = getColorPair(topAcc);
                const isSelected = idx === selectedIndex;
                return (
                  <Link
                    key={item.id}
                    href={`/fragrance/${item.slug}`}
                    className={`typeahead-item ${isSelected ? "selected" : ""}`}
                    onClick={() => setTypeaheadOpen(false)}
                    prefetch={false}
                  >
                    <span
                      className="typeahead-dot"
                      style={{ background: fill }}
                      aria-hidden="true"
                    />
                    <span className="typeahead-name">{item.name}</span>
                    <span className="typeahead-brand">{item.brand}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="opts" role="region" aria-label="Filter options">
          <span className="lab">Gender</span>
          {["All", "Men", "Women", "Unisex"].map((g) => (
            <button
              key={g}
              type="button"
              className={`chip ${gender === g ? "on" : ""}`}
              onClick={() => {
                setGender(g);
                setVisibleCount(24);
              }}
              aria-pressed={gender === g}
            >
              {g}
            </button>
          ))}

          <span className="lab">Sort</span>
          {["Popular", "Rating", "Year", "Name"].map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${sort === s ? "on" : ""}`}
              onClick={() => {
                setSort(s);
                setVisibleCount(24);
              }}
              aria-pressed={sort === s}
            >
              {s}
            </button>
          ))}

          <button
            type="button"
            className={`chip ${moreFiltersOpen || selectedAccords.length > 0 ? "on" : ""}`}
            onClick={() => setMoreFiltersOpen((v) => !v)}
            aria-expanded={moreFiltersOpen}
          >
            More filters {selectedAccords.length > 0 ? `(${selectedAccords.length})` : ""}
          </button>

          <span className="cnt">
            showing {displayed.length} of {filtered.length}
          </span>
        </div>

        {moreFiltersOpen && (
          <div className="accord-filter-row" aria-label="Accord filters">
            {COMMON_ACCORDS.map((acc) => {
              const [fill] = PAL[acc];
              const isSelected = selectedAccords.includes(acc);
              return (
                <button
                  key={acc}
                  type="button"
                  className={`chip ${isSelected ? "on" : ""}`}
                  onClick={() => toggleAccord(acc)}
                  aria-pressed={isSelected}
                >
                  <span
                    className="accord-dot"
                    style={{ background: fill }}
                    aria-hidden="true"
                  />
                  {acc}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <main className="grid" id="catalog-grid" aria-label="Catalog results">
        {filtered.length === 0 ? (
          <div className="empty">
            No fragrances match &ldquo;{query}&rdquo;.
            <span>Clear the search or change the filters.</span>
            <button
              type="button"
              className="chip on"
              onClick={clearAllFilters}
            >
              Clear
            </button>
          </div>
        ) : (
          <>
            {displayed.map((f, idx) => (
              <FragranceTile
                key={f.id}
                fragrance={f}
                priority={idx === 0}
              />
            ))}

            {hasMore && (
              <div className="load-more-wrap">
                <button
                  type="button"
                  className="chip"
                  onClick={() => setVisibleCount((prev) => prev + 16)}
                >
                  Load more · {filtered.length - visibleCount} remaining
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
