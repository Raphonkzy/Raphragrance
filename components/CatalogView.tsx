"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Fragrance } from "@/lib/types";
import FragranceCard from "./FragranceCard";
import SearchInput from "./SearchInput";
import { ThemeToggle } from "./ThemeToggle";

interface CatalogViewProps {
  initialFragrances: Fragrance[];
  totalDatabaseCount?: number;
}

type SortBy = "popularity" | "rating" | "year" | "name";

const COMMON_ACCORDS = [
  "woody",
  "amber",
  "citrus",
  "floral",
  "vanilla",
  "warm spicy",
  "aromatic",
  "fresh spicy",
  "sweet",
  "musky",
];

export default function CatalogView({
  initialFragrances,
  totalDatabaseCount = 131930,
}: CatalogViewProps) {
  const [query, setQuery] = useState("");
  const [genders, setGenders] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy | "default">("default");
  const [selectedAccords, setSelectedAccords] = useState<string[]>([]);
  const [showAllAccords, setShowAllAccords] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Filter & sort logic
  const filtered = useMemo(() => {
    let list = initialFragrances;

    if (genders.length > 0) {
      list = list.filter((f) => {
        const g = (f.gender || "").toLowerCase();
        return genders.some((sel) => {
          if (sel === "Men") return g === "male" || g === "men";
          if (sel === "Women") return g === "female" || g === "women";
          if (sel === "Unisex") return g === "unisex";
          return false;
        });
      });
    }

    if (selectedAccords.length > 0) {
      list = list.filter((f) =>
        selectedAccords.every((acc) =>
          f.accords.some((a) => a.name.toLowerCase() === acc.toLowerCase())
        )
      );
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.brand.toLowerCase().includes(q) ||
          f.accords.some((a) => a.name.toLowerCase().includes(q)) ||
          f.notes.top.some((n) => n.toLowerCase().includes(q)) ||
          f.notes.heart.some((n) => n.toLowerCase().includes(q)) ||
          f.notes.base.some((n) => n.toLowerCase().includes(q)) ||
          f.notes.flat.some((n) => n.toLowerCase().includes(q))
      );
    }

    if (sortBy === "default") {
      return list;
    }

    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case "popularity":
          return (b.voteCount || 0) - (a.voteCount || 0);
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "year":
          return (b.year || 0) - (a.year || 0);
        case "name":
          return a.name.localeCompare(b.name);
      }
    });

    return sorted;
  }, [initialFragrances, genders, selectedAccords, query, sortBy]);

  const displayedFragrances = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function toggleGender(g: string) {
    setGenders((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  function toggleAccord(a: string) {
    setSelectedAccords((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  function clearFilters() {
    setGenders([]);
    setSelectedAccords([]);
    setQuery("");
    setSortBy("default");
  }

  const displayedAccordList = showAllAccords
    ? COMMON_ACCORDS
    : COMMON_ACCORDS.slice(0, 5);

  const sortLabel = {
    default: "popularity ↓",
    popularity: "popularity ↓",
    rating: "rating ↓",
    year: "year ↓",
    name: "name A–Z",
  }[sortBy];

  const filterControls = (
    <>
      <div>
        <h4>Gender</h4>
        {["Men", "Women", "Unisex"].map((g) => (
          <label key={g}>
            <input
              type="checkbox"
              checked={genders.includes(g)}
              onChange={() => toggleGender(g)}
            />
            {g}
          </label>
        ))}
      </div>

      <div>
        <h4>Sort</h4>
        {(
          [
            { id: "popularity", label: "Popularity" },
            { id: "rating", label: "Rating" },
            { id: "year", label: "Year" },
            { id: "name", label: "Name" },
          ] as const
        ).map((s) => (
          <label key={s.id}>
            <input
              type="radio"
              name="sort"
              value={s.id}
              checked={sortBy === s.id || (sortBy === "default" && s.id === "popularity")}
              onChange={() => setSortBy(s.id)}
            />
            {s.label}
          </label>
        ))}
      </div>

      <div>
        <h4>Accords</h4>
        {displayedAccordList.map((a) => (
          <label key={a}>
            <input
              type="checkbox"
              checked={selectedAccords.includes(a)}
              onChange={() => toggleAccord(a)}
            />
            {a}
          </label>
        ))}
        {COMMON_ACCORDS.length > 5 && (
          <button
            type="button"
            className="more-btn"
            onClick={() => setShowAllAccords((prev) => !prev)}
          >
            {showAllAccords ? "− Less" : "+ More"}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Sticky Header */}
      <header className="nav" role="banner">
        <Link href="/" className="logo" aria-label="Raphragrance home">
          Raphragrance
        </Link>
        <SearchInput
          fragrances={initialFragrances}
          query={query}
          onQueryChange={setQuery}
        />
        <ThemeToggle />
      </header>

      {/* Data Strip */}
      <div className="strip" role="region" aria-label="Catalog status">
        <span>
          <b>{totalDatabaseCount.toLocaleString("en-US")}</b> fragrances
        </span>
        <span>
          showing <b>{displayedFragrances.length}</b>{" "}
          {initialFragrances.length <= 6 ? "sample rows" : `of ${filtered.length}`}
        </span>
        <span>
          sort: <b>{sortLabel}</b>
        </span>
        <div className="strip-links">
          <Link href="/brands">Brands</Link>
          <span>·</span>
          <Link href="/notes">Notes</Link>
          <span>·</span>
          <Link href="/accords">Accords</Link>
        </div>
      </div>

      {/* Mobile Filter Toggle */}
      <div className="mobile-filter-bar">
        <button
          type="button"
          className="mobile-filter-btn"
          onClick={() => setMobileDrawerOpen(true)}
          aria-expanded={mobileDrawerOpen}
        >
          Filters{" "}
          {genders.length + selectedAccords.length > 0 &&
            `(${genders.length + selectedAccords.length})`}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <>
          <div
            className="drawer-backdrop"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="drawer" role="dialog" aria-label="Filters">
            {filterControls}
            <div className="drawer-actions">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                style={{ fontWeight: 500 }}
              >
                Apply
              </button>
              <button
                type="button"
                onClick={clearFilters}
                style={{ color: "var(--tx2)" }}
              >
                Clear
              </button>
            </div>
          </div>
        </>
      )}

      {/* Catalog Layout: 200px Sidebar + 1fr Grid */}
      <div className="lay">
        <aside className="side" aria-label="Catalog filters">
          {filterControls}
        </aside>

        {filtered.length === 0 ? (
          <main id="catalog" className="empty-state" aria-label="Fragrance catalog">
            No fragrances match &ldquo;{query}&rdquo;.
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                clearFilters();
              }}
            >
              Clear filters
            </a>
          </main>
        ) : (
          <main id="catalog" className="grid" aria-label="Fragrance catalog">
            {displayedFragrances.map((f, idx) => (
              <FragranceCard
                key={f.id}
                fragrance={f}
                priority={idx < 6}
              />
            ))}

            {hasMore && (
              <button
                type="button"
                className="load-more"
                onClick={() => setVisibleCount((prev) => prev + 24)}
              >
                Load more · {filtered.length - visibleCount} remaining
              </button>
            )}
          </main>
        )}
      </div>
    </>
  );
}
