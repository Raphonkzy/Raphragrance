"use client";

import { useState, useCallback, useEffect } from "react";
import { useFragrances } from "@/hooks/useFragrances";
import FragranceCard from "./FragranceCard";
import FragranceModal from "./FragranceModal";
import FilterModal, { SortOption, SORT_OPTIONS } from "./FilterModal";
import SearchFilter from "./SearchFilter";
import { Fragrance } from "@/types/fragrance";

const PAGE_SIZE = 60; // 15 full rows on 4 columns, 20 on 3 columns, 30 on 2 columns

export default function FragranceGrid() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [gender, setGender] = useState("");
  const [page, setPage] = useState(1);
  const [selectedFragrance, setSelectedFragrance] = useState<Fragrance | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeSort, setActiveSort] = useState<SortOption>(SORT_OPTIONS[0]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on new search, filter, or sort
  useEffect(() => setPage(1), [debouncedSearch, gender, activeSort]);

  const { fragrances, isLoading } = useFragrances({
    search: debouncedSearch,
    gender,
    limit: PAGE_SIZE,
    page,
    sortBy: activeSort.sortBy,
    sortOrder: activeSort.sortOrder,
  });

  const handleOpenDetail = useCallback((f: Fragrance) => {
    setSelectedFragrance(f);
  }, []);

  const handleResetAll = useCallback(() => {
    setGender("");
    setActiveSort(SORT_OPTIONS[0]);
  }, []);

  const [showBackToTop, setShowBackToTop] = useState(false);

  const scrollToTopCatalog = useCallback(() => {
    const elem = document.getElementById("collection");
    if (elem) {
      const navbarHeight = 70;
      const top = elem.getBoundingClientRect().top + window.scrollY - navbarHeight;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  // Track scroll position to reveal Back to Top button
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const collection = document.getElementById("collection");
          if (collection) {
            const rect = collection.getBoundingClientRect();
            // Show button when scrolled 280px into the collection
            setShowBackToTop(rect.top < -280);
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Compute up to 5 page buttons
  const getPageNumbers = (current: number) => {
    let start = Math.max(1, current - 2);
    const pages: number[] = [];
    for (let i = 0; i < 5; i++) {
      pages.push(start + i);
    }
    return pages;
  };

  const isCustomSort = activeSort.id !== "popularity-desc";
  const hasActiveFilters = Boolean(gender) || isCustomSort;

  return (
    <section
      id="collection"
      style={{
        paddingBlock: "5rem",
        background: "var(--bg-base)",
        borderTop: "1px solid var(--bg-border)",
      }}
    >
      <div className="container-lg">
        {/* Section header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            marginBottom: "2rem",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.6rem",
              fontWeight: 500,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "var(--amber)",
            }}
          >
            Fragrance Database
          </p>
          <h2
            className="font-serif"
            style={{
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              fontWeight: 300,
              color: "var(--text-primary)",
            }}
          >
            Explore Fragrances
          </h2>
        </div>

        {/* Search & Filter/Sort Toolbar */}
        <div className="catalog-toolbar">
          {/* Search bar */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <SearchFilter
              search={search}
              onSearchChange={setSearch}
            />
          </div>

          {/* Filter & Sort button opening pop-up */}
          <button
            id="filter-modal-trigger"
            onClick={() => setFilterOpen(true)}
            className={`filter-sort-btn ${hasActiveFilters ? "filter-sort-btn--active" : ""}`}
            aria-label="Open filter and sort options"
            title="Filter and sort options"
          >
            {/* Sliders Icon (visible on both desktop and mobile) */}
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>

            {/* Desktop text & active badges (hidden on mobile) */}
            <span className="filter-sort-text">
              <span>Filter & Sort</span>
              {gender && (
                <span
                  style={{
                    background: "var(--amber)",
                    color: "#0D0D0B",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    padding: "0.1rem 0.45rem",
                    borderRadius: "10px",
                    textTransform: "capitalize",
                  }}
                >
                  {gender}
                </span>
              )}
              {isCustomSort && (
                <span
                  style={{
                    background: "var(--bg-overlay)",
                    border: "1px solid var(--amber)",
                    color: "var(--amber-light)",
                    fontSize: "0.62rem",
                    fontWeight: 600,
                    padding: "0.1rem 0.45rem",
                    borderRadius: "10px",
                  }}
                >
                  {activeSort.label}
                </span>
              )}
            </span>

            {/* Mobile active indicator dot */}
            {hasActiveFilters && <span className="filter-sort-dot" />}
          </button>
        </div>

        {/* Fragrance Cards Grid */}
        {isLoading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
              gap: "1rem",
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ height: "300px" }} className="skeleton" />
            ))}
          </div>
        ) : fragrances.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              paddingBlock: "6rem",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-sans)",
              fontSize: "0.875rem",
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1"
              style={{ margin: "0 auto 1rem" }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <p>No fragrances found for &ldquo;{debouncedSearch}&rdquo;.</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
              gap: "1rem",
            }}
          >
            {fragrances.map((f) => (
              <FragranceCard
                key={f._id}
                fragrance={f}
                onOpenDetail={handleOpenDetail}
              />
            ))}
          </div>
        )}

        {/* Numbered Pagination: symmetrical row that never wraps on mobile */}
        {!isLoading && fragrances.length > 0 && (
          <>
            <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "0.35rem",
              marginTop: "3rem",
              flexWrap: "nowrap",
              width: "100%",
              overflowX: "auto",
              paddingBottom: "0.5rem",
            }}
          >
            {/* Prev button */}
            <button
              id="prev-page"
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                scrollToTopCatalog();
              }}
              disabled={page === 1}
              aria-label="Previous page"
              style={{
                width: "38px",
                height: "38px",
                minWidth: "38px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-elevated)",
                color: page === 1 ? "var(--text-muted)" : "var(--text-secondary)",
                border: "1px solid var(--bg-border)",
                borderRadius: "4px",
                fontFamily: "var(--font-sans)",
                fontSize: "0.9rem",
                fontWeight: 600,
                opacity: page === 1 ? 0.35 : 1,
                cursor: page === 1 ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                minHeight: "auto",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (page !== 1) {
                  e.currentTarget.style.borderColor = "var(--amber)";
                  e.currentTarget.style.color = "var(--amber)";
                }
              }}
              onMouseLeave={(e) => {
                if (page !== 1) {
                  e.currentTarget.style.borderColor = "var(--bg-border)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              ←
            </button>

            {/* Page number buttons: up to 5 buttons */}
            {getPageNumbers(page).map((p) => {
              const isActive = p === page;
              return (
                <button
                  key={p}
                  id={`page-btn-${p}`}
                  onClick={() => {
                    setPage(p);
                    scrollToTopCatalog();
                  }}
                  aria-label={`Page ${p}`}
                  aria-current={isActive ? "page" : undefined}
                  style={{
                    width: "38px",
                    height: "38px",
                    minWidth: "38px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isActive ? "var(--amber)" : "var(--bg-elevated)",
                    color: isActive ? "#0D0D0B" : "var(--text-secondary)",
                    border: `1px solid ${isActive ? "var(--amber)" : "var(--bg-border)"}`,
                    borderRadius: "4px",
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.78rem",
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    minHeight: "auto",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = "var(--amber)";
                      e.currentTarget.style.color = "var(--amber)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = "var(--bg-border)";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                >
                  {p}
                </button>
              );
            })}

            {/* Next button */}
            <button
              id="next-page"
              onClick={() => {
                setPage((p) => p + 1);
                scrollToTopCatalog();
              }}
              disabled={fragrances.length < PAGE_SIZE}
              aria-label="Next page"
              style={{
                width: "38px",
                height: "38px",
                minWidth: "38px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-elevated)",
                color: fragrances.length < PAGE_SIZE ? "var(--text-muted)" : "var(--text-secondary)",
                border: "1px solid var(--bg-border)",
                borderRadius: "4px",
                fontFamily: "var(--font-sans)",
                fontSize: "0.9rem",
                fontWeight: 600,
                opacity: fragrances.length < PAGE_SIZE ? 0.35 : 1,
                cursor: fragrances.length < PAGE_SIZE ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                minHeight: "auto",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (fragrances.length >= PAGE_SIZE) {
                  e.currentTarget.style.borderColor = "var(--amber)";
                  e.currentTarget.style.color = "var(--amber)";
                }
              }}
              onMouseLeave={(e) => {
                if (fragrances.length >= PAGE_SIZE) {
                  e.currentTarget.style.borderColor = "var(--bg-border)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              →
            </button>
          </div>

          {/* Inline Back to Top of Catalog */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
            <button
              id="inline-back-to-top"
              onClick={scrollToTopCatalog}
              aria-label="Back to top of catalog"
              style={{
                background: "transparent",
                border: "none",
                fontFamily: "var(--font-sans)",
                fontSize: "0.68rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.4rem 0.8rem",
                transition: "color 0.15s ease",
                minHeight: "auto",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--amber)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <span style={{ fontSize: "0.75rem" }}>↑</span>
              <span>Top of Catalog</span>
            </button>
          </div>
        </>
      )}
      </div>

      {/* Floating Back to Top of Catalog button */}
      {showBackToTop && (
        <button
          id="floating-back-to-top"
          className="back-to-top-btn"
          onClick={scrollToTopCatalog}
          aria-label="Back to top of catalog"
          title="Back to top of catalog"
        >
          <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>↑</span>
          <span className="back-to-top-btn__text">Top</span>
        </button>
      )}

      {/* Filter and Sort Modal Pop-up */}
      <FilterModal
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        gender={gender}
        onGenderChange={setGender}
        activeSort={activeSort}
        onSortChange={setActiveSort}
        onResetAll={handleResetAll}
      />

      {/* Fragrance Detail Modal */}
      {selectedFragrance && (
        <FragranceModal
          fragrance={selectedFragrance}
          onClose={() => setSelectedFragrance(null)}
        />
      )}
    </section>
  );
}
