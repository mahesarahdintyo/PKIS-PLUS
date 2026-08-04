'use client'

import { useState } from 'react'
import { FolderPlus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface CreateFolderDialogProps {
  parentId: number | null
  landId: string
  onCreateSuccess?: () => void
  onOpenChange?: (open: boolean) => void
}

export function CreateFolderDialog({
  parentId,
  landId,
  onCreateSuccess,
  onOpenChange
}: CreateFolderDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleOpen = () => {
    setIsOpen(true)
    onOpenChange?.(true)
  }

  const handleClose = () => {
    if (isLoading) return
    setIsOpen(false)
    setName('')
    onOpenChange?.(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Nama folder tidak boleh kosong')
      return
    }

    try {
      setIsLoading(true)

      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          parentId,
          landId
        })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        toast.error(data?.error || 'Gagal membuat folder')
        return
      }

      const data = await response.json()

      // Jika nama diganti otomatis oleh server (duplikat), beri notifikasi informatif
      if (data.finalName && data.finalName !== data.originalName) {
        toast.info(
          `Folder "${data.originalName}" sudah ada — dibuat sebagai "${data.finalName}"`,
          { duration: 5000 }
        )
      } else {
        toast.success(`Folder "${data.finalName ?? name.trim()}" berhasil dibuat!`)
      }

      setName('')
      setIsOpen(false)
      onOpenChange?.(false)
      onCreateSuccess?.()
    } catch {
      toast.error('Gagal membuat folder. Periksa koneksi internet Anda.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="outline"
        className="border-gray-300 hover:bg-gray-50 w-full sm:w-auto flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-gray-700 bg-white text-sm font-medium"
      >
        <FolderPlus className="w-4 h-4 text-yellow-600" />
        New Folder
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-[2px]"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Buat Folder Baru</h2>
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
              <div className="space-y-1.5">
                <label htmlFor="folder-name" className="block text-sm font-medium text-gray-700">
                  Nama Folder <span className="text-red-500">*</span>
                </label>
                <input
                  id="folder-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Dokumen SOP, Keuangan"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition"
                  disabled={isLoading}
                  autoFocus
                />
                <p className="text-xs text-gray-400">
                  Jika nama sudah ada, folder akan otomatis diberi nomor urut.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !name.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Membuat...
                    </>
                  ) : (
                    'Buat Folder'
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
