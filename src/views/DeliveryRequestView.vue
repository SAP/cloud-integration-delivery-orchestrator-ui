<template>
  <!-- Modals -->
  <!-- Flow Modal -->
  <ui5-dialog v-if="!loadingCpiTenants" 
    header-text="Delivery Flow" 
    :open="showFlowModal"
    style="width: 70%; height: 80%;" draggable 
    @before-close="showFlowModal = false">
    
    <CpiTransportFlowView style="width: 100%; height: 100%;" :delivery-request="deliveryRequest" :cpi-tenants="cpiTenants" :tenant-to-ops="tenantToOps" />

    <ui5-toolbar slot="footer">
      <ui5-toolbar-button class="dialogCloser" design="Transparent" text="Cancel" @click="showFlowModal = false" />
    </ui5-toolbar>
  </ui5-dialog>


  <ui5-dialog :open="showArtifactDetails" :header-text="`Artifact Details #${artifactOpDetial.ID || ''}`"
    style="width: 40%;" draggable @before-close="showArtifactDetails = false">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <ui5-label>Status: </ui5-label>
      <ui5-tag 
        design="Critical"
        v-show="draftSourceOps.find(d => d.op.ID === artifactOpDetial.ID)">
        DRAFT
      </ui5-tag>
      <ui5-tag 
        design="Positive"
        v-show="addOps.find(a => a.ArtifactTechID === artifactOpDetial.ArtifactTechID && a.ArtifactVersion === artifactOpDetial.ArtifactVersion)">
        NEW
      </ui5-tag>
    </div>


    <div style="display: flex; flex-direction: column; gap:12px">
      <ui5-table overflow-mode="Scroll">
        <ui5-table-header-row slot="headerRow">
          <ui5-table-header-cell min-width="150px">Package ID</ui5-table-header-cell>
          <ui5-table-header-cell min-width="200px">Artifact ID</ui5-table-header-cell>
          <ui5-table-header-cell>Version</ui5-table-header-cell>
          <ui5-table-header-cell v-if="artifactDetail.Type">Type</ui5-table-header-cell>
          <ui5-table-header-cell>Description</ui5-table-header-cell>
        </ui5-table-header-row>
        <ui5-table-row>
          <ui5-table-cell style="word-break: break-all;">{{ artifactDetail.PackageID }}</ui5-table-cell>
          <ui5-table-cell style="word-break: break-all;">{{ artifactDetail.TechID }}</ui5-table-cell>
          <ui5-table-cell>{{ artifactDetail.Version }}</ui5-table-cell>
          <ui5-table-cell v-if="artifactDetail.Type">{{ artifactDetail.Type }}</ui5-table-cell>
          <ui5-table-cell>{{ artifactDetail.Description }}</ui5-table-cell>
        </ui5-table-row>
      </ui5-table>
      <!-- Version history -->
      <div style="display: flex; flex-direction: column;">
        <div style="display: flex; align-items: center; margin: 10px 0">
          <ui5-label>Version History</ui5-label>
          <ui5-button design="Transparent" v-if="!loadingArtifactHistory && !artifactVersionHistory.length"
            @click="loadVersionHistory">Load</ui5-button>
        </div>
        <div v-if="loadingArtifactHistory">
          <ui5-busy-indicator active :delay="0" style="width: 60%; margin-top:8px" />
        </div>
        <ui5-table v-else-if="artifactVersionHistory.length" overflow-mode="Scroll" style="height: 300px;" sticky>
          <ui5-table-header-row slot="headerRow" sticky>
            <ui5-table-header-cell min-width="250px">Comment</ui5-table-header-cell>
            <ui5-table-header-cell>Created By</ui5-table-header-cell>
            <ui5-table-header-cell width="90px">Version</ui5-table-header-cell>
            <ui5-table-header-cell>Date</ui5-table-header-cell>
          </ui5-table-header-row>
          <ui5-table-row v-for="h in artifactVersionHistory" :key="h.semanticVersion">
            <ui5-table-cell>{{ h.comment }}</ui5-table-cell>
            <ui5-table-cell>{{ h.createdBy }}</ui5-table-cell>
            <ui5-table-cell>{{ h.semanticVersion }}</ui5-table-cell>
            <ui5-table-cell>{{ new Date(Number(h.createdDate)).toLocaleString('zh-CN') }}</ui5-table-cell>
          </ui5-table-row>
        </ui5-table>
      </div>
      <!-- ops details -->
      <div style="display: flex; flex-direction: column" v-if='Object.keys(artifactOpDetial).length'>
        <ui5-table>
          <ui5-table-header-row slot="headerRow">
            <ui5-table-header-cell>Request State</ui5-table-header-cell>
            <ui5-table-header-cell>Import State</ui5-table-header-cell>
            <ui5-table-header-cell>Deploy State</ui5-table-header-cell>
          </ui5-table-header-row>
          <ui5-table-row>
            <ui5-table-cell>{{ artifactOpDetial.RequestState }}</ui5-table-cell>
            <ui5-table-cell>{{ artifactOpDetial.ImportState }}</ui5-table-cell>
            <ui5-table-cell>
              <template v-if="artifactOpDetial.SkipDeploy">
                <ui5-tag design="Set2" color-scheme="2" title="Deploy skipped — this artifact only requires import">Skipped</ui5-tag>
              </template>
              <template v-else>{{ artifactOpDetial.DeployState }}</template>
            </ui5-table-cell>
          </ui5-table-row>
        </ui5-table>
        <!-- Transport Request Number -->
        <ui5-label style="margin: 10px 0;">Transport Request Number</ui5-label>
        <div style="display: flex; flex-direction: column; gap: 8px">
          <div style="display: flex; align-items: center;">
            <ui5-text 
              v-if="!isEditingTr" 
              style="margin: 0 15px; font-size: var(--sapFontSize); font-weight: bold;"> 
                {{ editingTrNumber || '-' }} 
            </ui5-text>
            <div v-if="!isEditingTr" style="width: 1px; height: 20px; background-color: #ccc; margin: 0 10px;"></div>
            <ui5-input v-show="isEditingTr" v-model="editingTrNumber" style="width:20%"
              placeholder="TR number" @keyup.enter="checkTr(artifactOpDetial)" />
            <ui5-button v-show="!isEditingTr" @click="isEditingTr = true"
              design="Transparent">Edit</ui5-button>
            <ui5-button
              v-show="isEditingTr && draftSourceOps.find(d => d.op.ID === artifactOpDetial.ID)"
              @click="revertTr" design="Transparent">
              Revert
            </ui5-button>
            <ui5-button :loading="checkingTrLoading" v-show="isEditingTr && !generatingTrLoading"
              @click="checkTr(artifactOpDetial)" design="Transparent">
              Check
            </ui5-button>
            <ui5-button :loading="generatingTrLoading" @click="handleGenTr" design="Transparent">Auto Generate</ui5-button>
            <ui5-button v-show="isEditingTr"
              @click="{ isEditingTr = false; editingTrNumber = artifactOpDetial.TransportRequestNumber }"
              design="Transparent">
              Cancel
            </ui5-button>
          </div>
          <ui5-text v-if="trInfo" style="color: var(--sapPositiveColor); font-size: var(--sapFontSize);">{{ trInfo }}</ui5-text>
        </div>

      </div>

    </div>

    <ui5-toolbar slot="footer">
      <ui5-toolbar-button design="Emphasized"
        :text="isArtifactSelected(artifactDetail.PackageID, artifactDetail) ? 'Unselect' : 'Select'"
        @click="toggleArtifact(artifactDetail.PackageID, artifactDetail)">
      </ui5-toolbar-button>
      <ui5-toolbar-button
        v-if="artifactOpDetial.ID !== undefined"
        :text="artifactOpDetial.SkipDeploy ? 'Enable Deploy' : 'Skip Deploy'"
        :design="artifactOpDetial.SkipDeploy ? 'Positive' : 'Attention'"
        :tooltip="artifactOpDetial.SkipDeploy ? 'Re-enable deploy phase for this artifact' : 'Skip deploy phase — artifact only requires import'"
        @click="handleToggleSkipDeploy" />
      <ui5-toolbar-button class="dialogCloser" design="Transparent" text="Cancel"
        @click="showArtifactDetails = false" />
    </ui5-toolbar>
  </ui5-dialog>


  <!-- end modal -->
  <ui5-dynamic-page id="page" show-footer>
    <ui5-dynamic-page-title slot="titleArea">
      <ui5-breadcrumbs slot="breadcrumbs">
        <ui5-breadcrumbs-item href="#">Delivery Request</ui5-breadcrumbs-item>
        <ui5-breadcrumbs-item href="#">#{{ deliveryRequest.ID }}</ui5-breadcrumbs-item>
      </ui5-breadcrumbs>

      <ui5-title slot="heading">{{ deliveryRequest.Name }}</ui5-title>

      <div slot="snappedHeading" class="snapped-title-heading">
        <ui5-title wrapping-type="None">{{ deliveryRequest.Name }}</ui5-title>
      </div>
      <!-- TODO: currently no desctiption for the delivery request. So keep empty. -->
      <!-- <p slot="subheading" class="text"></p> -->

      <ui5-tag :design="aggrStatusToDesign">{{ deliveryRequest.AggregateStatus }}</ui5-tag>

      <ui5-toolbar class="actionsBar" id="actionsToolbar" slot="actionsBar" design="Transparent">
        <ui5-toolbar-button icon="delete" @click="showDeleteDialog = true" design="Transparent"
          tooltip="Delete Delivery Request"></ui5-toolbar-button>
        <ui5-toolbar-button
          v-if="canCancel"
          icon="stop"
          @click="showCancelDialog = true"
          design="Attention"
          tooltip="Cancel Delivery Request" />
      </ui5-toolbar>
    </ui5-dynamic-page-title>

    <ui5-dynamic-page-header slot="headerArea">
      <div class="product-info">
        <div class="product-info-cell">
          <ui5-label>Version/Delivery</ui5-label>
          <p class="text availability">{{ deliveryRequest.DeliveryRule?.Name }}</p>
        </div>
        <div class="product-info-cell">
          <ui5-label>JIRA</ui5-label>
          <p class="text price">
            <ui5-link :href="deliveryRequest.JiraLink" target="_blank" icon="chain-link" design="Emphasized"
              :disabled="jira.includes('Invalid')">{{ jira }}</ui5-link>
          </p>
        </div>
        <div class="product-info-cell">
          <ui5-label>Created By </ui5-label>
          <ui5-label v-if="deliveryRequest.CreatedBy" >
            {{ uaaUsers[deliveryRequest.CreatedBy]?.email ?? (uaaUserInfo(deliveryRequest.CreatedBy), '') }}
            {{ toLocalTime(deliveryRequest.CreatedAt) }}
          </ui5-label>
        </div>
        <div class="product-info-cell">
          <ui5-label>Updated By </ui5-label>
          <ui5-label v-if="deliveryRequest.UpdatedBy" >
            {{ uaaUsers[deliveryRequest.UpdatedBy]?.email ?? (uaaUserInfo(deliveryRequest.UpdatedBy), '') }}
            {{ toLocalTime(deliveryRequest.UpdatedAt) }}
          </ui5-label>
        </div>
      </div>
    </ui5-dynamic-page-header>
    <!-- Generate Delivery Request -->
    <ui5-wizard id="wiz">
      <!-- Step 1: Prepare -->
      <ui5-wizard-step id="step1" title-text="Select Packages & Artifacts">
        <div style="display: flex; min-height: 200px; flex-direction: column;">
          <ui5-title>Select Packages & Artifacts</ui5-title><br />

          <ui5-busy-indicator v-if="!deliveryRequest.SourceTenant"
            active :delay="0" style="display:flex; justify-content:center; align-items:center; width:100%; height: 70px;">
          </ui5-busy-indicator>

          <div v-else style="display: flex; flex-direction: column; gap:10px">
            <!-- cpi tenants selection -->
            <ui5-title size="H6"> Source CPI Tenant </ui5-title>
            <div style="display: flex; flex-direction: row; gap:12px; align-items: center;">
              <ui5-label style="display:flex; align-items:center; justify-content:center;">
                {{ deliveryRequest.SourceTenant.Name }} #{{ deliveryRequest.SourceTenant.ID }}
              </ui5-label>
              <div style="width: 1px; height: 20px; background: #ccc;"></div>
              <ui5-link :href="cpiTenantLink" target="_blank" rel="noopener noreferrer">
                {{ cpiTenantLink }}
              </ui5-link>
            </div>

            <!-- packages & artifacts section -->
            <ui5-title size="H6"> Packages ({{ selectedPackages.length }}) </ui5-title>
            <div>
              <!-- Loading Skeleton -->
              <ui5-busy-indicator v-if="packagesLoading" active :delay="0"
                style="display:flex; justify-content:center; align-items:center; width:100%; height: 70px;">
              </ui5-busy-indicator>
              <!-- Packages Select -->
              <div v-else>
                <div v-if="!packageOptions || !packageOptions.length" style="margin-top:6px">
                  <ui5-illustrated-message name="NoData" design="Dot"
                    :title-text="`No Packages found in Tenant(${deliveryRequest.SourceTenant.Name})`"
                    :subtitle-text="`Please Retry...`" />
                </div>

                <ui5-multi-combobox v-else show-clear-icon show-select-all @selection-change="handleSelectPackage"
                  style="width: 40%;">
                  <ui5-mcb-item v-for="pkg in packageOptions" :id="pkg.value.Id" :key="pkg.value.Id"
                    :text="pkg.value.Name" :additional-text="`${pkg.value.Version}`"
                    :selected="selectedPackages.some(p => p.Id === pkg.value.Id)" />
                </ui5-multi-combobox>
              </div>
            </div>
            <!-- Package & Artifacts Section -->
            <div v-if="selectedPackages.length">
              <ui5-panel v-for="pkg in selectedPackages" :key="pkg.Id" :header-text="`${pkg.Name} - ${pkg.Version}`"
                @toggle="loadPackageArtifacts(pkg.Id)" collapsed style="margin-bottom: 10px;">
                <ui5-busy-indicator v-if="loadingPackages[pkg.Id] || !packageArtifacts[pkg.Id]" active :delay="0"
                  style="display:flex; justify-content:center; align-items:center; width:100%; height: 80px;">
                </ui5-busy-indicator>
                <div v-else>
                  <div v-if="(packageArtifacts[pkg.Id] || []).length === 0">
                    <ui5-illustrated-message name="NoData" design="Dot">
                      <div slot="subtitle">
                        <ui5-button icon="refresh" design="Transparent"
                          @click="loadPackageArtifacts(pkg.Id, true)"></ui5-button>
                      </div>
                    </ui5-illustrated-message>
                  </div>
                  <div v-else>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0;">
                      <ui5-input :id="`input-filter-artifacts-${pkg.Id}`" @input="handleFilterArtifacts(pkg.Id, $event)"
                        placeholder="Filter artifacts (id/version/type)"
                        show-clear-icon
                        style="width: 20%;"/>
                      
                      <ui5-button design="Transparent" @click="selectAllFiltered(pkg.Id)"
                        :disabled="!filteredArtifacts(pkg.Id).length">Select All Filtered
                      </ui5-button>
                      <ui5-button design="Transparent" @click="clearSelections(pkg.Id)"
                        :disabled="!(selPkgArtifacts[pkg.Id] || []).length">Clear Selected
                      </ui5-button>
                    </div>

                    <!-- Artifact list section -->
                    <div style="max-height:240px; overflow:auto; padding:6px; display:flex; flex-wrap:wrap; gap:6px;">
                      <ui5-segmented-button v-for="a in filteredArtifacts(pkg.Id)" 
                        :key="pkg.Id + '-' + a.TechID + '@' + a.Version" items-fit-content selection-mode="Multiple">
                        <ui5-segmented-button-item :selected="isArtifactSelected(pkg.Id, a)" @click="toggleArtifact(pkg.Id, a)">
                          {{ a.TechID }}@{{ a.Version }}
                        </ui5-segmented-button-item>
                        <ui5-segmented-button-item icon="italic-text" @click="openArtifactDetails(a)" tooltip="Show Details" />
                      </ui5-segmented-button>
                    </div>
                  </div>
                </div>
              </ui5-panel>
            </div>
            <!-- selected Artifacts list -->
            <div v-if="selArtifactOps.length || deleteOps.length" style="margin-top:18px; display: flex; flex-direction: column; gap:10px">
              <ui5-title size="H6">
                Selected Artifacts ({{ selArtifactOps.length }})
              </ui5-title>
              <!-- Missing TR warning for saved ops with empty TR (e.g. auto-created from Version Compare) -->
              <div v-if="missingTrOps.length > 0" style="display: flex; align-items: center; gap: 8px;">
                <ui5-message-strip design="Critical" :hide-close-button="true" style="width: fit-content;">
                  {{ missingTrOps.length }} artifact(s) missing Transport Request numbers. Generate TRs before requesting approval.
                </ui5-message-strip>
                <ui5-button
                  @click="batchGenTrs"
                  :loading="generatingTrsLoading"
                  design="Transparent">
                    Generate TRs for All Missing
                </ui5-button>
              </div>
              <div style="display: flex; flex-direction: column; gap:10px">
                <!-- old(source) artifacts + draft source artifacts -->
                <div style="display: flex; flex-direction: row; gap: 8px; flex-wrap: wrap;">
                  <ArtifactOpTag v-for="(op, i) in sourceOps" :key="op.ID" :i="i" :art-op="op" :stage-type="stateType(op)"
                    @open-artifact-details="openArtifactDetails" 
                    style="margin: 0 5px;"
                  />
                </div>
                <!-- artifacts to be added -->
                <div v-if="addOps && addOps.length > 0" style="display: flex; flex-direction: column; margin-top: 10px; gap: 8px;">
                  <ui5-title size="H6">
                    <span style="color: var(--sapPositiveColor);">New ({{ addOps.length }})</span>
                  </ui5-title>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <ui5-message-strip design="Critical" :hide-close-button="true" style="width: fit-content;">TRs required before requesting approval</ui5-message-strip>
                    <ui5-button
                      @click="batchGenTrs"
                      :loading="generatingTrsLoading"
                      design="Transparent">
                        Generate TRs
                    </ui5-button>
                  </div>
                  <div style="display: flex; flex-direction: row; gap: 8px; flex-wrap: wrap;">
                    <ArtifactOpTag v-for="(op, i) in addOps" :key="`add-${op.ArtifactTechID}@${op.ArtifactVersion}`"
                      :i="i" :art-op="op" :stage-type="stateType(op)"
                      @open-artifact-details="openArtifactDetails" />
                  </div>
                </div>
                <!-- artifacts to be deleted -->
                <div v-if="deleteOps && deleteOps.length > 0" style="display: flex; flex-direction: column;">
                  <ui5-title size="H6" style="margin-bottom: 4px;">
                    <span style="color: var(--sapNegativeColor);">To be Deleted ({{ deleteOps.length }})</span>
                  </ui5-title>
                  <div style="display: flex; flex-direction: row; gap: 8px; flex-wrap: wrap;">
                    <ArtifactOpTag v-for="(op, i) in deleteOps" :key="op.ID" :i="i" :art-op="op" :stage-type="stateType(op)"
                      @open-artifact-details="openArtifactDetails" />
                  </div>
                </div>
              </div>
              <ui5-button design="Emphasized" @click="updateDr" style="width:10%; margin-top: 10px;" :loading="updatingOps" :loading-delay="0"> Update </ui5-button>
            </div>
          </div>
        </div>
      </ui5-wizard-step>

      <!-- Step 2: Approve -->
      <ui5-wizard-step id="step2" title-text="Request Approval">
        <div style="display: flex;flex-direction: column">
          <ui5-title>Request Approval</ui5-title><br />
          <ui5-busy-indicator v-if="approveInfo.loading" active :delay="0" />
          <div style="display: flex; flex-direction: column" v-else-if="!deliveryRequest.ApprovedBy">
            <AutoComplete style="width: 40%;" :suggestions="approverOptions" :loading="searchApproverLoading"
              v-model="searchApprover" optionLabel="label" placeholder="Search Approvers"
              @complete="(e: any) => handleSearchArrover(e.query)"
              @item-select="(e: any) => { handleSelectApprover(e.value.value); searchApprover = '' }" />
            <ui5-label>Approvers:</ui5-label>
            <div style="display: flex; gap: 10px;">
              <span v-for="user_id in deliveryRequest.Approvers" :key="user_id">
                <ui5-busy-indicator v-if="!(uaaUsers[user_id]?.email ?? (uaaUserInfo(user_id), ''))" active :delay="0" size="M" />
                <ui5-tag v-else @close="handleUnselectApprover(user_id)">
                  {{ uaaUsers[user_id]?.email }}
                </ui5-tag>
              </span>
            </div>

            <div style="display: flex; margin-top:20px">
              <!-- Approve/Skip Approval button -->
              <ui5-button 
                :disabled="approveInfo.disable" 
                :design="approveInfo.disable ? 'Attention' : 'Positive'"
                :loading="approveStepLoading"
                :loading-delay="0"
                @click="handleApprove"
                :tooltip="approveInfo.tooltip">
                {{ approveInfo.display }}
              </ui5-button>

              <ui5-button 
                design="Transparent" 
                v-if="deliveryRequest.Approvers" 
                :disabled="missingTrOps.length > 0"
                :loading="approveStepLoading" 
                :loading-delay="0"
                @click="handleRequestApprove"
                :tooltip="missingTrOps.length > 0 ? 'Generate all Transport Requests before sending approval' : ''">
                Send To Approvers
              </ui5-button>

            </div>
          </div>
          <div style="display: flex; flex-direction: column" v-else>
            <ui5-label>
              Approved By
              {{ uaaUsers[deliveryRequest.ApprovedBy]?.email ?? (uaaUserInfo(deliveryRequest.ApprovedBy), '') }}
            </ui5-label>
          </div>
        </div>
      </ui5-wizard-step>

      <!-- Step 3: Delivery Flow -->
      <ui5-wizard-step id="step3" title-text="Delivery Flow">
        <div style="display: flex; flex-direction: row; margin-bottom: 15px;">
          <ui5-title>Delivery Flow</ui5-title><br />
          <ui5-segmented-button style="margin-left: 12px;">
            <ui5-segmented-button-item @click="onSyncDrStatus" icon="synchronize" tooltip="Sync Status" />
            <ui5-segmented-button-item @click="showFlowModal = true" :disabled="loadingCpiTenants" icon="show" tooltip="Show Detail" />
          </ui5-segmented-button>
        </div>
        <div style="display: flex; flex-direction: column;">
          <div v-if="loadingCpiTenants" style="display: flex; flex-direction: column">
            <ui5-busy-indicator active :delay="0" />
          </div>
          <div v-else class="delivery-flow-container">
            <DeliveryFlowView :delivery-request="deliveryRequest" :cpi-tenants="cpiTenants"
              :tenant-to-ops="tenantToOps" />
            <div v-if="syncingStatus" class="sync-overlay">
              <ui5-busy-indicator active :delay="0" />
            </div>
          </div>
        </div>
      </ui5-wizard-step>
      <!-- Step 4: Logs -->
      <ui5-wizard-step id="step4" title-text="Logs">
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <ui5-title>Logs</ui5-title>
            <ui5-segmented-button>
              <ui5-segmented-button-item
                v-for="key in conditionFilterKeys" :key="key"
                :pressed="activeConditionFilter === key"
                @click="activeConditionFilter = key">
                {{ key }} ({{ conditionFilterCounts[key] }})
              </ui5-segmented-button-item>
            </ui5-segmented-button>
          </div>
          <div v-if="filteredConditions.length"
            style="max-height: 400px; overflow-y: auto;">
            <ui5-message-strip
              v-for="condition in filteredConditions"
              :key="condition.ID"
              :design="conditionTypeToDesign(condition.State)"
              :hide-close-button="true"
              style="margin-bottom: 8px;">
              <div style="white-space: pre-line;">{{ condition.Message }}</div>
              <ui5-text>{{ condition.CreatedAt }}</ui5-text>
            </ui5-message-strip>
          </div>
          <ui5-illustrated-message v-else name="NoData" design="Dot"
            title-text="No Logs Available"
            subtitle-text="There are no Logs for this delivery request." />
        </div>
      </ui5-wizard-step>
    </ui5-wizard>
  </ui5-dynamic-page>

  <ui5-dialog header-text="Cancel Delivery Request" :open="showCancelDialog"
    :busy="cancelingDr"
    @close="!cancelingDr && (showCancelDialog = false)">
    <div style="padding: 1rem; display: flex; flex-direction: column; gap: 12px;">
      <ui5-message-strip design="Critical" hide-close-button>
        This action is permanent. The delivery request will be marked as CANCELED
        and no further import/deploy operations will be allowed.
      </ui5-message-strip>
      <ui5-label for="cancel-reason" required>Reason for cancellation</ui5-label>
      <ui5-textarea id="cancel-reason" v-model="cancelReason"
        :disabled="cancelingDr"
        placeholder="e.g. Requirements changed, no longer needed"
        rows="3" />
    </div>
    <ui5-toolbar slot="footer">
      <ui5-toolbar-button design="Negative" :text="cancelingDr ? 'Canceling...' : 'Confirm Cancel'"
        :disabled="cancelingDr || !cancelReason.trim()"
        @click="handleCancelDr" />
      <ui5-toolbar-button class="dialogCloser" design="Transparent" text="Close"
        :disabled="cancelingDr"
        @click="showCancelDialog = false" />
    </ui5-toolbar>
  </ui5-dialog>

  <ConfirmDeleteDialog
    :open="showDeleteDialog"
    :name="deliveryRequest.Name"
    @confirm="confirmDeleteDr"
    @close="showDeleteDialog = false"
  />

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
  GenTransportRequest,
  DeliveryRuleCheck,
  CancelDeliveryRequest,
} from '@/service/api'
import { CANCELLABLE_STATUSES, type ConditionType } from '@/service/statuses'
import { toLocalTime } from '@/service/consts'
import { VueFlow } from '@vue-flow/core'
import CpiTransportNode from '@/components/CpiTransportNode.vue'
import AutoComplete from 'primevue/autocomplete'
import type { DeliveryRequest, CpiTenant, Package, Artifact, ArtifactVersionHistoryItem, ArtifactTenantOperation, UserInfo, Condition } from '@/service/model'
import DeliveryFlowView from './DeliveryFlowView.vue'
import CpiTransportFlowView from './CpiTransportFlowView.vue'
import ArtifactOpTag from '@/components/ArtifactOpTag.vue'
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog.vue'
import { nextTick } from 'vue'
import { aggregateStatusToUi5Design, conditionTypeToDesign } from '@/service/statuses'
import { sseClient } from '@/service/sse'


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
import "@ui5/webcomponents/dist/Input.js";

import "@ui5/webcomponents-icons/dist/delete.js";
import "@ui5/webcomponents-icons/dist/stop.js";
import "@ui5/webcomponents-icons/dist/chain-link.js";
import "@ui5/webcomponents-icons/dist/laptop.js";
import "@ui5/webcomponents-icons/dist/refresh.js";
import "@ui5/webcomponents-icons/dist/italic-text.js";
import "@ui5/webcomponents-icons/dist/synchronize.js";
import "@ui5/webcomponents-icons/dist/show.js";
import "@ui5/webcomponents/dist/Dialog.js";
import "@ui5/webcomponents/dist/Panel.js";
import "@ui5/webcomponents/dist/BusyIndicator.js";
import "@ui5/webcomponents/dist/MessageStrip.js";
import "@ui5/webcomponents-fiori/dist/IllustratedMessage.js";
import "@ui5/webcomponents-fiori/dist/illustrations/NoData.js";
import "@ui5/webcomponents/dist/SegmentedButton.js";
import "@ui5/webcomponents/dist/SegmentedButtonItem.js";
import "@ui5/webcomponents/dist/MultiComboBox.js";
import "@ui5/webcomponents/dist/MultiComboBoxItem.js";
import "@ui5/webcomponents/dist/CheckBox.js";
import "@ui5/webcomponents/dist/TextArea.js";
import "@ui5/webcomponents/dist/Table.js";
import "@ui5/webcomponents/dist/TableRow.js";
import "@ui5/webcomponents/dist/TableCell.js";
import "@ui5/webcomponents/dist/TableHeaderRow.js";
import "@ui5/webcomponents/dist/TableHeaderCell.js";

import "@ui5/webcomponents-fiori/dist/Wizard.js";
import "@ui5/webcomponents-fiori/dist/WizardStep.js";

export default {
  name: 'TransportPlanView',
  components: {
    VueFlow,
    CpiTransportNode,
    DeliveryFlowView,
    CpiTransportFlowView,
    ConfirmDeleteDialog,
    ArtifactOpTag,
  },
  props: { planId: { required: true, type: Number } },
  data() {
    return {
      deliveryRequest: {} as DeliveryRequest,
      current: 0,
      toLocalTime,
      isEditingTr: false,
      cpiTenants: [] as CpiTenant[],
      tenantPkgs: [] as Package[],
      selectedPackages: [] as Package[],
      packageArtifacts: {} as { [key: string]: Artifact[] }, // packages to their artifacts, this is like a cache for package
      loadingPackages: {} as { [key: string]: boolean },
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
      generatingTrLoading: false,
      trInfo: '' as string, // displays info about tr number after checking
      draftSourceOps: [] as { op: ArtifactTenantOperation, newTr: string, oldTr: string }[], // operations being drafted (source ops only)
      loadingArtifactHistory: false,
      showFlowModal: false,
      deleteOps: [] as ArtifactTenantOperation[], // indexes of operations to be deleted
      addOps: [] as ArtifactTenantOperation[],
      // handle approvers
      searchApproverLoading: false,
      approverOptions: [] as { label: string; value: UserInfo }[],
      searchTimer: null as ReturnType<typeof setTimeout> | null,
      searchApprover: '',
      uaaUsers: {} as { [key: string]: UserInfo }, // userId - userEmail
      currentUser: {} as UserInfo,
      loadingCpiTenants: true,
      updatingOps: false,
      syncingStatus: false,
      generatingTrsLoading: false,
      approveStepLoading: false,
      showCancelDialog: false,
      cancelReason: '',
      cancelingDr: false,
      showDeleteDialog: false,
      sseUnsubscribers: [] as (() => void)[],
      sseRefreshTimer: null as ReturnType<typeof setTimeout> | null,
      activeConditionFilter: 'All' as 'All' | ConditionType,
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
        this.approverOptions = options.map(a => ({ label: `${a.email}(${a.userName}) - ${a.origin}`, value: a }))
        this.searchApproverLoading = false
      }, 800)
    },
    handleSelectApprover(user: UserInfo) {
      if (!this.deliveryRequest.Approvers) this.deliveryRequest.Approvers = []
      if (this.deliveryRequest.Approvers.includes(user.id)) return
      this.deliveryRequest.Approvers.push(user.id)
    },
    async handleRequestApprove() {
      // Send to selected approvers
      if (!this.deliveryRequest.Approvers || !this.deliveryRequest.Approvers.length) {
        window.$toast?.warning?.('Please select at least one approver before sending approval request.')
        return
      }
      this.approveStepLoading = true
      try {
        await RequestApprove(this.deliveryRequest.ID, this.deliveryRequest.Approvers, '')
        window.$toast?.success?.(`Approval request sent to ${this.deliveryRequest.Approvers.map(a => a).join(', ')}`)
      } finally {
        this.approveStepLoading = false
      }
    },
    async handleApprove() {
      this.approveStepLoading = true
      try {
        await Approve(this.deliveryRequest.ID, '')
        await this.refresh()
        window.$toast?.success?.('Delivery Request approved.')
      } finally {
        this.approveStepLoading = false
      }
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
    async confirmDeleteDr() {
      await DeleteDeliveryRequest(this.planId)
      this.showDeleteDialog = false
      this.$router.go(-1)
    },
    async handleCancelDr() {
      this.cancelingDr = true
      try {
        await CancelDeliveryRequest(this.deliveryRequest.ID, this.cancelReason.trim())
        this.showCancelDialog = false
        this.cancelReason = ''
        await this.refresh()
      } catch (e) {
        // HTTP interceptor handles error toast
      } finally {
        this.cancelingDr = false
      }
    },
    async updateDr() {
      if (!this.deliveryRequest.SourceTenant) {
        window.$toast?.warning?.('Please select a source CPI tenant')
        return
      }
      // No TR validation at save time — backend allows empty TRs (Phase 1).
      // Missing TRs are enforced at approve/request-approval stage via missingTrOps check.
      try {
        this.updatingOps = true
        // await nextTick()
        await UpdateDeliveryRequest(this.deliveryRequest)
        const draftOps = UpdateOps(this.deliveryRequest.ID, this.draftSourceOps.map(d => d.op))
        const delOps = DeleteOps(this.deliveryRequest.ID, this.deleteOps.map(op => op.ID))
        const insertOps = InsertOps(this.deliveryRequest.ID, this.addOps)
        await Promise.all([delOps, insertOps, draftOps])
      } finally {
        this.updatingOps = false
        await this.refresh()
      }
    },
    async loadPackageArtifacts(pkgId: string, reload: boolean = false) {
      if (this.packageArtifacts[pkgId] && !reload) return // already loaded
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
      const { PackageID, TechID } = this.artifactDetail || {}
      try {
        this.loadingArtifactHistory = true
        // NOTE: request has no interception when calling cpi-cookie-service, should manually handel exceptions.
        // Same with auto generate TR.
        this.artifactVersionHistory = await GetArtifactVersionHistory(`${baseUrl.protocol}//${baseUrl.host}`, PackageID, TechID)
      } catch (error: any) {
        const resp = error?.response?.data
        window.$toast?.error(`Failed to load artifact version history: ${resp?.message ?? ''}`, { duration: 30 * 1000, closable: true })
      } finally {
        this.loadingArtifactHistory = false
      }
    },
    // check TR number existence
    async checkTr(op: ArtifactTenantOperation) {
      this.checkingTrLoading = true
      const originalTrNumber = op?.TransportRequestNumber || ''
      const newTrNumber = this.editingTrNumber?.trim() || ''
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
    async genSingleTr(op: ArtifactTenantOperation): Promise<{ tr_number: string; tr_info: string }> {
      const baseUrl = new URL(this.deliveryRequest.SourceTenant.CpiEndpoint.url)
      const { PackageID, TechID, Version } = op.Artifact || {}

      await DeliveryRuleCheck(this.deliveryRequest.ID, [op])

      const description = `Delivery Request #${this.deliveryRequest.ID}. Transport Request for artifact ${TechID}:${Version} in package ${PackageID} by ${this.currentUser?.email}`

      return await GenTransportRequest(
        `${baseUrl.protocol}//${baseUrl.host}`,
        PackageID,
        TechID,
        description
      )
    },
    async handleGenTr() {
      try {
        this.generatingTrLoading = true
        this.isEditingTr = true
        const { tr_number, tr_info } = await this.genSingleTr(this.artifactOpDetial)

        // this.artifactOpDetial.TransportRequestNumber = tr_number
        this.editingTrNumber = tr_number
        this.trInfo = tr_info
        window.$toast?.success(`Generated transport request: ${tr_number}`, { duration: 30 * 1000, closable: true })
        await this.checkTr(this.artifactOpDetial)
      } catch (error: any) {
        const resp = error?.response?.data
        const message = resp?.message ?? error ?? ''
        window.$toast?.error(`Failed to generate transport request: ${message}`, { duration: 30 * 1000, closable: true })
      } finally {
        this.generatingTrLoading = false
      }
    },
    async batchGenTrs() {
      // Collect all ops that need TRs: new addOps + saved ops with empty TR
      const opsToGen = [...this.addOps.filter(op => !op.TransportRequestNumber || !op.TransportRequestNumber.trim()),
                         ...this.missingTrOps]
      if (!opsToGen.length) {
        window.$toast?.warning?.('No artifacts need TR generation')
        return
      }
      this.generatingTrsLoading = true
      try {
        // Generate TR for all artifacts in parallel
        const results = await Promise.allSettled(
          opsToGen.map(op => this.genSingleTr(op))
        )
        const successResults: { op: ArtifactTenantOperation; trNumber: string }[] = []
        const errorResults: { op: ArtifactTenantOperation; error: string }[] = []

        // Process results
        results.forEach((result, index) => {
          const op = opsToGen[index]
          if (result.status === 'fulfilled') {
            const { tr_number } = result.value
            op.TransportRequestNumber = tr_number
            successResults.push({ op, trNumber: tr_number })
            // Track saved ops as drafts so updateDr() sends the change
            const isSavedOp = this.sourceOps.find(s => s.ID === op.ID)
            if (isSavedOp && !this.draftSourceOps.find(d => d.op.ID === op.ID)) {
              this.draftSourceOps.push({ op: isSavedOp, newTr: tr_number, oldTr: '' })
            }
          } else {
            const error = result.reason
            const resp = error?.response?.data
            const message = resp?.message ?? error?.toString() ?? 'Unknown error'
            errorResults.push({ op, error: message })
          }
        })

        // Show results
        if (successResults.length > 0) {
          const successList = successResults.map(r => `${r.op.ArtifactTechID}@${r.op.ArtifactVersion}: ${r.trNumber}`).join('\n')
          window.$toast?.success(`Successfully generated ${successResults.length} transport request(s):\n${successList}`, { duration: 30 * 1000, closable: true })
        }

        if (errorResults.length > 0) {
          const errorList = errorResults.map(e => `${e.op.ArtifactTechID}@${e.op.ArtifactVersion}: ${e.error}`).join('\n')
          window.$toast?.error(`Failed to generate ${errorResults.length} transport request(s):\n${errorList}`, { duration: 30 * 1000, closable: true })
        }
      } finally {
        this.generatingTrsLoading = false
      }
    },
    handleToggleSkipDeploy() {
      const op = this.artifactOpDetial
      if (!op || op.ID === undefined) return

      const deployBlocked = ['IN_PROGRESS', 'COMPLETE', 'QUEUED', 'FAILED'].some(
        s => op.DeployState === s || op.DeployState === `DEPLOY_${s}`
      )
      if (deployBlocked && !op.SkipDeploy) {
        window.$toast?.warning?.(`Cannot skip deploy: deploy state is ${op.DeployState}`)
        return
      }

      op.SkipDeploy = !op.SkipDeploy
      op.DeployState = op.SkipDeploy ? 'DEPLOY_DISABLED' : 'NOT_STARTED'

      const isNewOp = this.addOps.find(a => a.ArtifactTechID === op.ArtifactTechID && a.ArtifactVersion === op.ArtifactVersion)
      if (!isNewOp) {
        const existing = this.draftSourceOps.find(d => d.op.ID === op.ID)
        if (!existing) {
          this.draftSourceOps.push({ op, newTr: op.TransportRequestNumber, oldTr: op.TransportRequestNumber })
        }
      }
    },
    openArtifactDetails(a: Artifact, op?: ArtifactTenantOperation) {
      this.artifactDetail = a
      this.showArtifactDetails = true
      this.artifactVersionHistory = []
      this.artifactOpDetial = op || {} as ArtifactTenantOperation
      this.editingTrNumber = this.artifactOpDetial.TransportRequestNumber
      this.trInfo = ''
      this.isEditingTr = false
    },
    async onSyncDrStatus() {
      if (!this.deliveryRequest.ID) return
      this.syncingStatus = true
      try {
        await SyncStatus(this.deliveryRequest.ID)
        await this.refresh()
      } finally {
        this.syncingStatus = false
      }
    },
    // Throttle (not debounce): SSE events arrive in bursts during background sync;
    // debounce would keep deferring the refresh, throttle caps it at once per 300ms.
    scheduleSSERefresh() {
      if (this.sseRefreshTimer) return
      this.sseRefreshTimer = setTimeout(async () => {
        this.sseRefreshTimer = null
        await this.refresh()
      }, 300)
    },
    stateType(op: ArtifactTenantOperation) {
      // op request state to tag type mapping('default' | 'primary' | 'info' | 'success' | 'warning' | 'error')
      const delIndex = this.deleteOps.findIndex(delOp => delOp.ArtifactTechID === op.ArtifactTechID && delOp.ArtifactVersion === op.ArtifactVersion)
      if (delIndex >= 0) return '1' // to be deleted
      const addIndex = this.addOps.findIndex(addOp => addOp.ArtifactTechID === op.ArtifactTechID && addOp.ArtifactVersion === op.ArtifactVersion)
      if (addIndex >= 0) return '4' // to be added
      const draftIndex = this.draftSourceOps?.findIndex(draftOp => draftOp.op.ID === op.ID)
      if (draftIndex >= 0) return '3' // drafted
      if (op.RequestState === 'NOT_REQUESTED') return '5'
      return '10'
    },
    handleSelectPackage(event: CustomEvent) {
      const selectedItems = event.detail.items as Array<{ id: string; text: string; additionalText: string }>
      const selectedPkgs = selectedItems
        .map(item => {
          const pkgOption = this.packageOptions.find(opt => opt.value.Id === item.id)
          return pkgOption ? pkgOption.value : null
        })
        .filter((pkg): pkg is Package => pkg !== null)
      this.selectedPackages = selectedPkgs
    },
    handleFilterArtifacts(pkgId: string, event: Event) {
      const input = event.target as HTMLInputElement;
      if (input) this.artifactSearch[pkgId] = input.value;
    },
    conditionTypeToDesign,

  },
  watch: {
    selectedPackages(newPkgs: Package[], oldPkgs: Package[]) {
      const removed = (oldPkgs || []).filter(p => !newPkgs.includes(p))
      removed.forEach(p => {
        delete this.packageArtifacts[p.Id]
        delete this.selPkgArtifacts[p.Id]
      })
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
              window.$toast?.warning?.(`Cannot remove artifact ${a.TechID}@${a.Version} as its request state is ${op.RequestState}`)
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
              SkipDeploy: false,
            } as ArtifactTenantOperation
          })
      },
      deep: true,
    }

  },
  computed: {
    canCancel(): boolean {
      return CANCELLABLE_STATUSES.has(this.deliveryRequest.AggregateStatus)
    },
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
    // Saved source ops that have empty TransportRequestNumber (e.g. auto-created from Version Compare)
    missingTrOps(): ArtifactTenantOperation[] {
      return this.sourceOps.filter(op => !op.TransportRequestNumber || !op.TransportRequestNumber.trim())
    },
    tenantToOps(): { [key: number]: { [key: string]: ArtifactTenantOperation } } { // only used in delivert flow view
      return TenantOps(this.allOps) || {} // cpi tenant ID - map[trNumber]ArtifactTenantOperation
    },
    approveInfo(): { disable: boolean, display: string, loading: boolean, tooltip: string } {
      const createdBy = this.uaaUsers[this.deliveryRequest.CreatedBy]?.email
      const currentEmail = this.currentUser?.email
      if (!createdBy || !currentEmail) return { loading: true, disable: false, display: 'Approve', tooltip: '' }
      const hasMissingTr = this.missingTrOps.length > 0
      if (hasMissingTr) {
        return {
          disable: true,
          display: 'Approve',
          loading: false,
          tooltip: `${this.missingTrOps.length} artifact(s) missing Transport Request numbers`
        }
      }
      const disable = !this.deliveryRequest.DeliveryRule?.SkipApprove && currentEmail === createdBy // disable self approval
      const allowApprove = currentEmail !== createdBy
      return {
        disable: disable,
        display: allowApprove ? 'Approve' : 'Skip Approval',
        loading: false,
        tooltip: disable ? 'Cannot approve your own request' : 'Force Deliver'
      }
    },
    jira(): string {
      const v = this.deliveryRequest.JiraLink || ''
      const match = v.match(/([A-Z]+-\d+)/)
      return match ? match[1] : `Invalid(${v})`
    },
    cpiTenantLink() {
      const tenant = this.deliveryRequest.SourceTenant
      if (!tenant || !tenant.CpiEndpoint) return ''
      const baseUrl = new URL(tenant.CpiEndpoint.url)
      return `${baseUrl.protocol}//${baseUrl.host}/itspaces/shell/design`
    },
    aggrStatusToDesign() {
      return aggregateStatusToUi5Design(this.deliveryRequest.AggregateStatus)
    },
    conditionFilterKeys(): ('All' | ConditionType)[] {
      return ['All', 'Error', 'Warn', 'Success']
    },
    conditionFilterCounts(): Record<'All' | ConditionType, number> {
      const list = (this.deliveryRequest.Conditions || []) as Condition[]
      return {
        All: list.length,
        Error: list.filter(c => c.State === 'Error').length,
        Warn: list.filter(c => c.State === 'Warn').length,
        Success: list.filter(c => c.State === 'Success').length,
      }
    },
    filteredConditions(): Condition[] {
      const list = (this.deliveryRequest.Conditions || []) as Condition[]
      if (this.activeConditionFilter === 'All') return list
      return list.filter(c => c.State === this.activeConditionFilter)
    },
  },
  async created() {
    await this.refresh()
    this.loadingCpiTenants = true
    await nextTick()
    this.cpiTenants = await GetAllCpiTenants()
    this.loadingCpiTenants = false
    this.currentUser = await CurrentUser()
  },
  mounted() {
    this.sseUnsubscribers.push(
      sseClient.on('dr-ops', (data: { drId?: number }) => {
        if (data?.drId === this.planId) this.scheduleSSERefresh()
      }),
      sseClient.on('dr-status', (data: { drId?: number }) => {
        if (data?.drId === this.planId) this.scheduleSSERefresh()
      }),
    )
  },
  beforeUnmount() {
    this.sseUnsubscribers.forEach(unsub => unsub())
    this.sseUnsubscribers = []
    if (this.sseRefreshTimer) {
      clearTimeout(this.sseRefreshTimer)
      this.sseRefreshTimer = null
    }
  },
}
</script>

<style scoped>
.delivery-flow-container {
  position: relative;
  min-height: 300px;
}

.sync-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
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
