<template>
  <!-- artifact details modal -->
  <n-modal v-model:show="showArtifactDetails" preset="card" title="Artifact Details" style="max-width:560px"
    size="small" :closable="true" :close-on-esc="true" :mask-closable="true">
    <div v-if="artifactDetail">
      <n-flex vertical style="gap:12px">
        <div style="display:flex; gap:16px; flex-wrap:wrap">
          <div>
            <n-text depth="3" strong>ID</n-text>
            <div style="margin-top:4px">{{ artifactDetail.Id }}</div>
          </div>
          <div>
            <n-text depth="3" strong>Version</n-text>
            <div style="margin-top:4px">{{ artifactDetail.Version }}</div>
          </div>
          <div v-if="artifactDetail.Type">
            <n-text depth="3" strong>Type</n-text>
            <div style="margin-top:4px">{{ artifactDetail.Type }}</div>
          </div>
        </div>
        <div>
          <n-text depth="3" strong>Raw JSON</n-text>
          <n-code :code="artifactRawJson" language="json" style="margin-top:6px; max-height:260px; overflow:auto" />
        </div>
        <div>
          <n-text depth="3" strong>Version History</n-text>
          {{ artifactVersionHistory }}
        </div>
        <div style="display:flex; gap:8px">
          <n-button size="small" type="primary" @click="toggleArtifact(artifactDetailPkgId, artifactDetail)">
            {{ isArtifactSelected(artifactDetailPkgId, artifactDetail) ? 'Unselect' : 'Select' }}
          </n-button>
          <n-button size="small" secondary @click="showArtifactDetails = false">Close</n-button>
        </div>
      </n-flex>
    </div>
  </n-modal>
  <div style="margin: 0 42px">

    <!-- header -->
    <n-card class="header-card-shadow-class">
      <n-grid x-gap="10" :cols="5">
        <!-- delivery request name and desctiption -->
        <n-gi>
          <n-flex vertical>
            <n-input class="ui5-title-root" v-model:value="deliveryRequest.Name" placeholder="Delivery Request Name"
              clearable autofocus v-if="editing" />
            <span class="ui5-title-root" v-else-if="deliveryRequest.Name">
              <n-text depth="3"> Delivery Request Name: </n-text>
              {{ deliveryRequest.Name }}
            </span>
            <!-- plan JIRA link -->
            <n-input v-model:value="deliveryRequest.JiraLink" placeholder="Delivery Request Description" size="large"
              clearable v-if="editing" />
            <n-text style="font-weight: bold" v-else-if="deliveryRequest.JiraLink">
              {{ deliveryRequest.JiraLink }}
            </n-text>
          </n-flex>
        </n-gi>

        <!-- Delivery Request basic information -->
        <n-gi span="2">
          <n-flex vertical>
            <n-text depth="3" style="font-size: 12px" strong>
              Created By: {{ deliveryRequest.CreatedBy }} at
              {{ toLocalTime(deliveryRequest.CreatedAt) }}
            </n-text>
            <n-text depth="3" style="font-size: 12px" strong>
              Updated By: {{ deliveryRequest.UpdatedBy }} at
              {{ toLocalTime(deliveryRequest.UpdatedAt) }}
            </n-text>
          </n-flex>
        </n-gi>
        <!-- Delivery Request status tag -->
        <n-gi> </n-gi>
        <!-- action buttions -->
        <n-gi>
          <!-- Edit button -->
          <IconBtn tip="Edit" :handler="onEdit" v-if="!editing">
            <edit16-regular />
          </IconBtn>
          <IconBtn tip="Cancel" :handler="refresh" v-if="editing" color="#df423a">
            <CancelOutlined />
          </IconBtn>
          <!-- Delete button -->
          <IconBtn tip="Delete" :handler="handleDelete" v-if="!editing" color="#df423a">
            <Delete28Regular />
          </IconBtn>

          <n-divider vertical />
        </n-gi>
      </n-grid>
    </n-card>

    <!-- Generate Delivert Request -->
    <n-card class="card-shadow-class">
      <div style="margin-bottom: 15px; font-size: 15px; font-weight: bold">
        Delivery Request <n-gradient-text type="success">#{{ deliveryRequest.ID }}</n-gradient-text>
      </div>
      <n-grid x-gap="40" :cols="5">
        <!-- step lists -->
        <n-gi span="4">
          <n-steps vertical :current="current" @update:current="handleCurrent">
            <!-- parse yaml step -->
            <n-step>
              <template #title> Create Delivery Plan </template>
              <n-card hoverable size="medium">
                <n-flex vertical style="gap:12px">
                  <n-divider dashed title-placement="center"
                    style="margin:0 0 10px 0; font-weight:600; letter-spacing:.5px">
                    Source Cpi Tenant
                  </n-divider>
                  <n-select style="margin-top:4px; max-width:420px" @update:value="handleSelectSourceCpiTenant"
                    :options="cpiTenantsOptions" filterable />

                  <!-- cpi tenants selection -->
                  <n-flex vertical v-if="deliveryRequest.SourceTenant" style="gap:8px">
                    <div>
                      <n-text depth="3" strong>Tenant:</n-text>
                      <n-tag type="info" :bordered="false" style="margin-left:6px">
                        #{{ deliveryRequest.SourceTenant.ID}} {{deliveryRequest.SourceTenant.Name }}
                      </n-tag>
                    </div>
                    <div v-if="deliveryRequest.SourceTenant.TransportNode">
                      <n-text depth="3" strong>Transport Node:</n-text>
                      <n-tag type="success" :bordered="false" style="margin-left:6px">
                        #{{deliveryRequest.SourceTenant.TransportNode.id }} {{deliveryRequest.SourceTenant.TransportNode.name }} - {{deliveryRequest.SourceTenant.TransportNode.description }}</n-tag>
                    </div>
                    <div v-if="deliveryRequest.SourceTenant.CpiEndpoint">
                      <n-text depth="3" strong>CPI Endpoint:</n-text>
                      <n-tag type="warning" :bordered="false" style="margin-left:6px">
                        {{deliveryRequest.SourceTenant.CpiEndpoint.name}} ({{ deliveryRequest.SourceTenant.CpiEndpoint.url }})
                      </n-tag>
                    </div>
                    <n-divider dashed title-placement="center"
                      style="margin:0 0 10px 0; font-weight:600; letter-spacing:.5px">
                      Packages({{ selectedPackages.length }})
                    </n-divider>
                    <div style="margin-top:6px">
                      <!-- Error State -->
                      <n-alert v-if="packagesLoadError" type="error" closable @close="packagesLoadError = ''"
                        style="max-width:420px">
                        {{ packagesLoadError }}
                        <n-button size="tiny" text type="primary" @click.stop="retryFetchPackages"
                          style="margin-left:8px">Retry</n-button>
                      </n-alert>
                      <!-- Loading Skeleton -->
                      <div v-else-if="packagesLoading" style="max-width:420px">
                        <n-skeleton text style="width: 60%" :repeat="1" />
                        <n-skeleton text style="width: 80%; margin-top:8px" :repeat="1" />
                        <n-skeleton text style="width: 40%; margin-top:8px" :repeat="1" />
                      </div>
                      <!-- Packages Select -->
                      <div v-else>
                        <n-select v-model:value="selectedPackages" :options="packagesOptions" multiple clearable
                          filterable placeholder="Select packages from this tenant" style="width: 420px"
                          :disabled="!packagesOptions.length" />
                        <div v-if="!packagesOptions.length" style="margin-top:6px">
                          <n-text depth="3" type="warning">No packages found for this tenant.</n-text>
                        </div>
                      </div>
                    </div>
                    <!-- Package & Artifacts Section -->
                    <div v-if="selectedPackages.length" style="margin-top:16px; width:100%">
                      <n-text depth="3" strong>Artifacts (select to include):</n-text>
                      <n-collapse v-model:expanded-names="expandedPackages" style="margin-top:6px">
                        <!-- Package Lists -->
                        <n-collapse-item v-for="pkg in selectedPackages" :key="pkg.Id" :name="pkg.Id"
                          :title="packageLabel(pkg)">
                          <div v-if="loadingPackages[pkg.Id]" style="padding:4px 0">
                            <n-skeleton text style="width:55%" :repeat="1" />
                            <n-skeleton text style="width:70%; margin-top:6px" :repeat="1" />
                            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px">
                              <n-skeleton v-for="i in 6" :key="'art-skel-' + i" text style="width:92px" />
                            </div>
                          </div>
                          <div v-else>
                            <div v-if="(packageArtifacts[pkg.Id] || []).length === 0">
                              <n-empty description="No artifacts" />
                            </div>
                            <div v-else>
                              <n-flex>
                                <n-input v-model:value="artifactSearch[pkg.Id]" size="small"
                                  placeholder="Filter artifacts (id / version / type)" clearable
                                  style="max-width:320px; margin-bottom:8px" />
                                <n-button tertiary size="tiny" @click="selectAllFiltered(pkg.Id)"
                                  :disabled="!filteredArtifacts(pkg.Id).length">Select All Filtered</n-button>
                                <n-button tertiary size="tiny" @click="clearSelections(pkg.Id)"
                                  :disabled="!(artifactSelections[pkg.Id] || []).length">Clear Selected</n-button>
                                <n-text depth="1" type="info" style="font-size:12px; margin-left:auto">
                                  Hint: click Info16Regular icon on an artifact tag to view details
                                </n-text>
                              </n-flex>

                              <!-- Artifact list section -->
                              <n-scrollbar
                                style="max-height:260px; border:1px solid var(--n-border-color); padding:6px; border-radius:4px">
                                <div style="display:flex; flex-wrap:wrap; gap:6px">
                                  <n-tag v-for="a in filteredArtifacts(pkg.Id)"
                                    :key="pkg.Id + '-' + a.Id + '@' + a.Version"
                                    :type="isArtifactSelected(pkg.Id, a) ? 'success' : 'default'" :bordered="false"
                                    size="small" @click="toggleArtifact(pkg.Id, a)">
                                    <!-- TODO: may extract a component -->
                                    <span>{{ a.Id }}@{{ a.Version }}</span>
                                    <template v-if="isArtifactSelected(pkg.Id, a)"><span
                                        style="margin-left:2px">✔</span></template>
                                    <n-tooltip trigger="hover" placement="top">
                                      <template #trigger>
                                        <n-icon size="18" @click.stop="openArtifactDetails(a)">
                                          <Info16Regular />
                                        </n-icon>
                                      </template>
                                      Show Details
                                    </n-tooltip>
                                  </n-tag>
                                </div>
                              </n-scrollbar>
                            </div>
                          </div>
                        </n-collapse-item>
                      </n-collapse>
                    </div>
                    <!-- selected Artifacts list -->
                    <n-flex vertical v-if="selectedArtifacts.length" style="margin-top:18px">
                      <n-divider dashed title-placement="center"
                        style="margin:0 0 10px 0; font-weight:600; letter-spacing:.5px">
                        Selected Artifacts ({{ selectedArtifacts.length }})
                      </n-divider>
                      <n-flex wrap>
                        <n-tag v-for="(a, i) in selectedArtifacts" :key="'sel-' + i + '-' + a.Id + '@' + a.Version"
                          type="info" size="small" :bordered="false">
                          {{ a.Id }}@{{ a.Version }}
                          <n-tooltip trigger="hover" placement="top">
                            <template #trigger>
                              <n-icon size="18" @click.stop="openArtifactDetails(a)">
                                <Info16Regular />
                              </n-icon>
                            </template>
                            Show Details
                          </n-tooltip>
                        </n-tag>
                      </n-flex>
                    </n-flex>
                  </n-flex>
                  <n-button type="primary" secondary @click="handleGenerate">Generate</n-button>
                </n-flex>
              </n-card>
            </n-step>
          </n-steps>
        </n-gi>
        <!-- <n-gi span="2"> Log </n-gi> -->
      </n-grid>
    </n-card>
  </div>

  <div style="height:1000px; width:100%">
    <VueFlow :nodes="flowNodes" :edges="flowEdges" fit-view-on-init>
      <template #node-cpi-transport="props" >
        <CpiTransportNode v-bind="props" />
      </template>
    </VueFlow>
  </div>
</template>

<script lang="ts">
import {
  GetCpiTenants,
  GetDeliveryRequest,
  UpsertDeliveryRequest,
  GetPackages,
  GetPackageArtifacts,
  type CpiTenant,
  type DeliveryRequest,
  type Package,
  type Artifact,
  DeleteDeliveryRequest,
  GetArtifactVersionHistory,
  type ArtifactVersionHistoryItem,
  GetTransportRoutes,
  type TransportNode,
  type TransportRoute
} from '@/service/api'
import { toLocalTime } from '@/service/consts'
import { Edit16Regular, Delete28Regular, Info16Regular } from '@vicons/fluent'
import { SaveAltRound, StartTwotone, CancelOutlined } from '@vicons/material'
import IconBtn from '@/components/IconBtn.vue'
import { VueFlow, type Edge, type Node } from '@vue-flow/core'
import CpiTransportNode from '@/components/CpiTransportNode.vue'


export default {
  name: 'TransportPlanView',
  components: {
    Edit16Regular,
    Delete28Regular,
    SaveAltRound,
    StartTwotone,
    CancelOutlined,
    IconBtn,
    Info16Regular,
    VueFlow,
    CpiTransportNode
  },
  props: { planId: { required: true, type: Number } },
  data() {
    return {
      deliveryRequest: {} as DeliveryRequest,
      editing: false,
      current: 0,
      toLocalTime,
      cpiTenantsOptions: [] as { label: string; value: CpiTenant }[],
      packageOptions: [] as Package[],
      selectedPackages: [] as Package[],
      packageArtifacts: {} as { [key: string]: Artifact[] },
      loadingPackages: {} as { [key: string]: boolean },
      expandedPackages: [] as string[],
      artifactSelections: {} as { [key: string]: string[] },
      packagesLoading: false,
      packagesLoadError: '' as string,
      artifactSearch: {} as { [key: string]: string },
      // artifact details state
      showArtifactDetails: false,
      artifactDetail: null as Artifact | null,
      artifactDetailPkgId: '' as string,
      artifactRawJson: '' as string,
      artifactVersionHistory: [] as ArtifactVersionHistoryItem[]
    }
  },
  methods: {
    onEdit() {
      this.editing = true
    },
    async refresh() {
      this.editing = false
      this.deliveryRequest = await GetDeliveryRequest(this.planId)
    },
    async handleDelete() {
      await DeleteDeliveryRequest(this.planId)
      this.$router.go(-1)
    },
    handleCurrent(current: number) {
      this.current = current
    },
    async handleSelectSourceCpiTenant(tenant: CpiTenant) {
      this.deliveryRequest.SourceTenant = tenant
      this.resetPackageState()
      await this.fetchPackagesForTenant(tenant.CpiEndpoint.name)
    },
    resetPackageState() {
      this.selectedPackages = []
      this.packageOptions = []
      this.packageArtifacts = {}
      this.expandedPackages = []
      this.artifactSelections = {}
      this.packagesLoadError = ''
      this.updateArtifactsFromSelection()
    },
    async fetchPackagesForTenant(tenantKey: string) {
      this.packagesLoading = true
      this.packagesLoadError = ''
      try {
        const pkgs = await GetPackages(tenantKey)
        this.packageOptions = pkgs
      } catch (e: any) {
        this.packagesLoadError = 'Failed to load packages.'
      } finally {
        this.packagesLoading = false
      }
    },
    async retryFetchPackages() {
      if (!this.deliveryRequest.SourceTenant) return
      await this.fetchPackagesForTenant(this.deliveryRequest.SourceTenant.CpiEndpoint.name)
    },
    async handleGenerate() {
      await UpsertDeliveryRequest(this.deliveryRequest)
      await this.refresh()
      const routes = await GetTransportRoutes()
    },
    async loadPackageArtifacts(pkgId: string) {
      if (!this.deliveryRequest.SourceTenant) return
      if (this.packageArtifacts[pkgId]) return // already loaded
      const tenantKey = this.deliveryRequest.SourceTenant.CpiEndpoint.name
      this.loadingPackages[pkgId] = true
      try {
        this.packageArtifacts[pkgId] = await GetPackageArtifacts(tenantKey, pkgId)
        if (!this.artifactSelections[pkgId]) {
          this.artifactSelections[pkgId] = []
        }
      } catch (e) {
        window.$message?.warning?.(`Artifacts fetch failed for package ${pkgId}`)
      } finally {
        this.loadingPackages[pkgId] = false
      }
    },
    updateArtifactsFromSelection() {
      // flatten selected artifacts based on artifactSelections
      const list: Artifact[] = []
      Object.entries(this.artifactSelections).forEach(([pkgId, keys]) => {
        const arts = this.packageArtifacts[pkgId] || []
        keys.forEach(k => {
          const [id, version] = k.split('@')
          const found = arts.find(a => a.Id === id && a.Version === version)
          if (found) list.push(found)
        })
      })
      this.deliveryRequest.Artifacts = list
    },
    packageLabel(pkg: Package) {
      return `${pkg.Name} @ ${pkg.Version}`
    },
    artifactKey(a: Artifact) { return `${a.Id}@${a.Version}` }
    ,
    filteredArtifacts(pkgId: string): Artifact[] {
      const list = this.packageArtifacts[pkgId] || []
      const kw = (this.artifactSearch[pkgId] || '').trim().toLowerCase()
      if (!kw) return list
      return list.filter(a =>
        a.Id.toLowerCase().includes(kw) ||
        a.Version.toLowerCase().includes(kw) ||
        (a.Type && a.Type.toLowerCase().includes(kw))
      )
    },
    isArtifactSelected(pkgId: string, a: Artifact) {
      const key = this.artifactKey(a)
      return (this.artifactSelections[pkgId] || []).includes(key)
    },
    toggleArtifact(pkgId: string, a: Artifact) {
      if (!this.artifactSelections[pkgId]) this.artifactSelections[pkgId] = []
      const key = this.artifactKey(a)
      const arr = this.artifactSelections[pkgId]
      const idx = arr.indexOf(key)
      if (idx >= 0) arr.splice(idx, 1)
      else arr.push(key)
      this.updateArtifactsFromSelection()
    },
    selectAllFiltered(pkgId: string) {
      const keys = this.filteredArtifacts(pkgId).map(a => this.artifactKey(a))
      this.artifactSelections[pkgId] = keys
      this.updateArtifactsFromSelection()
    },
    clearSelections(pkgId: string) {
      this.artifactSelections[pkgId] = []
      this.updateArtifactsFromSelection()
    },
    async openArtifactDetails(a: Artifact) {
      this.artifactDetail = a
      this.artifactDetailPkgId = a.PackageId
      this.artifactRawJson = JSON.stringify(a, null, 2)
      this.showArtifactDetails = true

      const cpiTenantUrl = this.deliveryRequest.SourceTenant.CpiEndpoint.url
      const baseUrl = new URL(cpiTenantUrl)
      this.artifactVersionHistory = await GetArtifactVersionHistory(`${baseUrl.protocol}//${baseUrl.host}`, a.PackageId, a.Id)
      console.log(this.artifactVersionHistory)
    },
  },
  watch: {
    selectedPackages(newPkgs: Package[], oldPkgs: Package[]) {
      const removed = (oldPkgs || []).filter(p => !newPkgs.includes(p))
      removed.forEach(p => {
        delete this.packageArtifacts[p.Id]
        delete this.artifactSelections[p.Id]
        this.expandedPackages = this.expandedPackages.filter(id => id !== p.Id)
      })
      this.updateArtifactsFromSelection()
    },
    expandedPackages(newVal: string[], oldVal: string[]) {
      const added = newVal.filter(id => !(oldVal || []).includes(id))
      added.forEach(id => this.loadPackageArtifacts(id))
    },
    artifactSelections: {
      deep: true,
      handler() { this.updateArtifactsFromSelection() }
    },
    
  },
  computed: {
    packagesOptions() {
      return this.packageOptions.map(pkg => ({ label: `${pkg.Name} @ ${pkg.Version}`, value: pkg }))
    },
    selectedArtifacts(): Artifact[] {
      return this.deliveryRequest.Artifacts || []
    },
    flowEdges(): Edge[] {
      if (!this.deliveryRequest.SourceTenant) return []
      const routes = (this.deliveryRequest)?.TargetRoutes || []
      return routes.map((route: TransportRoute) => ({
        id: route.description || `e-${route.sourceNodeId}-to-${route.targetNodeId}`,
        source: String(route.sourceNodeId),
        target: String(route.targetNodeId),
        animated: true,
        label: route.description || ''
      }))
    },
    flowNodes(): Node[] {      
      if(!this.deliveryRequest.SourceTenant) return []
      const nodes = (this.deliveryRequest)?.TargetNodes || []
      nodes.push(this.deliveryRequest.SourceTenant?.TransportNode as TransportNode) // add source node
      return nodes.map((node: TransportNode) => ({
        id: String(node.id),
        data: { curNode: node, deliveryRequest: this.deliveryRequest },
        position: { x: Math.random() * 600, y: Math.random() * 400 },
        type: 'cpi-transport'

      }))
    }
  },
  async created() {
    await this.refresh()
    const cpiTenants = await GetCpiTenants()
    this.cpiTenantsOptions = cpiTenants.map((tenant: CpiTenant) => ({ label: tenant.Name, value: tenant }))
    if (this.deliveryRequest.SourceTenant) {
      await this.fetchPackagesForTenant(this.deliveryRequest.SourceTenant.CpiEndpoint.name)
    }
  }
}
</script>

<style scoped>
.header-card-shadow-class {
  border-radius: 0.5rem;
  box-shadow:
    0 0 0.125rem 0 rgba(34, 53, 72, 0.2),
    0 0.125rem 0.25rem 0 rgba(34, 53, 72, 0.2);
  position: sticky;
  top: 80px;
  z-index: 99;
}

.ui5-title-root {
  font-weight: bold;
  font-size: larger;
}

.card-shadow-class {
  border-radius: 0.5rem;
  box-shadow:
    0 0 0.125rem 0 rgba(34, 53, 72, 0.2),
    0 0.125rem 0.25rem 0 rgba(34, 53, 72, 0.2);
  margin-bottom: 10px;
}
</style>
