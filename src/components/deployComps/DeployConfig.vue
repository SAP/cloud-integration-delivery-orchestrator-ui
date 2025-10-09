<template>
  <data-table
    title="CPI Tenants"
    :data="cpitenantOptions"
    :columns="apiEndpointColums"
    :row-key="(row: ApiEndpoint) => row.name"
    @update:check-rows="handleApiEndpoint"
    :default-checked-row-keys="[step.Endpoint]"
    :loading="!cpitenantOptions || cpitenantOptions.length === 0"
  />
  <data-table
    :title="'Packages of ' + step.Endpoint"
    :data="packageOptions"
    :columns="packageColums"
    :row-key="(row: Package) => row.Id"
    @update:check-rows="handlePackage"
    :loading="!packageOptions || !packageOptions.length"
    :key="step.Endpoint"
  />
  <data-table
    :title="'Design Time Artifacts of ' +  selectedPackage.Name"
    :data="artifactOptions"
    :columns="artifactColumns"
    :row-key="(row: Artifact) => row.TechID"
    @update:check-rows="handleArtifacts"
    :default-checked-row-keys="step.Artifacts.filter((art) => art.PackageId === selectedPackage.Id).map((art) => art.TechID)"
    :loading="!artifactOptions || !artifactOptions.length"
    :key="selectedPackage.Id"
  />
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import DataTable from '@/components/DataTable.vue'
import {
  GetCPIApiEndpoints,
  GetPackageArtifacts,
  GetPackages,
  validate,
  type ApiEndpoint,
  type Artifact,
  type DeployStep,
  type Package
} from '@/service/api'
import { apiEndpointColums, artifactColumns, packageColums } from '@/service/consts'
export default defineComponent({
  props: {
    step: { type: Object as PropType<DeployStep>, required: true }
  },
  components: {
    DataTable
  },
  data() {
    return {
      apiEndpointColums,
      packageColums,
      artifactColumns,
      cpitenantOptions: [] as ApiEndpoint[],
      packageOptions: [] as Package[],
      artifactOptions: [] as Artifact[],

      selectedPackage: {} as Package
    }
  },
  created() {
    if (!this.step.Artifacts) this.step.Artifacts = []
    GetCPIApiEndpoints().then((endpoints) => (this.cpitenantOptions = endpoints))
    if (!this.step.Endpoint) return
    GetPackages(this.step.Endpoint).then((pkgs) => (this.packageOptions = pkgs))
    if (!this.step.PackageId) return
    GetPackageArtifacts(this.step.Endpoint, this.step.PackageId).then(
      (atfs) => (this.artifactOptions = atfs)
    )
  },
  methods: {
    handleApiEndpoint(rows: ApiEndpoint[]) {
      if (!validate(this.step)) return
      this.step.Status = 'Draft'

      this.step.Endpoint = rows[0].name
      // clear package and artifact options
      this.packageOptions = []
      this.artifactOptions = []

      GetPackages(this.step.Endpoint).then((pkgs) => (this.packageOptions = pkgs))
    },
    handlePackage(rows: Package[]) {
      if (!validate(this.step)) return
      this.step.Status = 'Draft'

      this.selectedPackage = rows[0]
      // clear artifact options
      this.artifactOptions = []

      GetPackageArtifacts(this.step.Endpoint, this.selectedPackage.Id).then((artifacts) => {this.artifactOptions = artifacts})
    },
    handleArtifacts(selectedArtifacts: Artifact[]) {
      if (!validate(this.step)) return
      this.step.Status = 'Draft'
      selectedArtifacts.forEach((artifact) => {artifact.PackageId = this.selectedPackage.Id})
      if (!this.step.Artifacts) this.step.Artifacts = []
      // filter out artifacts in the selectedPackage, so that packaged within that package can be re-added
      this.step.Artifacts = this.step.Artifacts.filter((art) => art.PackageId !== this.selectedPackage.Id)
      this.step.Artifacts.push(...selectedArtifacts)
    }
  }
})
</script>
