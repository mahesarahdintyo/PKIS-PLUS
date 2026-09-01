'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { AlertTriangle, Bell, ChevronLeft, ChevronRight, Database, FileText, FolderKanban, History, LayoutDashboard, Menu, Shield, Trash2, Users, Wrench, X, Zap } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DocumentCard } from '@/components/ui/document-card'
import { SearchBar } from '@/components/ui/search-bar'
import { UploadDialog } from '@/components/ui/upload-dialog'
import { FolderCard } from '@/components/ui/folder-card'
import { CreateFolderDialog } from '@/components/ui/create-folder-dialog'
import { CreateLineDialog } from '@/components/admin/CreateLineDialog'
import { AdminLineCard } from '@/components/admin/AdminLineCard'
import { LogoutButton } from '@/components/ui/logout-button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { getLines, type Line } from '@/lib/services/line'

interface Document {
  id: string
  lineId?: string
  title: string
  description: string
  category: string
  type: string
  file: {
    name: string
    path: string
    size?: number
  }
  targetTime?: string | null
  hiddenFromOperator?: boolean
  linkedPartNumbers?: { id: string; value: string }[]
}

interface Folder {
  id: number
  name: string
  parent_id: number | null
  item_count?: number
}

interface BreadcrumbItem {
  id: number
  name: string
}

interface AdminLocationState {
  lineId: string
  folderPathHistory: BreadcrumbItem[]
}

const ADMIN_LOCATION_STORAGE_KEY = 'futaba.admin.location'

function readAdminLocation(): AdminLocationState | null {
  try {
    const rawLocation = window.localStorage.getItem(ADMIN_LOCATION_STORAGE_KEY)
    if (!rawLocation) return null

    const location = JSON.parse(rawLocation) as Partial<AdminLocationState>
    const folderPathHistory = Array.isArray(location.folderPathHistory)
      ? location.folderPathHistory.filter(
        (folder): folder is BreadcrumbItem =>
          typeof folder?.id === 'number' && typeof folder?.name === 'string'
      )
      : []

    const lineId = location.lineId ?? (location as any).landId
    if (typeof lineId !== 'string') {
      return null
    }

    return {
      lineId,
      folderPathHistory,
    }
  } catch {
    return null
  }
}

interface AdminPageProps {
  initialLines?: Line[]
}

export default function Page({ initialLines = [] }: AdminPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLine, setSelectedLine] = useState<Line | null>(null)
  const [showLineList, setShowLineList] = useState(true)
  const [lines, setLines] = useState<Line[]>(initialLines)
  const [documents, setDocuments] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentFolder, setCurrentFolder] = useState<BreadcrumbItem | null>(null)
  const [folderPathHistory, setFolderPathHistory] = useState<BreadcrumbItem[]>([])
  const [isLoading, setIsLoading] = useState(initialLines.length === 0)
  const [error, setError] = useState('')
  const [activeView, setActiveView] = useState<'workspace'>('workspace')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false)
  const [isAnyDialogOpen, setIsAnyDialogOpen] = useState(false)

  // ── Bulk select state ──────────────────────────────────────────────────────
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState('')
  const pageTitle = {
    workspace: 'Workspace',
  }[activeView]

  const selectView = (view: typeof activeView) => {
    setActiveView(view)
    setIsSidebarOpen(false)
  }

  // Pastikan keluar dari mode fullscreen saat berada di halaman admin
  useEffect(() => {
    if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const persistAdminLocation = (line: Line, history: BreadcrumbItem[]) => {
    window.localStorage.setItem(
      ADMIN_LOCATION_STORAGE_KEY,
      JSON.stringify({
        lineId: line.id,
        folderPathHistory: history,
      })
    )
  }

  const clearAdminLocation = () => {
    window.localStorage.removeItem(ADMIN_LOCATION_STORAGE_KEY)
  }

  const loadLines = async () => {
    try {
      setIsLoading(true)
      const data = await getLines({ includeHidden: true })

      setLines(data)
      setSelectedLine(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengambil data line produksi')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    async function loadInitialLines() {
      try {
        setIsLoading(true)
        const data = await getLines({ includeHidden: true })
        if (!mounted) return

        setLines(data)

        const savedLocation = readAdminLocation()
        const savedLine = savedLocation
          ? data.find((line) => line.id === savedLocation.lineId)
          : null

        if (savedLine && savedLocation) {
          const nextHistory = savedLocation.folderPathHistory

          setSelectedLine(savedLine)
          setShowLineList(false)
          setFolderPathHistory(nextHistory)
          setCurrentFolder(nextHistory[nextHistory.length - 1] ?? null)
          setSearchQuery('')
          return
        }

        clearAdminLocation()
        setSelectedLine(null)
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Gagal mengambil data line produksi')
        }
        console.error(err)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadInitialLines()

    return () => {
      mounted = false
    }
  }, [])

  const handleEnterLine = (line: Line) => {
    setSelectedLine(line)
    setShowLineList(false)

    setCurrentFolder(null)
    setFolderPathHistory([])
    setSearchQuery('')
    persistAdminLocation(line, [])
  }

  // Fetch documents and folders whenever the current folder or search changes
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchWorkspaceData(searchQuery.trim())
    }, searchQuery.trim() ? 300 : 0)

    return () => window.clearTimeout(timeoutId)
  }, [selectedLine, showLineList, currentFolder, searchQuery])

  const fetchWorkspaceData = async (searchTerm = '') => {
    if (showLineList || !selectedLine) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError('')

      await Promise.all([
        fetchDocuments(searchTerm),
        fetchFolders(searchTerm)
      ])
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchDocuments = async (searchTerm = searchQuery.trim()) => {
    if (!selectedLine) return

    try {
      const params = new URLSearchParams({
        lineId: selectedLine.id,
        includeHidden: 'true'
      })

      if (searchTerm) {
        params.set('search', searchTerm)
      } else if (currentFolder) {
        params.set('folderId', currentFolder.id.toString())
      }

      const url = `/api/documents?${params.toString()}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Gagal mengambil data dokumen')
      }

      const data = await response.json()
      setDocuments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching documents')
      console.error('Error fetching documents:', err)
    }
  }

  const fetchFolders = async (searchTerm = searchQuery.trim()) => {
    if (!selectedLine) return

    try {
      const params = new URLSearchParams({
        lineId: selectedLine.id
      })

      if (searchTerm) {
        params.set('search', searchTerm)
        params.set('includeAll', 'true')
      } else if (currentFolder) {
        params.set('parentId', currentFolder.id.toString())
      }

      const url = `/api/folders?${params.toString()}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Gagal mengambil data folder')
      }

      const data = await response.json()
      setFolders(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching folders')
      console.error('Error fetching folders:', err)
    }
  }

  const handleUploadSuccess = () => {
    fetchWorkspaceData()
  }

  const handleCreateFolderSuccess = () => {
    fetchWorkspaceData()
  }

  const handleDeleteSuccess = (deletedId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== deletedId))
    setSelectedDocIds(prev => { const next = new Set(prev); next.delete(deletedId); return next })
  }

  const toggleDocSelect = useCallback((id: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkDeleteDocs = async () => {
    if (selectedDocIds.size === 0) return
    try {
      setIsBulkDeleting(true)
      setBulkDeleteError('')

      const ids = Array.from(selectedDocIds)
      const res = await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Gagal menghapus dokumen')
      }

      toast.success(`${ids.length} dokumen berhasil dipindahkan ke Tempat Sampah.`)
      setDocuments(prev => prev.filter(d => !selectedDocIds.has(d.id)))
      setSelectedDocIds(new Set())
      setShowBulkDeleteModal(false)
    } catch (err: any) {
      setBulkDeleteError(err?.message ?? 'Gagal menghapus dokumen.')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleVisibilityChange = (documentId: string, hiddenFromOperator: boolean) => {
    setDocuments((currentDocuments) =>
      currentDocuments.map((doc) =>
        doc.id === documentId
          ? { ...doc, hiddenFromOperator }
          : doc
      )
    )
  }

  const handleEnterFolder = (id: number, name: string) => {
    const newHistory = [...folderPathHistory, { id, name }]

    setFolderPathHistory(newHistory)
    setCurrentFolder({ id, name })
    setSearchQuery('')

    if (selectedLine) {
      persistAdminLocation(selectedLine, newHistory)
    }
  }

  const handleNavigateBreadcrumb = (index: number) => {
    if (index === -1) {
      setShowLineList(true)
      setSelectedLine(null)
      setCurrentFolder(null)
      setFolderPathHistory([])
      setSearchQuery('')
      clearAdminLocation()
      return
    }

    const newHistory = folderPathHistory.slice(0, index + 1)

    setFolderPathHistory(newHistory)
    setCurrentFolder(newHistory[newHistory.length - 1])
    setSearchQuery('')

    if (selectedLine) {
      persistAdminLocation(selectedLine, newHistory)
    }
  }

  const handleNavigateLineRoot = () => {
    setCurrentFolder(null)
    setFolderPathHistory([])
    setSearchQuery('')

    if (selectedLine) {
      persistAdminLocation(selectedLine, [])
    }
  }

  const handleFolderDeleteSuccess = () => {
    fetchFolders()
  }

  // Clear selection when navigating away from a line
  useEffect(() => {
    setSelectedDocIds(new Set())
  }, [currentFolder, selectedLine, showLineList])

  const filteredLines = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return lines

    return lines.filter((line) => {
      return (
        line.name.toLowerCase().includes(query) ||
        (line.description || '').toLowerCase().includes(query)
      )
    })
  }, [searchQuery, lines])

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.file.name.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesSearch
    })
  }, [searchQuery, documents])

  const filteredFolders = useMemo(() => {
    if (!searchQuery) return folders
    return folders.filter((folder) =>
      folder.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery, folders])

  // ── Bulk select computed values (need filteredDocuments) ──────────────────
  const isAllDocsSelected = useMemo(() =>
    filteredDocuments.length > 0 && filteredDocuments.every(d => selectedDocIds.has(d.id)),
    [filteredDocuments, selectedDocIds]
  )

  const isDocIndeterminate = useMemo(() =>
    filteredDocuments.some(d => selectedDocIds.has(d.id)) && !isAllDocsSelected,
    [filteredDocuments, selectedDocIds, isAllDocsSelected]
  )

  const toggleSelectAllDocs = () => {
    if (isAllDocsSelected) {
      setSelectedDocIds(new Set())
    } else {
      setSelectedDocIds(new Set(filteredDocuments.map(d => d.id)))
    }
  }

  const showEmptyState = filteredDocuments.length === 0 && filteredFolders.length === 0

  return (
    <div className="h-screen w-full bg-background text-foreground lg:flex overflow-hidden">
      {/* Mobile backdrop */}
      {isSidebarOpen && <button aria-label="Tutup navigasi" className="fixed inset-0 z-30 bg-background/80 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* Desktop sidebar */}
      <div className="hidden lg:block relative flex-shrink-0 h-full">
        <div className={`h-full overflow-hidden transition-[width] duration-300 ease-in-out ${isDesktopSidebarCollapsed ? 'w-0' : 'w-72'}`}>
          <aside className={`h-full w-72 flex flex-col border-r border-border bg-card p-4 transition-all duration-300 ${isAnyDialogOpen ? 'blur-md pointer-events-none opacity-40' : ''}`}>
            <div className="flex items-center justify-between border-b border-border px-2 pb-4">
              <Link href="/" aria-label="Kembali ke landing page" className="inline-flex"><Image src="/pkis-logo-wordmark(final).png" alt="PKIS Logo" width={180} height={60} className="h-13 w-auto object-contain" priority /></Link>
            </div>
            <nav className="mt-6 flex-1 overflow-y-auto space-y-1" aria-label="Navigasi utama">
              <SidebarButton icon={FolderKanban} label="Workspace" active={activeView === 'workspace'} onClick={() => selectView('workspace')} />
              <SidebarLink href="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" />
              <div className="pt-2">
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Input Produksi</p>
                <SidebarLink href="/admin/safety" icon={Shield} label="Input Safety" />
                <SidebarLink href="/admin/productivity" icon={Zap} label="Input Earned Hours" />
                <SidebarLink href="/admin/scrap" icon={Wrench} label="Input Scrap" />
                <SidebarLink href="/admin/attendance" icon={Users} label="Input Attendance" />
                <SidebarLink href="/admin/andon-settings" icon={Bell} label="Panggilan Andon" />
              </div>
              <div className="pt-2">
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Monitoring Produksi</p>
                <SidebarLink href="/admin/laporan-produksi" icon={FileText} label="Laporan Produksi" />
                <SidebarLink href="/admin/master-data" icon={Database} label="Master Data Produksi" />
                <SidebarLink href="/admin/downtime-log" icon={History} label="Downtime Log" />
              </div>
            </nav>
            <div className="mt-auto space-y-3 border-t border-border pt-4">
              <Link href="/admin/recycle-bin" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"><Trash2 className="h-5 w-5" />Tempat Sampah</Link>
              <ThemeToggle variant="sidebar" />
              <LogoutButton />
            </div>
          </aside>
        </div>
        <button
          aria-label={isDesktopSidebarCollapsed ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
          className="absolute top-16 right-0 translate-x-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors duration-200 cursor-pointer active:scale-90"
          onClick={() => setIsDesktopSidebarCollapsed(prev => !prev)}
        >
          <ChevronLeft className={`h-4 w-4 transition-transform duration-300 ${isDesktopSidebarCollapsed ? 'rotate-180' : 'rotate-0'}`} />
        </button>
      </div>

      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 lg:hidden flex w-72 flex-col border-r border-border bg-card p-4 shadow-xl transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isAnyDialogOpen ? 'blur-md pointer-events-none opacity-40' : ''}`}>
        <div className="flex items-center justify-between border-b border-border px-2 pb-4">
          <Link href="/" aria-label="Kembali ke landing page" className="inline-flex"><Image src="/pkis-logo-wordmark(final).png" alt="PKIS Logo" width={180} height={60} className="h-13 w-auto object-contain" priority /></Link>
          <button aria-label="Tutup navigasi" className="rounded-lg p-2 text-muted-foreground hover:bg-muted" onClick={() => setIsSidebarOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="mt-6 flex-1 overflow-y-auto space-y-1" aria-label="Navigasi utama">
          <SidebarButton icon={FolderKanban} label="Workspace" active={activeView === 'workspace'} onClick={() => selectView('workspace')} />
          <SidebarLink href="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <div className="pt-2">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Input Produksi</p>
            <SidebarLink href="/admin/safety" icon={Shield} label="Input Safety" />
            <SidebarLink href="/admin/productivity" icon={Zap} label="Input Earned Hours" />
            <SidebarLink href="/admin/scrap" icon={Wrench} label="Input Scrap" />
            <SidebarLink href="/admin/attendance" icon={Users} label="Input Attendance" />
            <SidebarLink href="/admin/andon-settings" icon={Bell} label="Panggilan Andon" />
          </div>
          <div className="pt-2">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Monitoring Produksi</p>
            <SidebarLink href="/admin/laporan-produksi" icon={FileText} label="Laporan Produksi" />
            <SidebarLink href="/admin/master-data" icon={Database} label="Master Data Produksi" />
            <SidebarLink href="/admin/downtime-log" icon={History} label="Downtime Log" />
          </div>
        </nav>
        <div className="mt-auto space-y-3 border-t border-border pt-4">
          <Link href="/admin/recycle-bin" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground" onClick={() => setIsSidebarOpen(false)}><Trash2 className="h-5 w-5" />Tempat Sampah</Link>
          <ThemeToggle variant="sidebar" />
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1 flex flex-col h-full overflow-y-auto">
        <header className="sticky top-0 z-20 border-b border-border bg-card">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button aria-label="Buka navigasi" className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors duration-200 lg:hidden" onClick={() => setIsSidebarOpen(true)}><Menu className="h-5 w-5" /></button>
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{pageTitle}</h1>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {activeView === 'workspace' && (showLineList ? <CreateLineDialog onCreateSuccess={loadLines} onOpenChange={setIsAnyDialogOpen} /> : selectedLine ? <><CreateFolderDialog parentId={currentFolder ? currentFolder.id : null} lineId={selectedLine.id} onCreateSuccess={handleCreateFolderSuccess} onOpenChange={setIsAnyDialogOpen} /><UploadDialog folderId={currentFolder ? currentFolder.id : null} lineId={selectedLine.id} onUploadSuccess={handleUploadSuccess} onOpenChange={setIsAnyDialogOpen} /></> : null)}
            </div>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <>
              {/* Search Bar */}
              <div className="mb-6">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={
                    showLineList
                      ? 'Cari line produksi berdasarkan nama atau deskripsi...'
                      : 'Cari folder atau dokumen berdasarkan nama...'
                  }
                />
              </div>

              {/* Breadcrumb Navigation */}
              {(!showLineList && selectedLine) && (
                <div className="flex items-center flex-wrap gap-2 text-sm text-muted-foreground mb-6 bg-card p-3 rounded-lg border border-border shadow-sm select-none">
                  <button
                    onClick={() => handleNavigateBreadcrumb(-1)}
                    className="font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Home
                  </button>

                  <ChevronRight className="w-4 h-4 text-muted-foreground" />

                  <button
                    onClick={handleNavigateLineRoot}
                    disabled={folderPathHistory.length === 0}
                    className={`font-semibold transition-colors ${folderPathHistory.length === 0
                      ? 'text-foreground cursor-default'
                      : 'text-primary hover:text-primary/80'
                      }`}
                  >
                    {selectedLine.name}
                  </button>

                  {folderPathHistory.map((folder, index) => (
                    <div key={folder.id} className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />

                      <button
                        onClick={() => handleNavigateBreadcrumb(index)}
                        disabled={index === folderPathHistory.length - 1}
                        className={`font-semibold transition-colors ${index === folderPathHistory.length - 1
                          ? 'text-foreground cursor-default'
                          : 'text-primary hover:text-primary/80'
                          }`}
                      >
                        {folder.name}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showLineList && (
                isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <AdminLineCardSkeleton />
                    <AdminLineCardSkeleton />
                    <AdminLineCardSkeleton />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {filteredLines.map((line, index) => (
                      <div
                        key={line.id}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <AdminLineCard
                          line={line}
                          onEnter={handleEnterLine}
                          onChangeSuccess={loadLines}
                        />
                      </div>
                    ))}
                  </div>
                )
              )}

              {showLineList && !isLoading && filteredLines.length === 0 && (
                <div className="text-center py-16 bg-card rounded-lg border border-border shadow-sm flex flex-col items-center justify-center p-6">
                  <p className="text-muted-foreground text-lg font-medium">
                    {searchQuery ? 'Tidak ada line produksi yang cocok' : 'Belum ada line produksi'}
                  </p>
                  {!searchQuery ? (
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <p className="text-muted-foreground text-xs">
                        Buat line produksi baru untuk memulai
                      </p>
                      <div className="mt-2">
                        <CreateLineDialog onCreateSuccess={loadLines} onOpenChange={setIsAnyDialogOpen} />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-4 text-sm font-semibold text-primary hover:underline"
                    >
                      Bersihkan pencarian
                    </button>
                  )}
                </div>
              )}

              {/* Folder List Grid */}
              {!showLineList && !isLoading && filteredFolders.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Folder ({filteredFolders.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredFolders.map((folder) => (
                      <FolderCard
                        key={folder.id}
                        id={folder.id}
                        name={folder.name}
                        itemCount={folder.item_count}
                        onEnter={handleEnterFolder}
                        onDeleteSuccess={handleFolderDeleteSuccess}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Documents List */}
              <div className="space-y-3">
                {!showLineList && !isLoading && filteredDocuments.length > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isAllDocsSelected}
                        ref={(el) => { if (el) el.indeterminate = isDocIndeterminate }}
                        onChange={toggleSelectAllDocs}
                        aria-label="Pilih semua dokumen"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Dokumen ({filteredDocuments.length})
                      </h3>
                    </div>
                    {selectedDocIds.size > 0 && (
                      <span className="text-xs text-blue-600 font-semibold">{selectedDocIds.size} dipilih</span>
                    )}
                  </div>
                )}

                {/* Floating Bulk Action Bar */}
                {selectedDocIds.size > 0 && !showLineList && (
                  <div className="sticky top-4 z-30 flex items-center justify-between gap-3 p-3.5 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-3 duration-200">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
                        {selectedDocIds.size}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold">Dokumen Dipilih</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDocIds(new Set())}
                        className="h-8 px-3 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                      >
                        Batal
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => { setBulkDeleteError(''); setShowBulkDeleteModal(true) }}
                        className="h-8 px-3 text-xs font-bold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Hapus ({selectedDocIds.size})</span>
                      </Button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
                    {error}
                  </div>
                )}

                {!showLineList && isLoading ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 animate-pulse">
                        Memuat Folder...
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <FolderCardSkeleton />
                        <FolderCardSkeleton />
                        <FolderCardSkeleton />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 animate-pulse">
                        Memuat Dokumen...
                      </h3>
                      <DocumentCardSkeleton />
                      <DocumentCardSkeleton />
                      <DocumentCardSkeleton />
                    </div>
                  </div>
                ) : !showLineList && filteredDocuments.length > 0 ? (
                  <div className="space-y-3">
                    {filteredDocuments.map((doc) => (
                      <DocumentCard
                        key={doc.id}
                        id={doc.id}
                        lineId={doc.lineId}
                        title={doc.title}
                        description={doc.description}
                        category={doc.category}
                        type={doc.type}
                        file={doc.file}
                        targetTime={doc.targetTime}
                        hiddenFromOperator={doc.hiddenFromOperator}
                        linkedPartNumbers={doc.linkedPartNumbers}
                        onDelete={handleDeleteSuccess}
                        onVisibilityChange={handleVisibilityChange}
                        isSelected={selectedDocIds.has(doc.id)}
                        onToggleSelect={toggleDocSelect}
                      />
                    ))}
                  </div>
                ) : null}

                {/* Empty State */}
                {!showLineList && !isLoading && showEmptyState && (
                  <div className="text-center py-16 bg-card rounded-lg border border-border shadow-sm flex flex-col items-center justify-center p-6">
                    <p className="text-muted-foreground text-lg font-medium">
                      {searchQuery ? 'Tidak ada kecocokan pencarian' : 'Folder ini kosong'}
                    </p>
                    {!searchQuery ? (
                      <div className="mt-4 flex flex-col items-center gap-2">
                        <p className="text-muted-foreground text-xs mb-2">
                          Buat folder baru atau unggah dokumen di atas untuk memulai
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <CreateFolderDialog
                            parentId={currentFolder ? currentFolder.id : null}
                            lineId={selectedLine!.id}
                            onCreateSuccess={handleCreateFolderSuccess}
                            onOpenChange={setIsAnyDialogOpen}
                          />
                          <UploadDialog
                            folderId={currentFolder ? currentFolder.id : null}
                            lineId={selectedLine!.id}
                            onUploadSuccess={handleUploadSuccess}
                            onOpenChange={setIsAnyDialogOpen}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="mt-4 text-sm font-semibold text-primary hover:underline"
                      >
                        Bersihkan pencarian
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Bulk Delete Modal */}
              {showBulkDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-start gap-4 mb-5">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-foreground">Hapus {selectedDocIds.size} Dokumen?</h3>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                          Apakah Anda yakin ingin menghapus <strong className="text-foreground">{selectedDocIds.size} dokumen</strong> yang dipilih?
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          Dokumen akan dipindahkan ke Tempat Sampah (soft-delete).
                        </p>
                      </div>
                    </div>

                    {bulkDeleteError && (
                      <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs">
                        {bulkDeleteError}
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isBulkDeleting}
                        onClick={() => setShowBulkDeleteModal(false)}
                      >
                        Batal
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={isBulkDeleting}
                        onClick={handleBulkDeleteDocs}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        {isBulkDeleting ? 'Menghapus...' : `Ya, Hapus (${selectedDocIds.size})`}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
        </main>

        {/* Footer */}
        <footer className="bg-card border-t border-border mt-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-center text-muted-foreground text-sm">
              © 2026 PKIS. Semua hak dilindungi.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}

function SidebarButton({ icon: Icon, label, active, onClick }: { icon: typeof FolderKanban; label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-200 ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="h-5 w-5" />{label}</button>
}

function SidebarLink({ href, icon: Icon, label }: { href: string; icon: typeof FolderKanban; label: string }) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-200 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  )
}

function FolderCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm flex items-center justify-between min-w-0 animate-pulse select-none">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 bg-muted rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-3 bg-muted rounded w-1/3" />
        </div>
      </div>
    </div>
  )
}

function DocumentCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4 animate-pulse select-none">
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div className="flex-shrink-0 w-12 h-12 bg-muted rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="h-5 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="flex items-center gap-2 pt-1">
            <div className="h-4 bg-muted rounded-full w-12" />
            <div className="h-3 bg-muted rounded w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminLineCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-start justify-between gap-3 animate-pulse select-none">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/3 pt-1" />
        </div>
      </div>
    </div>
  )
}