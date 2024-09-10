<template>
  <n-card hoverable size="small" closable>
    <template #header>
      <n-text v-if="step.transport_node_name">{{ step.transport_node_name }}</n-text>
      <n-text v-else type="warning">Choose a Transport Node</n-text>
    </template>
    <template #header-extra> {{ step.status }} </template>
    <n-text v-if="!step.transport_requests" type="warning">Transport Requests:</n-text>
    <n-text v-else>Transport Requests:</n-text>
    <!-- transport requests -->
    <n-space>
      <n-tag v-for="(tr, index) in step.transport_requests" :key="index">{{ tr }}</n-tag>
    </n-space>
  </n-card>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import type { ImportStep } from '../store/index'

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
}
</style>
