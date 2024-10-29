<template>
  <h4>Artifact Deploy Status</h4>
  <div v-for="(step, i) in steps" :key="i">
    <n-alert type="default">
        <template #header>
            Step {{ i + 1 }} Triggered By: {{ step.TriggeredBy }} at
            {{ toLocalTime(step.TriggeredAt) }}
        </template>
      <p v-for="(artifactId, index) in step.ArtifactIds" :key="index">
        {{ artifactId }}:{{ step.ArtifactVersions[index] }} - {{ step.TaskIds[index] }} -
        <n-tag :type="toStatusTag(step.TaskStatuses[index])">
            {{ step.TaskStatuses[index] }}
        </n-tag>
      </p>
      Finished at: {{ toLocalTime(step.EndedAt) }}
    </n-alert>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { type DeployStep } from '@/service/api'
import { toLocalTime } from '@/service/consts';
export default defineComponent({
  props: {
    steps: { type: Object as PropType<DeployStep[]>, required: true }
  },
  data() {
    return {
      toLocalTime
    }
  },
  methods:{
    toStatusTag(status: string) { // map artifacts deployment status to tag type: SUCCESS, FAIL, DEPLOYING, Fail_On_License_Error
        switch (status) {
            case 'SUCCESS':
                return 'success';
            case 'FAIL':
            case 'Fail_On_License_Error':
                return 'error';
            case 'DEPLOYING':
                return 'info';
            default:
                return 'default';
        }
    }
  }
})
</script>
