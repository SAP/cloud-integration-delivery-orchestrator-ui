<template>
  <h4>Transport Request Import Status</h4>
  <div v-for="(step, i) in steps" :key="i">
    <n-alert type="default">
      <template #header>
        Step {{ i + 1 }} Triggered By: {{ step.TriggeredBy }} at
        {{ toLocalTime(step.TriggeredAt) }}
      </template>
      ActionId: {{ step.ActionId }} -
      <n-tag :type="toTagStatus(step.Status)">{{ step.Status }}</n-tag>. 
      Finished at: {{ toLocalTime(step.EndedAt) }}
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
