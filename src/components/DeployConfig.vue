<template>
  <n-tabs type="segment" animated>
    <n-tab-pane name="Config" tab="Config">
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
        :title="'Packages of ' + step.Endpoint"
        :data="packages"
        :columns="packageColums"
        :row-key="(row: Package) => row.Id"
        @update:check-rows="handlePackage"
        :default-checked-row-keys="[step.PackageId]"
        :loading="!packages || !packages.length"
        :key="step.Endpoint"
      />
      <data-table
        :title="'Design Time Artifacts of ' + step.PackageId"
        :data="artifacts"
        :columns="artifactColumns"
        :row-key="(row: Artifact) => row.Id"
        @update:check-rows="handleArtifacts"
        :default-checked-row-keys="step.ArtifactIds"
        :loading="!artifacts || !artifacts.length"
        :key="step.PackageId"
      />
    </n-tab-pane>
    <n-tab-pane name="Execution Log" tab="Execution Log">
      <n-alert title="Artifact Deploy Status" type="default">
        <p v-for="(artifactId, index) in step.ArtifactIds" :key="index">
          {{ artifactId }} : {{ step.ArtifactVersions[index] }} - {{ step.TaskIds[index] }} -
          {{ step.TaskStatuses[index] }}
        </p>
      </n-alert>
    </n-tab-pane>
  </n-tabs>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import DataTable from '@/components/DataTable.vue'
import {
  GetApiEndpointsByType,
  GetArtifacts,
  GetPackages,
  type ApiEndpoint,
  type Artifact,
  type DeployStep,
  type Package
} from '@/service'
import { apiEndpointColums, artifactColumns, packageColums } from '@/service/consts'
export default defineComponent({
  props: {
    step: { type: Object as PropType<DeployStep>, required: true }
  },
  components: {
    DataTable
  },
  data() {
    const cpitenants: ApiEndpoint[] = []
    const packages: Package[] = []
    const artifacts: Artifact[] = []
    return {
      apiEndpointColums,
      packageColums,
      artifactColumns,
      cpitenants,
      packages,
      artifacts
    }
  },
  created() {
    GetApiEndpointsByType().then((endpoints) => (this.cpitenants = endpoints))
    if (!this.step.Endpoint) return
    GetPackages(this.step.Endpoint).then((pkgs) => (this.packages = pkgs))
    if (!this.step.PackageId) return
    GetArtifacts(this.step.Endpoint, this.step.PackageId).then((atfs) => (this.artifacts = atfs))
  },
  methods: {
    handleApiEndpoint(rows: ApiEndpoint[]) {
      if (
        this.step.Status === 'Running' ||
        this.step.Status === 'Finished' ||
        this.step.Status === 'Error'
      ) {
        window.$message.warning(`Do not modify step with status ${this.step.Status}`)
        return
      }
      this.step.Endpoint = rows[0].name
      this.packages = []
      this.artifacts = []
      this.step.PackageId = ''
      this.step.ArtifactIds = []
      this.step.Status = 'Draft'
      GetPackages(this.step.Endpoint).then((pkgs) => (this.packages = pkgs))
    },
    handlePackage(rows: Package[]) {
      this.step.PackageId = rows[0].Id
      this.artifacts = []
      this.step.ArtifactIds = []
      this.step.Status = 'Draft'
      GetArtifacts(this.step.Endpoint, this.step.PackageId).then(
        (artifacts) => (this.artifacts = artifacts)
      )
    },
    handleArtifacts(rows: Artifact[]) {
      this.step.ArtifactIds = rows.map((v, i) => v.Id)
      this.step.ArtifactTypes = rows.map((v, i) => v.Type)
      this.step.ArtifactVersions = rows.map((v, i) => v.Version)
      this.step.Status = 'Draft'
    }
  }
})
</script>
