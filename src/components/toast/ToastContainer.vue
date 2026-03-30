<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div v-for="item in toasts" :key="item.id" :class="['toast-item', `toast-${item.severity}`]">
          <ui5-icon :name="iconMap[item.severity]" class="toast-icon" />
          <span class="toast-message">{{ item.message }}</span>
          <ui5-button design="Transparent" icon="decline" class="toast-close" @click="remove(item.id)" />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import "@ui5/webcomponents/dist/Icon.js"
import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents-icons/dist/sys-enter-2.js"
import "@ui5/webcomponents-icons/dist/error.js"
import "@ui5/webcomponents-icons/dist/alert.js"
import "@ui5/webcomponents-icons/dist/information.js"
import "@ui5/webcomponents-icons/dist/decline.js"

export type Severity = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  severity: Severity
  message: string
  timer?: ReturnType<typeof setTimeout>
}

const iconMap: Record<Severity, string> = {
  success: 'sys-enter-2',
  error: 'error',
  warning: 'alert',
  info: 'information'
}

const lifetimeMap: Record<Severity, number | null> = {
  success: 5000,
  info: 5000,
  warning: 10000,
  error: null,    // error: manual close only
}

let nextId = 0
const toasts = ref<ToastItem[]>([])

function add(severity: Severity, message: string) {
  const id = nextId++
  const life = lifetimeMap[severity]
  const timer = life ? setTimeout(() => remove(id), life) : undefined
  toasts.value.push({ id, severity, message, timer })
}

function remove(id: number) {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx !== -1) {
    const [item] = toasts.value.splice(idx, 1)
    if (item.timer) clearTimeout(item.timer)
  }
}

// Expose for useToast
defineExpose({ add })
</script>

<style>
.toast-container {
  position: fixed;
  bottom: 1rem;
  left: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column-reverse;
  gap: 0.5rem;
  max-width: 28rem;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-left: 4px solid;
  font-family: '72', '72full', Arial, Helvetica, sans-serif;
  font-size: 0.875rem;
  color: #32363a;
}

.toast-success { border-left-color: #256f3a; }
.toast-error   { border-left-color: #aa0808; }
.toast-warning { border-left-color: #e76500; }
.toast-info    { border-left-color: #0070f2; }

.toast-success .toast-icon { color: #256f3a; }
.toast-error   .toast-icon { color: #aa0808; }
.toast-warning .toast-icon { color: #e76500; }
.toast-info    .toast-icon { color: #0070f2; }

.toast-icon { flex-shrink: 0; }
.toast-message { flex: 1; word-break: break-word; }
.toast-close { flex-shrink: 0; margin-left: 0.25rem; }

/* Transitions */
.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(-1rem); }
.toast-leave-to { opacity: 0; transform: translateX(-1rem); }
</style>
