"use client";

import Link from "next/link";
import OperatorHeader from "@/components/operator/OperatorHeader";
import LineSelector from "@/components/operator/LineSelector";
import SearchBar from "@/components/operator/SearchBar";
import DocumentList from "@/components/operator/DocumentList";
import MachineDetailClient from "@/components/produksi/machines/MachineDetailClient";
import "@/app/admin/(produksi)/produksi.css";
import { getDocuments, type Document } from "@/lib/services/document";
import { getFolders, type Folder } from "@/lib/services/folder";
import { getLines, type Line } from "@/lib/services/line";
import { Tv, Factory } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const LINE_STORAGE_KEY = "futaba.operator.selectedLine";
const OPERATOR_LOCATION_STORAGE_KEY = "futaba.operator.location";
const WORKSPACE_REFRESH_INTERVAL_MS = 3000;
const LINE_REFRESH_INTERVAL_MS = 3000;

interface BreadcrumbItem {
  id: number;
  name: string;
}

interface OperatorLocationState {
  lineId: string;
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

    const lineId = location.lineId ?? (location as any).landId;
    if (typeof lineId !== "string") {
      return null;
    }

    return {
      lineId,
      folderPathHistory,
    };
  } catch {
    return null;
  }
}

interface OperatorPageProps {
  lineId?: string;
  selectedLineName?: string;
  userRole?: string;
  userLineId?: string | null;
  userLandId?: string | null;
  initialLines?: Line[];
  initialLands?: Line[];
  initialFolders?: Folder[];
  initialDocuments?: Document[];
}

export default function OperatorPage({
  lineId,
  selectedLineName,
  userRole = "operator",
  userLineId,
  userLandId,
  initialLines = [],
  initialLands = [],
  initialFolders = [],
  initialDocuments = [],
}: OperatorPageProps) {
  const activeUserLineId = userLineId ?? userLandId;
  const activeInitialLines = initialLines.length > 0 ? initialLines : initialLands;

  const isOperator = userRole === "operator";
  const defaultLine = lineId
    ? activeInitialLines.find(
        (l) => String(l.id).trim().toLowerCase() === String(lineId).trim().toLowerCase()
      ) ?? activeInitialLines[0] ?? null
    : isOperator && activeUserLineId
    ? activeInitialLines.find(
        (l) => String(l.id).trim().toLowerCase() === String(activeUserLineId).trim().toLowerCase()
      ) ?? activeInitialLines[0] ?? null
    : activeInitialLines[0] ?? null;

  const [selectedLine, setSelectedLine] = useState<Line | null>(defaultLine);
  const [lines, setLines] = useState<Line[]>(activeInitialLines);
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [currentFolder, setCurrentFolder] = useState<BreadcrumbItem | null>(null);
  const [folderPathHistory, setFolderPathHistory] = useState<BreadcrumbItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // Start as false when SSR already provided lines — no need to show spinner immediately
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"display" | "machine">("display");
  const [documentListKey, setDocumentListKey] = useState(0);
  // Whether SSR already seeded documents — if so, first workspace fetch should be silent.
  // If lineId is present, SSR ran getInitialDocuments/getInitialFolders and the result
  // (even empty arrays) is already fresh — no spinner needed on first client fetch.
  const hasInitialDataRef = useRef(!!lineId);
  const workspaceRequestIdRef = useRef(0);
  const linesRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const folderPathHistoryRef = useRef<BreadcrumbItem[]>([]);
  // Track previous lineId to distinguish initial mount from actual navigation changes
  const prevLineIdRef = useRef<string | undefined>(lineId);

  useEffect(() => {
    if (!lineId) return;
    // On initial mount, skip the fetch — server already provided fresh data via SSR props
    if (prevLineIdRef.current === lineId) {
      prevLineIdRef.current = lineId;
      return;
    }
    prevLineIdRef.current = lineId;
    const nextLine = activeInitialLines.find(
      (l) => String(l.id).trim().toLowerCase() === String(lineId).trim().toLowerCase()
    ) ?? null;
    setSelectedLine(nextLine);
    setLines(activeInitialLines);
    setFolders(initialFolders);
    setDocuments(initialDocuments);
    setCurrentFolder(null);
    setFolderPathHistory([]);
    setSearchQuery("");
    // Immediately kick off a fresh workspace fetch for the new line;
    // can't rely on loadWorkspaceData here (it's stale via closure),
    // so pass the lineId directly.
    if (nextLine) {
      const requestId = workspaceRequestIdRef.current + 1;
      workspaceRequestIdRef.current = requestId;
      setIsLoading(true);
      setError("");
      Promise.all([
        getFolders({ lineId: nextLine.id, parentId: null }),
        getDocuments({ lineId: nextLine.id, folderId: null }),
      ])
        .then(([lineFolders, lineDocuments]) => {
          if (!isMountedRef.current || workspaceRequestIdRef.current !== requestId) return;
          setFolders(lineFolders);
          setDocuments(lineDocuments);
          setDocumentListKey((prev) => prev + 1);
        })
        .catch((err) => {
          if (!isMountedRef.current || workspaceRequestIdRef.current !== requestId) return;
          console.error("Failed to load workspace on line change", err);
          setFolders([]);
          setDocuments([]);
          setError(err instanceof Error ? err.message : "Gagal memuat data operator");
        })
        .finally(() => {
          if (isMountedRef.current && workspaceRequestIdRef.current === requestId) {
            setIsLoading(false);
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    folderPathHistoryRef.current = folderPathHistory;
  }, [folderPathHistory]);

  // For operators: clear any stale line from previous sessions on mount
  useEffect(() => {
    if (isOperator) {
      window.localStorage.removeItem(LINE_STORAGE_KEY);
      window.localStorage.removeItem("futaba.operator.selectedLand");
      window.localStorage.removeItem(OPERATOR_LOCATION_STORAGE_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistOperatorLocation = (line: Line, history: BreadcrumbItem[]) => {
    // For operators, don't persist lineId to localStorage (it's enforced from profile)
    if (!isOperator) {
      window.localStorage.setItem(LINE_STORAGE_KEY, line.id);
    }
    window.localStorage.setItem(
      OPERATOR_LOCATION_STORAGE_KEY,
      JSON.stringify({
        lineId: isOperator ? undefined : line.id,
        folderPathHistory: history,
      })
    );
  };

  const clearOperatorFolderLocation = (line: Line) => {
    persistOperatorLocation(line, []);
  };

  const clearOperatorLocation = () => {
    window.localStorage.removeItem(LINE_STORAGE_KEY);
    window.localStorage.removeItem("futaba.operator.selectedLand");
    window.localStorage.removeItem(OPERATOR_LOCATION_STORAGE_KEY);
  };

  const loadLines = useCallback(
    async ({
      preferSavedLocation = false,
      showError = false,
    }: { preferSavedLocation?: boolean; showError?: boolean } = {}) => {
      const requestId = linesRequestIdRef.current + 1;
      linesRequestIdRef.current = requestId;

      try {
        const activeLines = await getLines();

        if (!isMountedRef.current || linesRequestIdRef.current !== requestId) return;

        setLines(activeLines);

        const savedLocation = isOperator ? null : readOperatorLocation();
        const savedLineId = isOperator
          ? null
          : savedLocation?.lineId ?? window.localStorage.getItem(LINE_STORAGE_KEY) ?? window.localStorage.getItem("futaba.operator.selectedLand");

        setSelectedLine((currentLine) => {
          const preferredLineId = isOperator && activeUserLineId
            ? activeUserLineId
            : preferSavedLocation
            ? savedLineId
            : currentLine?.id ?? savedLineId;
          const nextSelectedLine =
            activeLines.find(
              (line) =>
                String(line.id).trim().toLowerCase() ===
                String(preferredLineId).trim().toLowerCase()
            ) ??
            (isOperator ? currentLine ?? activeLines[0] ?? null : activeLines[0] ?? null);

          if (!nextSelectedLine) {
            clearOperatorLocation();
            setCurrentFolder(null);
            setFolderPathHistory([]);
            setSearchQuery("");
            setFolders([]);
            setDocuments([]);
            return null;
          }

          const shouldKeepCurrentFolder =
            currentLine?.id === nextSelectedLine.id ||
            (preferSavedLocation && savedLocation?.lineId === nextSelectedLine.id);
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
          persistOperatorLocation(nextSelectedLine, nextHistory);

          if (
            currentLine?.id === nextSelectedLine.id &&
            currentLine.name === nextSelectedLine.name &&
            currentLine.description === nextSelectedLine.description &&
            currentLine.is_active === nextSelectedLine.is_active
          ) {
            return currentLine;
          }

          return nextSelectedLine;
        });
      } catch (error) {
        if (showError && isMountedRef.current) {
          setError(error instanceof Error ? error.message : "Gagal memuat line produksi");
        }
        console.error("Failed to load lines", error);
      }
    },
    [isOperator, activeUserLineId]
  );

  useEffect(() => {
    loadLines({ preferSavedLocation: true, showError: true });
  }, [loadLines]);

  useEffect(() => {
    let timeoutId: number;
    let isMounted = true;

    const pollLines = async () => {
      if (!isMounted) return;
      await loadLines();
      if (isMounted) {
        timeoutId = window.setTimeout(pollLines, LINE_REFRESH_INTERVAL_MS);
      }
    };

    timeoutId = window.setTimeout(pollLines, LINE_REFRESH_INTERVAL_MS);

    const handleWindowFocus = () => {
      loadLines();
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [loadLines]);

  const handleLineChange = (line: Line) => {
    setSelectedLine(line);
    setCurrentFolder(null);
    setFolderPathHistory([]);
    setSearchQuery("");
    clearOperatorFolderLocation(line);
  };

  const loadWorkspaceData = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      const requestId = workspaceRequestIdRef.current + 1;
      workspaceRequestIdRef.current = requestId;

      if (!selectedLine) {
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

        const [lineFolders, lineDocuments] = await Promise.all([
          getFolders({
            lineId: selectedLine.id,
            parentId: folderParentId,
            includeAll: Boolean(search),
            search,
          }),
          getDocuments({
            lineId: selectedLine.id,
            folderId: folderParentId,
            search,
          }),
        ]);

        setFolders(lineFolders);
        setDocuments(lineDocuments);
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
    [currentFolder, searchQuery, selectedLine]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      // If SSR already provided data, do first fetch silently (no spinner)
      // so the user sees documents immediately while refresh runs in background
      const showSpinner = !hasInitialDataRef.current || searchQuery.trim().length > 0;
      hasInitialDataRef.current = false; // only skip spinner on the very first call
      loadWorkspaceData({ showLoading: showSpinner });
    }, searchQuery.trim() ? 300 : 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadWorkspaceData]);

  useEffect(() => {
    if (!selectedLine) return;

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
  }, [loadWorkspaceData, selectedLine]);

  const handleEnterFolder = (id: number, name: string) => {
    const nextFolder = { id, name };
    const nextHistory = [...folderPathHistory, nextFolder];
    setFolderPathHistory(nextHistory);
    setCurrentFolder(nextFolder);
    setSearchQuery("");

    if (selectedLine) {
      persistOperatorLocation(selectedLine, nextHistory);
    }
  };

  const handleNavigateBreadcrumb = (index: number) => {
    setSearchQuery("");

    if (index === -1) {
      setFolderPathHistory([]);
      setCurrentFolder(null);
      if (selectedLine) {
        clearOperatorFolderLocation(selectedLine);
      }
      return;
    }

    const nextHistory = folderPathHistory.slice(0, index + 1);
    setFolderPathHistory(nextHistory);
    setCurrentFolder(nextHistory[index] ?? null);
    if (selectedLine) {
      persistOperatorLocation(selectedLine, nextHistory);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <OperatorHeader selectedLine={selectedLine?.name ?? ""} userRole={userRole} />

      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6 p-3 sm:p-6">
        {/* Active Machine & Ganti Mesin Link */}
        <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground bg-card/60 border border-border px-4 py-2.5 rounded-xl shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground uppercase tracking-wide text-[11px] sm:text-xs">Mesin Aktif:</span>
            <span className="font-bold text-foreground font-mono text-xs sm:text-sm">
              {selectedLine?.name || selectedLineName || "-"}
            </span>
          </div>
          <Link
            href="/operator/machines"
            className="text-primary hover:underline font-bold text-xs sm:text-sm flex items-center gap-1 transition-colors min-h-[36px] sm:min-h-[40px] px-2 py-1 items-center touch-manipulation"
          >
            Ganti Mesin &rarr;
          </Link>
        </div>

        {userRole === "admin" && (
          <LineSelector
            value={selectedLine}
            lines={lines}
            onChange={handleLineChange}
          />
        )}

        {/* Menu Tabs Switcher */}
        <div className="flex border-b border-border overflow-x-auto gap-2">
          <button
            onClick={() => setActiveTab("display")}
            className={`flex items-center gap-2 border-b-2 px-4 sm:px-6 py-3 min-h-[48px] text-xs sm:text-sm font-bold transition-all duration-200 active:scale-[0.97] focus:outline-none cursor-pointer whitespace-nowrap flex-shrink-0 touch-manipulation ${
              activeTab === "display"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            type="button"
          >
            <Tv className="h-4 w-4 shrink-0" />
            Display TV
          </button>
          <button
            onClick={() => setActiveTab("machine")}
            className={`flex items-center gap-2 border-b-2 px-4 sm:px-6 py-3 min-h-[48px] text-xs sm:text-sm font-bold transition-all duration-200 active:scale-[0.97] focus:outline-none cursor-pointer whitespace-nowrap flex-shrink-0 touch-manipulation ${
              activeTab === "machine"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            type="button"
          >
            <Factory className="h-4 w-4 shrink-0" />
            Produksi
          </button>
        </div>

        {activeTab === "display" && (
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
              selectedLineId={selectedLine?.id}
              onEnterFolder={handleEnterFolder}
            />
          </div>
        )}

        {activeTab === "machine" && (
          <div className="space-y-6">
            <MachineDetailClient
              lineId={selectedLine?.id ?? lineId}
              lineName={selectedLine?.name ?? selectedLineName}
              machineType={selectedLine?.machine_type}
            />
          </div>
        )}
      </div>
    </main>
  );
}
