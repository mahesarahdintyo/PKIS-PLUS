'use client'

import { useState } from 'react'
import { FolderPlus, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface CreateLandDialogProps {
  onCreateSuccess?: () => void
  onOpenChange?: (open: boolean) => void
}

export function CreateLandDialog({ onCreateSuccess, onOpenChange }: CreateLandDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDuplicate, setIsDuplicate] = useState(false)

  const handleOpen = () => {
    setIsOpen(true)
    onOpenChange?.(true)
  }

  const handleClose = () => {
    if (isLoading) return
    setIsOpen(false)
    setName('')
    setDescription('')
    setIsDuplicate(false)
    onOpenChange?.(false)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsDuplicate(false)

    if (!name.trim()) {
      toast.error('Nama card tidak boleh kosong')
      return
    }

    try {
      setIsLoading(true)

      const response = await fetch('/api/lands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data?.error || 'Gagal membuat card'

        // Tandai input sebagai duplikat jika status 409
        if (response.status === 409) {
          setIsDuplicate(true)
        }

        toast.error(message)
        return
      }

      toast.success(`Card "${name.trim()}" berhasil dibuat!`)
      setName('')
      setDescription('')
      setIsOpen(false)
      onOpenChange?.(false)
      onCreateSuccess?.()
    } catch {
      toast.error('Gagal membuat card. Periksa koneksi internet Anda.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={handleOpen}
        className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto flex items-center justify-center h-9 px-4 rounded-lg text-white text-sm font-medium"
      >
        <FolderPlus className="w-4 h-4 mr-2" />
        New Card
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Buat Card Baru</h2>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Nama Card */}
              <div className="space-y-1.5">
                <label htmlFor="land-name" className="block text-sm font-medium text-gray-700">
                  Nama Card <span className="text-red-500">*</span>
                </label>
                <input
                  id="land-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (isDuplicate) setIsDuplicate(false)
                  }}
                  placeholder="Contoh: Produksi, HRD, Keuangan"
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm text-gray-900 outline-none transition
                    focus:ring-2 focus:border-transparent
                    ${isDuplicate
                      ? 'border-red-400 bg-red-50 focus:ring-red-200'
                      : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
                    }`}
                  disabled={isLoading}
                  autoFocus
                />
                {isDuplicate && (
                  <p className="text-xs text-red-600 font-medium">
                    Nama ini sudah digunakan. Pilih nama yang berbeda.
                  </p>
                )}
              </div>

              {/* Deskripsi */}
              <div className="space-y-1.5">
                <label htmlFor="land-description" className="block text-sm font-medium text-gray-700">
                  Deskripsi <span className="text-gray-400">(opsional)</span>
                </label>
                <textarea
                  id="land-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan singkat tentang card ini..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-blue-200 focus:border-blue-500 resize-none"
                  disabled={isLoading}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !name.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Membuat...
                    </>
                  ) : (
                    'Buat Card'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
