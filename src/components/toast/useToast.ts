import { ref, type ComponentPublicInstance } from 'vue'
import type { Severity } from './ToastContainer.vue'

export interface ToastAPI {
  success(msg: string): void
  error(msg: string): void
  warning(msg: string): void
  info(msg: string): void
}

const toastRef = ref<ComponentPublicInstance & { add: (severity: Severity, message: string) => void }>()

export function setToastRef(instance: any) {
  toastRef.value = instance
}

function createAPI(): ToastAPI {
  return {
    success: (msg: string) => toastRef.value?.add('success', msg),
    error: (msg: string) => toastRef.value?.add('error', msg),
    warning: (msg: string) => toastRef.value?.add('warning', msg),
    info: (msg: string) => toastRef.value?.add('info', msg),
  }
}

export function useToast(): ToastAPI {
  return createAPI()
}

export function initGlobalToast(): ToastAPI {
  const api = createAPI()
  window.$toast = api
  return api
}
