"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

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
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Sinkronkan tampilan input kalau value berubah dari luar (mis. reset form)
  React.useEffect(() => {
    setQuery(value)
  }, [value])

  const filteredOptions = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (opt) =>
        opt.value.toLowerCase().includes(q) ||
        opt.label.toLowerCase().includes(q)
    )
  }, [query, options])

  React.useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredOptions.length, isOpen])

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const commitValue = (v: string) => {
    setQuery(v)
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
        onChange(query)
        setIsOpen(false)
      }
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setIsOpen(true)
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          inputClassName
        )}
      />
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full min-w-[180px] overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          {filteredOptions.map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                commitValue(opt.value)
              }}
              className={cn(
                "block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted",
                idx === highlightedIndex && "bg-muted"
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
