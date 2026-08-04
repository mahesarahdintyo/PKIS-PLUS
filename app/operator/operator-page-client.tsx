"use client";

import OperatorHeader from "@/components/operator/OperatorHeader";
import LandSelector from "@/components/operator/LandSelector";
import SearchBar from "@/components/operator/SearchBar";
import DocumentList from "@/components/operator/DocumentList";
import ProductionReportForm from "@/components/operator/ProductionReportForm";
import { getDocuments, type Document } from "@/lib/services/document";
import { getFolders, type Folder } from "@/lib/services/folder";
import { getLands, type Land } from "@/lib/services/land";
import { ClipboardList, Tv } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const LAND_STORAGE_KEY = "futaba.operator.selectedLand";
const OPERATOR_LOCATION_STORAGE_KEY = "futaba.operator.location";
const WORKSPACE_REFRESH_INTERVAL_MS = 3000;
const LAND_REFRESH_INTERVAL_MS = 3000;

interface BreadcrumbItem {
  id: number;
  name: string;
}

interface OperatorLocationState {
  landId: string;
  folderPathHistory: BreadcrumbItem[];
}

function readOperatorLocation(): OperatorLocationState | null {
  try {
    const rawLocation = window.localStorage.getItem(OPERATOR_LOCATION_STORAGE_KEY);
    if (!rawLocation) return null;

    const location = JSON.parse(rawLocation) as Partial<OperatorLocationState>;
    const folderPathHistory = Array.isArray(location.folderPathHistory)
      ? location.folderPathHistory.filter(
        (folder): folder is BreadcrumbItem =>
          typeof folder?.id === "number" && typeof folder?.name === "string"
      )
      : [];

    if (typeof location.landId !== "string") {
      return null;
    }

    return {
      landId: location.landId,
      folderPathHistory,
    };
  } catch {
    return null;
  }
}

interface OperatorPageProps {
  userRole?: string;
  userLandId?: string | null;
  initialLands?: Land[];
  initialFolders?: Folder[];
  initialDocuments?: Document[];
}

export default function OperatorPage({
  userRole = "operator",
  userLandId,
  initialLands = [],
  initialFolders = [],
  initialDocuments = [],
}: OperatorPageProps) {
  const isOperator = userRole === "operator";
  const defaultLand = isOperator && userLandId
    ? initialLands.find(
        (l) => String(l.id).trim().toLowerCase() === String(userLandId).trim().toLowerCase()
      ) ?? initialLands[0] ?? null
    : initialLands[0] ?? null;

  const [selectedLand, setSelectedLand] = useState<Land | null>(defaultLand);
  const [lands, setLands] = useState<Land[]>(initialLands);
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [currentFolder, setCurrentFolder] = useState<BreadcrumbItem | null>(null);
  const [folderPathHistory, setFolderPathHistory] = useState<BreadcrumbItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(initialLands.length === 0);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"display" | "report">("display");
  const [documentListKey, setDocumentListKey] = useState(0);
  const workspaceRequestIdRef = useRef(0);
  const landsRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const folderPathHistoryRef = useRef<BreadcrumbItem[]>([]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    folderPathHistoryRef.current = folderPathHistory;
  }, [folderPathHistory]);

  // For operators: clear any stale land from previous sessions on mount
  useEffect(() => {
    if (isOperator) {
      window.localStorage.removeItem(LAND_STORAGE_KEY);
      window.localStorage.removeItem(OPERATOR_LOCATION_STORAGE_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistOperatorLocation = (land: Land, history: BreadcrumbItem[]) => {
    // For operators, don't persist landId to localStorage (it's enforced from profile)
    if (!isOperator) {
      window.localStorage.setItem(LAND_STORAGE_KEY, land.id);
    }
    window.localStorage.setItem(
      OPERATOR_LOCATION_STORAGE_KEY,
      JSON.stringify({
        landId: isOperator ? undefined : land.id,
        folderPathHistory: history,
      })
    );
  };

  const clearOperatorFolderLocation = (land: Land) => {
    persistOperatorLocation(land, []);
  };

  const clearOperatorLocation = () => {
    window.localStorage.removeItem(LAND_STORAGE_KEY);
    window.localStorage.removeItem(OPERATOR_LOCATION_STORAGE_KEY);
  };

  const loadLands = useCallback(
    async ({
      preferSavedLocation = false,
      showError = false,
    }: { preferSavedLocation?: boolean; showError?: boolean } = {}) => {
      const requestId = landsRequestIdRef.current + 1;
      landsRequestIdRef.current = requestId;

      try {
        const activeLands = await getLands();

        if (!isMountedRef.current || landsRequestIdRef.current !== requestId) return;

        setLands(activeLands);

        const savedLocation = isOperator ? null : readOperatorLocation();
        const savedLandId = isOperator
          ? null
          : savedLocation?.landId ?? window.localStorage.getItem(LAND_STORAGE_KEY);

        setSelectedLand((currentLand) => {
          const preferredLandId = isOperator && userLandId
            ? userLandId
            : preferSavedLocation
            ? savedLandId
            : currentLand?.id ?? savedLandId;
          const nextSelectedLand =
            activeLands.find(
              (land) =>
                String(land.id).trim().toLowerCase() ===
                String(preferredLandId).trim().toLowerCase()
            ) ??
            (isOperator ? currentLand ?? activeLands[0] ?? null : activeLands[0] ?? null);

          if (!nextSelectedLand) {
            clearOperatorLocation();
            setCurrentFolder(null);
            setFolderPathHistory([]);
            setSearchQuery("");
            setFolders([]);
            setDocuments([]);
            return null;
          }

          const shouldKeepCurrentFolder =
            currentLand?.id === nextSelectedLand.id ||
            (preferSavedLocation && savedLocation?.landId === nextSelectedLand.id);
          const nextHistory = shouldKeepCurrentFolder
            ? preferSavedLocation
              ? savedLocation?.folderPathHistory ?? []
              : folderPathHistoryRef.current
            : [];

          if (!shouldKeepCurrentFolder) {
            setSearchQuery("");
          }

          setFolderPathHistory(nextHistory);
          setCurrentFolder(nextHistory[nextHistory.length - 1] ?? null);
          persistOperatorLocation(nextSelectedLand, nextHistory);

          if (
            currentLand?.id === nextSelectedLand.id &&
            currentLand.name === nextSelectedLand.name &&
            currentLand.description === nextSelectedLand.description &&
            currentLand.is_active === nextSelectedLand.is_active
          ) {
            return currentLand;
          }

          return nextSelectedLand;
        });
      } catch (error) {
        if (showError && isMountedRef.current) {
          setError(error instanceof Error ? error.message : "Gagal memuat card");
        }
        console.error("Failed to load lands", error);
      }
    },
    [isOperator, userLandId]
  );

  useEffect(() => {
    loadLands({ preferSavedLocation: true, showError: true });
  }, [loadLands]);

  useEffect(() => {
    let timeoutId: number;
    let isMounted = true;

    const pollLands = async () => {
      if (!isMounted) return;
      await loadLands();
      if (isMounted) {
        timeoutId = window.setTimeout(pollLands, LAND_REFRESH_INTERVAL_MS);
      }
    };

    timeoutId = window.setTimeout(pollLands, LAND_REFRESH_INTERVAL_MS);

    const handleWindowFocus = () => {
      loadLands();
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [loadLands]);

  const handleLandChange = (land: Land) => {
    setSelectedLand(land);
    setCurrentFolder(null);
    setFolderPathHistory([]);
    setSearchQuery("");
    clearOperatorFolderLocation(land);
  };

  const loadWorkspaceData = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      const requestId = workspaceRequestIdRef.current + 1;
      workspaceRequestIdRef.current = requestId;

      if (!selectedLand) {
        setFolders([]);
        setDocuments([]);
        setIsLoading(false);
        return;
      }

      try {
        if (showLoading) {
          setIsLoading(true);
        }
        setError("");

        const search = searchQuery.trim();
        const folderParentId = search ? null : currentFolder?.id ?? null;

        const [landFolders, landDocuments] = await Promise.all([
          getFolders({
            landId: selectedLand.id,
            parentId: folderParentId,
            includeAll: Boolean(search),
            search,
          }),
          getDocuments({
            landId: selectedLand.id,
            folderId: folderParentId,
            search,
          }),
        ]);

        setFolders(landFolders);
        setDocuments(landDocuments);
        if (showLoading) {
          setDocumentListKey((prev) => prev + 1);
        }
      } catch (error) {
        console.error("Failed to load operator workspace", error);

        if (!isMountedRef.current || workspaceRequestIdRef.current !== requestId) return;

        if (showLoading) {
          setFolders([]);
          setDocuments([]);
          setError(
            error instanceof Error
              ? error.message
              : "Gagal memuat data operator"
          );
        }
      } finally {
        if (isMountedRef.current && workspaceRequestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [currentFolder, searchQuery, selectedLand]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadWorkspaceData();
    }, searchQuery.trim() ? 300 : 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadWorkspaceData, searchQuery]);

  useEffect(() => {
    if (!selectedLand) return;

    let timeoutId: number;
    let isMounted = true;

    const pollWorkspace = async () => {
      if (!isMounted) return;
      await loadWorkspaceData({ showLoading: false });
      if (isMounted) {
        timeoutId = window.setTimeout(pollWorkspace, WORKSPACE_REFRESH_INTERVAL_MS);
      }
    };

    timeoutId = window.setTimeout(pollWorkspace, WORKSPACE_REFRESH_INTERVAL_MS);

    const handleWindowFocus = () => {
      loadWorkspaceData({ showLoading: false });
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [loadWorkspaceData, selectedLand]);
  const handleEnterFolder = (id: number, name: string) => {
    const nextFolder = { id, name };
    const nextHistory = [...folderPathHistory, nextFolder];
    setFolderPathHistory(nextHistory);
    setCurrentFolder(nextFolder);
    setSearchQuery("");

    if (selectedLand) {
      persistOperatorLocation(selectedLand, nextHistory);
    }
  };

  const handleNavigateBreadcrumb = (index: number) => {
    setSearchQuery("");

    if (index === -1) {
      setFolderPathHistory([]);
      setCurrentFolder(null);
      if (selectedLand) {
        clearOperatorFolderLocation(selectedLand);
      }
      return;
    }

    const nextHistory = folderPathHistory.slice(0, index + 1);
    setFolderPathHistory(nextHistory);
    setCurrentFolder(nextHistory[index] ?? null);
    if (selectedLand) {
      persistOperatorLocation(selectedLand, nextHistory);
    }
  };


  return (
    <main className="min-h-screen bg-background text-foreground">
      <OperatorHeader selectedLand={selectedLand?.name ?? ""} />

      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6 p-3 sm:p-6">
        {userRole === "admin" && (
          <LandSelector
            value={selectedLand}
            lands={lands}
            onChange={handleLandChange}
          />
        )}

        {/* Menu Tabs Switcher */}
        <div className="flex border-b border-border overflow-x-auto">
          <button
            onClick={() => setActiveTab("display")}
            className={`flex items-center gap-1.5 border-b-2 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all duration-200 active:scale-[0.97] focus:outline-none cursor-pointer whitespace-nowrap flex-shrink-0 ${activeTab === "display"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            type="button"
          >
            <Tv className="h-4 w-4" />
            Display TV
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`flex items-center gap-1.5 border-b-2 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all duration-200 active:scale-[0.97] focus:outline-none cursor-pointer whitespace-nowrap flex-shrink-0 ${activeTab === "report"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            type="button"
          >
            <ClipboardList className="h-4 w-4" />
            Laporan Produksi
          </button>
        </div>

        {activeTab === "display" ? (
          <div className="space-y-6">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />

            {folderPathHistory.length > 0 && !searchQuery && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground shadow-sm">
                <button
                  onClick={() => handleNavigateBreadcrumb(-1)}
                  className="font-semibold text-primary transition-colors duration-200 active:scale-[0.97] hover:text-primary/80"
                  type="button"
                >
                  Home
                </button>

                {folderPathHistory.map((folder, index) => (
                  <div key={folder.id} className="flex items-center gap-2">
                    <span className="text-muted-foreground">/</span>

                    <button
                      onClick={() => handleNavigateBreadcrumb(index)}
                      className="font-semibold text-foreground transition-colors duration-200 active:scale-[0.97] enabled:text-primary enabled:hover:text-primary/80"
                      disabled={index === folderPathHistory.length - 1}
                      type="button"
                    >
                      {folder.name}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <DocumentList
              key={documentListKey}
              folders={folders}
              documents={documents}
              isLoading={isLoading}
              error={error}
              selectedLandId={selectedLand?.id}
              onEnterFolder={handleEnterFolder}
            />
          </div>
        ) : (
          selectedLand ? (
            <div>
              <ProductionReportForm landId={selectedLand.id} />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground shadow-sm">
              Silakan pilih Line terlebih dahulu untuk mengisi laporan produksi.
            </div>
          )
        )}
      </div>
    </main>
  );
}
