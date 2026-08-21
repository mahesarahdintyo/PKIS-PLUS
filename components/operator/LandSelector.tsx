import type { Land } from "@/lib/services/land";
import { MonitorUp } from "lucide-react";

interface LandSelectorProps {
  value: Land | null;
  lands: Land[];
  onChange: (value: Land) => void;
}

export default function LandSelector({
  value,
  lands,
  onChange,
}: LandSelectorProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-sm text-foreground">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Pilih Line Produksi
        </label>

        {value && (
          <a
            href={`/display/${encodeURIComponent(value.id)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[40px] sm:min-h-[44px] items-center gap-2 rounded-lg border border-primary bg-card px-3 sm:px-4 text-xs sm:text-sm font-bold text-primary transition-all duration-200 active:scale-[0.97] hover:bg-primary/10 touch-manipulation"
          >
            <MonitorUp className="h-4 w-4 shrink-0" />
            <span>Buka Display</span>
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-2.5">
        {lands.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm font-medium text-muted-foreground">
            Belum ada line tersedia
          </p>
        ) : (
          lands.map((land) => {
            const isSelected = value?.id === land.id;

            return (
              <button
                key={land.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChange(land)}
                className={`rounded-xl border min-h-[44px] sm:min-h-[48px] px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold shadow-sm transition-all duration-200 active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary/20 touch-manipulation cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/95 shadow-md"
                    : "border-border bg-card text-muted-foreground hover:border-primary hover:bg-muted hover:text-foreground"
                }`}
              >
                {land.name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
