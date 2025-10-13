<template>
  <data-table
    title="CPI Tenants"
    :data="cpiTenantOptions"
    :columns="apiEndpointColums"
    :row-key="(row: ApiEndpoint) => row.name"
    @update:check-rows="handleApiEndpoint"
    :default-checked-row-keys="[step.Endpoint]"
    :loading="!cpiTenantOptions || !cpiTenantOptions.length"
  />
  <data-table
    :title="'Runtime Artifacts of ' + step.Endpoint"
    :data="runtimeArtifactOptions"
    :columns="runtimeArtifactColumns"
    :row-key="(row: RuntimeArtifact) => row.Id"
    @update:check-rows="handleRuntimeArtifacts"
    :default-checked-row-keys="step.Artifacts.map((art) => art.TechID)"
    :loading="!runtimeArtifactOptions || !runtimeArtifactOptions.length"
    :key="step.Endpoint"
  />
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import DataTable from '@/components/DataTable.vue'
import {
  GetCPIApiEndpoints,
  GetRuntimeArtifacts,
  validate
} from '@/service/api'
import { apiEndpointColums, runtimeArtifactColumns } from '@/service/consts'
import type { DeployStep, ApiEndpoint, RuntimeArtifact } from '@/service/model'
export default defineComponent({
  components: {
    DataTable
  },
  props: {
    step: { type: Object as PropType<DeployStep>, required: true }
  },
  data() {
    return {
      cpiTenantOptions: [] as ApiEndpoint[],
      apiEndpointColums,
      runtimeArtifactColumns,
      runtimeArtifactOptions: [] as RuntimeArtifact[]
    }
  },
  methods: {
    handleApiEndpoint(rows: ApiEndpoint[]) {
      if (!validate(this.step)) return
      this.step.Status = 'Draft'
      this.runtimeArtifactOptions = []

      this.step.Endpoint = rows[0].name
      this.step.Artifacts = []
      GetRuntimeArtifacts(this.step.Endpoint).then((artifacts) => {
        this.runtimeArtifactOptions = artifacts
      })
    },
    handleRuntimeArtifacts(selectedArtifacts: RuntimeArtifact[]) {
      if (!validate(this.step)) return
      this.step.Status = 'Draft'
      this.step.Artifacts = selectedArtifacts
    }
  },
  created() {
    if (!this.step.Artifacts) this.step.Artifacts = []
    GetCPIApiEndpoints()
      .then((endpoints) => {this.cpiTenantOptions = endpoints})
    if (!this.step.Endpoint) return
    GetRuntimeArtifacts(this.step.Endpoint)
      .then((artifacts) => {this.runtimeArtifactOptions = artifacts})
  }
})
</script>
