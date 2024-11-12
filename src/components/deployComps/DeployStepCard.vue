<template>
  <n-card hoverable size="small" closable>
    <template #header>
      <n-text v-if="step.Endpoint">{{ step.Endpoint }}</n-text>
      <n-text v-else type="warning">Choose a CPI Tenant</n-text>
    </template>
    <template #header-extra>
      <n-text depth="3" strong>{{step.Type}}</n-text>
    </template>
    <!-- package id -->
    <n-text v-if="step.PackageId" style="font-size: medium"> 
      <n-text depth=3>Package ID:</n-text> {{ step.PackageId }}
    </n-text>
    <n-text v-else type="warning"> Choose Package </n-text>
    <n-space>
      <n-text depth=3  style="font-size: medium">Artifacts:</n-text>
    </n-space>
    <!-- artifacts list -->
    <n-space>
      <n-tag v-for="(artifact, index) in step.ArtifactIds" :key="index" type="info" :bordered="false">
        {{ artifact }}:{{ step.ArtifactVersions[index] }}
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
