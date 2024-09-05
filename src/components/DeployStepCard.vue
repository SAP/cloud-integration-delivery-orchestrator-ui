<template>
  <n-card hoverable size="small">
    <template #header>
      <n-text v-if="step.endpoint_id">{{ step.endpoint_name }}</n-text>
      <n-text v-else type="warning">Choose a CPI Tenant</n-text>
    </template>
    <n-text v-if="step.package_id"> {{ step.package_id}}</n-text>
    <n-text v-else type="warning"> Choose Package </n-text>
    <n-space>
      <n-text :type="step.artifact_ids && step.artifact_ids.length ? 'success':'warning'">Artifacts:</n-text>
    </n-space>
    
    <n-space>
      <n-tag v-for="(artifact, index) in step.artifact_ids" :key="index"> {{ artifact }}</n-tag>
    </n-space>
  </n-card>
</template>

<style scoped>
.n-card {
  min-width: 400px;
}
</style>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { type DeployStep } from '../store/index'
export default defineComponent({
  data() {
    return {
      deployStep: this.step,
      
    }
  },
  methods: {
    onSubmit() {}
  },
  props: {
    step: { type: Object as PropType<DeployStep>, required: true }
  }
})
</script>

<style scoped>

.n-card {
  width: 300px;
}
</style>
