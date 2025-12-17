<script setup lang="ts">
import AppCard from '@/components/AppCard.vue'
import type { AppCount } from '@/service/model'
import { useRouter } from 'vue-router'

const router = useRouter()
const apps = router.getRoutes().filter(r => r.children.length > 0)
</script>

<template>
  <div v-for="(router, index) in apps" :key="index" class="sub">
    <div class="subtitle"> {{ router.name }} </div>
    <n-flex>
      <AppCard v-for="(child, index) in router.children" 
        :key="index" 
        :title="child.name as string"
        :subtitle="(child.meta?.description || '') as string" 
        :path="`${router.path}/${child.path}`"
        :count="child.meta?.statusCount as () => Promise<AppCount>" />
    </n-flex>
  </div>
</template>

<style scoped>
.subtitle {
  margin: 15px;
  font-size: large;
  font-weight: bolder;
}

.sub {
  margin: 10px 50px;
}
</style>
