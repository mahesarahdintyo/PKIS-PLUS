'use client'

import { useState } from 'react'
import { FolderPlus, Loader2, X, Factory, FileText, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

/** Opsi mesin produksi yang sudah punya konfigurasi khusus */
const EXISTING_MACHINE_TYPES = [
  { slug: 'tandem',         label: 'Tandem' },
  { slug: 'blanking',       label: 'Blanking' },
  { slug: 'pc200t',         label: 'PC200t' },
  { slug: 'transfer-2000t', label: 'Transfer 2000t' },
  { slug: 'transfer-800t',  label: 'Transfer 800t' },
] as const

/** Slugify nama line untuk dijadikan machine_type generik */
function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

type MachineTypeMode = 'none' | 'existing' | 'custom'

interface CreateLineDialogProps {
  onCreateSuccess?: () => void
  onOpenChange?: (open: boolean) => void
}

export function CreateLineDialog({ onCreateSuccess, onOpenChange }: CreateLineDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [machineTypeMode, setMachineTypeMode] = useState<MachineTypeMode>('none')
  const [existingMachineType, setExistingMachineType] = useState<string>(EXISTING_MACHINE_TYPES[0].slug)
  const [isLoading, setIsLoading] = useState(false)
  const [isDuplicate, setIsDuplicate] = useState(false)

  /** Hitung machine_type berdasarkan pilihan mode */
  function resolveMachineType(): string | null {
    if (machineTypeMode === 'none') return null
    if (machineTypeMode === 'existing') return existingMachineType
    // custom: slugify nama line
    return slugifyName(name) || null
  }

  const handleOpen = () => {
    setIsOpen(true)
    onOpenChange?.(true)
  }

  const handleClose = () => {
    if (isLoading) return
    setIsOpen(false)
    setName('')
    setDescription('')
    setMachineTypeMode('none')
    setExistingMachineType(EXISTING_MACHINE_TYPES[0].slug)
    setIsDuplicate(false)
    onOpenChange?.(false)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsDuplicate(false)

    if (!name.trim()) {
      toast.error('Nama line produksi tidak boleh kosong')
      return
    }

    const machine_type = resolveMachineType()

    try {
      setIsLoading(true)

      const response = await fetch('/api/lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          machine_type,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data?.error || 'Gagal membuat line produksi'
        if (response.status === 409) setIsDuplicate(true)
        toast.error(message)
        return
      }

      toast.success(`Line produksi "${name.trim()}" berhasil dibuat!`)
      setName('')
      setDescription('')
      setMachineTypeMode('none')
      setExistingMachineType(EXISTING_MACHINE_TYPES[0].slug)
      setIsOpen(false)
      onOpenChange?.(false)
      onCreateSuccess?.()
    } catch {
      toast.error('Gagal membuat line produksi. Periksa koneksi internet Anda.')
    } finally {
      setIsLoading(false)
    }
  }

  const customSlugPreview = machineTypeMode === 'custom' && name.trim()
    ? slugifyName(name)
    : null

  return (
    <>
      <Button
        onClick={handleOpen}
        className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto flex items-center justify-center h-9 px-4 rounded-lg text-white text-sm font-medium"
      >
        <FolderPlus className="w-4 h-4 mr-2" />
        New Line Produksi
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
              <h2 className="text-lg font-semibold text-gray-900">Buat Line Produksi Baru</h2>
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
              {/* Nama Line */}
              <div className="space-y-1.5">
                <label htmlFor="line-name" className="block text-sm font-medium text-gray-700">
                  Nama Line Produksi <span className="text-red-500">*</span>
                </label>
                <input
                  id="line-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (isDuplicate) setIsDuplicate(false)
                  }}
                  placeholder="Contoh: Tandem, Blanking, PC200t"
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
                <label htmlFor="line-description" className="block text-sm font-medium text-gray-700">
                  Deskripsi <span className="text-gray-400">(opsional)</span>
                </label>
                <textarea
                  id="line-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan singkat tentang line produksi ini..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-blue-200 focus:border-blue-500 resize-none"
                  disabled={isLoading}
                />
              </div>

              {/* Hubungkan ke Mesin Produksi */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Hubungkan ke mesin produksi
                </label>

                {/* Opsi: Bukan line produksi */}
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition
                  ${machineTypeMode === 'none'
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <input
                    type="radio"
                    name="machine-type-mode"
                    value="none"
                    checked={machineTypeMode === 'none'}
                    onChange={() => setMachineTypeMode('none')}
                    className="mt-0.5 accent-blue-600"
                    disabled={isLoading}
                  />
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Bukan line produksi</p>
                      <p className="text-xs text-gray-500">Hanya untuk card dokumen / folder biasa</p>
                    </div>
                  </div>
                </label>

                {/* Opsi: Mesin yang sudah ada */}
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition
                  ${machineTypeMode === 'existing'
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <input
                    type="radio"
                    name="machine-type-mode"
                    value="existing"
                    checked={machineTypeMode === 'existing'}
                    onChange={() => setMachineTypeMode('existing')}
                    className="mt-0.5 accent-blue-600"
                    disabled={isLoading}
                  />
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Cpu className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">Mesin yang sudah ada</p>
                      <p className="text-xs text-gray-500">Pakai konfigurasi mesin yang sudah dikonfigurasi</p>
                      {machineTypeMode === 'existing' && (
                        <select
                          value={existingMachineType}
                          onChange={(e) => setExistingMachineType(e.target.value)}
                          className="mt-2 w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                          disabled={isLoading}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {EXISTING_MACHINE_TYPES.map((m) => (
                            <option key={m.slug} value={m.slug}>{m.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </label>

                {/* Opsi: Line produksi baru (konfigurasi standar) */}
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition
                  ${machineTypeMode === 'custom'
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <input
                    type="radio"
                    name="machine-type-mode"
                    value="custom"
                    checked={machineTypeMode === 'custom'}
                    onChange={() => setMachineTypeMode('custom')}
                    className="mt-0.5 accent-blue-600"
                    disabled={isLoading}
                  />
                  <div className="flex items-center gap-2 min-w-0">
                    <Factory className="w-4 h-4 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Line produksi baru (konfigurasi standar)</p>
                      <p className="text-xs text-gray-500">
                        Buat mesin baru dengan template umum
                      </p>
                      {customSlugPreview && (
                        <p className="text-xs text-indigo-600 font-mono mt-0.5">
                          machine_type: <span className="font-semibold">{customSlugPreview}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </label>
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
                    'Buat Line'
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
