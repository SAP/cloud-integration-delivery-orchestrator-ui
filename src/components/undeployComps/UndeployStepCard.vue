<template>
  <n-card hoverable size="small" closable>
    <template #header>
      <n-text v-if="step.Endpoint">{{ step.Endpoint }}</n-text>
      <n-text v-else type="warning">Choose a CPI Tenant</n-text>
    </template>
    <template #header-extra>
      <n-text type="warning" strong depth="3">{{step.Type}}</n-text>
    </template>
    <!-- artifacts list -->
    <n-space>
      <n-text depth=3  style="font-size: medium">Runtime Artifacts:</n-text>
    </n-space>
    <n-space>
      <n-tag v-for="(artifact, index) in step.Artifacts" :key="index" type="info" :bordered="false">
        {{ artifact.TechID }}:{{ artifact.Version }}
      </n-tag>
    </n-space>
  </n-card>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { type DeployStep } from '../../service/api'
export default defineComponent({
  data() {
    return {
      deployStep: this.step
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
  min-width: 400px;
}
</style>
