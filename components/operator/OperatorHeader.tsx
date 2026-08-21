import Link from "next/link";
import { AppHeader } from "@/components/ui/app-header";
import { LogoutButton } from "@/components/ui/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
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
        <div className="flex flex-col border-slate-200 sm:border-l sm:pl-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Line Operator
          </span>
          <span className="text-base font-bold text-emerald-700">
            {selectedLand}
          </span>
        </div>
      }
    >
      {isAdmin && (
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Home className="h-4 w-4 mr-1.5" />
          <span className="hidden sm:inline">Halaman Utama</span>
        </Link>
      )}
      <ThemeToggle variant="icon" />
      <LogoutButton variant="header" />
    </AppHeader>
  );
}
