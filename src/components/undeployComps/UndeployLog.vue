<template>
    <!-- if job not triggered -->
    <n-alert v-if="step.Status === 'Draft' || step.Status === 'Saved'">
      <template #header>
        Step <n-gradient-text type="success">#{{ index + 1 }}</n-gradient-text>
      </template>
      Not Triggerd
    </n-alert>
    <!-- if job triggred -->
    <n-alert type="default" v-else>
      <template #header>
        Step <n-gradient-text type="success">#{{ index + 1 }}</n-gradient-text>
        -
        <!-- step type -->
        <n-text depth="3" style="font-size: 80%" type="warning">
          {{stepTypeOptions[step.Type]}}
        </n-text>
        -
        <n-text depth="3" italic style="font-size: 80%">
          trigger by {{ step.TriggeredBy }} at {{ toLocalTime(step.TriggeredAt) }}
        </n-text>
      </template>
      <p v-for="(artifact, index) in step.Artifacts" :key="index">
        <n-tag :bordered="false" type="info">
          {{ artifact.TechID }}:{{ artifact.Version }}
        </n-tag>
        -
        <n-tag :type="toStatusTag(artifact.Status)">
          artifact.Status
        </n-tag>
      </p>
      <n-text depth="3" strong>Finished at: {{ toLocalTime(step.EndedAt) }}</n-text>
    </n-alert>
  </template>
  
  <script lang="ts">
  import { defineComponent, type PropType } from 'vue'
  import { type DeployStep } from '@/service/model'
  import { toLocalTime, stepTypeOptions } from '@/service/consts'
  export default defineComponent({
    props: {
      step: { type: Object as PropType<DeployStep>, required: true },
      index: { type: Number, required: true }
    },
    data() {
      return {
        toLocalTime,
        stepTypeOptions
      }
    },
    methods: {
      toStatusTag(status: string) {
        // map artifacts deployment status to tag type: SUCCESS, FAIL, DEPLOYING, Fail_On_License_Error
        switch (status) {
          case 'SUCCESS':
            return 'success'
          case 'FAIL':
            return 'error'
          case 'UNDEPLOYING':
            return 'info'
          default:
            return 'default'
        }
      }
    }
  })
  </script>
  