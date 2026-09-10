"use client";

import { useEffect, useRef, useState } from "react";

export type SortBy = "popularity" | "rating" | "name" | "brand" | "year" | "longevity" | "sillage";
export type SortOrder = "asc" | "desc";

export interface SortOption {
  id: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  label: string;
  desc: string;
}

export const SORT_OPTIONS: SortOption[] = [
  {
    id: "popularity-desc",
    sortBy: "popularity",
    sortOrder: "desc",
    label: "Most Popular",
    desc: "Community favorite fragrances with the highest votes",
  },
  {
    id: "rating-desc",
    sortBy: "rating",
    sortOrder: "desc",
    label: "Highest Rated",
    desc: "Top review scores and user ratings",
  },
  {
    id: "year-desc",
    sortBy: "year",
    sortOrder: "desc",
    label: "Newest Releases",
    desc: "Latest release years first",
  },
  {
    id: "year-asc",
    sortBy: "year",
    sortOrder: "asc",
    label: "Classic and Vintage",
    desc: "Earliest heritage and vintage creations",
  },
  {
    id: "name-asc",
    sortBy: "name",
    sortOrder: "asc",
    label: "Fragrance Name (A to Z)",
    desc: "Alphabetical order by fragrance title",
  },
  {
    id: "name-desc",
    sortBy: "name",
    sortOrder: "desc",
    label: "Fragrance Name (Z to A)",
    desc: "Reverse alphabetical order",
  },
  {
    id: "brand-asc",
    sortBy: "brand",
    sortOrder: "asc",
    label: "Perfume House (A to Z)",
    desc: "Alphabetical order by brand and house",
  },
  {
    id: "longevity-desc",
    sortBy: "longevity",
    sortOrder: "desc",
    label: "Longest Lasting",
    desc: "Fragrances known for enduring longevity",
  },
  {
    id: "sillage-desc",
    sortBy: "sillage",
    sortOrder: "desc",
    label: "Strongest Projection",
    desc: "Bold scents with maximum sillage",
  },
];

const GENDERS = [
  { value: "", label: "All Fragrances", desc: "Show everything in catalog" },
  { value: "men", label: "Men", desc: "Masculine fragrance profiles" },
  { value: "women", label: "Women", desc: "Feminine fragrance profiles" },
  { value: "unisex", label: "Unisex", desc: "Universal and genderless scents" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gender: string;
  onGenderChange: (v: string) => void;
  activeSort: SortOption;
  onSortChange: (opt: SortOption) => void;
  onResetAll: () => void;
}

export default function FilterModal({
  isOpen,
  onClose,
  gender,
  onGenderChange,
  activeSort,
  onSortChange,
  onResetAll,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"sort" | "gender">("sort");

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isFiltered = Boolean(gender) || activeSort.id !== "popularity-desc";

  return (
    <div
      id="filter-modal-overlay"
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        id="filter-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Filter and Sort"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--bg-border)",
          borderRadius: "8px",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90vh",
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45)",
          display: "flex",
          flexDirection: "column",
          animation: "scaleIn 0.2s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem 1rem",
            borderBottom: "1px solid var(--bg-border)",
          }}
        >
          <div>
            <h3
              className="font-serif"
              style={{
                fontSize: "1.35rem",
                fontWeight: 400,
                color: "var(--text-primary)",
                lineHeight: 1.1,
              }}
            >
              Filter & Sort
            </h3>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "0.68rem",
                color: "var(--text-muted)",
                marginTop: "0.25rem",
              }}
            >
              Customize order and refine fragrance selection
            </p>
          </div>

          <button
            id="filter-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--bg-border)",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              minHeight: "auto",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.borderColor = "var(--amber)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.borderColor = "var(--bg-border)";
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--bg-border)",
          }}
        >
          <button
            id="tab-sort"
            onClick={() => setActiveTab("sort")}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              background: activeTab === "sort" ? "var(--bg-surface)" : "transparent",
              border: `1px solid ${activeTab === "sort" ? "var(--amber)" : "transparent"}`,
              borderRadius: "4px",
              fontFamily: "var(--font-sans)",
              fontSize: "0.72rem",
              fontWeight: activeTab === "sort" ? 600 : 500,
              color: activeTab === "sort" ? "var(--amber-light)" : "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              minHeight: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
            }}
          >
            <span>Sort By</span>
            {activeSort.id !== "popularity-desc" && (
              <span
                style={{
                  background: "var(--amber)",
                  color: "#0D0D0B",
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  padding: "0.1rem 0.35rem",
                  borderRadius: "8px",
                }}
              >
                1
              </span>
            )}
          </button>

          <button
            id="tab-gender"
            onClick={() => setActiveTab("gender")}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              background: activeTab === "gender" ? "var(--bg-surface)" : "transparent",
              border: `1px solid ${activeTab === "gender" ? "var(--amber)" : "transparent"}`,
              borderRadius: "4px",
              fontFamily: "var(--font-sans)",
              fontSize: "0.72rem",
              fontWeight: activeTab === "gender" ? 600 : 500,
              color: activeTab === "gender" ? "var(--amber-light)" : "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              minHeight: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
            }}
          >
            <span>Gender</span>
            {gender && (
              <span
                style={{
                  background: "var(--amber)",
                  color: "#0D0D0B",
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  padding: "0.1rem 0.35rem",
                  borderRadius: "8px",
                }}
              >
                1
              </span>
            )}
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            overflowY: "auto",
            maxHeight: "52vh",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {activeTab === "sort" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {SORT_OPTIONS.map((opt) => {
                const isSelected = activeSort.id === opt.id;
                return (
                  <button
                    key={opt.id}
                    id={`sort-opt-${opt.id}`}
                    onClick={() => onSortChange(opt)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.85rem 1rem",
                      background: isSelected ? "var(--bg-overlay)" : "var(--bg-elevated)",
                      border: `1px solid ${isSelected ? "var(--amber)" : "var(--bg-border)"}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      minHeight: "auto",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = "rgba(201, 144, 58, 0.4)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = "var(--bg-border)";
                      }
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "0.82rem",
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? "var(--amber-light)" : "var(--text-primary)",
                          marginBottom: "0.15rem",
                        }}
                      >
                        {opt.label}
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "0.68rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {opt.desc}
                      </p>
                    </div>

                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: `1.5px solid ${isSelected ? "var(--amber)" : "var(--bg-border)"}`,
                        background: isSelected ? "var(--amber)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginLeft: "1rem",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isSelected && (
                        <div
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "#0D0D0B",
                          }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === "gender" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {GENDERS.map((g) => {
                const isSelected = gender === g.value;
                return (
                  <button
                    key={g.value}
                    id={`gender-opt-${g.value || "all"}`}
                    onClick={() => onGenderChange(g.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.85rem 1rem",
                      background: isSelected ? "var(--bg-overlay)" : "var(--bg-elevated)",
                      border: `1px solid ${isSelected ? "var(--amber)" : "var(--bg-border)"}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      minHeight: "auto",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = "rgba(201, 144, 58, 0.4)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = "var(--bg-border)";
                      }
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "0.82rem",
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? "var(--amber-light)" : "var(--text-primary)",
                          marginBottom: "0.15rem",
                        }}
                      >
                        {g.label}
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "0.68rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {g.desc}
                      </p>
                    </div>

                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: `1.5px solid ${isSelected ? "var(--amber)" : "var(--bg-border)"}`,
                        background: isSelected ? "var(--amber)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginLeft: "1rem",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isSelected && (
                        <div
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "#0D0D0B",
                          }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.5rem",
            background: "var(--bg-elevated)",
            borderTop: "1px solid var(--bg-border)",
            gap: "0.75rem",
          }}
        >
          {isFiltered ? (
            <button
              id="filter-modal-reset"
              onClick={onResetAll}
              className="btn-ghost"
              style={{
                fontSize: "0.72rem",
                padding: "0.5rem 0.85rem",
                minHeight: "38px",
                color: "var(--text-muted)",
              }}
            >
              Reset All
            </button>
          ) : (
            <div />
          )}

          <button
            id="filter-modal-apply"
            onClick={onClose}
            className="btn-primary"
            style={{
              fontSize: "0.72rem",
              padding: "0.6rem 1.5rem",
              minHeight: "38px",
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
