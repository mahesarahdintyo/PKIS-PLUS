'use client'

import { useEffect } from 'react'

export function IosTouchListener() {
  useEffect(() => {
    const handleTouchStart = () => {}
    document.body.addEventListener('touchstart', handleTouchStart, { passive: true })

    return () => {
      document.body.removeEventListener('touchstart', handleTouchStart)
    }
  }, [])

  return null
}
