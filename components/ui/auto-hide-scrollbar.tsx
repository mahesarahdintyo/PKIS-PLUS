'use client'

import { useEffect } from 'react'

export function AutoHideScrollbar() {
  useEffect(() => {
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null

    const handleScroll = () => {
      document.documentElement.classList.add('is-scrolling')

      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }

      scrollTimeout = setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling')
      }, 1000)
    }

    // capture: true agar menangkap scroll di window maupun elemen scrollable di dalamnya (seperti table-wrap)
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
      document.documentElement.classList.remove('is-scrolling')
    }
  }, [])

  return null
}
