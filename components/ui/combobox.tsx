"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, X } from "lucide-react"

export interface ComboboxOption {
  value: string
  label: string
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
  const [query, setQuery] = React.useState(value)
  const [isUserTyping, setIsUserTyping] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Sinkronkan tampilan input kalau value berubah dari luar (mis. reset form)
  React.useEffect(() => {
    setQuery(value)
    setIsUserTyping(false)
  }, [value])

  const filteredOptions = React.useMemo(() => {
    // Jika dropdown dibuka tanpa user mengetik filter baru (hanya melihat nilai saat ini),
    // tampilkan semua opsi agar user bisa langsung ganti ke part number lain.
    if (!isUserTyping || query === value) {
      return options
    }
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (opt) =>
        opt.value.toLowerCase().includes(q) ||
        opt.label.toLowerCase().includes(q)
    )
  }, [query, options, isUserTyping, value])

  // Set initial highlighted index to currently selected value
  React.useEffect(() => {
    if (isOpen) {
      const selectedIdx = filteredOptions.findIndex((opt) => opt.value === value)
      setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0)
    }
  }, [isOpen, value, filteredOptions])

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsUserTyping(false)
        setQuery(value)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [value])

  const commitValue = (v: string) => {
    setQuery(v)
    setIsUserTyping(false)
    onChange(v)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true)
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
      setIsUserTyping(false)
      setQuery(value)
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
            e.target.select()
          }}
          onClick={() => {
            setIsOpen(true)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsUserTyping(true)
            onChange(e.target.value)
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
              className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition"
              title="Hapus pilihan"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev)
              inputRef.current?.focus()
            }}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition"
            title="Tampilkan daftar"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
          </button>
        </div>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full min-w-[200px] overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          {filteredOptions.map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                commitValue(opt.value)
              }}
              className={cn(
                "block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted transition-colors",
                idx === highlightedIndex && "bg-muted font-medium",
                opt.value === value && "text-primary font-semibold"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

