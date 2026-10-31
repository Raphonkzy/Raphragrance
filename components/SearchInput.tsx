"use client";

import { useEffect, useRef, useState } from "react";
import type { Fragrance } from "@/lib/types";
import { useRouter } from "next/navigation";

interface SearchInputProps {
  fragrances: Fragrance[];
  query: string;
  onQueryChange: (q: string) => void;
}

export default function SearchInput({
  fragrances,
  query,
  onQueryChange,
}: SearchInputProps) {
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // / and Ctrl+K focus search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        (e.key === "/" || (e.key === "k" && (e.ctrlKey || e.metaKey))) &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const suggestions = query.trim().length >= 2
    ? fragrances
        .filter(
          (f) =>
            f.name.toLowerCase().includes(query.toLowerCase()) ||
            f.brand.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 6)
    : [];

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setSelectedIndex(-1);
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const f = suggestions[selectedIndex];
      router.push(`/fragrance/${f.slug}`);
    }
  }

  return (
    <div className="search-wrap">
      <input
        ref={inputRef}
        type="search"
        className="search"
        placeholder="Search brand, note, accord…"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setOpen(true);
          setSelectedIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={handleKeyDown}
        aria-label="Search brand, note, accord"
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
      />
      {open && suggestions.length > 0 && (
        <ul className="typeahead" role="listbox">
          {suggestions.map((f, i) => (
            <li
              key={f.id}
              className="typeahead-item"
              role="option"
              aria-selected={i === selectedIndex}
            >
              <button
                type="button"
                onMouseDown={() => {
                  router.push(`/fragrance/${f.slug}`);
                }}
              >
                <strong>{f.name}</strong> · {f.brand}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
