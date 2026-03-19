<script setup lang="ts">
import type { AppCount } from '@/service/model'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { sseClient } from '@/service/sse'
import "@ui5/webcomponents/dist/Card.js"
import "@ui5/webcomponents/dist/CardHeader.js"

const props = defineProps<{
  title: string
  path: string
  meta: { description?: string; statusCount?: () => Promise<AppCount>, width?: string, height?: string }
}>()

const router = useRouter()

const appCount = ref<AppCount>({} as AppCount)

const subtitle = computed(() => props.meta?.description ?? '')

const jumpTo = () => {
  if (props.path) router.push(props.path)
}
const loading = ref(false)
let unsubscribeCounts: (() => void) | null = null
onMounted(async () => {
  try {
    loading.value = true
    const fetchStatus = props.meta?.statusCount
    if (fetchStatus) {
      appCount.value = await fetchStatus()
      unsubscribeCounts = sseClient.on('counts', async () => {
        appCount.value = await fetchStatus()
      })
    } else {
      appCount.value = {} as AppCount
    }
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (unsubscribeCounts) unsubscribeCounts()
})
</script>

<template>
  <ui5-card @click="jumpTo" :loading="loading" :style="{ width: props.meta?.width || '11rem', height: props.meta?.height || '11rem' }">
    <ui5-card-header slot="header" :title-text="title" :subtitle-text="subtitle" interactive>
    </ui5-card-header>
    <div class="card-content">
      <ui5-text style="color: var(--sapPositiveColor); font-size: 2rem;">{{ appCount.Total || 0 }}</ui5-text>
      <ui5-text> Total</ui5-text>
      <div class="status-counts">
        <span v-for="key in Object.keys(appCount.StatusCounts || {})" :key="key" class="status-item">
          <span v-if="appCount.StatusCounts?.[key]">
            <ui5-text class="status-count">
              {{ appCount.StatusCounts?.[key] }}
            </ui5-text>
              {{ key }}
          </span>
        </span>
      </div>
    </div>
  </ui5-card>

</template>

<style scoped>
.card-content {
  margin-left: 16px;
}

.status-counts {
  margin-top: 0.625rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
}

.status-item {
  display: flex;
  align-items: center;
}

.status-count {
  color: var(--sapCriticalColor);
  font-size: 1.25rem;
}
</style>
