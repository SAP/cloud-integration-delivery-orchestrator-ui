<template>
  <h4>Artifact Deploy Status</h4>
  <div v-for="(step, i) in steps" :key="i">
    <n-alert :title="`Step ${i + 1} - ${step.Endpoint}`" type="default">
      <p v-for="(artifactId, index) in step.ArtifactIds" :key="index">
        {{ artifactId }} : {{ step.ArtifactVersions[index] }} - {{ step.TaskIds[index] }} -
        {{ step.TaskStatuses[index] }}
      </p>
    </n-alert>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { type DeployStep } from '@/service/api'
export default defineComponent({
  props: {
    steps: { type: Object as PropType<DeployStep[]>, required: true }
  }
})
</script>
