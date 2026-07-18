// Tab-attention utility -- flashes the document title (Gmail/Slack/
// WhatsApp Web-style "(1) New message") when a realtime event arrives
// while this tab is backgrounded or unfocused. Same implementation as
// superadmin/src/lib/tab-attention.ts -- kept as a separate copy for the
// same reason use-socket.ts is: these are independent Next.js apps with
// their own lib/ conventions, not sharing a package for this.
//
// Plain module, not a React hook: pure imperative DOM manipulation, no
// component state to manage.

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
 * Call whenever a realtime event the person should notice arrives. If
 * the tab is currently active/focused, does nothing. If backgrounded,
 * flashes the title between the original and `(N) label` every second
 * until the person comes back.
 */
export function notifyTab(label = "New message") {
  if (typeof document === "undefined") return;
  if (!document.hidden && document.hasFocus()) return;

  pendingCount += 1;
  if (originalTitle === null) originalTitle = document.title;

  if (!flashInterval) {
    flashInterval = setInterval(() => {
      flashOn = !flashOn;
      document.title = flashOn ? `(${pendingCount}) ${label}` : (originalTitle as string);
    }, 1000);
  }
}
