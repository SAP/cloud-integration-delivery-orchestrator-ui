<template>
  <h4>Transport Request Import Status</h4>
  <div v-for="(step, i) in steps" :key="i">
    <n-alert type="default" v-if="step.ActionId!==0">
      <template #header>
        Step <n-gradient-text type="success">#{{ i + 1 }}</n-gradient-text>
        <n-text depth="3" italic style="font-size: 80%">
            trigger By: {{ step.TriggeredBy }} at {{ toLocalTime(step.TriggeredAt) }}
        </n-text>
      </template>
      TRs:
      <n-tag type="info" v-for="(tr, index) in step.TransportRequests" :key="index">
        {{ tr }}
      </n-tag>
      -
      Action Id: <n-text code> {{ step.ActionId }}</n-text>
       -
      <n-tag :type="toTagStatus(step.Status)">{{ step.Status }}</n-tag>
      <p/>
      <n-text depth="3">
        Finished at: {{ toLocalTime(step.EndedAt) }}
      </n-text>
    </n-alert>
    <n-alert type="default" v-else>
      <template #header>
        Step <n-gradient-text type="success">#{{ i + 1 }}</n-gradient-text>
      </template>
      Not Triggered
    </n-alert>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { type ImportStep } from '@/service/api'
import { toLocalTime } from '@/service/consts'
export default defineComponent({
  props: {
    steps: { type: Object as PropType<ImportStep[]>, required: true }
  },
  data() {
    return {
      toLocalTime
    }
  },
methods: {
    // maps to naive-ui tag status: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'
    toTagStatus(status: string) {
        switch (status) {
          case 'Saved':
            return 'primary'
          case 'Running':
            return 'info'
          case 'Success':
            return 'success'
          case 'Error':
            return 'error'
          default:
            return 'default'
        }
    }
}
})
</script>
