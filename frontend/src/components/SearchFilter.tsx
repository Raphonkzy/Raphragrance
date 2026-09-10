"use client";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
}

export default function SearchFilter({ search, onSearchChange }: Props) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Search Icon */}
      <svg
        style={{
          position: "absolute",
          left: "1rem",
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--text-muted)",
          pointerEvents: "none",
        }}
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>

      {/* Input with autocomplete, autocorrect, and history disabled */}
      <input
        id="search-input"
        type="text"
        name="fragrance-search-no-history"
        className="search-input"
        placeholder="Search fragrance or brand…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        style={{
          paddingLeft: "2.75rem",
          paddingRight: search ? "2.5rem" : "1rem",
          height: "46px",
        }}
        aria-label="Search fragrances"
      />

      {/* Clear button when there is text */}
      {search && (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          aria-label="Clear search input"
          style={{
            position: "absolute",
            right: "0.75rem",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "0.35rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.8rem",
            minHeight: "auto",
            lineHeight: 1,
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          ✕
        </button>
      )}
    </div>
  );
}
