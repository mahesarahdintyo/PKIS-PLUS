import { AppHeader } from "@/components/ui/app-header";
import { LogoutButton } from "@/components/ui/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface OperatorHeaderProps {
  selectedLand: string;
}

export default function OperatorHeader({ selectedLand }: OperatorHeaderProps) {
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
      <ThemeToggle variant="icon" />
      <LogoutButton variant="header" />
    </AppHeader>
  );
}
