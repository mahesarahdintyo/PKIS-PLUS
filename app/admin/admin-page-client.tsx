'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, FileText, FolderKanban, Menu, Tags, Trash2, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DocumentCard } from '@/components/ui/document-card'
import { SearchBar } from '@/components/ui/search-bar'
import { UploadDialog } from '@/components/ui/upload-dialog'
import { FolderCard } from '@/components/ui/folder-card'
import { CreateFolderDialog } from '@/components/ui/create-folder-dialog'
import { CreateLandDialog } from '@/components/admin/CreateLandDialog'
import { AdminLandCard } from '@/components/admin/AdminLandCard'
import { LogoutButton } from '@/components/ui/logout-button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { getLands, type Land } from '@/lib/services/land'
import ProductionReportsDashboard from '@/components/admin/ProductionReportsDashboard'
import AdminPartNumbersPanel from '@/components/admin/AdminPartNumbersPanel'
import AdminNgCategoriesPanel from '@/components/admin/AdminNgCategoriesPanel'

interface Document {
  id: string
  landId?: string
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
  landId: string
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

    if (typeof location.landId !== 'string') {
      return null
    }

    return {
      landId: location.landId,
      folderPathHistory,
    }
  } catch {
    return null
  }
}

interface AdminPageProps {
  initialLands?: Land[]
}

export default function Page({ initialLands = [] }: AdminPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLand, setSelectedLand] = useState<Land | null>(null)
  const [showLandList, setShowLandList] = useState(true)
  const [lands, setLands] = useState<Land[]>(initialLands)
  const [documents, setDocuments] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentFolder, setCurrentFolder] = useState<BreadcrumbItem | null>(null)
  const [folderPathHistory, setFolderPathHistory] = useState<BreadcrumbItem[]>([])
  const [isLoading, setIsLoading] = useState(initialLands.length === 0)
  const [error, setError] = useState('')
  const [activeView, setActiveView] = useState<'workspace' | 'reports' | 'part-numbers' | 'ng-categories'>('workspace')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false)
  const [isAnyDialogOpen, setIsAnyDialogOpen] = useState(false)
  const pageTitle = {
    workspace: 'Workspace',
    reports: 'Laporan Produksi',
    'part-numbers': 'Part Number',
    'ng-categories': 'Kategori NG',
  }[activeView]

  const selectView = (view: typeof activeView) => {
    setActiveView(view)
    setIsSidebarOpen(false)
  }
  const persistAdminLocation = (land: Land, history: BreadcrumbItem[]) => {
    window.localStorage.setItem(
      ADMIN_LOCATION_STORAGE_KEY,
      JSON.stringify({
        landId: land.id,
        folderPathHistory: history,
      })
    )
  }

  const clearAdminLocation = () => {
    window.localStorage.removeItem(ADMIN_LOCATION_STORAGE_KEY)
  }

  const loadLands = async () => {
    try {
      setIsLoading(true)
      const data = await getLands({ includeHidden: true })

      setLands(data)
      setSelectedLand(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengambil data card')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    async function loadInitialLands() {
      try {
        setIsLoading(true)
        const data = await getLands({ includeHidden: true })
        if (!mounted) return

        setLands(data)

        const savedLocation = readAdminLocation()
        const savedLand = savedLocation
          ? data.find((land) => land.id === savedLocation.landId)
          : null

        if (savedLand && savedLocation) {
          const nextHistory = savedLocation.folderPathHistory

          setSelectedLand(savedLand)
          setShowLandList(false)
          setFolderPathHistory(nextHistory)
          setCurrentFolder(nextHistory[nextHistory.length - 1] ?? null)
          setSearchQuery('')
          return
        }

        clearAdminLocation()
        setSelectedLand(null)
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Gagal mengambil data card')
        }
        console.error(err)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadInitialLands()

    return () => {
      mounted = false
    }
  }, [])

  const handleEnterLand = (land: Land) => {
    setSelectedLand(land)
    setShowLandList(false)

    setCurrentFolder(null)
    setFolderPathHistory([])
    setSearchQuery('')
    persistAdminLocation(land, [])
  }

  // Fetch documents and folders whenever the current folder or search changes
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchWorkspaceData(searchQuery.trim())
    }, searchQuery.trim() ? 300 : 0)

    return () => window.clearTimeout(timeoutId)
  }, [selectedLand, showLandList, currentFolder, searchQuery])

  const fetchWorkspaceData = async (searchTerm = '') => {
    if (showLandList || !selectedLand) {
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
    if (!selectedLand) return

    try {
      const params = new URLSearchParams({
        landId: selectedLand.id,
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
      console.error('[v0] Error fetching documents:', err)
    }
  }

  const fetchFolders = async (searchTerm = searchQuery.trim()) => {
    if (!selectedLand) return

    try {
      const params = new URLSearchParams({
        landId: selectedLand.id
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
      console.error('[v0] Error fetching folders:', err)
    }
  }

  const handleUploadSuccess = () => {
    fetchWorkspaceData()
  }

  const handleCreateFolderSuccess = () => {
    fetchWorkspaceData()
  }

  const handleDeleteSuccess = (deletedId: string) => {
    setDocuments(documents.filter(doc => doc.id !== deletedId))
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

    if (selectedLand) {
      persistAdminLocation(selectedLand, newHistory)
    }
  }

  const handleNavigateBreadcrumb = (index: number) => {
    if (index === -1) {
      setShowLandList(true)
      setSelectedLand(null)
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

    if (selectedLand) {
      persistAdminLocation(selectedLand, newHistory)
    }
  }

  const handleNavigateLandRoot = () => {
    setCurrentFolder(null)
    setFolderPathHistory([])
    setSearchQuery('')

    if (selectedLand) {
      persistAdminLocation(selectedLand, [])
    }
  }

  const handleFolderDeleteSuccess = () => {
    fetchFolders()
  }

  const filteredLands = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return lands

    return lands.filter((land) => {
      return (
        land.name.toLowerCase().includes(query) ||
        (land.description || '').toLowerCase().includes(query)
      )
    })
  }, [searchQuery, lands])

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.file.name.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesSearch
    })
  }, [searchQuery, documents])

  // Filter folders by search query (only at UI level when searching)
  const filteredFolders = useMemo(() => {
    if (!searchQuery) return folders
    return folders.filter((folder) =>
      folder.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery, folders])

  const showEmptyState = filteredDocuments.length === 0 && filteredFolders.length === 0

  return (
    <div className="h-screen w-full bg-background text-foreground lg:flex overflow-hidden">
      {/* Mobile backdrop */}
      {isSidebarOpen && <button aria-label="Tutup navigasi" className="fixed inset-0 z-30 bg-background/80 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* Desktop sidebar — width-animated wrapper + border toggle button */}
      <div className="hidden lg:block relative flex-shrink-0 h-full">
        <div className={`h-full overflow-hidden transition-[width] duration-300 ease-in-out ${isDesktopSidebarCollapsed ? 'w-0' : 'w-72'}`}>
          <aside className={`h-full w-72 flex flex-col border-r border-border bg-card p-4 transition-all duration-300 ${isAnyDialogOpen ? 'blur-md pointer-events-none opacity-40' : ''}`}>
            <div className="flex items-center justify-between border-b border-border px-2 pb-4">
              <Link href="/" aria-label="Kembali ke landing page" className="inline-flex"><Image src="/pkis-logo-wordmark(final).png" alt="PKIS Logo" width={180} height={60} className="h-13 w-auto object-contain" priority /></Link>
            </div>
            <nav className="mt-6 flex-1 overflow-y-auto space-y-1" aria-label="Navigasi utama">
              <SidebarButton icon={FolderKanban} label="Workspace" active={activeView === 'workspace'} onClick={() => selectView('workspace')} />
              <SidebarButton icon={FileText} label="Laporan Produksi" active={activeView === 'reports'} onClick={() => selectView('reports')} />
              <SidebarButton icon={Tags} label="Part Number" active={activeView === 'part-numbers'} onClick={() => selectView('part-numbers')} />
              <SidebarButton icon={Tags} label="Kategori NG" active={activeView === 'ng-categories'} onClick={() => selectView('ng-categories')} />
            </nav>
            <div className="mt-auto space-y-3 border-t border-border pt-4">
              <Link href="/admin/recycle-bin" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"><Trash2 className="h-5 w-5" />Tempat Sampah</Link>
              <ThemeToggle variant="sidebar" />
              <LogoutButton />
            </div>
          </aside>
        </div>
        {/* Floating toggle button on the sidebar border */}
        <button
          aria-label={isDesktopSidebarCollapsed ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
          className="absolute top-16 right-0 translate-x-1/2 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors duration-200 cursor-pointer active:scale-90"
          onClick={() => setIsDesktopSidebarCollapsed(prev => !prev)}
        >
          <ChevronLeft className={`h-4 w-4 transition-transform duration-300 ${isDesktopSidebarCollapsed ? 'rotate-180' : 'rotate-0'}`} />
        </button>
      </div>

      {/* Mobile sidebar — fixed + translate */}
      <aside className={`fixed inset-y-0 left-0 z-40 lg:hidden flex w-72 flex-col border-r border-border bg-card p-4 shadow-xl transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isAnyDialogOpen ? 'blur-md pointer-events-none opacity-40' : ''}`}>
        <div className="flex items-center justify-between border-b border-border px-2 pb-4">
          <Link href="/" aria-label="Kembali ke landing page" className="inline-flex"><Image src="/pkis-logo-wordmark(final).png" alt="PKIS Logo" width={180} height={60} className="h-13 w-auto object-contain" priority /></Link>
          <button aria-label="Tutup navigasi" className="rounded-lg p-2 text-muted-foreground hover:bg-muted" onClick={() => setIsSidebarOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="mt-6 flex-1 overflow-y-auto space-y-1" aria-label="Navigasi utama">
          <SidebarButton icon={FolderKanban} label="Workspace" active={activeView === 'workspace'} onClick={() => selectView('workspace')} />
          <SidebarButton icon={FileText} label="Laporan Produksi" active={activeView === 'reports'} onClick={() => selectView('reports')} />
          <SidebarButton icon={Tags} label="Part Number" active={activeView === 'part-numbers'} onClick={() => selectView('part-numbers')} />
          <SidebarButton icon={Tags} label="Kategori NG" active={activeView === 'ng-categories'} onClick={() => selectView('ng-categories')} />
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
              {/* Mobile: hamburger */}
              <button aria-label="Buka navigasi" className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors duration-200 lg:hidden" onClick={() => setIsSidebarOpen(true)}><Menu className="h-5 w-5" /></button>
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{pageTitle}</h1>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {activeView === 'workspace' && (showLandList ? <CreateLandDialog onCreateSuccess={loadLands} onOpenChange={setIsAnyDialogOpen} /> : selectedLand ? <><CreateFolderDialog parentId={currentFolder ? currentFolder.id : null} landId={selectedLand.id} onCreateSuccess={handleCreateFolderSuccess} onOpenChange={setIsAnyDialogOpen} /><UploadDialog folderId={currentFolder ? currentFolder.id : null} landId={selectedLand.id} onUploadSuccess={handleUploadSuccess} onOpenChange={setIsAnyDialogOpen} /></> : null)}
            </div>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeView === 'reports' ? (
            <ProductionReportsDashboard />
          ) : activeView === 'part-numbers' ? (
            <AdminPartNumbersPanel />
          ) : activeView === 'ng-categories' ? (
            <AdminNgCategoriesPanel />
          ) : (
            <>
              {/* Search Bar */}
              <div className="mb-6">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={
                    showLandList
                      ? 'Cari card berdasarkan nama atau deskripsi...'
                      : 'Cari folder atau dokumen berdasarkan nama...'
                  }
                />
              </div>

              {/* Breadcrumb Navigation */}
              {(!showLandList && selectedLand) && (
                <div className="flex items-center flex-wrap gap-2 text-sm text-muted-foreground mb-6 bg-card p-3 rounded-lg border border-border shadow-sm select-none">

                  <button
                    onClick={() => handleNavigateBreadcrumb(-1)}
                    className="font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Home
                  </button>

                  <ChevronRight className="w-4 h-4 text-muted-foreground" />

                  <button
                    onClick={handleNavigateLandRoot}
                    disabled={folderPathHistory.length === 0}
                    className={`font-semibold transition-colors ${folderPathHistory.length === 0
                      ? 'text-foreground cursor-default'
                      : 'text-primary hover:text-primary/80'
                      }`}
                  >
                    {selectedLand.name}
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

              {showLandList && (
                isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <AdminLandCardSkeleton />
                    <AdminLandCardSkeleton />
                    <AdminLandCardSkeleton />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {filteredLands.map((land, index) => (
                      <div
                        key={land.id}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <AdminLandCard
                          land={land}
                          onEnter={handleEnterLand}
                          onChangeSuccess={loadLands}
                        />
                      </div>
                    ))}
                  </div>
                )
              )}

              {showLandList && !isLoading && filteredLands.length === 0 && (
                <div className="text-center py-16 bg-card rounded-lg border border-border shadow-sm flex flex-col items-center justify-center p-6">
                  <p className="text-muted-foreground text-lg font-medium">
                    {searchQuery ? 'Tidak ada card yang cocok' : 'Belum ada card'}
                  </p>
                  {!searchQuery ? (
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <p className="text-muted-foreground text-xs">
                        Buat card baru untuk memulai
                      </p>
                      <div className="mt-2">
                        <CreateLandDialog onCreateSuccess={loadLands} onOpenChange={setIsAnyDialogOpen} />
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
              {!showLandList && !isLoading && filteredFolders.length > 0 && (
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
                {!showLandList && !isLoading && filteredDocuments.length > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Dokumen ({filteredDocuments.length})
                    </h3>
                  </div>
                )}

                {error && (
                  <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
                    {error}
                  </div>
                )}

                {!showLandList && isLoading ? (
                  <div className="space-y-6">
                    {/* Folder Loading Skeleton */}
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
                    {/* Document Loading Skeleton */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 animate-pulse">
                        Memuat Dokumen...
                      </h3>
                      <DocumentCardSkeleton />
                      <DocumentCardSkeleton />
                      <DocumentCardSkeleton />
                    </div>
                  </div>
                ) : !showLandList && filteredDocuments.length > 0 ? (
                  <div className="space-y-3">
                    {filteredDocuments.map((doc) => (
                      <DocumentCard
                        key={doc.id}
                        id={doc.id}
                        landId={doc.landId}
                        title={doc.title}
                        description={doc.description}
                        category={doc.category}
                        type={doc.type}
                        file={doc.file}
                        targetTime={doc.targetTime}
                        hiddenFromOperator={doc.hiddenFromOperator}
                        onDelete={handleDeleteSuccess}
                        onVisibilityChange={handleVisibilityChange}
                      />
                    ))}
                  </div>
                ) : null}

                {/* Empty State */}
                {!showLandList && !isLoading && showEmptyState && (
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
                            landId={selectedLand!.id}
                            onCreateSuccess={handleCreateFolderSuccess}
                            onOpenChange={setIsAnyDialogOpen}
                          />
                          <UploadDialog
                            folderId={currentFolder ? currentFolder.id : null}
                            landId={selectedLand!.id}
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
            </>
          )}
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

function AdminLandCardSkeleton() {
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