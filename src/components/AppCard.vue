<script setup lang="ts">
import type { AppCount } from '@/service/model'
import { ref, onMounted, withDefaults, defineProps, computed } from 'vue'
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
      <ui5-text style="color: var(--sapPositiveColor); font-size: 2rem;">{{ appCount.Total || 0 }}</ui5-text>
      <ui5-text> Total</ui5-text>
      <span v-for="key in Object.keys(appCount.StatusCounts || {})" :key="key">
        <span v-if="appCount.StatusCounts?.[key]" style="margin-left: 10px;">
          <ui5-text :style="{ color: 'var(--sapCriticalColor)', fontSize: '1.25rem' }">
            {{ appCount.StatusCounts?.[key] }}
          </ui5-text>
          {{ key }}
        </span>
      </span>
    </div>

  </ui5-card>

</template>

<style scoped>
ui5-card {
  /* width and height are set via :style binding on the component to support dynamic props */
}


.ui5-header-subtitle {
  font-size: var(--sapFontSize);
  color: var(--sapObjectHeader_Subtitle_TextColor);
  padding-left: 16px;
  padding-right: 16px;
}

.card-content {
  width: 100%;
  padding-left: 16px;
  padding-right: 16px;
}
</style>
