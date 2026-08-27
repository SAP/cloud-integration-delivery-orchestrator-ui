<script setup lang="ts">
import AppCard from '@/components/AppCard.vue'
import type { AppCount } from '@/service/model'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import "@ui5/webcomponents/dist/Title.js"
import "@ui5/webcomponents-fiori/dist/IllustratedMessage.js"
import "@ui5/webcomponents-fiori/dist/illustrations/UnableToUpload.js";

type ChildMeta = { description?: string; statusCount?: () => Promise<AppCount>; width?: string; height?: string; requiredScope?: string }

const router = useRouter()
const { hasScope } = useAuth()
const apps = router.getRoutes().filter(r => r.children.length > 0)

function childMeta(child: { meta?: Record<string, unknown> }): ChildMeta {
  return (child.meta ?? {}) as ChildMeta
}

function visibleChildren(route: (typeof apps)[number]) {
  return route.children.filter(c => {
    const scope = (c.meta as any)?.requiredScope
    return !scope || hasScope(scope)
  })
}

const hasAnyVisible = computed(() => apps.some(app => visibleChildren(app).length > 0))
</script>

<template>
  <div class="home">
    <section v-for="(router, index) in apps" :key="index" class="section"
      v-show="visibleChildren(router).length > 0">
      <div class="section-header">
        <ui5-title level="H4">{{ router.name }}</ui5-title>
      </div>
      <div class="card-grid">
        <AppCard v-for="(child, cIdx) in visibleChildren(router)"
          :key="cIdx"
          :title="child.name as string"
          :meta="childMeta(child)"
          :path="`${router.path}/${child.path}`"
        />
      </div>
    </section>
    <div v-if="!hasAnyVisible" >
      <ui5-illustrated-message name="UnableToUpload"
        title-text="No Apps Available"
        subtitle-text="You don't have permission to access any features yet. Ask an administrator to assign you a Delivery Orchestrator role collection (Administrator, Operator, or Viewer) in BTP Cockpit.">
      </ui5-illustrated-message>
    </div>
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
