'use client'

import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, Factory, FileText, Folder, Cpu, Loader2, MoreVertical, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { FixedStationConfig, Line, LineStationConfig, StationConfigMode } from '@/lib/services/line'

/** Opsi mesin produksi yang sudah punya konfigurasi khusus */
const EXISTING_MACHINE_TYPES = [
  { slug: 'tandem',         label: 'Tandem' },
  { slug: 'blanking',       label: 'Blanking' },
  { slug: 'pc200t',         label: 'PC200t' },
  { slug: 'transfer-2000t', label: 'Transfer 2000t' },
  { slug: 'transfer-800t',  label: 'Transfer 800t' },
] as const

const KNOWN_SLUGS = EXISTING_MACHINE_TYPES.map((m) => m.slug) as string[]

type MachineTypeMode = 'none' | 'existing' | 'custom'

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function getStationModeFromLine(targetLine: Line): StationConfigMode {
  if (targetLine.station_config?.mode === 'fixed') return 'fixed'
  if (targetLine.station_config?.mode === 'variant') return 'variant'
  return 'none'
}

function getFixedStationsTextFromLine(targetLine: Line): string {
  if (targetLine.station_config?.mode === 'fixed' && Array.isArray((targetLine.station_config as FixedStationConfig).stations)) {
    return (targetLine.station_config as FixedStationConfig).stations.join(', ')
  }
  return ''
}

interface AdminLineCardProps {
  line: Line
  onEnter: (line: Line) => void
  onChangeSuccess?: () => void
}

export function AdminLineCard({
  line,
  onEnter,
  onChangeSuccess,
}: AdminLineCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isEditClosing, setIsEditClosing] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleteClosing, setIsDeleteClosing] = useState(false)
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const [isActionMenuClosing, setIsActionMenuClosing] = useState(false)
  const [name, setName] = useState(line.name)
  const menuRef = useRef<HTMLDivElement>(null)

  // Tentukan mode awal berdasarkan machine_type yang ada di line
  function getModeFromLine(): MachineTypeMode {
    if (!line.machine_type) return 'none'
    if (KNOWN_SLUGS.includes(line.machine_type)) return 'existing'
    return 'custom'
  }

  const [machineTypeMode, setMachineTypeMode] = useState<MachineTypeMode>(getModeFromLine)
  const [existingMachineType, setExistingMachineType] = useState<string>(
    line.machine_type && KNOWN_SLUGS.includes(line.machine_type)
      ? line.machine_type
      : EXISTING_MACHINE_TYPES[0].slug
  )
  const [stationMode, setStationMode] = useState<StationConfigMode>(() => getStationModeFromLine(line))
  const [fixedStationsText, setFixedStationsText] = useState<string>(() => getFixedStationsTextFromLine(line))

  const closeDeleteModal = () => {
    if (!isDeleteOpen || isDeleteClosing) return
    setIsDeleteClosing(true)
    setTimeout(() => {
      setIsDeleteOpen(false)
      setIsDeleteClosing(false)
    }, 200)
  }

  const closeEditModal = () => {
    if (!isEditOpen || isEditClosing) return
    setIsEditClosing(true)
    setTimeout(() => {
      setIsEditOpen(false)
      setIsEditClosing(false)
    }, 200)
  }

  const closeActionMenu = () => {
    if (!isActionMenuOpen || isActionMenuClosing) return
    setIsActionMenuClosing(true)
    setTimeout(() => {
      setIsActionMenuOpen(false)
      setIsActionMenuClosing(false)
    }, 150)
  }

  const toggleActionMenu = () => {
    if (isActionMenuOpen) {
      closeActionMenu()
    } else {
      setIsActionMenuClosing(false)
      setIsActionMenuOpen(true)
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeActionMenu()
      }
    }

    if (isActionMenuOpen && !isActionMenuClosing) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isActionMenuOpen, isActionMenuClosing])
  const [description, setDescription] = useState(line.description ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingVisibility, setIsSavingVisibility] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [isDuplicateName, setIsDuplicateName] = useState(false)
  const isHiddenFromOperator = Boolean(line.hidden_from_operator)

  const resetEditForm = () => {
    setName(line.name)
    setDescription(line.description ?? '')
    setMachineTypeMode(getModeFromLine())
    setExistingMachineType(
      line.machine_type && KNOWN_SLUGS.includes(line.machine_type)
        ? line.machine_type
        : EXISTING_MACHINE_TYPES[0].slug
    )
    setStationMode(getStationModeFromLine(line))
    setFixedStationsText(getFixedStationsTextFromLine(line))
    setError('')
    setIsDuplicateName(false)
  }

  const handleMachineTypeModeChange = (mode: MachineTypeMode) => {
    setMachineTypeMode(mode)
    if (mode === 'none') {
      setStationMode('none')
      setFixedStationsText('')
    } else if (mode === 'existing') {
      if (existingMachineType === 'pc200t') {
        setStationMode('fixed')
        setFixedStationsText('PC-1, PC-2')
      } else if (existingMachineType === 'tandem') {
        setStationMode('variant')
      } else {
        setStationMode('none')
        setFixedStationsText('')
      }
    }
  }

  const handleExistingMachineTypeChange = (slug: string) => {
    setExistingMachineType(slug)
    if (slug === 'pc200t') {
      setStationMode('fixed')
      setFixedStationsText('PC-1, PC-2')
    } else if (slug === 'tandem') {
      setStationMode('variant')
    } else {
      setStationMode('none')
      setFixedStationsText('')
    }
  }

  function resolveStationConfig(): LineStationConfig {
    if (machineTypeMode === 'none') {
      return { mode: 'none' }
    }
    if (stationMode === 'fixed') {
      const stations = fixedStationsText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      return {
        mode: 'fixed',
        stations: stations.length > 0 ? stations : ['Stasiun 1'],
      }
    }
    if (stationMode === 'variant') {
      if (line.station_config?.mode === 'variant') {
        return line.station_config
      }
      if (machineTypeMode === 'existing' && existingMachineType === 'tandem') {
        return {
          mode: 'variant',
          default: 'baru',
          variants: [
            { key: 'lama', label: 'TDM Lama', stations: ['PA-1', 'PA-2', 'PA-3', 'PA-4', 'PA-5'] },
            { key: 'baru', label: 'TDM Baru', stations: ['PA-6', 'PA-7', 'PA-8', 'PA-9', 'PA-10'] },
          ],
        }
      }
      return { mode: 'none' }
    }
    return { mode: 'none' }
  }

  const handleOpenEdit = (event: React.MouseEvent) => {
    event.stopPropagation()
    resetEditForm()
    setIsEditOpen(true)
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Nama line produksi tidak boleh kosong')
      return
    }

    // Hitung machine_type berdasarkan mode
    let machine_type: string | null
    if (machineTypeMode === 'none') {
      machine_type = null
    } else if (machineTypeMode === 'existing') {
      machine_type = existingMachineType
    } else {
      // custom: slugify nama
      machine_type = slugifyName(name.trim()) || null
    }

    try {
      setIsSaving(true)
      setIsDuplicateName(false)
      setError('')

      const response = await fetch('/api/lines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: line.id,
          name: name.trim(),
          description: description.trim() || null,
          machine_type,
          station_config: resolveStationConfig(),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data?.error || 'Gagal mengubah line produksi'
        if (response.status === 409) {
          setIsDuplicateName(true)
        } else {
          setError(message)
        }
        toast.error(message)
        return
      }

      toast.success(`Line produksi "${name.trim()}" berhasil diperbarui!`)
      setIsEditOpen(false)
      onChangeSuccess?.()
    } catch {
      const msg = 'Gagal mengubah line produksi. Periksa koneksi internet Anda.'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenDelete = (event: React.MouseEvent) => {
    event.stopPropagation()
    setIsDeleteOpen(true)
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)

      const response = await fetch(`/api/lines?id=${encodeURIComponent(line.id)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Gagal menghapus line produksi')
      }

      toast.success(`Line produksi "${line.name}" berhasil dihapus.`)
      setIsDeleteOpen(false)
      onChangeSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus line produksi')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleVisibility = async (event: React.MouseEvent) => {
    event.stopPropagation()

    try {
      setIsSavingVisibility(true)

      const response = await fetch('/api/lines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: line.id,
          hidden_from_operator: !isHiddenFromOperator,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Gagal mengubah visibilitas line produksi')
      }

      toast.success(
        isHiddenFromOperator
          ? `Line produksi "${line.name}" sekarang terlihat oleh operator.`
          : `Line produksi "${line.name}" disembunyikan dari operator.`
      )
      onChangeSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah visibilitas line produksi')
    } finally {
      setIsSavingVisibility(false)
    }
  }

  return (
    <>
      {/* Line Card */}
      <div
        onClick={() => onEnter(line)}
        className={`group relative ${isActionMenuOpen ? 'z-20' : 'z-0'} bg-card border rounded-xl p-5 shadow-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isHiddenFromOperator
            ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
            : 'border-border hover:border-primary'
          }`}
        title={`Klik untuk membuka ${line.name}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Folder className="w-5 h-5 text-primary" />
            </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground truncate">
                  {line.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {line.description || 'Klik untuk membuka'}
                </p>
                <p className="mt-3 text-xs font-medium text-muted-foreground">Total Dokumen: {line.document_count ?? 0}</p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {isHiddenFromOperator && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      <EyeOff className="h-3.5 w-3.5" />
                      Disembunyikan dari operator
                    </span>
                  )}
                </div>
              </div>
          </div>

          <div ref={menuRef} className="relative flex-shrink-0" onClick={(event) => event.stopPropagation()}>
            <Button size="icon-sm" variant="ghost" onClick={toggleActionMenu} title="Aksi line produksi" aria-label={`Aksi untuk line ${line.name}`} className="text-muted-foreground hover:bg-muted hover:text-foreground">
              <MoreVertical className="w-5 h-5" />
            </Button>
            {isActionMenuOpen && (
              <div className={`absolute right-0 top-9 z-10 w-48 rounded-xl border border-border bg-card p-1.5 shadow-lg ${isActionMenuClosing
                  ? 'animate-out fade-out slide-out-to-top-2 duration-150 [animation-fill-mode:forwards]'
                  : 'animate-in fade-in slide-in-from-top-2 duration-150'
                }`}>
                <button onClick={(e) => { closeActionMenu(); handleToggleVisibility(e); }} disabled={isSavingVisibility} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
                  {isSavingVisibility ? <Loader2 className="w-4 h-4 animate-spin" /> : isHiddenFromOperator ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-amber-600" />}
                  {isHiddenFromOperator ? 'Tampilkan ke Operator' : 'Sembunyikan dari Operator'}
                </button>
                <button onClick={(e) => { closeActionMenu(); handleOpenEdit(e); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary"><Pencil className="w-4 h-4" /> Edit Line</button>
                <button onClick={(e) => { closeActionMenu(); handleOpenDelete(e); }} disabled={isDeleting} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50">{isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Hapus Line</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus */}
      {isDeleteOpen && (
        <div
          className={`fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm ${
            isDeleteClosing
              ? 'animate-out fade-out duration-200 [animation-fill-mode:forwards]'
              : 'animate-in fade-in duration-200'
          }`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) closeDeleteModal() }}
        >
          <div className={`bg-card rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4 ${
            isDeleteClosing
              ? 'animate-out fade-out zoom-out-95 duration-200 [animation-fill-mode:forwards]'
              : 'animate-in fade-in zoom-in-95 duration-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Hapus Line Produksi</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <p className="text-sm text-foreground">
              Apakah Anda yakin ingin menghapus line produksi{' '}
              <span className="font-semibold text-foreground">&quot;{line.name}&quot;</span>?
            </p>

            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-destructive text-white hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  'Hapus'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit */}
      {isEditOpen && (
        <div
          className={`fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm ${
            isEditClosing
              ? 'animate-out fade-out duration-200 [animation-fill-mode:forwards]'
              : 'animate-in fade-in duration-200'
          }`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !isSaving) closeEditModal() }}
        >
          <div className={`bg-card rounded-xl shadow-2xl max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden ${
            isEditClosing
              ? 'animate-out fade-out zoom-out-95 duration-200 [animation-fill-mode:forwards]'
              : 'animate-in fade-in zoom-in-95 duration-200'
          }`}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <h2 className="text-base font-semibold text-foreground">Edit Line Produksi</h2>
              <button
                onClick={closeEditModal}
                disabled={isSaving}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50 transition-all duration-200"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 text-sm">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground">
                  Nama Line Produksi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    if (isDuplicateName) setIsDuplicateName(false)
                    if (error) setError('')
                  }}
                  className={`w-full px-3 py-1.5 border rounded-lg text-sm text-foreground outline-none focus:ring-2 transition-all duration-200
                    ${isDuplicateName
                      ? 'border-red-400 bg-red-50 focus:ring-red-200'
                      : 'border-border bg-background focus:ring-primary/20 focus:border-primary'
                    }`}
                  disabled={isSaving}
                  autoFocus
                />
                {isDuplicateName && (
                  <p className="text-xs text-red-600 font-medium">
                    Nama ini sudah digunakan. Pilih nama yang berbeda.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground">
                  Deskripsi <span className="text-muted-foreground">(opsional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 border border-border bg-background rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 resize-none"
                  disabled={isSaving}
                />
              </div>

              {/* Hubungkan ke Mesin Produksi */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">
                  Hubungkan ke mesin produksi
                </label>

                <div className="space-y-1.5">
                  {/* Opsi: Bukan line produksi */}
                  <label className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition
                    ${machineTypeMode === 'none'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground hover:bg-muted/50'
                    }`}>
                    <input
                      type="radio"
                      name="edit-machine-type-mode"
                      value="none"
                      checked={machineTypeMode === 'none'}
                      onChange={() => handleMachineTypeModeChange('none')}
                      className="mt-0.5 accent-blue-600"
                      disabled={isSaving}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-foreground">Bukan line produksi</p>
                        <p className="text-[11px] text-muted-foreground">Hanya untuk card dokumen / folder biasa</p>
                      </div>
                    </div>
                  </label>

                  {/* Opsi: Mesin yang sudah ada */}
                  <label className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition
                    ${machineTypeMode === 'existing'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground hover:bg-muted/50'
                    }`}>
                    <input
                      type="radio"
                      name="edit-machine-type-mode"
                      value="existing"
                      checked={machineTypeMode === 'existing'}
                      onChange={() => handleMachineTypeModeChange('existing')}
                      className="mt-0.5 accent-blue-600"
                      disabled={isSaving}
                    />
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Cpu className="w-4 h-4 text-indigo-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">Mesin yang sudah ada</p>
                        <p className="text-[11px] text-muted-foreground">Pakai konfigurasi mesin yang sudah dikonfigurasi</p>
                        {machineTypeMode === 'existing' && (
                          <select
                            value={existingMachineType}
                            onChange={(e) => handleExistingMachineTypeChange(e.target.value)}
                            className="mt-1.5 w-full px-2.5 py-1 border border-border rounded-md text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background"
                            disabled={isSaving}
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
                  <label className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition
                    ${machineTypeMode === 'custom'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground hover:bg-muted/50'
                    }`}>
                    <input
                      type="radio"
                      name="edit-machine-type-mode"
                      value="custom"
                      checked={machineTypeMode === 'custom'}
                      onChange={() => handleMachineTypeModeChange('custom')}
                      className="mt-0.5 accent-blue-600"
                      disabled={isSaving}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <Factory className="w-4 h-4 text-green-500 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-foreground">Line produksi baru (konfigurasi standar)</p>
                        <p className="text-[11px] text-muted-foreground">Buat mesin baru dengan template umum</p>
                        {machineTypeMode === 'custom' && name.trim() && (
                          <p className="text-[11px] text-indigo-600 font-mono mt-0.5">
                            machine_type: <span className="font-semibold">{slugifyName(name.trim())}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </label>

                  {/* Tampilkan machine_type saat ini jika ada dan tidak diubah */}
                  {machineTypeMode === 'custom' && line.machine_type && !KNOWN_SLUGS.includes(line.machine_type) && (
                    <p className="text-[11px] text-muted-foreground pl-1">
                      Sebelumnya: <span className="font-mono text-foreground">{line.machine_type}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Konfigurasi Sub-Stasiun */}
              <div className="space-y-1.5 pt-1 border-t border-border">
                <label className="block text-xs font-medium text-foreground">
                  Konfigurasi Sub-Stasiun
                </label>

                <div className="space-y-1.5">
                  {/* Opsi 1: Tanpa sub-stasiun */}
                  <label className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition
                    ${stationMode === 'none'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground hover:bg-muted/50'
                    }`}>
                    <input
                      type="radio"
                      name="edit-station-mode"
                      value="none"
                      checked={stationMode === 'none'}
                      onChange={() => setStationMode('none')}
                      className="mt-0.5 accent-blue-600"
                      disabled={isSaving}
                    />
                    <div>
                      <p className="text-xs font-medium text-foreground">Tanpa sub-stasiun</p>
                      <p className="text-[11px] text-muted-foreground">Mesin beroperasi sebagai satu stasiun tunggal</p>
                    </div>
                  </label>

                  {/* Opsi 2: Daftar stasiun tetap */}
                  <label className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition
                    ${stationMode === 'fixed'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground hover:bg-muted/50'
                    }`}>
                    <input
                      type="radio"
                      name="edit-station-mode"
                      value="fixed"
                      checked={stationMode === 'fixed'}
                      onChange={() => setStationMode('fixed')}
                      className="mt-0.5 accent-blue-600"
                      disabled={isSaving}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">Daftar stasiun tetap</p>
                      <p className="text-[11px] text-muted-foreground">Memiliki daftar sub-stasiun tetap (cth: PC-1, PC-2)</p>
                      {stationMode === 'fixed' && (
                        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                          <label className="block text-[11px] font-medium text-foreground mb-0.5">
                            Nama Stasiun <span className="text-muted-foreground">(pisahkan dengan koma)</span>
                          </label>
                          <input
                            type="text"
                            value={fixedStationsText}
                            onChange={(e) => setFixedStationsText(e.target.value)}
                            placeholder="Contoh: PC-1, PC-2"
                            className="w-full px-2.5 py-1 border border-border rounded-md text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background"
                            disabled={isSaving}
                          />
                          {fixedStationsText.trim() && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {fixedStationsText
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean)
                                .map((s, i) => (
                                  <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                                    {s}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Opsi 3: Beberapa varian stasiun */}
                  <label className={`flex items-start gap-2.5 p-2 rounded-lg border transition opacity-70 cursor-not-allowed bg-muted/30
                    ${stationMode === 'variant' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <input
                      type="radio"
                      name="edit-station-mode"
                      value="variant"
                      checked={stationMode === 'variant'}
                      onChange={() => setStationMode('variant')}
                      className="mt-0.5 accent-blue-600"
                      disabled={true}
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-foreground">Beberapa varian stasiun</p>
                        <span className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold px-1 py-0.2 rounded">Segera Hadir</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Fitur ini akan tersedia di update berikutnya
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2 shrink-0 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeEditModal}
                  disabled={isSaving}
                  className="flex-1 h-9"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !name.trim()}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-9"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan'
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
