// Tab-attention utility -- flashes the document title (Gmail/Slack/
// WhatsApp Web-style "(1) New message") when a realtime event arrives
// while this tab is backgrounded or unfocused, so the person notices it
// without needing to already be looking at this tab. Does nothing if the
// tab is already active -- the in-app toast is enough in that case.
//
// Plain module, not a React hook: it's pure imperative DOM manipulation
// (document.title), not component state, so there's nothing for React
// to manage here. The visibilitychange/focus listeners are registered
// once at module load (client-side only) -- callers just call
// notifyTab(), nothing else required.

let originalTitle: string | null = null;
let flashInterval: ReturnType<typeof setInterval> | null = null;
let pendingCount = 0;
let flashOn = false;

function restore() {
  if (flashInterval) { clearInterval(flashInterval); flashInterval = null; }
  if (originalTitle !== null) { document.title = originalTitle; originalTitle = null; }
  pendingCount = 0;
  flashOn = false;
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (!document.hidden) restore(); });
  window.addEventListener("focus", restore);
}

/**
 * Call whenever a realtime event the person should notice arrives (new
 * ticket, new message, etc). If the tab is currently active/focused,
 * does nothing. If backgrounded, flashes the title between the original
 * and `(N) label` every second until the person comes back, stacking a
 * count if more than one event arrives while away.
 */
export function notifyTab(label = "New message") {
  if (typeof document === "undefined") return;
  if (!document.hidden && document.hasFocus()) return; // already looking at this tab

  pendingCount += 1;
  if (originalTitle === null) originalTitle = document.title;

  if (!flashInterval) {
    flashInterval = setInterval(() => {
      flashOn = !flashOn;
      document.title = flashOn ? `(${pendingCount}) ${label}` : (originalTitle as string);
    }, 1000);
  }
}
