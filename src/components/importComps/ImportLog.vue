<template>
    <h4>Transport Request Import Status</h4>
  <div v-for="(step, i) in steps" :key="i">
    <n-alert :title="`Step ${i+1}`" type="default">
      ActionId: {{ step.ActionId }} - {{ step.Status }}
    </n-alert>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { type ImportStep } from '@/service/api'
export default defineComponent({
  props: {
    steps: { type: Object as PropType<ImportStep[]>, required: true }
  }
})
</script>
