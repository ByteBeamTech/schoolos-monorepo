"use client";
// frontend/src/app/dashboard/(finance)/billing/error.tsx
//
// Structural finding, not a per-page workaround: this app had ZERO
// error.tsx boundaries anywhere (confirmed by direct search -- no root
// error.tsx, no dashboard/error.tsx, none at all). Next.js's own
// documented behavior for that situation is exactly what was reported --
// EVERY uncaught client-side render exception, anywhere in the app,
// falls through to the same generic "Application error: a client-side
// exception has occurred" text, with no way to differentiate one page's
// crash from a completely unrelated one on a different page. That's the
// actual reason two genuinely different bugs (see the companion
// StudentSummaryCard.tsx fix for the one independently confirmed root
// cause) were reported as "the same pattern" -- there was nothing in
// this app that could have shown them as different.
//
// Scoped to this route segment (billing/), not the whole app -- a crash
// on one billing detail page is now contained here, cannot bleed into
// sibling routes via stale error-boundary state, and the sidebar/layout
// stays intact so the user isn't dropped out of the app entirely.

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function BillingErrorBoundary({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logged, not swallowed -- this is exactly the console signal that
    // was missing before, per the investigation's own step 4.
    console.error("[billing] client-side exception:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
      <div className="text-red-300 mb-4">
        <AlertTriangle className="w-10 h-10" />
      </div>
      <h3 className="text-slate-700 font-semibold text-lg">Something went wrong loading this page</h3>
      <p className="text-slate-400 text-sm mt-1 mb-6">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
      >
        <RefreshCw className="w-4 h-4" /> Try again
      </button>
    </div>
  );
}
