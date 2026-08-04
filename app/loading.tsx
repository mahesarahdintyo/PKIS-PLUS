export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50/50 animate-pulse">
      {/* Header Skeleton */}
      <div className="border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-200" />
            <div className="h-5 w-28 rounded-md bg-slate-200" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-24 rounded-lg bg-slate-200" />
            <div className="h-9 w-24 rounded-lg bg-slate-200" />
            <div className="h-9 w-20 rounded-lg bg-slate-200" />
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Title block */}
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-md bg-slate-200" />
          <div className="h-4 w-72 rounded-md bg-slate-200" />
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
      {/* Icon + title row */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-slate-200 flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-4 w-3/4 rounded-md bg-slate-200" />
          <div className="h-3 w-1/2 rounded-md bg-slate-200" />
        </div>
      </div>
      {/* Content lines */}
      <div className="space-y-2 pt-1">
        <div className="h-3 w-full rounded-md bg-slate-200" />
        <div className="h-3 w-5/6 rounded-md bg-slate-200" />
        <div className="h-3 w-4/6 rounded-md bg-slate-200" />
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="h-5 w-16 rounded-full bg-slate-200" />
        <div className="h-7 w-20 rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}
