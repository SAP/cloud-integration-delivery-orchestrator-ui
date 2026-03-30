import type { ToastAPI } from './components/toast/useToast'
declare global {
  interface Window {
    $toast: ToastAPI
  }
}
