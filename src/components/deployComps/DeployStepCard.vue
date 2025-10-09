<template>
  <n-card hoverable size="small" closable>
    <template #header>
      <n-text v-if="step.Endpoint">{{ step.Endpoint }}</n-text>
      <n-text v-else type="warning">Choose a CPI Tenant</n-text>
    </template>
    <template #header-extra>
      <n-text depth="3" strong>{{ step.Type }}</n-text>
    </template>
    <!-- list artifacts group by package -->
    <n-text v-if="!step.Artifacts" type="warning">Choose Artifacts</n-text>
    <div v-else v-for="(artifacts, packageName) in artifactsGroup" :key="packageName">
      <n-text depth="3" style="font-size: medium">{{ packageName }}:</n-text>
      <n-space>
        <n-tag v-for="(artifact, index) in artifacts" :key="index" type="info" :bordered="false">
          {{ artifact.TechID }}:{{ artifact.Version }}
        </n-tag>
      </n-space>
    </div>
  </n-card>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { type Artifact, type DeployStep } from '../../service/api'
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
  },
  computed: {
    artifactsGroup() {
      // group artifacts by package
      const pkgsMap: { [key: string]: Artifact[] } = {}
      for (const artifact of this.step.Artifacts) {
        if (!pkgsMap[artifact.PackageId]) pkgsMap[artifact.PackageId] = []
        pkgsMap[artifact.PackageId].push(artifact)
      }
      return pkgsMap
    }
  }
})
</script>

<style scoped>
.n-card {
  width: 80%;
}
</style>
