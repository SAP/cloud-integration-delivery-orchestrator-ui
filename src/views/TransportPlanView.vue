<template>
  <n-modal v-model:show="showModal" preset="dialog" >
    <template #header> Create Delivery Plan </template>
    <n-flex class="table-class" vertical align="start" v-if="current > 0">
      <!-- List Cpi Tenants -->
      <n-text depth="3" strong>Choose Source Cpi Tenant:</n-text>
      <n-select @update:value="handleSelectSourceCpiTenant" :options="cpiTenantsOptions" filterable/>
      <div v-if="deliveryRequest.SourceTenant">
        <n-flex vertical>
          <n-flex vertical style="gap: 12px">
            <div>
              <n-text depth="3" strong>Tenant: </n-text>
              <n-tag type="info" :bordered="false">
                  #{{ deliveryRequest.SourceTenant.ID }} {{ deliveryRequest.SourceTenant.Name }}
              </n-tag>
            </div>

            <div v-if="deliveryRequest.SourceTenant.TransportNode">
              <n-text depth="3" strong>Transport Node</n-text>
              <div style="margin-top: 4px">
                <n-tag type="success" :bordered="false">
                  #{{ deliveryRequest.SourceTenant.TransportNode.id }}
                  {{ deliveryRequest.SourceTenant.TransportNode.name }} -
                  {{ deliveryRequest.SourceTenant.TransportNode.description }}
                </n-tag>
              </div>
            </div>

            <div v-if="deliveryRequest.SourceTenant.CpiEndpoint">
              <n-text depth="3" strong>CPI Endpoint</n-text>
              <div style="margin-top: 4px">
                <n-tag type="warning" :bordered="false">
                  {{ deliveryRequest.SourceTenant.CpiEndpoint.name }}({{ deliveryRequest.SourceTenant.CpiEndpoint.url }})
                </n-tag>
              </div>
            </div>
          </n-flex>
        </n-flex>
      </div>
      <!-- Packages in this cpi tenant -->

      <div v-if="deliveryRequest.SourceTenant">
        <n-text depth="3" strong>Packages:</n-text>
        <n-select
          v-model:value="selectedPackageIds"
          :options="packagesOptions"
          multiple
          clearable
          filterable
          placeholder="Select packages from this tenant"
          style="margin-top: 6px; width: 420px"
        />
        <div v-if="selectedPackageIds.length" style="margin-top:12px; width:100%">
          <n-text depth="3" strong>Artifacts (select to include):</n-text>
          <n-collapse v-model:expanded-names="expandedPackages" style="margin-top:6px">
            <n-collapse-item
              v-for="pkgId in selectedPackageIds"
              :key="pkgId"
              :name="pkgId"
              :title="packageLabel(pkgId)"
            >
              <n-spin :show="loadingPackages[pkgId]">
                <n-empty v-if="!loadingPackages[pkgId] && (packageArtifacts[pkgId] || []).length === 0" description="No artifacts" />
                <n-checkbox-group
                  v-model:value="artifactSelections[pkgId]"
                  @update:value="updateArtifactsFromSelection"
                  v-if="(packageArtifacts[pkgId] || []).length"
                >
                  <n-space item-style="display:flex" wrap>
                    <n-checkbox
                      v-for="a in packageArtifacts[pkgId] || []"
                      :key="pkgId + '-' + a.Id + '@' + a.Version"
                      :value="artifactKey(a)"
                      :label="a.Id + '@' + a.Version"
                    />
                  </n-space>
                </n-checkbox-group>
              </n-spin>
            </n-collapse-item>
          </n-collapse>
          <div v-if="selectedArtifacts.length" style="margin-top:10px">
            <n-text depth="3" strong>Selected Artifacts:</n-text>
            <div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:6px">
              <n-tag
                v-for="(a, i) in selectedArtifacts"
                :key="'sel-' + i + '-' + a.Id + '@' + a.Version"
                type="info"
                size="small"
                :bordered="false"
              >{{ a.Id }}@{{ a.Version }}</n-tag>
            </div>
          </div>
        </div>
      </div>
    </n-flex>
    <template #action>
      <n-button @click="handleGenerate">Generate</n-button>
    </template>
  </n-modal>

  <div style="margin: 0 42px">
    <!-- head -->
    <n-card class="header-card-shadow-class">
      <n-grid x-gap="10" :cols="5">
        <!-- transport plan name and desctiption -->
        <n-gi>
          <n-flex vertical>
            <!-- plan name -->
            <n-input
              class="ui5-title-root"
              v-model:value="deliveryRequest.Name"
              placeholder="Transport Plan Name"
              clearable
              autofocus
              v-if="editing"
            />
            <span class="ui5-title-root" v-else-if="deliveryRequest.Name">
              <n-text depth="3"> Transport Plan Name: </n-text>
              {{ deliveryRequest.Name }}
            </span>
            <!-- plan JIRA link -->
            <n-input
              v-model:value="deliveryRequest.JiraLink"
              placeholder="Transport Plan Description"
              size="large"
              clearable
              v-if="editing"
            />
            <n-text style="font-weight: bold" v-else-if="deliveryRequest.JiraLink">
              {{ deliveryRequest.JiraLink }}
            </n-text>
          </n-flex>
        </n-gi>

        <!-- transport plan basic information -->
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
        <!-- transport plan status tag -->
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

          <!-- Submit Button -->
          <IconBtn tip="Save" :handler="handleSave" v-if="editing">
            <SaveAltRound />
          </IconBtn>
        </n-gi>
      </n-grid>
    </n-card>

    <!-- step list with config view -->
    <n-card class="card-shadow-class">
      <div style="margin-bottom: 15px; font-size: 15px; font-weight: bold">
        Transport Plan <n-gradient-text type="success">#{{ deliveryRequest.ID }}</n-gradient-text>
      </div>
      <n-grid x-gap="40" :cols="5">
        <!-- step lists -->
        <n-gi span="3">
          <n-steps vertical :current="current" @update:current="handleCurrent">
            <!-- parse yaml step -->
            <n-step @click="showModal = true">
              <template #title> Create Delivery Plan </template>
              <n-card hoverable size="medium">
                <n-text depth="3" style="font-size: medium">Source CPI Tenant: </n-text>
                <n-text strong>
                  <!-- {{ deliveryRequest.SourceTenant.Name }} #{{ deliveryRequest.SourceTenant.ID }} -->
                </n-text>
                <n-gradient-text type="success" :size="18">
                  <!-- #{{ deliveryRequest.SourceTenant.ID }} -->
                </n-gradient-text>
                <div />
                <n-text depth="3" style="font-size: medium"> Artifacts: </n-text>

                <div />
                <n-tag
                  v-for="(artifact, i) in deliveryRequest.Artifacts"
                  :key="i"
                  :bordered="false"
                  type="info"
                  style="margin-right: 5px"
                >
                  {{ artifact.Id }}:{{ artifact.Version }}
                </n-tag>
              </n-card>
            </n-step>
          </n-steps>
        </n-gi>
        <n-gi span="2"> Log </n-gi>
      </n-grid>
    </n-card>
  </div>
</template>

<script lang="ts">
import {
  DeleteTransportPlan,
  GenImportJob,
  GetCpiTenants,
  GetDeliveryRequest,
  UpsertDeliveryRequest,
  GetPackages,
  GetPackageArtifacts,
  type CpiTenant,
  type DeliveryRequest,
  type Package,
  type Artifact
} from '@/service/api'
import { toLocalTime } from '@/service/consts'
import { Edit16Regular, Delete28Regular } from '@vicons/fluent'
import { SaveAltRound, StartTwotone, CancelOutlined } from '@vicons/material'
import IconBtn from '@/components/IconBtn.vue'
export default {
  name: 'TransportPlanView',
  components: {
    Edit16Regular,
    Delete28Regular,
    SaveAltRound,
    StartTwotone,
    CancelOutlined,
    IconBtn
  },
  props: { planId: { required: true, type: Number } },
  data() {
    return {
      showModal: false,
      deliveryRequest: {} as DeliveryRequest,
      editing: false,
      current: 0,
      toLocalTime,
      cpiTenantsOptions: [] as { label: string; value: CpiTenant }[],
      transportNodes: [],
      packageOptions: [] as Package[],
      selectedPackageIds: [] as string[],
      packageArtifacts: {} as Record<string, Artifact[]>,
      loadingPackages: {} as Record<string, boolean>,
      expandedPackages: [] as string[],
      artifactSelections: {} as Record<string, string[]>,
    }
  },
  methods: {
    onEdit() {
      this.editing = true
    },
    async refresh() {
      this.editing = this.showModal = false
      this.deliveryRequest = await GetDeliveryRequest(this.planId)
    },
    async handleDelete() {
      await DeleteTransportPlan(this.planId)
      this.$router.go(-1)
    },
    async handleSave() {
      this.editing = false
      await UpsertDeliveryRequest(this.deliveryRequest)
      await this.refresh()
    },
    handleCurrent(current: number) {
      this.current = current
    },
    async handleSelectSourceCpiTenant(tenant: CpiTenant) {
      this.deliveryRequest.SourceTenant = tenant
      this.selectedPackageIds = []
      try {
        this.packageOptions = await GetPackages(tenant.CpiEndpoint.name)
      } catch (e) {
        window.$message?.error?.('Failed to fetch packages')
      }
      this.packageArtifacts = {}
      this.expandedPackages = []
      this.artifactSelections = {}
      this.updateArtifactsFromSelection()
    },
    async handleGenerate() {
    },
    async handleGenImportJob() {
      // generate import job
      await GenImportJob(this.deliveryRequest.ID)
      await this.refresh()
    },
    async loadPackageArtifacts(pkgId: string) {
      if (!this.deliveryRequest.SourceTenant) return
      if (this.packageArtifacts[pkgId]) return // already loaded
      const tenantKey = this.deliveryRequest.SourceTenant.CpiEndpoint.name
  this.loadingPackages[pkgId] = true
      try {
        const artifacts = await GetPackageArtifacts(tenantKey, pkgId)
        this.packageArtifacts[pkgId] = artifacts
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
    packageLabel(pkgId: string) {
      const pkg = this.packageOptions.find(p => p.Id === pkgId)
      return pkg ? `${pkg.Name} @ ${pkg.Version}` : pkgId
    },
    artifactKey(a: Artifact) { return `${a.Id}@${a.Version}` }
  },
  watch: {
    selectedPackageIds(newVal: string[], oldVal: string[]) {
      // remove unselected packages data
      const removed = (oldVal || []).filter(id => !newVal.includes(id))
      removed.forEach(id => {
        delete this.packageArtifacts[id]
        delete this.artifactSelections[id]
        this.expandedPackages = this.expandedPackages.filter(p => p !== id)
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
    }
  },
  computed: {
    packagesOptions() {
      return this.packageOptions.map(p => ({ label: `${p.Name} @ ${p.Version}`, value: p.Id }))
    },
    selectedArtifacts(): Artifact[] {
      return this.deliveryRequest.Artifacts || []
    }
  },
  async created() {
    await this.refresh()
    const cpiTenants = await GetCpiTenants()
    this.cpiTenantsOptions = cpiTenants.map((tenant: CpiTenant) => ({ label: tenant.Name, value: tenant }))
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
