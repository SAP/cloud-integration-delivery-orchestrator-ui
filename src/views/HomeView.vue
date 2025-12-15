<script lang="ts">
import AppCard from '@/components/AppCard.vue'
import http from '@/service/http';
import type { AppCount } from '@/service/model';
import { defineComponent } from 'vue'


export default defineComponent({
  components: {
    AppCard
  },
  data() {
    const routers = this.$router.getRoutes()
    const apps = routers.filter(r => r.children.length > 0)
    const counts: { [key: string]: AppCount } = {}
    return {
      apps,
      counts,
    }
  },
  async created() {
    const all = this.apps.map(app => app.children).flat()
      .map(async app => {
        const statusCount = app.meta?.statusCount as (() => Promise<AppCount>) | undefined
        if (!statusCount) return
        this.counts[app.name as string] = await statusCount()
      })
    await Promise.all(all)
  }
})
</script>

<template>
  <div v-for="(router, index) in apps" :key="index" class="sub">
    <div class="subtitle"> {{ router.name }} </div>
    <n-flex>
      <AppCard v-for="(child, index) in router.children" :key="index" :title="child.name as string"
        :subtitle="(child.meta?.description || '') as string" :path="`${router.path}/${child.path}`"
        :count="counts[child.name as string]" />
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
