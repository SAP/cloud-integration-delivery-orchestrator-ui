<template>
  <n-card size="huge" hoverable>
    <n-space vertical v-if="importStep.status === 'DRAFT'">
      CPI tenant
      <n-select
        v-model:value="importStep.tenant"
        placeholder="Choose CPI tenant"
        :options="tenantOptions"
      />
      TRs
      <n-select
        v-model:value="importStep.trs"
        placeholder="choose TRs"
        :options="trOptions"
        multiple
      />
      <n-space justify="end">
        <n-button @click="onsubmit">Submit</n-button>
      </n-space>
    </n-space>

    <n-space vertical v-if="importStep.status === 'SUBMITTED'">
      selected tenant: {{ importStep.tenant }}
      <n-divider />
      selected TRs : {{ importStep?.trs }}
    </n-space>
  </n-card>
</template>

<script lang="ts">
import { stepProps } from 'naive-ui'
import { mapStores } from 'pinia'
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import type { ImportStep } from '../store/index'

export default defineComponent({
  data() {
    return {
      importStep: this.step,
      // options are fetched from backend
      tenantOptions: [
        {
          label: 'cpi ctest 01',
          value: 'CPICTest01'
        },
        {
          label: 'cpi prod',
          value: 'CPIPRODEON'
        }
      ],
      trOptions: [
        {
          label: '17003',
          value: '17004'
        },
        {
          label: '3242342',
          value: '534534'
        }
      ]
    }
  },
  methods: {
    onsubmit() {
      this.importStep!.status = 'SUBMITTED'
    }
  },
  emits: ['update:value'],
  props: {
    step: { type: Object as PropType<ImportStep>, required: true }
  }
})
</script>
<style scoped>
.n-card {
  min-width: 400px;
}
</style>
