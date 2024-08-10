<template>
  <n-card hoverable size="small">
    <template #header>
      <n-text v-if="step.tenant">{{ step.tenant.description }}</n-text>
      <n-text v-if="!step.tenant" type="warning">Choose a TMS Node</n-text>
    </template>
    <template #header-extra> {{ step.status }} </template>
    <n-text v-if="!step.targets || !step.targets.length" type="warning">Transport Requests:</n-text>
    <n-text v-else>Transport Requests:</n-text>

    <n-space>
      <n-tag v-for="(tr, index) in step.targets" :key="index">{{ tr.uuid }}</n-tag>
    </n-space>
  </n-card>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import type { ImportStep, Step } from '../store/index'

export default defineComponent({
  data() {
    return {}
  },
  emits: ['update:value'],
  props: {
    step: { type: Object as PropType<Step>, required: true }
  }
})
</script>
<style scoped>
.n-card {
  width: 300px;
}
</style>
