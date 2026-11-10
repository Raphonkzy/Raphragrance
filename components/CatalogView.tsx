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

const INITIAL_COUNT = 30;
const STEP_COUNT = 30;

function getInitialCount(cols: number): number {
  if (cols <= 0) return INITIAL_COUNT;
  const rem = INITIAL_COUNT % cols;
  return rem === 0 ? INITIAL_COUNT : INITIAL_COUNT + (cols - rem);
}

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
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [gridCols, setGridCols] = useState(5);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Live API search results & pagination across 131,930 database
  const [apiResults, setApiResults] = useState<CatalogFragrance[] | null>(null);
  const [apiTotal, setApiTotal] = useState<number | null>(null);
  const [apiSuggestions, setApiSuggestions] = useState<CatalogFragrance[] | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const typeaheadAbortRef = useRef<AbortController | null>(null);

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
    if (q && q !== initialQuery) setQuery(q);
    if (g) {
      const gLow = g.toLowerCase();
      const normG =
        gLow === "men" || gLow === "male"
          ? "Men"
          : gLow === "women" || gLow === "female"
          ? "Women"
          : gLow === "unisex"
          ? "Unisex"
          : "All";
      if (normG !== initialGender) setGender(normG);
    }
    if (s && s !== initialSort) setSort(s);
    if (acc) {
      const parsedAcc = acc.split(",").filter(Boolean);
      setSelectedAccords(parsedAcc);
      setMoreFiltersOpen(true);
    }
  }, [initialQuery, initialGender, initialSort]);

  // Synchronize visible count with the computed grid columns so every row is completely filled
  useEffect(() => {
    function syncGridRows() {
      const grid = document.getElementById("catalog-grid");
      if (!grid) return;
      const computed = window.getComputedStyle(grid);
      const cols = computed.gridTemplateColumns.split(" ").filter(Boolean).length;
      if (cols > 0) {
        setGridCols(cols);
        setVisibleCount((prev) => {
          const remainder = prev % cols;
          return remainder === 0 ? prev : prev + (cols - remainder);
        });
      }
    }
    syncGridRows();
    window.addEventListener("resize", syncGridRows);
    return () => window.removeEventListener("resize", syncGridRows);
  }, []);

  // Keyboard shortcut: '/' and 'Ctrl+K' / 'Cmd+K' to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.key === "/" && document.activeElement !== searchInputRef.current) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")
      ) {
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

  // Debounced API search when query or filters are active
  useEffect(() => {
    const trimmed = query.trim();
    const hasFilters =
      trimmed.length > 0 ||
      gender !== "All" ||
      sort !== "Popular" ||
      selectedAccords.length > 0;

    if (!hasFilters) {
      setApiResults(null);
      setApiTotal(null);
      setIsSearching(false);
      return;
    }

    if (trimmed.length > 0) {
      setIsSearching(true);
    }

    const handler = setTimeout(async () => {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const ac = new AbortController();
      searchAbortRef.current = ac;

      try {
        const params = new URLSearchParams();
        if (trimmed) params.set("q", trimmed);
        if (gender !== "All") params.set("gender", gender);
        if (sort !== "Popular") params.set("sort", sort.toLowerCase());
        if (selectedAccords.length > 0) params.set("accord", selectedAccords.join(","));
        params.set("limit", "60");

        const res = await fetch(`/api/fragrances?${params.toString()}`, {
          signal: ac.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        setApiResults(json.data);
        setApiTotal(json.total);
        setVisibleCount(getInitialCount(gridCols));
      } catch (e: unknown) {
        if ((e as Error)?.name !== "AbortError") {
          console.error("Search fetch error:", e);
        }
      } finally {
        setIsSearching(false);
      }
    }, 180);

    return () => {
      clearTimeout(handler);
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
    };
  }, [query, gender, sort, selectedAccords, gridCols]);

  // Debounced Typeahead suggestions from API
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setApiSuggestions(null);
      return;
    }

    const handler = setTimeout(async () => {
      if (typeaheadAbortRef.current) {
        typeaheadAbortRef.current.abort();
      }
      const ac = new AbortController();
      typeaheadAbortRef.current = ac;

      try {
        const res = await fetch(
          `/api/fragrances?q=${encodeURIComponent(trimmed)}&limit=6`,
          { signal: ac.signal }
        );
        if (!res.ok) return;
        const json = await res.json();
        setApiSuggestions(json.data);
      } catch (e: unknown) {
        if ((e as Error)?.name !== "AbortError") {
          // silent
        }
      }
    }, 120);

    return () => {
      clearTimeout(handler);
      if (typeaheadAbortRef.current) {
        typeaheadAbortRef.current.abort();
      }
    };
  }, [query]);

  // Fallback local filtering & sorting for zero-network initial view
  const localFiltered = useMemo(() => {
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

    if (selectedAccords.length > 0 && selectedAccords !== initialAccords) {
      list = list.filter((f) =>
        selectedAccords.every((sel) =>
          f.accords.some((a) => a.name.toLowerCase() === sel.toLowerCase())
        )
      );
    }

    if (query.trim() && query !== initialQuery) {
      const q = query.toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.brand.toLowerCase().includes(q) ||
          f.accords.some((a) => a.name.toLowerCase().includes(q))
      );
    }

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
  }, [initialFragrances, gender, selectedAccords, query, sort, initialAccords, initialQuery]);

  // Typeahead suggestions (API results preferred, local fallback)
  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    if (apiSuggestions && apiSuggestions.length > 0) {
      return apiSuggestions;
    }
    const q = query.toLowerCase();
    return initialFragrances
      .filter((f) => f.name.toLowerCase().includes(q) || f.brand.toLowerCase().includes(q))
      .slice(0, 6);
  }, [initialFragrances, query, apiSuggestions]);

  function handleTypeaheadKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      if (!typeaheadOpen && suggestions.length > 0) {
        setTypeaheadOpen(true);
        return;
      }
      if (suggestions.length === 0) return;
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      if (!typeaheadOpen || suggestions.length === 0) return;
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (typeaheadOpen && selectedIndex >= 0 && suggestions[selectedIndex]) {
        const chosen = suggestions[selectedIndex];
        router.push(`/fragrance/${chosen.slug}`);
        setTypeaheadOpen(false);
      } else {
        // Dismiss suggestion popover so user can explore the catalog grid results freely
        setTypeaheadOpen(false);
        searchInputRef.current?.blur();
      }
    } else if (e.key === "Escape") {
      if (typeaheadOpen) {
        setTypeaheadOpen(false);
      } else if (query) {
        clearSearch();
      }
    }
  }

  function clearSearch() {
    setQuery("");
    setApiResults(null);
    setApiTotal(null);
    setTypeaheadOpen(false);
    setSelectedIndex(-1);
    setVisibleCount(getInitialCount(gridCols));
    searchInputRef.current?.focus();
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
    setApiResults(null);
    setApiTotal(null);
    setTypeaheadOpen(false);
    setSelectedIndex(-1);
    setVisibleCount(getInitialCount(gridCols));
  }

  async function handleLoadMore() {
    if (loadingMore) return;
    const step = STEP_COUNT;

    // 1. If we already have preloaded/buffered items in activeList beyond visibleCount:
    if (visibleCount + step <= activeList.length) {
      setVisibleCount((prev) => prev + step);
      return;
    }

    // 2. If we need more items from the database/API:
    const currentCount = apiResults ? apiResults.length : activeList.length;
    const canFetchMore =
      apiTotal !== null
        ? currentCount < apiTotal
        : currentCount < totalDatabaseCount;

    if (canFetchMore) {
      setLoadingMore(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (gender !== "All") params.set("gender", gender);
        if (sort !== "Popular") params.set("sort", sort.toLowerCase());
        if (selectedAccords.length > 0) params.set("accord", selectedAccords.join(","));
        params.set("offset", String(currentCount));
        params.set("limit", String(step));

        const res = await fetch(`/api/fragrances?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setApiResults((prev) => (prev ? [...prev, ...json.data] : [...activeList, ...json.data]));
            if (json.total !== undefined) {
              setApiTotal(json.total);
            }
            setVisibleCount((prev) => prev + json.data.length);
            return;
          }
        }
      } catch (e) {
        console.error("Load more fetch error:", e);
      } finally {
        setLoadingMore(false);
      }
    }

    // Fallback: display whatever items remain in activeList
    setVisibleCount((prev) => Math.min(activeList.length, prev + step));
  }

  const activeList = apiResults !== null ? apiResults : localFiltered;
  const totalCount =
    apiTotal !== null
      ? apiTotal
      : query.trim() || selectedAccords.length > 0 || gender !== "All" || sort !== "Popular"
      ? localFiltered.length
      : totalDatabaseCount;

  const displayed = activeList.slice(0, visibleCount);
  const hasMore =
    visibleCount < activeList.length ||
    (apiTotal !== null ? visibleCount < apiTotal : visibleCount < totalDatabaseCount);

  return (
    <>
      <div className="top">
        <div className="search-wrap">
          <div className="search-box">
            <svg
              className="search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              className="q"
              placeholder={`Search ${totalDatabaseCount.toLocaleString("en-US")} fragrances, brands, or notes...`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setTypeaheadOpen(true);
                setSelectedIndex(-1);
              }}
              onFocus={() => {
                if (query.trim().length >= 2) setTypeaheadOpen(true);
              }}
              onBlur={() => {
                setTimeout(() => setTypeaheadOpen(false), 200);
              }}
              onKeyDown={handleTypeaheadKeyDown}
              role="combobox"
              aria-expanded={typeaheadOpen && suggestions.length > 0}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-controls="typeahead-listbox"
              aria-label="Search fragrances"
            />
            <div className="search-actions">
              {isSearching && (
                <span className="search-spinner" aria-label="Searching perfumes..." />
              )}
              {query && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  ×
                </button>
              )}
              {!query && <kbd className="search-kbd">/</kbd>}
            </div>
          </div>

          {typeaheadOpen && suggestions.length > 0 && (
            <div id="typeahead-listbox" className="typeahead" role="listbox">
              {suggestions.map((item, idx) => {
                const topAcc = item.accords?.[0]?.name;
                const [fill] = getColorPair(topAcc);
                const isSelected = idx === selectedIndex;
                return (
                  <Link
                    key={item.id}
                    href={`/fragrance/${item.slug}`}
                    className={`typeahead-item ${isSelected ? "selected" : ""}`}
                    role="option"
                    aria-selected={isSelected}
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
              <button
                type="button"
                className="typeahead-footer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setTypeaheadOpen(false);
                  searchInputRef.current?.blur();
                }}
              >
                <span>View all results in grid for &ldquo;{query}&rdquo;</span>
                <span style={{ opacity: 0.7 }}>↵ Enter</span>
              </button>
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
                setTypeaheadOpen(false);
                setVisibleCount(getInitialCount(gridCols));
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
                setTypeaheadOpen(false);
                setVisibleCount(getInitialCount(gridCols));
              }}
              aria-pressed={sort === s}
            >
              {s}
            </button>
          ))}

          <button
            type="button"
            className={`chip ${moreFiltersOpen || selectedAccords.length > 0 ? "on" : ""}`}
            onClick={() => {
              setMoreFiltersOpen((v) => !v);
              setTypeaheadOpen(false);
            }}
            aria-expanded={moreFiltersOpen}
          >
            More filters {selectedAccords.length > 0 ? `(${selectedAccords.length})` : ""}
          </button>

          <span className="cnt">
            showing {displayed.length} of {totalCount.toLocaleString("en-US")}
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
                  onClick={() => {
                    toggleAccord(acc);
                    setTypeaheadOpen(false);
                  }}
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
        {displayed.length === 0 ? (
          <div className="empty">
            No fragrances match &ldquo;{query}&rdquo;.
            <span>Try searching for another keyword or select a popular family:</span>
            <div className="empty-suggestions">
              {["Chanel", "Dior", "Tom Ford", "Vanilla", "Sauvage", "Aventus", "Citrus", "Woody"].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setQuery(sample);
                    searchInputRef.current?.focus();
                  }}
                >
                  {sample}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="chip on"
              style={{ marginTop: 22 }}
              onClick={clearAllFilters}
            >
              Clear all filters
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
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  aria-busy={loadingMore}
                >
                  {loadingMore
                    ? "Loading perfumes..."
                    : `Load more · ${Math.max(0, totalCount - displayed.length).toLocaleString("en-US")} remaining`}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
