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
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm text-foreground">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <label className="block font-semibold text-foreground">
          Line
        </label>

        {value && (
          <a
            href={`/display/${encodeURIComponent(value.id)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-lg border border-primary bg-card px-2.5 sm:px-3 text-xs sm:text-sm font-semibold text-primary transition-colors duration-200 active:scale-[0.97] hover:bg-primary/10"
          >
            <MonitorUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Display
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 sm:gap-2">
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
                className={`rounded-lg border px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold shadow-sm transition-colors duration-200 active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/95"
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
