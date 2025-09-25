<script lang="ts">
import AppCard from '@/components/AppCard.vue'
import { GetJobCounts } from '@/service/api';
import { defineComponent } from 'vue'


export default defineComponent({
  components: {
    AppCard
  },
  data() {
    const routers = this.$router.getRoutes()
    const apps = []
    const counts: {[key: string]: number}[] = []
    for (const item of routers) {
      if (item.children.length) apps.push(item)
    }
    const subtitleMap: {[key:string]: string} = {
      Delivery: 'Deploy/Undeploy Artifacts in CPI Tenant',
      Import: 'Import TRs to CPI Tenant',
      "Transport Group": 'Manage Transport Groups',
      "Transport Plan": 'Generate Transport Plan by parsing YAML content',
      "CPI Tenants": 'Bind Cpi Endpoints to Transport Nodes',
      'Delivery Rule': 'Define rules to select Artifacts for Delivery',
    }

    return {
      apps,
      subtitleMap,
      counts
    }
  },
  async created() {
    this.counts = await GetJobCounts()
    console.log(this.counts)
  }
})
</script>

<template>
  <div v-for="(router, index) in apps" :key="index" class="sub">
    <div class="subtitle">
      {{ router.name }}
    </div>
    <n-flex>
      <AppCard
        v-for="(child, index) in router.children"
        :key="index"
        :title="child.name"
        :subtitle="subtitleMap[child.name]"
        :path="`${router.path}/${child.path}`"
        :count="counts.find((item) => item.type.toLowerCase() === child.path.toLowerCase())?.count"
      />
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
