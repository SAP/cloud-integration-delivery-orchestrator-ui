import { reactive } from 'vue'
import { UaaUserInfo } from '@/service/api'
import type { UserInfo } from '@/service/model'

// Global singleton cache: userId → Promise<UserInfo>
// Caching the Promise (not the result) ensures no duplicate in-flight requests.
const cache: Record<string, Promise<UserInfo>> = {}
const resolved: Record<string, UserInfo> = reactive({})

export function useUserCache() {
  /**
   * Get user email synchronously from cache. Returns userId as fallback while loading.
   * Triggers a fetch if not yet cached.
   */
  function getUserEmail(userId: string): string {
    if (!userId) return '—'
    if (resolved[userId]) return resolved[userId].email
    if (!cache[userId]) {
      cache[userId] = UaaUserInfo(userId)
      cache[userId].then(info => { resolved[userId] = info }).catch(() => {})
    }
    return userId // show UUID while loading
  }

  /**
   * Get user info as a Promise (for await-based usage).
   * Deduplicates concurrent requests to the same userId.
   */
  function fetchUserInfo(userId: string): Promise<UserInfo> {
    if (!cache[userId]) {
      cache[userId] = UaaUserInfo(userId)
      cache[userId].then(info => { resolved[userId] = info }).catch(() => {})
    }
    return cache[userId]
  }

  return { getUserEmail, fetchUserInfo, resolved }
}
