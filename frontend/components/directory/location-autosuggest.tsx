"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { FieldWrapper, Input } from "@/components/ui/field";
import { getLocationSuggestions, type LocationSuggestion } from "@/lib/api";

type LocationAutosuggestProps = {
  label?: string;
  placeholder?: string;
  hint?: string;
  defaultValue?: string;
  onSelect?: (suggestion: LocationSuggestion) => void;
};

export function LocationAutosuggest({
  label = "Ville ou localisation",
  placeholder = "Ex. Quimper, 29000, Finistère, Bretagne",
  hint,
  defaultValue = "",
  onSelect,
}: LocationAutosuggestProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [items, setItems] = useState<LocationSuggestion[]>([]);
  const [open, setOpen] = useState(false);

  function getKindLabel(kind: LocationSuggestion["kind"]) {
    switch (kind) {
      case "postal_code":
        return "Code postal";
      case "department":
        return "Département";
      case "region":
        return "Région";
      case "country":
        return "Pays";
      default:
        return "Ville";
    }
  }

  async function loadSuggestions(nextQuery: string) {
    try {
      const suggestions = await getLocationSuggestions(nextQuery);
      setItems(suggestions);
      setOpen(suggestions.length > 0);
    } catch {
      setItems([]);
      setOpen(false);
    }
  }

  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      if (!query.trim()) {
        return;
      }

      try {
        const suggestions = await getLocationSuggestions(query);
        if (!active) {
          return;
        }
        setItems(suggestions);
        setOpen(true);
      } catch {
        if (!active) {
          return;
        }
        setItems([]);
        setOpen(false);
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  function handleSelect(item: LocationSuggestion) {
    setQuery(item.label);
    setOpen(false);
    if (onSelect) {
      onSelect(item);
      return;
    }
    router.push(item.directory_url);
  }

  return (
    <div className="relative">
      <FieldWrapper label={label} hint={hint}>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (query.trim()) {
              setOpen(items.length > 0);
              return;
            }
            void loadSuggestions("");
          }}
          placeholder={placeholder}
        />
      </FieldWrapper>

      {open && items.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-[1.3rem] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[0_24px_64px_rgba(8,15,28,0.18)]">
          {items.map((item) => (
            <button
              key={`${item.kind}-${item.slug}-${item.postal_code}`}
              type="button"
              onClick={() => handleSelect(item)}
              className="flex w-full flex-col rounded-[1rem] px-3 py-3 text-left hover:bg-[var(--background-soft)]"
            >
              <span className="text-sm font-medium text-[var(--foreground)]">{item.label}</span>
              <span className="text-xs text-[var(--foreground-subtle)]">
                {[getKindLabel(item.kind), item.postal_code, item.department_name, item.region]
                  .filter(Boolean)
                  .join(" · ") || item.country}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
