<template>
  <!-- Modals -->
  <!-- Flow Modal -->
  <n-modal v-model:show="showFlowModal" preset="card" title="Delivery Flow" :closable="true" :mask-closable="true"
    style="width:80%; height: 100%;">
    <CpiTransportFlowView :delivery-request="deliveryRequest" :cpi-tenants="cpiTenants" :tenant-to-ops="tenantToOps" />
  </n-modal>
  <!-- artifact details modal -->
  <n-modal v-model:show="showArtifactDetails" preset="card" title="Artifact Details" style="max-width:560px"
    size="small" :closable="true" :close-on-esc="true" :mask-closable="true">
    <div v-if="artifactDetail">
      <n-flex vertical style="gap:12px">
        <div style="display:flex; gap:16px; flex-wrap:wrap">
          <div>
            <n-text depth="3" strong>ID</n-text>
            <div style="margin-top:4px">{{ artifactDetail.TechID }}</div>
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
  <!-- end modal -->
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
              <!-- <n-text depth="3"> Delivery Request Name: </n-text> -->
              {{ deliveryRequest.Name }}
            </span>

          </n-flex>
        </n-gi>
        <n-gi>
          <!-- plan JIRA link -->
          <n-input v-model:value="deliveryRequest.JiraLink" placeholder="JIRA Link" size="large" clearable
            v-if="editing" />
          <n-text style="font-weight: bold" v-else-if="deliveryRequest.JiraLink">
            {{ deliveryRequest.JiraLink }}
          </n-text>
          <n-flex>{{ deliveryRequest.DeliveryRule?.Name }}</n-flex>
          <n-text>{{ deliveryRequest.Description }}</n-text>
        </n-gi>

        <!-- Delivery Request basic information -->
        <n-gi span="1">
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
        <n-gi> {{ deliveryRequest.AggregateStatus }} </n-gi>
        <!-- action buttions -->
        <n-gi>
          <n-divider vertical />
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

                  <!-- cpi tenants selection -->
                  <n-flex vertical v-if="deliveryRequest.SourceTenant" style="gap:8px">
                    <div>
                      <n-text depth="3" strong>Tenant: #{{ deliveryRequest.SourceTenant.ID }}
                        {{ deliveryRequest.SourceTenant.Name
                        }}</n-text>
                    </div>
                    <div v-if="deliveryRequest.SourceTenant.TransportNodeID">
                      <n-text depth="3" strong>
                        Transport Node: #{{ deliveryRequest.SourceTenant.TransportNodeID }}
                        {{ deliveryRequest.SourceTenant.TransportNodeName }} -
                        {{ deliveryRequest.SourceTenant.TransportNodeDescription
                        }}
                      </n-text>
                    </div>
                    <div v-if="deliveryRequest.SourceTenant.CpiEndpoint">
                      <n-text depth="3" strong>CPI Endpoint: {{ deliveryRequest.SourceTenant.CpiEndpoint.name }} - {{
                        deliveryRequest.SourceTenant.CpiEndpoint.url }}</n-text>
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
                        <n-button size="tiny" text type="primary" @click.stop="fetchPackagesForTenant"
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
                        <n-select v-model:value="selectedPackages" :options="packageOptions" multiple clearable
                          filterable placeholder="Select packages from this tenant" style="width: 420px"
                          :disabled="!packageOptions.length" />
                        <div v-if="!packageOptions.length" style="margin-top:6px">
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
                                  :disabled="!(selPkgArtifacts[pkg.Id] || []).length">Clear Selected</n-button>
                                <n-text depth="1" type="info" style="font-size:12px; margin-left:auto">
                                  Hint: click Info16Regular icon on an artifact tag to view details
                                </n-text>
                              </n-flex>

                              <!-- Artifact list section -->
                              <n-scrollbar
                                style="max-height:260px; border:1px solid var(--n-border-color); padding:6px; border-radius:4px">
                                <div style="display:flex; flex-wrap:wrap; gap:6px">
                                  <n-tag v-for="a in filteredArtifacts(pkg.Id)"
                                    :key="pkg.Id + '-' + a.TechID + '@' + a.Version"
                                    :type="isArtifactSelected(pkg.Id, a) ? 'success' : 'default'" :bordered="false"
                                    size="small" @click="toggleArtifact(pkg.Id, a)">
                                    <!-- TODO: may extract a component -->
                                    <span>{{ a.TechID }}@{{ a.Version }}</span>
                                    <template v-if="isArtifactSelected(pkg.Id, a)">
                                      <span style="margin-left:2px">✔</span>
                                    </template>
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
                    <n-flex vertical v-if="selArtifactOps.length" style="margin-top:18px">
                      <n-divider dashed title-placement="center"
                        style="margin:0 0 10px 0; font-weight:600; letter-spacing:.5px">
                        Selected Artifacts ({{ selArtifactOps.length }})
                      </n-divider>
                      <n-flex wrap>
                        <n-tag 
                          v-for="(artOp, i) in selArtifactOps"
                          :key="'sel-' + i + '-' + artOp.ArtifactTechID + '@' + artOp.ArtifactVersion" type="info"
                          size="small" :bordered="false">
                          {{ artOp.ArtifactTechID }}@{{ artOp.ArtifactVersion }}
                          <n-tooltip trigger="hover" placement="top">
                            <template #trigger>
                              <n-icon size="18" @click.stop="openArtifactDetails(artOp.Artifact)">
                                <Info16Regular />
                              </n-icon>
                            </template>
                            Show Details
                          </n-tooltip>
                          <n-divider vertical />
                          TR Number:
                          <n-input v-model:value="artOp.TransportRequestNumber" size="tiny" placeholder="TR Number"
                            style="width:80px; margin-left:4px" @click.stop
                            :status="!artOp.TransportRequestNumber ? 'warning' : 'info'" />
                        </n-tag>
                      </n-flex>
                    </n-flex>
                  </n-flex>
                  <n-button type="primary" secondary @click="handleUpdate">Save</n-button>
                  <n-button size="small" tertiary @click="showFlowModal = true">Show Delivery Flow</n-button>
                  <n-button size="small" tertiary @click="onSyncDrStatus">Sync Status</n-button>

                </n-flex>
              </n-card>
            </n-step>

            <n-step>
              <template #title> Approve </template>
              <n-card hoverable size="medium">

              </n-card>

            </n-step>
            <n-step>
              <template #title> Delivery Flow </template>
              <n-card hoverable size="medium">
                <DeliveryFlowView :delivery-request="deliveryRequest" :cpi-tenants="cpiTenants"
                  :tenant-to-ops="tenantToOps" />
              </n-card>
            </n-step>
          </n-steps>
        </n-gi>
        <!-- <n-gi span="2"> Log </n-gi> -->
      </n-grid>
    </n-card>
  </div>
</template>

<script lang="ts">
import {
  GetCpiTenants as GetAllCpiTenants,
  GetDeliveryRequest,
  UpdateDeliveryRequest,
  GetPackages,
  GetPackageArtifacts,
  DeleteDeliveryRequest,
  GetArtifactVersionHistory,
  GetTransportRoutes,
  TenantOps,
  SyncStatus,
} from '@/service/api'
import { toLocalTime } from '@/service/consts'
import { Edit16Regular, Delete28Regular, Info16Regular } from '@vicons/fluent'
import { SaveAltRound, StartTwotone, CancelOutlined } from '@vicons/material'
import IconBtn from '@/components/IconBtn.vue'
import { VueFlow, type Edge, type Node } from '@vue-flow/core'
import CpiTransportNode from '@/components/CpiTransportNode.vue'
import type { DeliveryRequest, CpiTenant, Package, Artifact, ArtifactVersionHistoryItem, ArtifactTenantOperation } from '@/service/model'
import DeliveryFlowView from './DeliveryFlowView.vue'
import CpiTransportFlowView from './CpiTransportFlowView.vue'

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
    CpiTransportNode,
    DeliveryFlowView,
    CpiTransportFlowView,
  },
  props: { planId: { required: true, type: Number } },
  data() {
    return {
      deliveryRequest: {} as DeliveryRequest,
      editing: false,
      current: 0,
      toLocalTime,
      cpiTenants: [] as CpiTenant[],
      tenantPkgs: [] as Package[],
      selectedPackages: [] as Package[],
      packageArtifacts: {} as { [key: string]: Artifact[] }, // packages to their artifacts, this is like a cache for package
      loadingPackages: {} as { [key: string]: boolean },
      expandedPackages: [] as string[],
      selPkgArtifacts: {} as { [key: string]: Artifact[] },  // selected artifacts within each package, [package id, array of artifact]
      packagesLoading: false,
      packagesLoadError: '' as string,
      artifactSearch: {} as { [key: string]: string },
      // artifact details state
      showArtifactDetails: false,
      artifactDetail: {} as Artifact | null,
      artifactDetailPkgId: '' as string,
      artifactRawJson: '' as string,
      artifactVersionHistory: [] as ArtifactVersionHistoryItem[],
      showFlowModal: false
    }
  },
  methods: {
    onEdit() {
      this.editing = true
    },
    async refresh() {
      this.editing = false
      this.deliveryRequest = await GetDeliveryRequest(this.planId)
      const sourceOps = this.deliveryRequest.ArtifactTenantOperations.filter(op => op.TenantID === this.deliveryRequest.SourceTenant.ID)
      await Promise.all( // load all artifacts for selected packages
        sourceOps.map(op => this.loadPackageArtifacts(op.Artifact.PackageID))
      )
      sourceOps.map(op => {
        const packageId = op.Artifact.PackageID
        if (!this.selPkgArtifacts[packageId]) this.selPkgArtifacts[packageId] = []

        const findIdx = this.packageArtifacts[packageId]?.findIndex(a => a.TechID === op.ArtifactTechID && a.Version === op.ArtifactVersion)
        if (findIdx < 0) {
          // TODO: handle artifact not found in package, may be deleted or invalid version
        }
        this.selPkgArtifacts[packageId].push(op.Artifact)
      })
    },
    async handleDelete() {
      await DeleteDeliveryRequest(this.planId)
      this.$router.go(-1)
    },
    handleCurrent(current: number) {
      this.current = current
    },
    async fetchPackagesForTenant() {
      const tenant = this.deliveryRequest.SourceTenant.CpiEndpoint.name
      if (!tenant) return
      this.packagesLoading = true
      this.packagesLoadError = ''
      try {
        this.tenantPkgs = await GetPackages(tenant)
      } catch (e: any) {
        this.packagesLoadError = 'Failed to load packages.'
      } finally {
        this.packagesLoading = false
      }
    },
    async handleUpdate() {
      if (!this.deliveryRequest.SourceTenant) {
        window.$message?.warning?.('Please select a source CPI tenant')
        return
      }
      for (const a of this.deliveryRequest.ArtifactTenantOperations) {
        if (!a.TransportRequestNumber || !a.TransportRequestNumber.trim()) {
          window.$message?.warning?.(`Please provide TR Number for artifact ${a.ArtifactTechID}@${a.ArtifactVersion}`)
          return
        }
      }
      await UpdateDeliveryRequest(this.deliveryRequest)
      await this.refresh()
      const routes = await GetTransportRoutes()
    },
    async loadPackageArtifacts(pkgId: string) {
      if (this.packageArtifacts[pkgId]) return // already loaded
      const cpiDest = this.deliveryRequest?.SourceTenant?.CpiEndpoint.name
      if (!cpiDest) return
      this.loadingPackages[pkgId] = true
      this.packageArtifacts[pkgId] = await GetPackageArtifacts(cpiDest, pkgId)
      this.loadingPackages[pkgId] = false
    },
    packageLabel(pkg: Package) {
      return `${pkg.Name} @ ${pkg.Version}`
    },
    filteredArtifacts(pkgId: string): Artifact[] {
      const list = this.packageArtifacts[pkgId] || []
      const kw = (this.artifactSearch[pkgId] || '').trim().toLowerCase()
      if (!kw) return list
      return list.filter(a =>
        a.TechID.toLowerCase().includes(kw) ||
        a.Version.toLowerCase().includes(kw) ||
        (a.Type && a.Type.toLowerCase().includes(kw))
      )
    },
    isArtifactSelected(pkgId: string, a: Artifact) {
      return (this.selPkgArtifacts[pkgId] || []).findIndex(x => x.TechID == a.TechID && x.Version == a.Version) >= 0
    },
    toggleArtifact(pkgId: string, a: Artifact) { // toggle selection of an artifact within a package
      if (!this.selPkgArtifacts[pkgId]) this.selPkgArtifacts[pkgId] = []
      const arr = this.selPkgArtifacts[pkgId]

      const foundIdx = arr.findIndex(x => x.TechID == a.TechID && x.Version == a.Version)
      if (foundIdx >= 0) arr.splice(foundIdx, 1) // clear selection
      else arr.push(a) // select
    },
    selectAllFiltered(pkgId: string) {
      const keys = this.filteredArtifacts(pkgId)
      this.selPkgArtifacts[pkgId] = keys
    },
    clearSelections(pkgId: string) {
      this.selPkgArtifacts[pkgId] = []
    },
    async openArtifactDetails(a: Artifact) {
      this.artifactDetail = a
      this.artifactDetailPkgId = a.PackageID
      this.artifactRawJson = JSON.stringify(a, null, 2)
      this.showArtifactDetails = true

      const cpiTenantUrl = this.deliveryRequest.SourceTenant.CpiEndpoint.url
      const baseUrl = new URL(cpiTenantUrl)
      this.artifactVersionHistory = await GetArtifactVersionHistory(`${baseUrl.protocol}//${baseUrl.host}`, a.PackageID, a.TechID)
      console.log(this.artifactVersionHistory)
    },
    async onSyncDrStatus() {
      if (!this.deliveryRequest.ID) return
      await SyncStatus(this.deliveryRequest.ID)
      await this.refresh()
    },

  },
  watch: {
    selectedPackages(newPkgs: Package[], oldPkgs: Package[]) {
      const removed = (oldPkgs || []).filter(p => !newPkgs.includes(p))
      removed.forEach(p => {
        delete this.packageArtifacts[p.Id]
        delete this.selPkgArtifacts[p.Id]
        this.expandedPackages = this.expandedPackages.filter(id => id !== p.Id)
      })
    },
    expandedPackages(newVal: string[], oldVal: string[]) {
      const added = newVal.filter(id => !(oldVal || []).includes(id))
      added.forEach(id => this.loadPackageArtifacts(id))
    },
    selPkgArtifacts: {
      handler(newVal: { [key: string]: Artifact[] }, oldVal: { [key: string]: Artifact[] }) {
        const newArtis = Object.values(newVal || {}).flat()
        const oldArtis = Object.values(oldVal || {}).flat()
        const added = newArtis.filter(a => !oldArtis.find(o => o.TechID === a.TechID && o.Version === a.Version))
        const removed = oldArtis.filter(a => !newArtis.find(n => n.TechID === a.TechID && n.Version === a.Version))

        const sourceOps = this.deliveryRequest.ArtifactTenantOperations?.filter(op =>
          op.TenantID === this.deliveryRequest.SourceTenant?.ID
        ) || []
        const all = this.deliveryRequest.ArtifactTenantOperations

        const remove = removed
          .filter(a => {
            const op = sourceOps.find(op => op.ArtifactTechID === a.TechID && op.ArtifactVersion === a.Version) || {} as ArtifactTenantOperation
            return op.RequestState === 'NOT_REQUESTED' // can only remove not requested artifacts. Other states are in delivery process
          })
          .map(a => all.find(op => op.ArtifactTechID === a.TechID && op.ArtifactVersion === a.Version)?.ID ?? 0) // NOTE: if remove, should also remove target tenant ops meanwhile
          .filter(i => i>0)  // removed operations IDs

        this.deliveryRequest.ArtifactTenantOperations = this.deliveryRequest.ArtifactTenantOperations.filter(op => !remove.includes(op.ID))

        const add = added
        .filter(a => 
          !sourceOps.find(op => op.ArtifactTechID === a.TechID && op.ArtifactVersion === a.Version) // only add if not exists
        )
        .map(a => ({  // add new operation
            ID: 0,
            DeliveryRequestID: this.deliveryRequest.ID,
            ArtifactTechID: a.TechID,
            ArtifactVersion: a.Version,
            Artifact: a,
            TenantID: this.deliveryRequest.SourceTenant.ID,
            Tenant: this.deliveryRequest.SourceTenant,
            RequestState: "NOT_REQUESTED",
          } as ArtifactTenantOperation))
        this.deliveryRequest.ArtifactTenantOperations.push(...add)
      },
      deep: true,
    }
  },
  computed: {
    packageOptions() {
      return this.tenantPkgs.map(pkg => ({ label: `${pkg.Name} @ ${pkg.Version}`, value: pkg }))
    },
    selArtifactOps(): ArtifactTenantOperation[] {
      const ops = this.deliveryRequest.ArtifactTenantOperations || []
      const srcTenantId = this.deliveryRequest?.SourceTenant.ID
      return ops.filter((op: ArtifactTenantOperation) => op.TenantID === srcTenantId)
    },
    tenantToOps(): { [key: number]: { [key: string]: ArtifactTenantOperation } } { // only used in delivert flow view
      if (!this.deliveryRequest.SourceTenant) return {}
      return TenantOps(this.deliveryRequest.ArtifactTenantOperations) // cpi tenant ID - map[trNumber]ArtifactTenantOperation
    },
  },
  async created() {
    await this.refresh()
    this.cpiTenants = await GetAllCpiTenants()
    await this.fetchPackagesForTenant()
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
