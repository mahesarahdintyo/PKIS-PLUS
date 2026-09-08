"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, X } from "lucide-react"

export interface ComboboxOption {
  value: string
  label: string
  display?: React.ReactNode
}

export interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  className?: string
  inputClassName?: string
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  className,
  inputClassName,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [query, setQuery] = React.useState(value || "")
  const [isSearching, setIsSearching] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Sinkronkan tampilan input kalau value berubah dari luar (mis. reset form)
  React.useEffect(() => {
    if (!isSearching) {
      setQuery(value || "")
    }
  }, [value, isSearching])

  const filteredOptions = React.useMemo(() => {
    // Kalau belum mulai mengetik pencarian baru (hanya membuka dropdown), tampilkan semua opsi
    if (!isSearching) {
      return options
    }
    const q = query.trim().toLowerCase()
    if (!q) return options

    // Pecah kata kunci jika ada spasi agar pencarian lebih fleksibel
    const terms = q.split(/\s+/).filter(Boolean)
    const matched = options.filter((opt) => {
      const val = opt.value.toLowerCase()
      const lbl = opt.label.toLowerCase()
      return terms.every((term) => val.includes(term) || lbl.includes(term))
    })

    // [PERBAIKAN_SEARCH_SORT] Smart sorting: prioritaskan item yang dimulai dengan query
    // sehingga ketik "7" → part "7xxx" muncul di atas, bukan tersebar di tengah list
    const firstTerm = terms[0] ?? ""
    return [...matched].sort((a, b) => {
      const aVal = a.value.toLowerCase()
      const aLbl = a.label.toLowerCase()
      const bVal = b.value.toLowerCase()
      const bLbl = b.label.toLowerCase()

      const aStartsVal = aVal.startsWith(firstTerm)
      const bStartsVal = bVal.startsWith(firstTerm)
      const aStartsLbl = aLbl.startsWith(firstTerm)
      const bStartsLbl = bLbl.startsWith(firstTerm)

      // Prioritas 1: value dimulai dengan query
      if (aStartsVal && !bStartsVal) return -1
      if (!aStartsVal && bStartsVal) return 1

      // Prioritas 2: label dimulai dengan query
      if (aStartsLbl && !bStartsLbl) return -1
      if (!aStartsLbl && bStartsLbl) return 1

      // Prioritas 3: value / label yang lebih pendek (lebih spesifik) dulu
      if (aVal.length !== bVal.length) return aVal.length - bVal.length

      // Fallback: urutan alfabet
      return aLbl.localeCompare(bLbl)
    })
  }, [query, options, isSearching])

  // Set initial highlighted index to currently selected value
  React.useEffect(() => {
    if (isOpen) {
      if (!isSearching) {
        const selectedIdx = filteredOptions.findIndex((opt) => opt.value === value)
        setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0)
      } else {
        setHighlightedIndex(0)
      }
    }
  }, [isOpen, value, filteredOptions, isSearching])

  const commitValue = React.useCallback(
    (v: string) => {
      setQuery(v)
      setIsSearching(false)
      onChange(v)
      setIsOpen(false)
    },
    [onChange]
  )

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsSearching(false)
        if (!query.trim()) {
          commitValue("")
        } else {
          // Cek apakah ada exact match dengan opsi
          const exactMatch = options.find(
            (opt) => opt.value.toLowerCase() === query.trim().toLowerCase()
          )
          if (exactMatch) {
            commitValue(exactMatch.value)
          } else if (query !== value) {
            commitValue(query)
          } else {
            setQuery(value || "")
          }
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [value, query, isSearching, options, commitValue])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true)
      setIsSearching(false)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, filteredOptions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const picked = filteredOptions[highlightedIndex]
      if (picked) {
        commitValue(picked.value)
      } else {
        commitValue(query)
      }
    } else if (e.key === "Escape") {
      setIsOpen(false)
      setIsSearching(false)
      setQuery(value || "")
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    commitValue("")
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          onFocus={(e) => {
            setIsOpen(true)
            setIsSearching(false)
            e.target.select()
          }}
          onClick={() => {
            setIsOpen(true)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsSearching(true)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-14 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            inputClassName
          )}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition cursor-pointer"
              title="Hapus pilihan"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => {
                const next = !prev
                if (next) {
                  setIsSearching(false)
                }
                return next
              })
              inputRef.current?.focus()
            }}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition cursor-pointer"
            title="Tampilkan daftar"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-56 w-full min-w-[200px] overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  commitValue(opt.value)
                }}
                className={cn(
                  "block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted transition-colors cursor-pointer",
                  idx === highlightedIndex && "bg-muted font-medium",
                  opt.value === value && "text-primary font-semibold"
                )}
              >
                {opt.display ?? opt.label}
              </button>
            ))
          ) : (
            <div className="p-3 text-center text-xs text-muted-foreground">
              Tidak ada part number yang cocok
            </div>
          )}
        </div>
      )}
    </div>
  )
}

