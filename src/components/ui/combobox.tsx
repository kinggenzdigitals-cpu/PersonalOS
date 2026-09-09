"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canOfferCreate,
  filterByName,
  normalizeCategoryName,
} from "@/lib/category-name";

export type ComboboxOption = { value: string; label: string };

/**
 * Searchable select with an optional "create" affordance.
 *
 * Built on Popover rather than the project's Select because Select owns its own
 * keyboard model — typing inside it jumps to a matching option instead of
 * filtering — and a text input cannot live inside it without fighting that.
 *
 * The trigger reuses SelectTrigger's class string so the field is visually
 * indistinguishable from every other picker in the app; only the behaviour is
 * an upgrade.
 *
 * ARIA follows the combobox pattern: the input is `role="combobox"` owning a
 * `listbox`, with `aria-activedescendant` naming the highlighted option so a
 * screen reader announces the moving selection while focus stays in the input.
 */
export function Combobox({
  options,
  value,
  onChange,
  onCreate,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  createLabel = (q: string) => `Create "${q}"`,
  disabled,
  id,
  className,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  /** Omit to disable creation. Resolves to the new option's value, or null on failure. */
  onCreate?: (label: string) => Promise<string | null>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  createLabel?: (query: string) => string;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  // The highlighted row. Reset wherever the list can change shape (typing,
  // opening) rather than in an effect, and clamped at read time so a filter
  // that shrinks the list can never leave it pointing past the end.
  const [rawActive, setRawActive] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const listId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = React.useMemo(
    () => filterByName(options, query),
    [options, query],
  );
  const showCreate = Boolean(onCreate) && canOfferCreate(options, query);
  const rowCount = filtered.length + (showCreate ? 1 : 0);
  const active = rowCount === 0 ? 0 : Math.min(rawActive, rowCount - 1);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setRawActive(0);
    if (!next) setQuery("");
  }

  async function commitCreate() {
    if (!onCreate || creating) return;
    const label = normalizeCategoryName(query);
    if (!label) return;
    setCreating(true);
    try {
      const newValue = await onCreate(label);
      if (newValue) {
        onChange(newValue);
        handleOpenChange(false);
      }
    } finally {
      setCreating(false);
    }
  }

  function choose(index: number) {
    if (showCreate && index === filtered.length) return void commitCreate();
    const opt = filtered[index];
    if (!opt) return;
    onChange(opt.value);
    handleOpenChange(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setRawActive(rowCount === 0 ? 0 : (active + 1) % rowCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setRawActive(rowCount === 0 ? 0 : (active - 1 + rowCount) % rowCount);
    } else if (e.key === "Enter") {
      // This lives inside a modal form; an unhandled Enter would submit it
      // with a half-typed category.
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleOpenChange(false);
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="line-clamp-1">{selected?.label ?? placeholder}</span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          // The surrounding Dialog traps focus; without this the search input
          // never receives it and typing goes nowhere.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-card"
        >
          <div className="border-b border-border p-1.5">
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                rowCount > 0 ? `${listId}-opt-${active}` : undefined
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setRawActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className="h-8 w-full rounded-md bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul
            id={listId}
            role="listbox"
            className="max-h-56 overflow-y-auto overscroll-contain p-1"
          >
            {filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setRawActive(i)}
                onClick={() => choose(i)}
                className={cn(
                  // min-h-9 keeps the touch target ~36px, not the ~28px a
                  // bare text row would give on a phone.
                  "flex min-h-9 cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
                  i === active && "bg-secondary text-foreground",
                )}
              >
                <span className="line-clamp-1">{o.label}</span>
                {o.value === value && (
                  <CheckIcon className="size-4 shrink-0 text-brand" aria-hidden />
                )}
              </li>
            ))}

            {showCreate && (
              <li
                id={`${listId}-opt-${filtered.length}`}
                role="option"
                aria-selected={false}
                onMouseEnter={() => setRawActive(filtered.length)}
                onClick={() => choose(filtered.length)}
                className={cn(
                  "flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-brand",
                  active === filtered.length && "bg-secondary",
                )}
              >
                <PlusIcon className="size-4 shrink-0" aria-hidden />
                <span className="line-clamp-1">
                  {creating
                    ? "Creating…"
                    : createLabel(normalizeCategoryName(query))}
                </span>
              </li>
            )}

            {rowCount === 0 && (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                {emptyText}
              </li>
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
