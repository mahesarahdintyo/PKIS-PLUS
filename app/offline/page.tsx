'use client'

import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { useState, useCallback } from 'react'

export default function OfflinePage() {
  const [isChecking, setIsChecking] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleRetry = useCallback(async () => {
    setIsChecking(true)
    setFailed(false)

    try {
      // Cek koneksi dengan fetch ke endpoint yang ringan
      const res = await fetch('/api/system/health', {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000), // timeout 5 detik
      })

      if (res.ok) {
        // Koneksi berhasil — arahkan kembali ke halaman asal
        const referrer = document.referrer
        if (referrer && new URL(referrer).origin === window.location.origin) {
          window.location.href = referrer
        } else {
          window.location.href = '/'
        }
      } else {
        // Server merespons tapi dengan error
        setFailed(true)
        setIsChecking(false)
      }
    } catch {
      // Masih offline / tidak bisa menjangkau server
      setFailed(true)
      setIsChecking(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="max-w-md w-full bg-slate-950/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md flex flex-col items-center">
        {/* Brand Logo */}
        <Image
          src="/pkis-logo-wordmark(final).png"
          alt="PKIS Logo"
          width={180}
          height={60}
          className="h-auto w-44 object-contain mb-6"
          priority
        />

        {/* Offline Icon */}
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
          <WifiOff className="h-8 w-8 text-emerald-400" />
        </div>

        {/* Status Message */}
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Koneksi Terputus
        </h1>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Anda sedang offline. Sistem Futaba PKIS membutuhkan koneksi internet/jaringan lokal untuk memperbarui data produksi secara realtime.
        </p>

        {/* Pesan Gagal */}
        {failed && (
          <div className="w-full flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Koneksi masih terputus. Pastikan perangkat terhubung ke jaringan pabrik lalu coba lagi.</span>
          </div>
        )}

        {/* Retry Button */}
        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Memeriksa koneksi...' : 'Coba Hubungkan Kembali'}</span>
        </button>
      </div>

      <p className="mt-8 text-xs text-slate-600">
        © 2026 PT FUTABA. Production & Knowledge Information System.
      </p>
    </div>
  )
}
