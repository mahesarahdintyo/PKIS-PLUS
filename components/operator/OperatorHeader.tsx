import Link from "next/link";
import { AppHeader } from "@/components/ui/app-header";
import { LogoutButton } from "@/components/ui/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Home } from "lucide-react";

interface OperatorHeaderProps {
  selectedLand: string;
  userRole?: string;
}

export default function OperatorHeader({ selectedLand, userRole }: OperatorHeaderProps) {
  const isAdmin = userRole === "admin" || userRole === "leader";

  return (
    <AppHeader
      disableLogoLink
      logoAside={
        <div className="flex flex-col border-slate-200 sm:border-l sm:pl-4 min-w-0">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">
            Line Operator
          </span>
          <span className="text-sm sm:text-base font-bold text-emerald-700 truncate max-w-[180px] sm:max-w-none">
            {selectedLand}
          </span>
        </div>
      }
    >
      {isAdmin && (
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "min-h-[40px] sm:min-h-[44px] px-3 sm:px-4 text-xs sm:text-sm font-semibold touch-manipulation active:scale-[0.97]"
          )}
        >
          <Home className="h-4 w-4 mr-1.5 shrink-0" />
          <span className="hidden sm:inline">Halaman Utama</span>
        </Link>
      )}
      <ThemeToggle variant="icon" />
      <LogoutButton variant="header" />
    </AppHeader>
  );
}
