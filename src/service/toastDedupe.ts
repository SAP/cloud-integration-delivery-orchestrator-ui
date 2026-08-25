const recent = new Map<string, number>()
const WINDOW_MS = 1500
const MAX_ENTRIES = 50

/**
 * Fire a toast only if the same key hasn't been shown within the dedup window.
 * Key should be `code:message` to merge identical errors from parallel requests.
 */
export function dedupedToastError(key: string, message: string) {
  const now = Date.now()
  const last = recent.get(key) ?? 0
  if (now - last < WINDOW_MS) return
  recent.set(key, now)
  window.$toast?.error(message)

  // Prune expired entries to prevent unbounded growth in long-running sessions
  if (recent.size > MAX_ENTRIES) {
    for (const [k, v] of recent) {
      if (now - v >= WINDOW_MS) recent.delete(k)
    }
  }
}
