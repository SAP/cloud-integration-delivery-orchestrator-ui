<script lang="ts">
import AppCard from '@/components/AppCard.vue'
import http from '@/service/http';
import { s } from 'node_modules/vite/dist/node/types.d-aGj9QkWt';
import { defineComponent } from 'vue'


export default defineComponent({
  components: {
    AppCard
  },
  data() {
    const routers = this.$router.getRoutes()
    const apps = routers.filter(r => r.children.length > 0)
    const counts: { [key: string]: { [key: string]: number } } = {}
    return {
      apps,
      counts,
    }
  },
  async created() {
    const all = this.apps.map(app => app.children).flat()
      .map(async app => {
        const countPath = app.meta?.countPath as string
        if (!countPath) return
        this.counts[app.name as string] = await http.get(countPath)
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
