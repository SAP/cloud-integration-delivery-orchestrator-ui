<script lang="ts">
import AppCard from '../components/AppCard.vue'
import { defineComponent } from 'vue'
export default defineComponent({
  components: {
    AppCard
  },
  data() {
    const routers = this.$router.getRoutes()
    const apps = []
    for (const item of routers) {
      if (item.children.length) apps.push(item)
    }
    return {
      apps
    }
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
        :path="`${router.path}/${child.path}`"
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
