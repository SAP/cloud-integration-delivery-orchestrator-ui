import type { ToastAPI } from './composables/useGlobalToast'
declare global {
  interface Window {
    $toast: ToastAPI
  }
}
