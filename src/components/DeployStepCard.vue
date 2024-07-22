<template>
  <n-card size="huge" hoverable>
    <n-space vertical>
      CPI tenant
      <n-select
        v-model:value="deployStep.tenant"
        placeholder="Choose CPI tenant"
        :options="tenantOptions"
      />
      Artifacts
      <n-select
        v-model:value="deployStep.artifacts"
        placeholder="choose Artifacts"
        :options="artifactsOptions"
        multiple
      />
    </n-space>
    <n-button @click="onSubmit">Submit</n-button>
  </n-card>
</template>

<style scoped>
.n-card {
  min-width: 400px;
}
</style>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { DeployStep } from '../store/index'
export default defineComponent({
  data() {
    return {
      deployStep: this.step,
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
      artifactsOptions: [
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
    onSubmit() {}
  },
  props: {
    step: Object as PropType<DeployStep>
  }
})
</script>
