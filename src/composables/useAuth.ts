import { ref } from 'vue'
import http from '@/service/http'

const userScopes = ref<string[]>([])
const userOrigin = ref('')
const loaded = ref(false)

async function loadScopes() {
  if (loaded.value) return
  try {
    const resp = (await http.get('/api/v1/currentUser/scopes')) as { scopes: string[]; origin: string }
    userScopes.value = resp.scopes
    userOrigin.value = resp.origin
    loaded.value = true
  } catch {
    userScopes.value = []
  }
}

export function useAuth() {
  function hasScope(scope: string): boolean {
    return userScopes.value.some(s => s.endsWith('.' + scope) || s === scope)
  }

  return { hasScope, userScopes, userOrigin, loadScopes }
}
