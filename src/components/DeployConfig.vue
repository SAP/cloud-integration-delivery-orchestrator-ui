<template>
  <data-table
    title="CPI Tenants"
    :data="cpitenants"
    :columns="apiEndpointSelectColums"
    :row-key="(row: ApiEndpoint) => row.id"
    @update:check-rows="handleApiEndpoint"
    :default-checked-row-keys="[step.endpoint_id]"
    :loading="!cpitenants || cpitenants.length === 0"
  />
  <data-table 
    :title="'Packages of '+step.endpoint_id"
    :data="packages"
    :columns="packageColums"
    :row-key="(row: Package) => row.Id"
    @update:check-rows="handlePackage"
    :default-checked-row-keys="[step.package_id]"
    :loading="!packages || !packages.length"
    :key="step.endpoint_id"
  />
  <data-table
    :title="'Design Time Artifacts of '+step.package_id"
    :data="artifacts"
    :columns="artifactColumns"
    :row-key="(row: Artifact) => row.Id"
    @update:check-rows="handleArtifacts"
    :default-checked-row-keys="step.artifact_ids"
    :loading="!artifacts || !artifacts.length"
    :key="step.package_id"
  />
</template>

<script lang="ts">
import axios from 'axios'
import type { DataTableColumns } from 'naive-ui'
import { defineComponent, type PropType } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { GetApiEndpointsByType, GetArtifacts, GetPackages, type ApiEndpoint, type Artifact, type DeployStep, type Package } from '@/store'
import {
  apiEndpointColums,
  apiEndpointSelectColums,
  artifactColumns,
  packageColums
} from '@/store/const-data'
import { rowDark } from 'naive-ui/es/legacy-grid/styles'
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
      packageColums,
      artifactColumns,
      apiEndpointSelectColums,
      cpitenants,
      packages,
      artifacts
    }
  },
  created() {
    GetApiEndpointsByType('CPI').then(endpoints => this.cpitenants = endpoints)
    if(this.step.endpoint_id<0) return
    GetPackages(this.step.endpoint_id).then(pkgs => this.packages=pkgs)
    if(!this.step.package_id) return
    GetArtifacts(this.step.endpoint_id, this.step.package_id).then(atfs => this.artifacts=atfs)
  },
  methods: {
    handleApiEndpoint(rows: ApiEndpoint[]) {
        this.step.endpoint_id = rows[0].id
        this.step.endpoint_name = rows[0].name
        this.packages = []
        this.artifacts = []
        this.step.package_id = ''
        this.step.artifact_ids = []
        GetPackages(this.step.endpoint_id).then(pkgs => this.packages = pkgs)

    },
    handlePackage(rows: Package[]) {
        this.step.package_id = rows[0].Id
        this.artifacts = []
        this.step.artifacts = []
        GetArtifacts(this.step.endpoint_id, this.step.package_id)
            .then(artifacts => this.artifacts = artifacts)

    },
    handleArtifacts(rows: Artifact[]) {
        this.step.artifact_ids = rows.map((v,i) => v.Id)
    }

    

  }
})
</script>
