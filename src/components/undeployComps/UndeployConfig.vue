<template>
  <data-table
    title="CPI Tenants"
    :data="cpitenants"
    :columns="apiEndpointColums"
    :row-key="(row: ApiEndpoint) => row.name"
    @update:check-rows="handleApiEndpoint"
    :default-checked-row-keys="[step.Endpoint]"
    :loading="!cpitenants || cpitenants.length === 0"
  />
  <data-table
    :title="'Runtime Artifacts of ' + step.Endpoint"
    :data="runtimeArtifacts"
    :columns="runtimeArtifactColumns"
    :row-key="(row: RuntimeArtifact) => row.Id"
    @update:check-rows="handleRuntimeArtifacts"
    :default-checked-row-keys="step.ArtifactIds"
    :loading="!runtimeArtifacts || !runtimeArtifacts.length"
    :key="step.Endpoint"
  />
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import DataTable from '@/components/DataTable.vue'
import {
    GetApiEndpointsByType,
  GetRuntimeArtifacts,
  validate,
  type ApiEndpoint,
  type DeployStep,
  type RuntimeArtifact
} from '@/service/api'
import { apiEndpointColums, runtimeArtifactColumns } from '@/service/consts'
export default defineComponent({
  components: {
    DataTable
  },
  props: {
    step: { type: Object as PropType<DeployStep>, required: true }
  },
  data() {
    const cpitenants: ApiEndpoint[] = []
    const runtimeArtifacts: RuntimeArtifact[] = []
    return {
      cpitenants,
      apiEndpointColums,
      runtimeArtifactColumns,
      runtimeArtifacts
    }
  },
  methods: {
    handleApiEndpoint(rows: ApiEndpoint[]) {
      if (!validate(this.step)) return
      this.step.Endpoint = rows[0].name
      this.step.ArtifactIds = []
      this.step.Status = 'Draft'
      this.runtimeArtifacts = []
      GetRuntimeArtifacts(this.step.Endpoint).then((artifacts) => {
        this.runtimeArtifacts = artifacts
      })
    },
    handleRuntimeArtifacts(rows: RuntimeArtifact[]) {
      if (!validate(this.step)) return
      this.step.ArtifactIds = rows.map((v, i) => v.Id)
      this.step.ArtifactTypes = rows.map((v, i) => v.Type)
      this.step.ArtifactVersions = rows.map((v, i) => v.Version)
      this.step.Status = 'Draft'
    }
  },
  created() {
    GetApiEndpointsByType().then((endpoints) => {
      this.cpitenants = endpoints
    })
    if (!this.step.Endpoint) return
    GetRuntimeArtifacts(this.step.Endpoint).then((artifacts) => {
      this.runtimeArtifacts = artifacts
    })
  }
})
</script>
