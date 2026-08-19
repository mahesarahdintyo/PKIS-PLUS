"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Profile } from "@/types/database";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import AndonAlertOverlay from "@/components/AndonAlertOverlay";

import { Button } from "@/components/ui/button";
import {
  Menu,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  Power,
  Circle,
} from "lucide-react";

interface HeaderNavProps {
  children: React.ReactNode;
  profile?: Profile | null;
  activeTitle?: string;
}

export default function HeaderNav({ children, activeTitle }: HeaderNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isOnline, setIsOnline] = useState(true);

  const { pendingCount, syncing, syncNow } = useOfflineSync({
    onSynced: (synced) => {
      alert(`${synced} data offline berhasil disinkron.`);
    },
  });

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme_v1") as "light" | "dark") || "dark";
    setTheme(savedTheme);
    if (savedTheme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", savedTheme);

    const handleThemeEvent = () => {
      const current = (localStorage.getItem("theme_v1") as "light" | "dark") || "dark";
      setTheme(current);
    };
    window.addEventListener("themeChange", handleThemeEvent);

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || "");
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (data) setProfile(data as Profile);
      }
    };
    checkUser();

    return () => {
      window.removeEventListener("themeChange", handleThemeEvent);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme_v1", nextTheme);
    if (nextTheme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.dispatchEvent(new Event("themeChange"));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isLeaderOrAdmin = profile && ["admin", "leader"].includes(profile.role || "");
  const isDashboard = pathname === "/";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className={`app-shell ${isDashboard ? "app-shell-dashboard" : ""}`}>
      <AndonAlertOverlay userId={profile?.id || null} />

      {/* Mobile Topbar */}
      <div className="mobile-topbar">
        <button className="hamburger" onClick={() => setMobileNavOpen(true)}>
          <Menu size={20} />
        </button>
        <span className="mobile-title">{activeTitle || "Press Shop System"}</span>
        <button className="theme-toggle" style={{ marginLeft: "auto" }} onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {mobileNavOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""} ${
          sidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
      >
        <button
          className="sidebar-collapse-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Buka menu" : "Ciutkan menu"}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {!sidebarCollapsed && (
          <div className="sidebar-brand">
            PRESS SHOP<span>·</span>SYSTEM
          </div>
        )}

        <nav className="sidebar-nav" onClick={() => setMobileNavOpen(false)}>
          {/* Dashboard */}
          <Link
            href="/"
            className={`sidebar-link ${isActive("/") ? "active" : ""}`}
            title="Dashboard"
          >
            <Image src="/icons/emoji-3d/dashboard.png" alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain flex-shrink-0" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </Link>

          {/* Input Produksi — semua user */}
          <Link
            href="/input-produksi"
            className={`sidebar-link ${isActive("/input-produksi") ? "active" : ""}`}
            title="Input Produksi"
          >
            <Image src="/icons/emoji-3d/clipboard.png" alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain flex-shrink-0" />
            {!sidebarCollapsed && <span>Input Produksi</span>}
          </Link>

          {/* Andon Settings — admin/leader */}
          {isLeaderOrAdmin && (
            <Link
              href="/andon-settings"
              className={`sidebar-link ${isActive("/andon-settings") ? "active" : ""}`}
              title="Panggilan Andon"
            >
              <Image src="/icons/emoji-3d/alert-light.png" alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain flex-shrink-0" />
              {!sidebarCollapsed && <span>Panggilan Andon</span>}
            </Link>
          )}

          {/* Input Attendance — admin/leader */}
          {isLeaderOrAdmin && (
            <Link
              href="/input-attendance"
              className={`sidebar-link ${isActive("/input-attendance") ? "active" : ""}`}
              title="Input Attendance"
            >
              <Image src="/icons/emoji-3d/people.png" alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain flex-shrink-0" />
              {!sidebarCollapsed && <span>Input Attendance</span>}
            </Link>
          )}

          {/* Input Earned Hours — admin/leader */}
          {isLeaderOrAdmin && (
            <Link
              href="/input-productivity"
              className={`sidebar-link ${isActive("/input-productivity") ? "active" : ""}`}
              title="Input Earned Hours"
            >
              <Image src="/icons/emoji-3d/chart-up.png" alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain flex-shrink-0" />
              {!sidebarCollapsed && <span>Input Earned Hours</span>}
            </Link>
          )}

          {/* Input Scrap — admin/leader */}
          {isLeaderOrAdmin && (
            <Link
              href="/input-scrap"
              className={`sidebar-link ${isActive("/input-scrap") ? "active" : ""}`}
              title="Input Scrap"
            >
              <Image src="/icons/emoji-3d/scrap.png" alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain flex-shrink-0" />
              {!sidebarCollapsed && <span>Input Scrap</span>}
            </Link>
          )}

          {/* Input Safety — admin/leader */}
          {isLeaderOrAdmin && (
            <Link
              href="/input-safety"
              className={`sidebar-link ${isActive("/input-safety") ? "active" : ""}`}
              title="Input Safety"
            >
              <Image src="/icons/emoji-3d/safety.png" alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain flex-shrink-0" />
              {!sidebarCollapsed && <span>Input Safety</span>}
            </Link>
          )}

        </nav>

        {!sidebarCollapsed ? (
          <div className="sidebar-foot">
            <div className="who">{profile?.full_name || userEmail || "Operator"}</div>
            <span
              className={`badge ${profile?.role === "admin" ? "role-admin" : ""}`}
            >
              {profile?.role || "user"}
            </span>

            <div
              style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
              title={isOnline ? "Online" : "Offline"}
            >
              <Circle
                size={8}
                fill={isOnline ? "#22c55e" : "#ef4444"}
                color={isOnline ? "#22c55e" : "#ef4444"}
              />
              <span>{isOnline ? "Online" : "Offline"}</span>
              {pendingCount > 0 && (
                <span className="badge" title={`${pendingCount} data menunggu sinkron`}>
                  {pendingCount} pending
                </span>
              )}
            </div>

            {pendingCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-1.5"
                onClick={() => syncNow()}
                disabled={syncing || !isOnline}
              >
                {syncing ? "Menyinkron..." : "Sync Now"}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2.5"
              onClick={handleLogout}
            >
              Keluar
            </Button>
          </div>
        ) : (
          <button
            className="sidebar-logout-collapsed"
            onClick={handleLogout}
            title="Keluar"
          >
            <Power size={16} />
          </button>
        )}
      </aside>

      {/* Main Content Area */}
      <main className={`main ${isDashboard ? "main-dashboard" : ""}`}>{children}</main>
    </div>
  );
}
