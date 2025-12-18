<template>
  <!-- Modals -->
  <!-- Flow Modal -->
  <n-modal v-model:show="showFlowModal" preset="dialog" title="Delivery Flow" :closable="true" :mask-closable="true"
    style="width: 80%; height: 80%;">
    <CpiTransportFlowView :delivery-request="deliveryRequest" :cpi-tenants="cpiTenants" :tenant-to-ops="tenantToOps" />
  </n-modal>
  <!-- artifact details modal -->
  <n-modal v-model:show="showArtifactDetails" preset="card" style="width: 35%;" size="small" :closable="true"
    :close-on-esc="true" :mask-closable="true">
    <template #header>
      {{ `Artifact Details #${artifactOpDetial.ID}` }}
      <n-tag round size="small" type="warning"
        v-show="draftSourceOps.find(d => d.op.ID === artifactOpDetial.ID)">DRAFT</n-tag>
      <n-tag round size="small" type="success"
        v-show="addOps.find(a => a.ArtifactTechID === artifactOpDetial.ArtifactTechID && a.ArtifactVersion === artifactOpDetial.ArtifactVersion)">
        NEW
      </n-tag>
    </template>
    <n-flex vertical style="gap:12px">
      <div style="display:flex; gap:16px; flex-wrap:wrap">
        <div>
          <n-text depth="3" strong>Package</n-text>
          <div style="margin-top:4px">{{ artifactDetail.PackageID }}</div>
        </div>
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
        <div>
          <n-text depth="3" strong>Description</n-text>
          <div style="margin-top:4px">{{ artifactDetail.Description }}</div>
        </div>
      </div>
      <!-- Version history -->
      <n-flex vertical>
        <n-flex>
          <n-text depth="3" strong>Version History</n-text>
          <n-button type="info" strong tertiary v-if="!loadingArtifactHistory && !artifactVersionHistory.length"
            @click="loadVersionHistory">Load</n-button>
        </n-flex>
        <div v-if="loadingArtifactHistory">
          <n-skeleton text style="width: 60%; margin-top:8px" :repeat="3" />
        </div>
        <div v-else v-for="h in artifactVersionHistory">
          {{ h.comment }} - {{ h.createdBy }} - {{ h.semanticVersion }} - {{ h.createdDate }}
        </div>
      </n-flex>
      <n-divider :style="{ margin: 5 + 'px' }" dashed />
      <!-- ops details -->
      <n-flex vertical v-if='Object.keys(artifactOpDetial).length'>
        <n-flex>
          <div>
            <n-text depth="3" strong>Request State</n-text>
            <div style="margin-top:4px">{{ artifactOpDetial.RequestState }}</div>
          </div>
          <div>
            <n-text depth="3" strong>Import State</n-text>
            <div style="margin-top:4px">{{ artifactOpDetial.ImportState }}</div>
          </div>
          <div>
            <n-text depth="3" strong>Deploy State</n-text>
            <div style="margin-top:4px">{{ artifactOpDetial.DeployState }}</div>
          </div>
        </n-flex>
        <!-- Transport Request Number -->
        <n-text depth="3" strong>Transport Request Number</n-text>
        <n-flex>
          <n-text v-if="!isEditingTr">
            {{ editingTrNumber || '-' }}
          </n-text>
          <n-input v-show="isEditingTr" v-model:value="editingTrNumber" size="small" style="width:90px"
            placeholder="TR number" @keyup.enter="checkTr(artifactOpDetial)" />
          <n-button tertiary round type="info" v-show="!isEditingTr" @click="isEditingTr = true"
            aria-label="Edit TR">edit</n-button>
          <n-button tertiary round type="info"
            v-show="isEditingTr && draftSourceOps.find(d => d.op.ID === artifactOpDetial.ID)"
            @click="revertTr">revert</n-button>
          <n-button tertiary round type="info" :loading="checkingTrLoading" v-show="isEditingTr"
            @click="checkTr(artifactOpDetial)">
            check
          </n-button>
          <n-button tertiary round type="info" v-show="isEditingTr"
            @click="{ isEditingTr = false; editingTrNumber = artifactOpDetial.TransportRequestNumber }">
            cancel
          </n-button>
          <n-button tertiary round type="info">auto generate</n-button>
        </n-flex>

      </n-flex>

      <n-flex inline>
        <n-button size="small" type="info" secondary @click="toggleArtifact(artifactDetail.PackageID, artifactDetail)">
          {{ isArtifactSelected(artifactDetail.PackageID, artifactDetail) ? 'Unselect' : 'Select' }}
        </n-button>
        <n-button size="small" type="info" secondary>
          Disable
        </n-button>
      </n-flex>
    </n-flex>

  </n-modal>
  <!-- end modal -->

  <ui5-dynamic-page id="page" show-footer>
    <ui5-dynamic-page-title slot="titleArea">
      <ui5-breadcrumbs slot="breadcrumbs">
        <ui5-breadcrumbs-item href="#">Man</ui5-breadcrumbs-item>
        <ui5-breadcrumbs-item href="#">Shoes</ui5-breadcrumbs-item>
        <ui5-breadcrumbs-item href="#">Running Shoes</ui5-breadcrumbs-item>
      </ui5-breadcrumbs>

      <ui5-title slot="heading">{{ deliveryRequest.Name }}</ui5-title>

      <div slot="snappedHeading" class="snapped-title-heading">
        <ui5-avatar shape="square" icon="laptop" color-scheme="Accent5" size="S"></ui5-avatar>
        <ui5-title wrapping-type="None">{{ deliveryRequest.Name }}</ui5-title>
      </div>

      <p slot="subheading" class="text">#{{ deliveryRequest.ID }}</p>
      <p slot="snappedSubheading" class="text">#{{ deliveryRequest.ID }}</p>

      <ui5-tag color-scheme="7" wrapping-type="None">{{ deliveryRequest.AggregateStatus }}</ui5-tag>

      <ui5-toolbar class="actionsBar" id="actionsToolbar" slot="actionsBar" design="Transparent">
        <ui5-toolbar-button text="Edit" @click="onEditDr" v-if="!isEditingDr"></ui5-toolbar-button>
        <ui5-toolbar-button design="Transparent" text="Delete" @click="deleteDr"
          v-if="!isEditingDr"></ui5-toolbar-button>
        <ui5-toolbar-button text="Save" @click="updateDr" v-if="isEditingDr"></ui5-toolbar-button>
        <ui5-toolbar-button design="Transparent" text="Cancel" @click="refresh" v-if="isEditingDr"></ui5-toolbar-button>
      </ui5-toolbar>

      <ui5-toolbar class="navigationBar" slot="navigationBar" design="Transparent">
        <ui5-toolbar-button design="Transparent" icon="share"></ui5-toolbar-button>
        <ui5-toolbar-button design="Transparent" icon="action-settings"></ui5-toolbar-button>
      </ui5-toolbar>
    </ui5-dynamic-page-title>

    <ui5-dynamic-page-header slot="headerArea">
      <div class="product-info">
        <ui5-avatar id="avatar" shape="square" icon="laptop" color-scheme="Accent5" size="L"></ui5-avatar>
        <div class="product-info-cell">
          <ui5-label>Version/Delivery</ui5-label>
          <p class="text availability">{{ deliveryRequest.DeliveryRule?.Name }}</p>
        </div>
        <div class="product-info-cell">
          <ui5-label>JIRA</ui5-label>
          <p class="text price">
            <a :href="deliveryRequest.JiraLink" target="_blank" rel="noopener noreferrer">
              {{ jira }}
            </a>
          </p>
        </div>
        <div class="product-info-cell">
          <ui5-label>Created By</ui5-label>
          <p class="text product-description">
            {{ uaaUsers[deliveryRequest.CreatedBy]?.email ?? (uaaUserInfo(deliveryRequest.CreatedBy), '') }}
            {{ toLocalTime(deliveryRequest.CreatedAt) }}
          </p>
        </div>
        <div class="product-info-cell">
          <ui5-label>Updated By</ui5-label>
          <p class="text product-description">
            {{ uaaUsers[deliveryRequest.UpdatedBy]?.email ?? (uaaUserInfo(deliveryRequest.UpdatedBy), '') }}
            {{ toLocalTime(deliveryRequest.UpdatedAt) }}
          </p>
        </div>
      </div>
    </ui5-dynamic-page-header>
    <div>
      <!-- Generate Delivery Request -->
      <n-card class="card-shadow-class">
        <n-grid x-gap="40" :cols="5">
          <!-- step lists -->
          <n-gi span="4">
            <n-steps vertical :current="current" @update:current="handleCurrent">
              <!-- parse yaml step -->
              <n-step>
                <template #title> Prepare </template>
                <n-card hoverable size="medium">
                  <n-flex vertical v-if="!deliveryRequest.SourceTenant">
                    <n-skeleton text height="20px" style="width: 40%" />
                    <n-skeleton text height="20px" style="width: 50%" />
                    <n-skeleton text height="20px" style="width: 60%" />

                  </n-flex>
                  <n-flex vertical v-else style="gap:8px">
                    <!-- cpi tenants selection -->
                    <n-divider dashed title-placement="center"
                      style="margin:0 0 10px 0; font-weight:600; letter-spacing:.5px">
                      Source CPI Tenant
                    </n-divider>
                    <n-flex justify="center">
                      <n-text depth="3" strong>
                        {{ deliveryRequest.SourceTenant.Name }} #{{ deliveryRequest.SourceTenant.ID }}
                        <n-divider vertical />
                      </n-text>
                      <n-text depth="3" strong>
                        <a :href="cpiTenantLink" target="_blank" rel="noopener noreferrer">
                          {{ cpiTenantLink }}
                        </a>
                      </n-text>

                    </n-flex>

                    <!-- packages & artifacts section -->
                    <n-divider dashed title-placement="center"
                      style="margin:0 0 10px 0; font-weight:600; letter-spacing:.5px">
                      Packages({{ selectedPackages.length }})
                    </n-divider>
                    <div style="margin-top:6px">
                      <!-- Loading Skeleton -->
                      <div v-if="packagesLoading" style="max-width:420px">
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
                          :title="`${pkg.Name} - ${pkg.Version}`">
                          <n-flex vertical v-if="loadingPackages[pkg.Id]" style="padding:4px 0">
                            <n-skeleton text style="width:55%" :repeat="1" />
                            <n-skeleton text style="width:70%; margin-top:6px" :repeat="1" />
                          </n-flex>
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
                                    size="medium" @click="toggleArtifact(pkg.Id, a)">
                                    <span>{{ a.TechID }}@{{ a.Version }}</span>
                                    <template v-if="isArtifactSelected(pkg.Id, a)">
                                      <span style="margin-left:2px">✔</span>
                                    </template>
                                    <n-popover trigger="hover" placement="top">
                                      <template #trigger>
                                        <n-icon size="18" @click.stop="openArtifactDetails(a)">
                                          <Info16Regular />
                                        </n-icon>
                                      </template>
                                      <n-text depth="3" strong>Show Details</n-text>
                                    </n-popover>
                                  </n-tag>
                                </div>
                              </n-scrollbar>
                            </div>
                          </div>
                        </n-collapse-item>
                      </n-collapse>
                    </div>
                    <!-- selected Artifacts list -->
                    <n-flex vertical v-if="selArtifactOps.length || deleteOps.length" style="margin-top:18px">
                      <n-divider dashed title-placement="center"
                        style="margin:0 0 10px 0; font-weight:600; letter-spacing:.5px">
                        Selected Artifacts ({{ selArtifactOps.length }})
                      </n-divider>
                      <n-flex vertical>
                        <n-spin :show="updatingOps" :delay="500">
                          <!-- old(source) artifacts + draft source artifacts -->
                          <n-flex>
                            <ArtifactOpTag v-for="(op, i) in sourceOps" :i="i" :art-op="op" :stage-type="stateType(op)"
                              @open-artifact-details="openArtifactDetails" />
                          </n-flex>
                          <!-- artifacts to be added -->
                          <n-flex vertical>
                            <n-text type="success" depth="3" strong v-if="addOps && addOps.length > 0">New: </n-text>
                            <n-flex>
                              <ArtifactOpTag v-for="(op, i) in addOps" :i="i" :art-op="op" :stage-type="stateType(op)"
                                @open-artifact-details="openArtifactDetails" />
                            </n-flex>
                          </n-flex>
                          <!-- artifacts to be deleted -->
                          <n-flex vertical>
                            <n-text type="error" depth="3" strong v-if="deleteOps && deleteOps.length > 0">To be
                              Deleted:
                            </n-text>
                            <n-flex>
                              <ArtifactOpTag v-for="(op, i) in deleteOps" :i="i" :art-op="op"
                                :stage-type="stateType(op)" @open-artifact-details="openArtifactDetails" />
                            </n-flex>
                          </n-flex>
                        </n-spin>
                      </n-flex>
                      <n-button type="info" ghost strong @click="updateDr"> Update </n-button>
                    </n-flex>
                  </n-flex>
                </n-card>
              </n-step>

              <n-step>
                <template #title> Approve </template>
                <n-card hoverable size="medium">
                  <n-skeleton v-if="approveInfo.loading" style="width: 50%;" />
                  <n-flex vertical v-else-if="!deliveryRequest.ApprovedBy">
                    <n-auto-complete style="width: 40%;" :options="approverOptions" :loading="searchApproverLoading"
                      :value="searchApprover" placeholder="Search Approvers"
                      @update:value="(v: string) => { searchApprover = v; handleSearchArrover(v) }"
                      @select="(v: UserInfo) => { handleSelectApprover(v) }" clearable clear-after-select />
                    <n-text depth="3" strong>Approvers:</n-text>
                    <n-flex>
                      <span v-for="(user_id, _) in deliveryRequest.Approvers">
                        <n-spin v-if="!(uaaUsers[user_id]?.email ?? (uaaUserInfo(user_id), ''))" :size="15" />
                        <n-tag v-else closable @close="handleUnselectApprover(user_id)">
                          {{ uaaUsers[user_id]?.email }}
                        </n-tag>
                      </span>

                    </n-flex>

                    <n-flex style="margin-top:20px">
                      <!-- Approve/Skip Approval button -->
                      <n-popover trigger="hover">
                        <template #trigger>
                          <n-button strong :disabled="approveInfo.disable" :type="approveInfo.disable ? 'error' : 'info'"
                            ghost @click="handleApprove">
                            {{ approveInfo.display }}
                          </n-button>
                        </template>
                        <n-text strong depth="3" v-if="approveInfo.disable">Cannot approve your own request</n-text>
                        <n-text strong depth="3" v-else>Force Deliver</n-text>
                      </n-popover>
                      <n-button v-if="deliveryRequest.Approvers" ghost type="info" @click="handleRequestApprove">Send To
                        Approvers</n-button>

                    </n-flex>
                  </n-flex>
                  <n-flex vertical v-else>
                    <n-text depth="3" strong type="success">
                      Approved By
                      {{ uaaUsers[deliveryRequest.ApprovedBy]?.email ?? (uaaUserInfo(deliveryRequest.ApprovedBy), '') }}
                    </n-text>
                  </n-flex>
                </n-card>

              </n-step>
              <n-step>
                <template #title>
                  Delivery Flow
                  <n-button type="info" ghost size="small" @click="onSyncDrStatus" style="margin: 0 20px;">Sync
                    Status</n-button>
                  <n-button type="info" ghost size="small" @click="showFlowModal = true"
                    :disabled="loadingCpiTenants">Show Detail</n-button>
                </template>
                <n-flex v-if="loadingCpiTenants" vertical>
                  <n-skeleton style="width: 50%;" />
                  <n-skeleton style="width: 60%;" />
                  <n-skeleton style="width: 70%;" />
                </n-flex>
                <n-card v-else hoverable size="large">
                  <DeliveryFlowView :delivery-request="deliveryRequest" :cpi-tenants="cpiTenants"
                    :tenant-to-ops="tenantToOps" />
                </n-card>
              </n-step>
            </n-steps>
          </n-gi>
          <n-gi span="2">
            Log
            <n-flex vertical>
              <n-alert v-for="(condition, i) in deliveryRequest.Conditions" :key="i">
                {{ condition.State }} - {{ condition.Message }}
              </n-alert>
            </n-flex>
          </n-gi>
        </n-grid>
      </n-card>
    </div>
  </ui5-dynamic-page>
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
  TenantOps,
  SyncStatus,
  DeleteOps,
  InsertOps,
  UpdateOps,
  UaaEmailSearch,
  RequestApprove,
  Approve,
  UaaUserInfo,
  CheckTrExistence,
  CurrentUser,
} from '@/service/api'
import { toLocalTime } from '@/service/consts'
import { Edit16Regular, Delete28Regular, Info16Regular } from '@vicons/fluent'
import { SaveAltRound, StartTwotone, CancelOutlined } from '@vicons/material'
import IconBtn from '@/components/IconBtn.vue'
import { VueFlow } from '@vue-flow/core'
import CpiTransportNode from '@/components/CpiTransportNode.vue'
import type { DeliveryRequest, CpiTenant, Package, Artifact, ArtifactVersionHistoryItem, ArtifactTenantOperation, UserInfo } from '@/service/model'
import DeliveryFlowView from './DeliveryFlowView.vue'
import CpiTransportFlowView from './CpiTransportFlowView.vue'
import ArtifactOpTag from '@/components/ArtifactOpTag.vue'
import { nextTick } from 'vue'


import "@ui5/webcomponents-fiori/dist/DynamicPage.js";
import "@ui5/webcomponents-fiori/dist/DynamicPageTitle.js";
import "@ui5/webcomponents-fiori/dist/DynamicPageHeader.js";

import "@ui5/webcomponents/dist/Bar.js";
import "@ui5/webcomponents/dist/Label.js";
import "@ui5/webcomponents/dist/Tag.js";
import "@ui5/webcomponents/dist/Breadcrumbs.js";
import "@ui5/webcomponents/dist/BreadcrumbsItem.js";
import "@ui5/webcomponents/dist/Title.js";
import "@ui5/webcomponents/dist/Toolbar.js";
import "@ui5/webcomponents/dist/ToolbarButton.js";
import "@ui5/webcomponents/dist/Avatar.js";
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/List.js";
import "@ui5/webcomponents/dist/ListItemStandard.js";


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
    ArtifactOpTag,
  },
  props: { planId: { required: true, type: Number } },
  data() {
    return {
      deliveryRequest: {} as DeliveryRequest,
      isEditingDr: false,
      current: 0,
      toLocalTime,
      isEditingTr: false,
      cpiTenants: [] as CpiTenant[],
      tenantPkgs: [] as Package[],
      selectedPackages: [] as Package[],
      packageArtifacts: {} as { [key: string]: Artifact[] }, // packages to their artifacts, this is like a cache for package
      loadingPackages: {} as { [key: string]: boolean },
      expandedPackages: [] as string[],
      selPkgArtifacts: {} as { [key: string]: Artifact[] },  // selected artifacts within each package, [package id, array of artifact]
      packagesLoading: false,
      artifactSearch: {} as { [key: string]: string },
      // artifact details state
      showArtifactDetails: false,
      artifactDetail: {} as Artifact,
      artifactOpDetial: {} as ArtifactTenantOperation,
      artifactVersionHistory: [] as ArtifactVersionHistoryItem[],
      editingTrNumber: '' as string, // tr number being edited, will assign to artifactOpDetial when saved
      checkingTrLoading: false,
      draftSourceOps: [] as { op: ArtifactTenantOperation, newTr: string, oldTr: string }[], // operations being drafted (source ops only)
      loadingArtifactHistory: false,
      showFlowModal: false,
      deleteOps: [] as ArtifactTenantOperation[], // indexes of operations to be deleted
      addOps: [] as ArtifactTenantOperation[],
      // handle approvers
      searchApproverLoading: false,
      approverOptions: [] as { label: string; value: UserInfo }[],
      searchTimer: null as number | null,
      searchApprover: '',
      uaaUsers: {} as { [key: string]: UserInfo }, // userId - userEmail
      currentUser: {} as UserInfo,
      loadingCpiTenants: true,
      updatingOps: false,
    }
  },
  methods: {
    handleUnselectApprover(user_id: string) {
      if (!this.deliveryRequest.Approvers) return
      const idx = this.deliveryRequest.Approvers.indexOf(user_id)
      if (idx > -1) this.deliveryRequest.Approvers.splice(idx, 1)
    },
    async uaaUserInfo(userId: string) {
      if (this.uaaUsers[userId]) return this.uaaUsers[userId]
      return this.uaaUsers[userId] = await UaaUserInfo(userId)
    },
    handleSearchArrover(query: string) {
      this.approverOptions = []
      if (!query || !query.trim()) return
      this.searchTimer && (clearTimeout(this.searchTimer), this.searchTimer = null)
      this.searchTimer = setTimeout(async () => {
        this.searchApproverLoading = true
        const options = await UaaEmailSearch(query)
        this.approverOptions = options.map(a => ({ label: `${a.email}(${a.userName})`, value: a }))
        this.searchApproverLoading = false
      }, 800)
    },
    handleSelectApprover(user: UserInfo) {
      if (!this.deliveryRequest.Approvers) this.deliveryRequest.Approvers = []
      if (this.deliveryRequest.Approvers.includes(user.id)) return
      this.deliveryRequest.Approvers.push(user.id)
    },
    async handleRequestApprove() {
      if (!this.deliveryRequest.Approvers || !this.deliveryRequest.Approvers.length) {
        window.$message?.warning?.('Please select at least one approver before sending approval request.')
        return
      }
      RequestApprove(this.deliveryRequest.ID, this.deliveryRequest.Approvers, '')
      window.$message?.success?.(`Approval request sent to ${this.deliveryRequest.Approvers.map(a => a).join(', ')}`)
    },
    async handleApprove() {
      await Approve(this.deliveryRequest.ID, '')
      await this.refresh()
      window.$message?.success?.('Delivery Request approved.')
    },
    handleCurrent(current: number) {
      this.current = current
    },
    onEditDr() {
      this.isEditingDr = true
    },
    revertTr() {
      const draft = this.draftSourceOps.find(d => d.op.ID === this.artifactOpDetial.ID)
      this.artifactOpDetial.TransportRequestNumber
        = this.editingTrNumber
        = draft!.oldTr
      this.draftSourceOps = this.draftSourceOps.filter(d => d.op.ID !== draft!.op.ID)
      this.isEditingTr = false
    },
    async refresh() {
      this.isEditingDr = false
      this.deliveryRequest = await GetDeliveryRequest(this.planId)

      // load packages in this cpi tenant
      const cpiEndpoint = this.deliveryRequest.SourceTenant.CpiEndpoint.name
      this.packagesLoading = true
      if (!this.tenantPkgs.length) this.tenantPkgs = await GetPackages(cpiEndpoint)

      await Promise.all( // load all artifacts for selected packages
        this.sourceOps.map(op => this.loadPackageArtifacts(op.Artifact.PackageID))
      )
      this.sourceOps.map(op => {
        const packageId = op.Artifact.PackageID
        if (!this.selPkgArtifacts[packageId]) this.selPkgArtifacts[packageId] = []

        const findIdx = this.packageArtifacts[packageId]?.findIndex(a => a.TechID === op.ArtifactTechID && a.Version === op.ArtifactVersion)
        if (findIdx < 0) {
          // TODO: handle artifact not found in package, may be deleted or invalid version
        }
        this.selPkgArtifacts[packageId].push(op.Artifact)
        const pkg = this.tenantPkgs.find(p => p.Id === packageId)
        if (pkg && !this.selectedPackages.find(p => p.Id === pkg.Id)) this.selectedPackages.push(pkg)
      })
      this.deleteOps = []
      this.addOps = []
      this.draftSourceOps = []
      this.packagesLoading = false
    },
    async deleteDr() {
      await DeleteDeliveryRequest(this.planId)
      this.$router.go(-1)
    },
    async updateDr() {
      if (!this.deliveryRequest.SourceTenant) {
        window.$message?.warning?.('Please select a source CPI tenant')
        return
      }
      for (const a of this.selArtifactOps) {
        if (!a.TransportRequestNumber || !a.TransportRequestNumber.trim()) {
          window.$message?.warning?.(`Please provide TR Number for artifact ${a.ArtifactTechID}@${a.ArtifactVersion}`)
          return
        }
      }
      try {
        this.updatingOps = true
        await nextTick()
        await UpdateDeliveryRequest(this.deliveryRequest)
        const draftOps = UpdateOps(this.deliveryRequest.ID, this.draftSourceOps.map(d => d.op))
        const delOps = DeleteOps(this.deleteOps.map(op => op.ID))
        const insertOps = InsertOps(this.deliveryRequest.ID, this.addOps)
        await Promise.all([delOps, insertOps, draftOps])
      } catch (_) {
        this.updatingOps = false
      }
      this.updatingOps = false
      await this.refresh()
    },
    // check TR number existence
    async checkTr(op: ArtifactTenantOperation) {
      this.checkingTrLoading = true
      const originalTrNumber = op.TransportRequestNumber
      const newTrNumber = this.editingTrNumber.trim() || ''
      op.TransportRequestNumber = newTrNumber
      try {
        await CheckTrExistence(op, this.deliveryRequest.ID)
        const draftOp = this.sourceOps.find(op => op.ID === this.artifactOpDetial.ID) // only ops in source(saved once) can be drafted
        if (!draftOp || originalTrNumber === newTrNumber) return
        const indraft = this.draftSourceOps.map(d => d.op).find(draft => draft.ID === draftOp.ID)
        if (!indraft) {
          this.draftSourceOps.push({ op: draftOp, newTr: newTrNumber, oldTr: originalTrNumber })
        } else {
          indraft.TransportRequestNumber = newTrNumber
        }
      } catch (_) {
        op.TransportRequestNumber = originalTrNumber // revert
      } finally {
        this.checkingTrLoading = false
      }
    },
    async loadPackageArtifacts(pkgId: string) {
      if (this.packageArtifacts[pkgId]) return // already loaded
      const cpiDest = this.deliveryRequest?.SourceTenant?.CpiEndpoint.name
      if (!cpiDest) return
      this.loadingPackages[pkgId] = true
      this.packageArtifacts[pkgId] = await GetPackageArtifacts(cpiDest, pkgId)
      this.loadingPackages[pkgId] = false
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
    async loadVersionHistory() {
      const baseUrl = new URL(this.deliveryRequest.SourceTenant.CpiEndpoint.url)
      this.loadingArtifactHistory = true
      const { PackageID, TechID } = this.artifactDetail || {}
      this.artifactVersionHistory = await GetArtifactVersionHistory(`${baseUrl.protocol}//${baseUrl.host}`, PackageID, TechID)
      console.log(this.artifactVersionHistory)
      this.loadingArtifactHistory = false
    },
    openArtifactDetails(a: Artifact, op?: ArtifactTenantOperation) {
      this.artifactDetail = a
      this.showArtifactDetails = true
      this.artifactVersionHistory = []
      this.artifactOpDetial = op || {} as ArtifactTenantOperation
      this.editingTrNumber = this.artifactOpDetial.TransportRequestNumber
      this.isEditingTr = false
    },
    async onSyncDrStatus() {
      if (!this.deliveryRequest.ID) return
      await SyncStatus(this.deliveryRequest.ID)
      await this.refresh()
    },
    stateType(op: ArtifactTenantOperation) {
      // op request state to tag type mapping('default' | 'primary' | 'info' | 'success' | 'warning' | 'error')
      const delIndex = this.deleteOps.findIndex(delOp => delOp.ArtifactTechID === op.ArtifactTechID && delOp.ArtifactVersion === op.ArtifactVersion)
      if (delIndex >= 0) return 'error' // to be deleted
      const addIndex = this.addOps.findIndex(addOp => addOp.ArtifactTechID === op.ArtifactTechID && addOp.ArtifactVersion === op.ArtifactVersion)
      if (addIndex >= 0) return 'success' // to be added
      const draftIndex = this.draftSourceOps?.findIndex(draftOp => draftOp.op.ID === op.ID)
      if (draftIndex >= 0) return 'warning' // drafted
      if (op.RequestState === 'NOT_REQUESTED') return 'default'
      return 'info'
    }

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
      handler(newVal: { [key: string]: Artifact[] }) {
        const newArtis = Object.values(newVal || {}).flat()
        const oldArtis = this.sourceOps.map(op => op.Artifact)

        const added = newArtis.filter(a => !oldArtis.find(o => o.TechID === a.TechID && o.Version === a.Version))
        const removed = oldArtis.filter(a => !newArtis.find(n => n.TechID === a.TechID && n.Version === a.Version))

        const removeIdx = removed
          .filter(a => {
            const op = this.sourceOps.find(op => op.ArtifactTechID === a.TechID && op.ArtifactVersion === a.Version) || {} as ArtifactTenantOperation
            if (op.RequestState !== 'NOT_REQUESTED')
              window.$message?.warning?.(`Cannot remove artifact ${a.TechID}@${a.Version} as its request state is ${op.RequestState}`)
            return op.RequestState === 'NOT_REQUESTED' // can only remove not requested artifacts. Other states are in delivery process
          })
          .map(a => this.allOps.findIndex(op => op.ArtifactTechID === a.TechID && op.ArtifactVersion === a.Version)) // NOTE: if remove, should also remove all target tenant ops meanwhile
          .filter(i => i > -1)  // removed operations IDs of all tenants
        this.deleteOps = removeIdx.map(i => this.allOps[i]) // operations to be deleted
        // cache ops that will be added
        this.addOps = added
          .map(a => {
            const existingOp = this.addOps.find(op => op.ArtifactTechID === a.TechID && op.ArtifactVersion === a.Version) // avoid duplicate addition
            if (existingOp) return existingOp
            return {  // add new operation
              ID: 0,
              DeliveryRequestID: this.deliveryRequest.ID,
              ArtifactTechID: a.TechID,
              ArtifactVersion: a.Version,
              Artifact: a,
              TenantID: this.deliveryRequest.SourceTenant.ID,
              Tenant: this.deliveryRequest.SourceTenant,
              RequestState: "NOT_REQUESTED",
              ImportState: 'NOT_STARTED',
              DeployState: 'NOT_STARTED',
            } as ArtifactTenantOperation
          })
      },
      deep: true,
    }

  },
  computed: {
    allOps(): ArtifactTenantOperation[] { //will not change unless refresh
      return this.deliveryRequest.ArtifactTenantOperations || []
    },
    sourceOps(): ArtifactTenantOperation[] { // existing operations for source tenant. will not change unless refresh
      return (this.deliveryRequest.ArtifactTenantOperations || []).filter(op => op.TenantID === this.deliveryRequest.SourceTenant.ID)
    },
    packageOptions() {
      return this.tenantPkgs.map(pkg => ({ label: `${pkg.Name} - ${pkg.Version}`, value: pkg }))
    },
    selArtifactOps(): ArtifactTenantOperation[] {
      return [...this.sourceOps.filter(op => this.deleteOps.findIndex(d => d.ID === op.ID) < 0), ...this.addOps]
    },
    tenantToOps(): { [key: number]: { [key: string]: ArtifactTenantOperation } } { // only used in delivert flow view
      return TenantOps(this.allOps) || {} // cpi tenant ID - map[trNumber]ArtifactTenantOperation
    },
    approveInfo(): { disable: boolean, display: string, loading: boolean } {
      const createdBy = this.uaaUsers[this.deliveryRequest.CreatedBy]?.email
      const currentEmail = this.currentUser?.email
      if (!createdBy || !currentEmail) return { loading: true, disable: false, display: 'Approve' }
      const disable = !this.deliveryRequest.DeliveryRule?.SkipApprove && currentEmail === createdBy // disable self approval
      return {
        disable: disable,
        display: disable ? 'Approve' : 'Skip Approval',
        loading: false
      }
    },
    jira(): string {
      const v = this.deliveryRequest.JiraLink || ''
      const match = v.match(/([A-Z]+-\d+)/)
      return match ? match[1] : 'Invalid'
    },
    cpiTenantLink() {
      const tenant = this.deliveryRequest.SourceTenant
      if (!tenant || !tenant.CpiEndpoint) return ''
      const baseUrl = new URL(tenant.CpiEndpoint.url)
      return `${baseUrl.protocol}//${baseUrl.host}/itspaces/shell/design`
    }
  },
  async created() {
    await this.refresh()
    this.loadingCpiTenants = true
    await nextTick()
    this.cpiTenants = await GetAllCpiTenants()
    this.loadingCpiTenants = false
    this.currentUser = await CurrentUser()
  }
}
</script>

<style scoped>
.header-card-shadow-class {
  border-radius: 0.5rem;
  box-shadow:
    0 0 0.125rem 0 rgba(34, 53, 72, 0.2),
    0 0.125rem 0.25rem 0 rgba(34, 53, 72, 0.2);
  /* position: sticky; */
  /* top: 0px; */
  /* z-index: 99; */
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

.text {
  display: inline-block;
  font-size: var(--sapFontSize);
  font-family: var(--sapFontFamily);
  color: var(--sapTextColor);
  line-height: normal;
  white-space: pre-line;
  word-wrap: break-word;
  cursor: text;
  margin: 0;
}

.text:nth-of-type(2) {
  margin-left: 4rem;
}

.product-info {
  display: flex;
  flex-wrap: wrap;
}

.product-info [ui5-avatar],
.product-info .product-info-cell {
  margin-right: 2rem;
  margin-bottom: 1rem;
}

.product-info-cell {
  display: flex;
  gap: 5px;
  flex-direction: column;
}

.product-description {
  display: inline;
  max-width: 300px;
}

.availability {
  font-size: 1.2rem;
  color: var(--sapPositiveTextColor);
}

.price {
  font-size: 1.2rem;
  color: var(--sapTextColor);
}

.actionsBar {
  padding: 0.8rem 0 0 1rem;
}

.navigationBar {
  padding: 0.8rem 0 0 0;
}

.snapped-title-heading {
  display: flex;
  align-items: center;
  position: relative;
}

.snapped-title-heading [ui5-avatar] {
  position: absolute;
  top: 0;
}

.snapped-title-heading [ui5-title] {
  font-family: var(--sapObjectHeader_Title_FontFamily);
  color: var(--sapObjectHeader_Title_TextColor);
  padding: 0.3125rem 0 0 0;
  font-size: var(--sapObjectHeader_Title_SnappedFontSize);
  text-overflow: ellipsis;
  min-width: 0;
  margin-left: 4rem;
}
</style>
