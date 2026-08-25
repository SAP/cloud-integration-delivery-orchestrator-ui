<script setup lang="ts">
import type { AppCount } from '@/service/model'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
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
const statusEntries = computed(() =>
  Object.entries(appCount.value.StatusCounts || {}).filter(([, value]) => Boolean(value))
)

const jumpTo = () => {
  if (props.path) router.push(props.path)
}
const loading = ref(false)
onMounted(async () => {
  try {
    loading.value = true
    const fetchStatus = props.meta?.statusCount
    if (fetchStatus) {
      appCount.value = await fetchStatus()
    } else {
      appCount.value = {} as AppCount
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <ui5-card @click="jumpTo" :loading="loading" :style="{ width: props.meta?.width || '11rem', height: props.meta?.height || '11rem' }">
    <ui5-card-header slot="header" :title-text="title" :subtitle-text="subtitle" interactive>
    </ui5-card-header>
    <div class="card-content">
      <template v-if="props.meta?.statusCount">
        <div class="metric-row total-row">
          <span class="metric-value total-count">{{ appCount.Total || 0 }}</span>
          <span class="metric-label">Total</span>
        </div>
        <div class="status-counts">
          <div v-for="[key, value] in statusEntries" :key="key" class="metric-row status-item">
            <span class="metric-value status-count">{{ value }}</span>
            <span class="metric-label">{{ key }}</span>
          </div>
        </div>
      </template>
    </div>
  </ui5-card>

</template>

<style scoped>
.card-content {
  margin-left: 16px;
}

.metric-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: nowrap;
}

.metric-value {
  line-height: 1;
  font-weight: 400;
}

.metric-label {
  line-height: 1.1;
}

.total-row {
  margin-top: 0.25rem;
}

.total-count {
  color: var(--sapPositiveColor);
  font-size: 2rem;
}

.status-counts {
  margin-top: 0.625rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
}

.status-item {
  align-items: baseline;
}

.status-count {
  color: var(--sapCriticalColor);
  font-size: 1.25rem;
}
</style>
