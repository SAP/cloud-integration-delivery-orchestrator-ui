<template>
  <n-card hoverable size="small" closable>
    <template #header>
      <n-text v-if="step.TransportNodeName">{{ step.TransportNodeName }}</n-text>
      <n-text v-else type="warning">Choose a Transport Node</n-text>
    </template>
    <n-text v-if="!step.TransportRequests || !step.TransportRequests.length" type="warning">Transport Requests:</n-text>
    <n-text v-else>Transport Requests:</n-text>
    <!-- transport requests -->
    <n-space>
      <n-tag v-for="(tr, index) in step.TransportRequests" :key="index" type="info">{{ tr }}</n-tag>
    </n-space>
  </n-card>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import type { ImportStep } from '../service/index'

export default defineComponent({
  data() {
    return {}
  },
  props: {
    step: { type: Object as PropType<ImportStep>, required: true }
  }
})
</script>
<style scoped>
.n-card {
  width: 300px;
  min-width: 400px;
}
</style>
