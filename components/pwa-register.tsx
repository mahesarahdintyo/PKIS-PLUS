'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    // Service Worker Registration
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      (window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.endsWith('.local'))
    ) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/service-worker.js')
          .then((registration) => {
            console.log('PWA ServiceWorker registered with scope:', registration.scope)
          })
          .catch((err) => {
            console.error('PWA ServiceWorker registration failed:', err)
          })
      })
    }

    // Capture beforeinstallprompt globally
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      ;(window as unknown as { deferredPwaPrompt?: Event }).deferredPwaPrompt = e
      window.dispatchEvent(new CustomEvent('pwa-install-available'))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  return null
}
