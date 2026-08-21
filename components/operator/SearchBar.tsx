interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Cari nomor drawing atau nama file..."
      className="w-full min-h-[48px] rounded-xl border border-border bg-card px-4 py-3 text-sm sm:text-base text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 touch-manipulation"
    />
  );
}
