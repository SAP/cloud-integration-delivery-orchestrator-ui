import type { ToastServiceMethods } from 'primevue/toastservice'

export interface ToastOptions {
  closable?: boolean
  duration?: number
}

export interface ToastAPI {
  success: (msg: string, opts?: ToastOptions) => void
  error: (msg: string, opts?: ToastOptions) => void
  warning: (msg: string, opts?: ToastOptions) => void
  info: (msg: string, opts?: ToastOptions) => void
}

export function initGlobalToast(toast: ToastServiceMethods): ToastAPI {
  const api: ToastAPI = {
    success: (msg, opts) =>
      toast.add({ severity: 'success', summary: msg, life: opts?.duration ?? 3000 }),
    error: (msg) =>
      toast.add({ severity: 'error', summary: msg }),
    warning: (msg, opts) =>
      toast.add({ severity: 'warn', summary: msg, life: opts?.duration ?? 5000 }),
    info: (msg, opts) =>
      toast.add({ severity: 'info', summary: msg, life: opts?.duration ?? 3000 }),
  }
  window.$toast = api
  return api
}
