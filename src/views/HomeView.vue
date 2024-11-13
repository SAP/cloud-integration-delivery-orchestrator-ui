<script lang="ts">
import AppCard from '@/components/AppCard.vue'
import { GetJobCounts } from '@/service/api';
import { defineComponent } from 'vue'

interface count {
  count: Number
  type:  String
}
export default defineComponent({
  components: {
    AppCard
  },
  data() {
    const routers = this.$router.getRoutes()
    const apps = []
    const counts: count[] = []
    for (const item of routers) {
      if (item.children.length) apps.push(item)
    }
    const subtitleMap = {
      Delivery: 'Deploy/Undeploy Artifacts in CPI Tenant',
      Import: 'Import TRs to CPI Tenant'
    }

    return {
      apps,
      subtitleMap,
      counts
    }
  },
  created() {
    GetJobCounts().then((res) => {
      this.counts = res
    })
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
