<template>
  <n-card size="huge" hoverable>
    <n-space vertical>
      Step Type
      <n-select
        v-model:value="selectedStepType"
        placeholder="Choose Step Type"
        :options="stepTypeOptions"
      />
    </n-space>
    <n-button @click="$emit('update:value', selectedStepType)">Submit</n-button>
  </n-card>
</template>

<style scoped>
.n-card {
  min-width: 300px;
}
.n-select {
  min-width: 200px;
}
</style>

<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
  data() {
    return {
      selectedStepType: null,
      stepTypeOptions: [
        {
          label: 'Import TRs',
          value: 'Import'
        },
        {
          label: 'Deploy Artifacts(iflow, package, scriptCollection)',
          value: 'Deploy'
        }
      ]
    }
  },
  props: ['value'],
  emits: ['update:value']
})
</script>
