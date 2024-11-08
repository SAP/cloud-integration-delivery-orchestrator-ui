<template>
  <h4>Artifact Deploy Status</h4>
  <div v-for="(step, i) in steps" :key="i">
    <!-- job not triggered -->
    <n-alert v-if="step.Status === 'Draft' || step.Status === 'Saved'">
        <template #header>
            Step <n-gradient-text type="success">#{{ i + 1 }}</n-gradient-text>
        </template>
        Not Triggerd
    </n-alert>
    <!-- job triggred -->
    <n-alert type="default" v-else>
      <template #header>
        Step <n-gradient-text type="success">#{{ i + 1 }}</n-gradient-text>
        <n-text depth="3" italic style="font-size: 80%">
            trigger by {{ step.TriggeredBy }} at {{ toLocalTime(step.TriggeredAt) }}
        </n-text>
      </template>
      <p v-for="(artifactId, index) in step.ArtifactIds" :key="index">
        <n-tag :bordered="false" type="info">
            {{ artifactId }}:{{ step.ArtifactVersions[index] }}
        </n-tag>
        - <n-text code>{{ step.TaskIds[index] }}</n-text> -
        <n-tag :type="toStatusTag(step.TaskStatuses[index])">
          {{ step.TaskStatuses[index] }}
        </n-tag>
      </p>
      <n-text depth="3">Finished at: {{ toLocalTime(step.EndedAt) }}</n-text>
      
    </n-alert>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { type DeployStep } from '@/service/api'
import { toLocalTime } from '@/service/consts'
export default defineComponent({
  props: {
    steps: { type: Object as PropType<DeployStep[]>, required: true }
  },
  data() {
    return {
      toLocalTime
    }
  },
  methods: {
    toStatusTag(status: string) {
      // map artifacts deployment status to tag type: SUCCESS, FAIL, DEPLOYING, Fail_On_License_Error
      switch (status) {
        case 'SUCCESS':
          return 'success'
        case 'FAIL':
        case 'Fail_On_License_Error':
          return 'error'
        case 'DEPLOYING':
          return 'info'
        default:
          return 'default'
      }
    }
  }
})
</script>
