<script setup lang="ts">
import AppCard from '@/components/AppCard.vue'
import type { AppCount } from '@/service/model'
import { useRouter } from 'vue-router'
import "@ui5/webcomponents/dist/Title.js"

type ChildMeta = { description?: string; statusCount?: () => Promise<AppCount>; width?: string; height?: string }

const router = useRouter()
const apps = router.getRoutes().filter(r => r.children.length > 0)

function childMeta(child: { meta?: Record<string, unknown> }): ChildMeta {
  return (child.meta ?? {}) as ChildMeta
}
</script>

<template>
  <div class="home">
    <section v-for="(router, index) in apps" :key="index" class="section">
      <div class="section-header">
        <ui5-title level="H4">{{ router.name }}</ui5-title>
      </div>
      <div class="card-grid">
        <AppCard v-for="(child, cIdx) in router.children"
          :key="cIdx"
          :title="child.name as string"
          :meta="childMeta(child)"
          :path="`${router.path}/${child.path}`"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem 2rem;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-header {
  padding-bottom: 0.25rem;
}

.card-grid {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: start;
}
</style>
