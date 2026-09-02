'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    // Service Worker Registration
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      const { protocol, hostname } = window.location;
      const isSecure = protocol === 'https:';
      const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.local');
      // Allow local network IPs (tablet/device on same WiFi/LAN)
      const isLocalNetwork =
        /^192\.168\.\d+\.\d+$/.test(hostname) ||
        /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname);

      if (isSecure || isLocalhost || isLocalNetwork) {
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
