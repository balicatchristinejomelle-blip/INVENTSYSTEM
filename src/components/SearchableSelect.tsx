import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { createPortal } from "react-dom"

export interface SearchableOption {
  value: string

  label: string

  searchText?: string

  disabled?: boolean
}

interface SearchableSelectProps {
  value: string

  options: readonly (string | SearchableOption)[]

  onChange: (value: string) => void

  placeholder: string
  searchPlaceholder?: string

  ariaLabel: string

  disabled?: boolean

  required?: boolean

  allowCustom?: boolean

  clearable?: boolean

  noResultsText?: string

  id?: string

  name?: string
  menuClassName?: string
}

export const normalizeSelectSearch = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "")

export function filterSelectOptions(
  options: readonly SearchableOption[],
  query: string,
) {
  const needle = normalizeSelectSearch(query)

  return needle
    ? options.filter((option) =>
        normalizeSelectSearch(
          `${option.label} ${option.value} ${option.searchText || ""}`,
        ).includes(needle),
      )
    : options
}

export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = placeholder,
  ariaLabel,
  disabled,
  required,

  allowCustom = false,
  clearable = true,
  noResultsText = "No matching options",
  id,
  name,
  menuClassName = '',
}: SearchableSelectProps) {
  const listId = useId()

  const rootRef = useRef<HTMLDivElement>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  const menuRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)

  const [query, setQuery] = useState("")

  const [activeIndex, setActiveIndex] = useState(0)

  const [mobileMenuStyle, setMobileMenuStyle] = useState<React.CSSProperties>()

  const normalizedOptions = useMemo<SearchableOption[]>(() => options.map(option => typeof option === 'string' ? { value: option, label: option } : option), [options]);

  const selected = normalizedOptions.find(option => option.value === value);

  const filtered = useMemo(
    () => filterSelectOptions(normalizedOptions, query),
    [normalizedOptions, query],
  )

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (
        rootRef.current && !rootRef.current.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
        if (allowCustom && query.trim()) onChange(query.trim());
        setOpen(false); setQuery('');
      }
    }

    document.addEventListener("pointerdown", closeOnOutside)

    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [allowCustom, onChange, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  useLayoutEffect(() => {
    if (!open) return

    const viewport = window.visualViewport

    const update = () => {
      const height = viewport?.height || window.innerHeight

      const offset = viewport?.offsetTop || 0

      if (window.matchMedia("(max-width: 520px)").matches) {
        const menuHeight = Math.min(280, height * 0.46)

        setMobileMenuStyle({
          position: "fixed",
          left: 12,
          right: 12,
          top: offset + height - menuHeight - 8,
          bottom: "auto",
          maxHeight: menuHeight,
        })

        return
      }

      const rect = inputRef.current?.getBoundingClientRect()

      if (!rect) return

      const bottomSpace = offset + height - rect.bottom - 12

      const above = bottomSpace < 160 && rect.top - offset > bottomSpace

      const maxHeight = Math.max(
        80,
        Math.min(280, above ? rect.top - offset - 12 : bottomSpace),
      )

      const width = Math.min(rect.width, window.innerWidth - 24)

      setMobileMenuStyle({
        position: "fixed",
        left: Math.min(Math.max(12, rect.left), window.innerWidth - width - 12),
        right: "auto",
        width,
        top: above ? rect.top - maxHeight - 4 : rect.bottom + 4,
        bottom: "auto",
        maxHeight,
      })
    }

    const onScroll = (event: Event) => {
      if (
        !(event.target instanceof Node) ||
        !menuRef.current?.contains(event.target)
      )
        update()
    }

    update()
    viewport?.addEventListener("resize", update)
    viewport?.addEventListener("scroll", update)
    window.addEventListener("resize", update)
    window.addEventListener("scroll", onScroll, true)

    return () => {
      viewport?.removeEventListener("resize", update)
      viewport?.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", onScroll, true)
    }
  }, [open])

  useEffect(() => {
    menuRef.current
      ?.querySelector<HTMLElement>(".is-active")
      ?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  const choose = (option: SearchableOption) => {
    if (option.disabled) return

    onChange(option.value)
    setOpen(false)
    setQuery("")
    inputRef.current?.blur()
  }

  const openList = () => {
    if (disabled || open) return

    setOpen(true)
    setQuery("")
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className={`searchable-combobox${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <div className="searchable-combobox-control">
        <input
          ref={inputRef}
          id={id}
          name={name}
          className="app-input searchable-select"
          type="search"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          value={open ? query : selected?.label || value}
          placeholder={open ? searchPlaceholder : placeholder}
          autoComplete="off"
          disabled={disabled}
          required={required && !value}
          onClick={openList}
          onFocus={openList}
          onBlur={(event) => {
            if (
              !rootRef.current?.contains(event.relatedTarget as Node) &&
              !menuRef.current?.contains(event.relatedTarget as Node)
            ) {
        if (allowCustom && query.trim()) onChange(query.trim());
        setOpen(false); setQuery('');
      }
          }}
          onChange={event => { if (!open) setOpen(true); setQuery(event.target.value); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()

              if (!open) {
                openList()
                return
              }

              const step = event.key === "ArrowDown" ? 1 : -1

              setActiveIndex((index) => {
                let next = index + step

                while (
                  next >= 0 &&
                  next < filtered.length &&
                  filtered[next].disabled
                )
                  next += step

                return next >= 0 && next < filtered.length ? next : index
              })
            } else if (event.key === 'Enter') {
            event.preventDefault();
            if (filtered[activeIndex]) choose(filtered[activeIndex]);
            else if (allowCustom && query.trim()) { onChange(query.trim()); setOpen(false); setQuery(''); }
          } else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setQuery(''); inputRef.current?.blur(); }
          }}
        />
        {clearable && value && !disabled && <button type="button" className="searchable-combobox-clear" aria-label={`Clear ${ariaLabel}`} onPointerDown={event => event.preventDefault()} onClick={() => { onChange(''); setQuery(''); inputRef.current?.focus(); }}>×</button>}
        <button type="button" className="searchable-combobox-toggle" aria-label={`Open ${ariaLabel} options`} tabIndex={-1} disabled={disabled} onPointerDown={event => event.preventDefault()} onClick={openList}>⌄</button>
      </div>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={mobileMenuStyle}
            className={`searchable-combobox-menu ${menuClassName}`}
            id={listId}
            role="listbox"
            aria-label={`${ariaLabel} options`}
          >
            {filtered.map((option, index) => (
              <button
                type="button"
                id={`${listId}-${index}`}
                role="option"
                disabled={option.disabled}
                aria-selected={option.value === value}
                className={`searchable-combobox-option${index === activeIndex ? ' is-active' : ''}${option.value === value ? ' is-selected' : ''}`}
                key={`${option.value}-${index}`}
                onMouseEnter={() => setActiveIndex(index)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                {option.label}
              </button>
            ))}
            {!filtered.length && (
              <div className="searchable-combobox-empty">
                {allowCustom && query.trim() ? `Press Enter to use “${query.trim()}”` : noResultsText}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
