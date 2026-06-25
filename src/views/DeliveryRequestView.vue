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
              placeholder="TR number" @keyup.enter="saveTr(artifactOpDetial)" />
            <ui5-button v-show="!isEditingTr" @click="isEditingTr = true"
              design="Transparent">Edit</ui5-button>
            <ui5-button
              v-show="isEditingTr && draftSourceOps.find(d => d.op.ID === artifactOpDetial.ID)"
              @click="revertTr" design="Transparent">
              Revert
            </ui5-button>
            <ui5-button v-show="isEditingTr"
              @click="saveTr(artifactOpDetial)" design="Transparent">
              Apply
            </ui5-button>
            <ui5-button :loading="generatingTrLoading" v-show="!isEditingTr"
              :disabled="artifactOpDetial.RequestState === 'TR_GENERATING'"
              :tooltip="artifactOpDetial.RequestState === 'TR_GENERATING' ? 'TR generation in progress…' : ''"
              @click="handleGenTr" design="Transparent">Auto Generate</ui5-button>
            <ui5-button v-show="isEditingTr"
              @click="{ isEditingTr = false; editingTrNumber = artifactOpDetial.TransportRequestNumber }"
              design="Transparent">
              Cancel
            </ui5-button>
          </div>
          <ui5-message-strip
            v-if="artifactOpDetial.RequestState === 'TR_GENERATING'"
            design="Information" :hide-close-button="true" style="width: fit-content; font-size: var(--sapFontSize);">
            TR generation in progress — this may take up to a few minutes.
          </ui5-message-strip>
          <ui5-message-strip
            v-else-if="artifactOpDetial.RequestState === 'TR_FAILED' && artifactOpDetial.TrError"
            design="Negative" :hide-close-button="true" style="width: fit-content; font-size: var(--sapFontSize);">
            TR generation failed: {{ artifactOpDetial.TrError }}
          </ui5-message-strip>
          <ui5-message-strip
            v-else-if="trInfo"
            design="Positive" :hide-close-button="true" style="width: fit-content; font-size: var(--sapFontSize);">
            TR generated: <strong>{{ artifactOpDetial.TransportRequestNumber }}</strong> -
            <ui5-link :href="trInfo" target="_blank">Open in TMS</ui5-link>
          </ui5-message-strip>
        </div>

      </div>

    </div>

    <ui5-toolbar slot="footer">
      <ui5-toolbar-button design="Emphasized"
        :text="isArtifactSelected(artifactDetail.PackageID, artifactDetail) ? 'Unselect' : 'Select'"
        @click="toggleArtifact(artifactDetail.PackageID, artifactDetail)">
      </ui5-toolbar-button>
      <ui5-toolbar-button
        v-if="artifactOpDetial.ID !== undefined && hasScope('DeliveryRequest.Operate')"
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
        <ui5-toolbar-button v-if="hasScope('DeliveryRequest.Write')" icon="delete" @click="showDeleteDialog = true" design="Transparent"
          tooltip="Delete Delivery Request"></ui5-toolbar-button>
        <ui5-toolbar-button
          v-if="canCancel && hasScope('DeliveryRequest.Operate')"
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

            <!-- separator between tenant info and artifact selection -->
            <div style="border-top: 1px solid var(--sapList_BorderColor); margin: 4px 0;"></div>

            <!-- artifact selection — two parallel methods -->
            <div style="margin-top: 2px;">
              <ui5-label style="display: block; margin-top: 4px;">Choose artifacts using either method below. Selections are shared between both methods.</ui5-label>
            </div>

            <div style="display: flex; flex-direction: row; gap: 24px; align-items: flex-start; margin-top: 4px;">

              <!-- Left column: Search All Artifacts -->
              <div style="flex: 0 0 50%; min-width: 0; display: flex; flex-direction: column; gap: 8px;">
                <ui5-title size="H5">Search All Artifacts</ui5-title>
                <ui5-input
                  :value="globalArtifactSearch"
                  @input="globalArtifactSearch = ($event.target as HTMLInputElement).value"
                  placeholder="Search by name / version across all packages"
                  show-clear-icon
                  :disabled="packagesLoading"
                  style="width: 60%;"
                />
                <div v-if="globalArtifactSearch && globalArtifactResults.length" style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 300px; overflow-y: auto; padding: 4px 0;">
                  <ui5-segmented-button
                    v-for="item in globalArtifactResults"
                    :key="item.pkg.Id + '-' + item.artifact.TechID + '@' + item.artifact.Version"
                    items-fit-content selection-mode="Multiple">
                    <ui5-segmented-button-item
                      :selected="isArtifactSelected(item.pkg.Id, item.artifact)"
                      @click="toggleArtifact(item.pkg.Id, item.artifact)">
                      {{ item.artifact.TechID }}@{{ item.artifact.Version }}
                    </ui5-segmented-button-item>
                    <ui5-segmented-button-item icon="italic-text" @click="openArtifactDetails(item.artifact)" tooltip="Show Details" />
                  </ui5-segmented-button>
                </div>
                <ui5-busy-indicator
                  v-if="globalArtifactSearch && globalArtifactSearching"
                  active :delay="0"
                  style="display:flex; justify-content:center; align-items:center; width:100%; height: 40px;">
                </ui5-busy-indicator>
                <ui5-illustrated-message
                  v-else-if="globalArtifactSearch && !globalArtifactResults.length && !globalArtifactSearching"
                  name="NoData" design="Dot"
                  title-text="No artifacts found"
                  :subtitle-text="`No artifacts match '${globalArtifactSearch}'`"
                  style="height: 80px;" />
              </div>

              <!-- Right column: Browse by Package -->
              <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px;">
                <ui5-title size="H5">Browse by Package ({{ selectedPackages.length }})</ui5-title>

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
                    style="width: 100%;">
                    <ui5-mcb-item v-for="pkg in packageOptions" :id="pkg.value.Id" :key="pkg.value.Id"
                      :text="pkg.value.Name" :additional-text="`${pkg.value.Version}`"
                      :selected="selectedPackages.some(p => p.Id === pkg.value.Id)" />
                  </ui5-multi-combobox>
                </div>

                <!-- Package & Artifacts panels -->
                <div v-if="selectedPackages.length">
                  <ui5-panel v-for="pkg in selectedPackages" :key="pkg.Id" :header-text="`${pkg.Name} - ${pkg.Version}`"
                    collapsed style="margin-bottom: 10px;">
                    <ui5-busy-indicator v-if="packagesLoading" active :delay="0"
                      style="display:flex; justify-content:center; align-items:center; width:100%; height: 80px;">
                    </ui5-busy-indicator>
                    <div v-else>
                      <div v-if="(packageArtifacts[pkg.Id] || []).length === 0">
                        <ui5-illustrated-message name="NoData" design="Dot" />
                      </div>
                      <div v-else>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0;">
                          <ui5-input :id="`input-filter-artifacts-${pkg.Id}`" @input="handleFilterArtifacts(pkg.Id, $event)"
                            placeholder="Filter artifacts (id/version/type)"
                            show-clear-icon
                            style="width: 40%;"/>

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
              </div>

            </div>

              <!-- Selected Artifacts list -->
            <div v-if="selArtifactOps.length || deleteOps.length" style="margin-top:18px; display: flex; flex-direction: column; gap:10px">
              <div style="display: flex; align-items: center; gap: 8px;">
                <ui5-title size="H6">Selected Artifacts ({{ selArtifactOps.length }})</ui5-title>
                <ui5-button icon="refresh" design="Transparent" tooltip="Refresh TR status" :disabled="refreshingOps" @click="refreshOps" />
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
              <ui5-button
                v-if="addOps.length > 0 || deleteOps.length > 0 || draftSourceOps.length > 0"
                design="Emphasized" 
                @click="updateDr" 
                style="width:10%; margin-top: 10px;" 
                :loading="updatingOps" 
                :loading-delay="0"> 
                Confirm 
              </ui5-button>
              <ui5-message-strip
                v-if="step1Message"
                :design="step1Message.type"
                :hide-close-button="false"
                style="margin-top: 8px; white-space: pre-line; width: fit-content;"
                @close="step1Message = null">
                {{ step1Message.text }}
              </ui5-message-strip>
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
            <div style="position: relative; width: 40%;">
              <ui5-input style="width: 100%;" placeholder="Search Approvers"
                @input="(e: any) => handleSearchArrover(e.target.value)" />
              <ui5-busy-indicator v-if="searchApproverLoading" active :delay="0" size="S"
                style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);" />
              <ui5-list v-if="approverOptions.length" class="approver-dropdown"
                @item-click="(e: any) => onApproverClick(e)">
                <ui5-li v-for="(opt, idx) in approverOptions" :key="idx"
                  :data-index="idx">{{ opt.label }}</ui5-li>
              </ui5-list>
            </div>
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
                v-if="hasScope('DeliveryRequest.Operate')"
                :disabled="approveInfo.disable"
                :design="approveInfo.disable ? 'Attention' : 'Positive'"
                :loading="approveStepLoading"
                :loading-delay="0"
                @click="handleApprove"
                :tooltip="approveInfo.tooltip">
                {{ approveInfo.display }}
              </ui5-button>

              <ui5-button
                v-if="deliveryRequest.Approvers && hasScope('DeliveryRequest.Operate')"
                design="Transparent"
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
  GenerateTR,
  DeleteDeliveryRequest,
  TenantOps,
  SyncStatus,
  DeleteOps,
  InsertOps,
  UpdateOps,
  UaaEmailSearch,
  RequestApprove,
  Approve,
  CurrentUser,
  CancelDeliveryRequest,
} from '@/service/api'
import { CANCELLABLE_STATUSES, type ConditionType } from '@/service/statuses'
import { toLocalTime } from '@/service/consts'
import type { DeliveryRequest, CpiTenant, Package, Artifact, ArtifactTenantOperation, UserInfo, Condition } from '@/service/model'
import DeliveryFlowView from './DeliveryFlowView.vue'
import CpiTransportFlowView from './CpiTransportFlowView.vue'
import ArtifactOpTag from '@/components/ArtifactOpTag.vue'
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog.vue'
import { nextTick } from 'vue'
import { aggregateStatusToUi5Design, conditionTypeToDesign } from '@/service/statuses'
import { wsClient } from '@/service/ws'
import { useAuth } from '@/composables/useAuth'
import { useUserCache } from '@/composables/useUserCache'


import "@ui5/webcomponents-fiori/dist/DynamicPage.js";
import "@ui5/webcomponents-fiori/dist/DynamicPageTitle.js";
import "@ui5/webcomponents-fiori/dist/DynamicPageHeader.js";

import "@ui5/webcomponents/dist/Label.js";
import "@ui5/webcomponents/dist/Tag.js";
import "@ui5/webcomponents/dist/Breadcrumbs.js";
import "@ui5/webcomponents/dist/BreadcrumbsItem.js";
import "@ui5/webcomponents/dist/Title.js";
import "@ui5/webcomponents/dist/Toolbar.js";
import "@ui5/webcomponents/dist/ToolbarButton.js";
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/List.js";
import "@ui5/webcomponents/dist/ListItemStandard.js";
import "@ui5/webcomponents/dist/Input.js";

import "@ui5/webcomponents-icons/dist/delete.js";
import "@ui5/webcomponents-icons/dist/stop.js";
import "@ui5/webcomponents-icons/dist/chain-link.js";
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
  setup() {
    const { hasScope } = useAuth()
    const { resolved: uaaUsers, getUserEmail, fetchUserInfo } = useUserCache()
    return { hasScope, uaaUsers, getUserEmail, fetchUserInfo }
  },
  components: {
    DeliveryFlowView,
    CpiTransportFlowView,
    ConfirmDeleteDialog,
    ArtifactOpTag,
  },
  props: { id: { required: true, type: Number } },
  data() {
    return {
      deliveryRequest: {} as DeliveryRequest,
      toLocalTime,
      isEditingTr: false,
      cpiTenants: [] as CpiTenant[],
      tenantPkgs: [] as Package[],
      selectedPackages: [] as Package[],
      packageArtifacts: {} as { [key: string]: Artifact[] }, // lazy-loaded per package via PIR API
      selPkgArtifacts: {} as { [key: string]: Artifact[] },  // selected artifacts within each package, [package id, array of artifact]
      packagesLoading: false,
      artifactSearch: {} as { [key: string]: string },
      // artifact details state
      showArtifactDetails: false,
      artifactDetail: {} as Artifact,
      artifactOpDetial: {} as ArtifactTenantOperation,
      editingTrNumber: '' as string, // tr number being edited, will assign to artifactOpDetial when saved
      generatingTrLoading: false,
      trInfo: '' as string, // displays tr URL after generation
      draftSourceOps: [] as { op: ArtifactTenantOperation, newTr: string, oldTr: string }[], // operations being drafted (source ops only)
      showFlowModal: false,
      deleteOps: [] as ArtifactTenantOperation[], // indexes of operations to be deleted
      addOps: [] as ArtifactTenantOperation[],
      // handle approvers
      searchApproverLoading: false,
      approverOptions: [] as { label: string; value: UserInfo }[],
      searchTimer: null as ReturnType<typeof setTimeout> | null,
      currentUser: {} as UserInfo,
      loadingCpiTenants: true,
      updatingOps: false,
      refreshingOps: false,
      syncingStatus: false,
      generatingTrsLoading: false,
      approveStepLoading: false,
      showCancelDialog: false,
      cancelReason: '',
      cancelingDr: false,
      showDeleteDialog: false,
      wsUnsubscribers: [] as (() => void)[],
      wsRefreshTimer: null as ReturnType<typeof setTimeout> | null,
      lastRefreshAt: 0,
      activeConditionFilter: 'All' as 'All' | ConditionType,
      globalArtifactSearch: '',
      globalArtifactResults: [] as { pkg: Package; artifact: Artifact }[],
      globalArtifactSearching: false,
      globalArtifactSearchVersion: 0,
      globalSearchTimer: null as ReturnType<typeof setTimeout> | null,
      step1Message: null as { type: 'Negative' | 'Positive' | 'Information'; text: string } | null,
    }
  },
  methods: {
    handleUnselectApprover(user_id: string) {
      if (!this.deliveryRequest.Approvers) return
      const idx = this.deliveryRequest.Approvers.indexOf(user_id)
      if (idx > -1) this.deliveryRequest.Approvers.splice(idx, 1)
    },
    async uaaUserInfo(userId: string) {
      return this.fetchUserInfo(userId)
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
    onApproverClick(e: any) {
      const idx = Number(e.detail.item.dataset.index)
      const opt = this.approverOptions[idx]
      if (opt) this.handleSelectApprover(opt.value)
      this.approverOptions = []
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
    async refreshOps() {
      this.refreshingOps = true
      try {
        this.deliveryRequest = await GetDeliveryRequest(this.id)
      } finally {
        this.refreshingOps = false
      }
    },
    async refresh() {
      this.lastRefreshAt = Date.now()
      this.deliveryRequest = await GetDeliveryRequest(this.id)

      // load packages from PIR; artifacts are loaded lazily per package on selection
      this.packagesLoading = true
      try {
        const pkgs = await GetPackages(this.deliveryRequest.SourceTenant.ID)
        this.tenantPkgs = pkgs ?? []
        // pre-load artifacts for packages that already have saved ops
        const savedPackageIDs = [...new Set(this.sourceOps.map(op => op.PackageID))]
        if (savedPackageIDs.length === 0) return
        await Promise.all(savedPackageIDs.map(async pkgId => {
          const arts = await GetPackageArtifacts(String(this.deliveryRequest.SourceTenant.ID), pkgId)
          this.packageArtifacts[pkgId] = arts ?? []
        }))
      } finally {
        this.packagesLoading = false
      }

      await Promise.all( // restore selections for already-saved ops
        this.sourceOps.map(op => {
          const packageId = op.PackageID
          if (!this.selPkgArtifacts[packageId]) this.selPkgArtifacts[packageId] = []
          const findIdx = this.packageArtifacts[packageId]?.findIndex(a => a.TechID === op.ArtifactTechID && a.Version === op.ArtifactVersion)
          if (findIdx < 0) {
            // TODO: handle artifact not found in package, may be deleted or invalid version
          }
          this.selPkgArtifacts[packageId].push({ TechID: op.ArtifactTechID, Version: op.ArtifactVersion, Name: op.ArtifactName, Type: op.ArtifactType, PackageID: op.PackageID, PackageName: op.PackageName, PackageVersion: op.PackageVersion } as Artifact)
          const pkg = this.tenantPkgs.find(p => p.Id === packageId)
          if (pkg && !this.selectedPackages.find(p => p.Id === pkg.Id)) this.selectedPackages.push(pkg)
        })
      )
      this.deleteOps = []
      this.addOps = []
      this.draftSourceOps = []
    },
    async confirmDeleteDr() {
      await DeleteDeliveryRequest(this.id)
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
      this.step1Message = null
      const trGeneratingCount = this.addOps.filter(
        op => op.TenantID === this.deliveryRequest.SourceTenant?.ID && !op.TransportRequestNumber
      ).length
      try {
        this.updatingOps = true
        await UpdateDeliveryRequest(this.deliveryRequest)
        const draftOps = UpdateOps(this.deliveryRequest.ID, this.draftSourceOps.map(d => d.op))
        const delOps = DeleteOps(this.deliveryRequest.ID, this.deleteOps.map(op => op.ID))
        const insertOps = InsertOps(this.deliveryRequest.ID, this.addOps)
        await Promise.all([draftOps, insertOps, delOps])
        await this.refresh()
        if (trGeneratingCount > 0) {
          this.step1Message = {
            type: 'Information',
            text: `${trGeneratingCount} artifact(s) queued for automatic TR generation. Use the refresh button to check status.`,
          }
        } else {
          this.step1Message = { type: 'Positive', text: 'Changes saved successfully.' }
        }
      } catch (e: any) {
        this.step1Message = { type: 'Negative', text: e?.message || 'Failed to save changes' }
      } finally {
        this.updatingOps = false
      }
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
      if (foundIdx >= 0) {
        arr.splice(foundIdx, 1) // clear selection
      } else {
        arr.push(a) // select
        // ensure the package is in selectedPackages (needed when toggling from global search)
        const pkg = this.tenantPkgs.find(p => p.Id === pkgId)
        if (pkg && !this.selectedPackages.find(p => p.Id === pkg.Id)) {
          this.selectedPackages.push(pkg)
        }
      }
    },
    selectAllFiltered(pkgId: string) {
      const keys = this.filteredArtifacts(pkgId)
      this.selPkgArtifacts[pkgId] = keys
    },
    clearSelections(pkgId: string) {
      this.selPkgArtifacts[pkgId] = []
    },
    saveTr(op: ArtifactTenantOperation) {
      const originalTrNumber = op?.TransportRequestNumber || ''
      const newTrNumber = this.editingTrNumber?.trim() || ''
      op.TransportRequestNumber = newTrNumber
      const draftOp = this.sourceOps.find(o => o.ID === this.artifactOpDetial.ID)
      if (draftOp && originalTrNumber !== newTrNumber) {
        const draftIndex = this.draftSourceOps.findIndex(d => d.op.ID === draftOp.ID)
        if (draftIndex < 0) {
          this.draftSourceOps.push({ op: draftOp, newTr: newTrNumber, oldTr: originalTrNumber })
        } else {
          const draft = this.draftSourceOps[draftIndex]
          if (newTrNumber === draft.oldTr) {
            // Edited back to the original DB value — remove draft entirely
            this.draftSourceOps.splice(draftIndex, 1)
          } else {
            draft.op.TransportRequestNumber = newTrNumber
            draft.newTr = newTrNumber
          }
        }
      }
      this.isEditingTr = false
    },
    async handleGenTr() {
      if (!this.artifactOpDetial.ID) {
        window.$toast?.warning?.('Save the delivery request first before generating a TR')
        return
      }
      try {
        this.generatingTrLoading = true
        const { succeeded, failed } = await GenerateTR(
          this.deliveryRequest.SourceTenant.ID,
          this.deliveryRequest.ID,
          [this.artifactOpDetial.ID],
        )
        const opIDKey = String(this.artifactOpDetial.ID)
        const tr = succeeded[opIDKey]
        if (tr) {
          this.trInfo = tr.transportRequestURL
          await this.refreshOps()
          // Sync detail panel with refreshed op state
          const refreshed = this.sourceOps.find(op => op.ID === this.artifactOpDetial.ID)
          if (refreshed) {
            this.artifactOpDetial = refreshed
            this.editingTrNumber = refreshed.TransportRequestNumber
          }
          window.$toast?.success(`Generated transport request: ${tr.transportRequestID}`)
        } else {
          window.$toast?.error(`Failed to generate transport request: ${failed[opIDKey] ?? 'Unknown error'}`)
        }
      } finally {
        this.generatingTrLoading = false
      }
    },
    async batchGenTrs() {
      const opsToGen = this.missingTrOps
      if (!opsToGen.length) {
        window.$toast?.warning?.('Save the delivery request first, then generate TRs for new artifacts')
        return
      }
      this.generatingTrsLoading = true
      try {
        const { succeeded, failed } = await GenerateTR(
          this.deliveryRequest.SourceTenant.ID,
          this.deliveryRequest.ID,
          opsToGen.map(op => op.ID),
        )
        // Update in-memory TR numbers — already persisted by backend
        for (const [opIDStr, tr] of Object.entries(succeeded)) {
          const op = this.sourceOps.find(s => String(s.ID) === opIDStr)
          if (op) op.TransportRequestNumber = tr.transportRequestID
        }
        const successCount = Object.keys(succeeded).length
        const failCount = Object.keys(failed).length
        if (successCount > 0) {
          window.$toast?.success(`Successfully generated ${successCount} transport request(s)`)
        }
        if (failCount > 0) {
          const errorList = Object.entries(failed).map(([id, err]) => `op ${id}: ${err}`).join('\n')
          window.$toast?.error(`Failed to generate ${failCount} transport request(s):\n${errorList}`)
        }
      } finally {
        this.generatingTrsLoading = false
      }
    },
    handleToggleSkipDeploy() {
      const op = this.artifactOpDetial
      if (!op || op.ID === undefined) return

      const deployBlocked = ['IN_PROGRESS', 'COMPLETE'].some(
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
    // Throttle WS-triggered refresh: skip if a refresh already happened recently
    // (e.g. user just clicked Approve/Cancel/Sync which already called refresh).
    scheduleWSRefresh() {
      if (this.wsRefreshTimer) return
      if (Date.now() - this.lastRefreshAt < 500) return
      this.wsRefreshTimer = setTimeout(async () => {
        this.wsRefreshTimer = null
        await this.refresh()
      }, 300)
    },
    stateType(op: ArtifactTenantOperation) {
      // op request state to tag type mapping('default' | 'primary' | 'info' | 'success' | 'warning' | 'error')
      const delIndex = this.deleteOps.findIndex(delOp => delOp.ArtifactTechID === op.ArtifactTechID && delOp.ArtifactVersion === op.ArtifactVersion)
      if (delIndex >= 0) return '1' // to be deleted
      const addIndex = this.addOps.findIndex(addOp => addOp.ArtifactTechID === op.ArtifactTechID && addOp.ArtifactVersion === op.ArtifactVersion)
      if (addIndex >= 0) return '4' // to be added
      if (op.RequestState === 'TR_GENERATING') return '2' // generating TR (information/blue)
      if (op.RequestState === 'TR_FAILED') return '8'    // TR failed (negative/red)
      const draftIndex = this.draftSourceOps?.findIndex(draftOp => draftOp.op.ID === op.ID)
      if (draftIndex >= 0) return '3' // drafted
      if (op.RequestState === 'NOT_REQUESTED') return '5'
      return '10'
    },
    async handleSelectPackage(event: CustomEvent) {
      const selectedItems = event.detail.items as Array<{ id: string; text: string; additionalText: string }>
      const selectedPkgs = selectedItems
        .map(item => {
          const pkgOption = this.packageOptions.find(opt => opt.value.Id === item.id)
          return pkgOption ? pkgOption.value : null
        })
        .filter((pkg): pkg is Package => pkg !== null)
      this.selectedPackages = selectedPkgs
      // lazy-load artifacts for newly selected packages not yet in cache
      const uncachedPkgs = selectedPkgs.filter(pkg => !this.packageArtifacts[pkg.Id])
      if (uncachedPkgs.length === 0) return
      await Promise.all(uncachedPkgs.map(async pkg => {
        const arts = await GetPackageArtifacts(String(this.deliveryRequest.SourceTenant.ID), pkg.Id)
        this.packageArtifacts[pkg.Id] = arts ?? []
      }))
    },
    handleFilterArtifacts(pkgId: string, event: Event) {
      const input = event.target as HTMLInputElement;
      if (input) this.artifactSearch[pkgId] = input.value;
    },
    conditionTypeToDesign,
    async runGlobalArtifactSearch(kw: string) {
      const version = ++this.globalArtifactSearchVersion
      this.globalArtifactResults = []
      this.globalArtifactSearching = true
      try {
        await Promise.all(this.tenantPkgs.map(async pkg => {
          if (!this.packageArtifacts[pkg.Id]) {
            const arts = await GetPackageArtifacts(String(this.deliveryRequest.SourceTenant.ID), pkg.Id)
            this.packageArtifacts[pkg.Id] = arts ?? []
          }
          if (version !== this.globalArtifactSearchVersion) return // stale
          const matches = (this.packageArtifacts[pkg.Id] ?? [])
            .filter(a => a.TechID.toLowerCase().includes(kw) || a.Version.toLowerCase().includes(kw))
            .map(artifact => ({ pkg, artifact }))
          this.globalArtifactResults.push(...matches)
        }))
      } finally {
        if (version === this.globalArtifactSearchVersion) {
          this.globalArtifactSearching = false
        }
      }
    },
  },
  watch: {
    globalArtifactSearch(val: string) {
      if (this.globalSearchTimer) clearTimeout(this.globalSearchTimer)
      const kw = val.trim().toLowerCase()
      if (!kw) { this.globalArtifactResults = []; this.globalArtifactSearching = false; this.globalArtifactSearchVersion++; return }
      this.globalSearchTimer = setTimeout(() => this.runGlobalArtifactSearch(kw), 200)
    },
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
        const oldArtis = this.sourceOps.map(op => ({ TechID: op.ArtifactTechID, Version: op.ArtifactVersion } as Artifact))

        const added = newArtis.filter(a => !oldArtis.find(o => o.TechID === a.TechID && o.Version === a.Version))
        const removed = oldArtis.filter(a => !newArtis.find(n => n.TechID === a.TechID && n.Version === a.Version))

        const removeIdx = removed
          .filter(a => {
            const op = this.sourceOps.find(op => op.ArtifactTechID === a.TechID && op.ArtifactVersion === a.Version) || {} as ArtifactTenantOperation
            const removable = op.RequestState === 'NOT_REQUESTED' || op.RequestState === 'TR_FAILED'
            if (!removable)
              window.$toast?.warning?.(`Cannot remove artifact ${a.TechID}@${a.Version} as its request state is ${op.RequestState}`)
            return removable
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
              ArtifactName: a.Name,
              ArtifactType: a.Type,
              PackageID: a.PackageID,
              PackageName: a.PackageName,
              PackageVersion: a.PackageVersion,
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
    // Saved source ops that are missing TRs or have TR in a non-terminal in-progress/failed state
    missingTrOps(): ArtifactTenantOperation[] {
      return this.sourceOps.filter(op =>
        !op.TransportRequestNumber ||
        !op.TransportRequestNumber.trim() ||
        op.RequestState === 'TR_GENERATING' ||
        op.RequestState === 'TR_FAILED'
      )
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
      if (!tenant?.PirApiUrl) return ''
      try {
        const u = new URL(tenant.PirApiUrl)
        return `${u.protocol}//${u.host}/itspaces`
      } catch {
        return ''
      }
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
    // Subscribe to this DR's real-time updates via WebSocket
    wsClient.subscribe(this.id)
    this.wsUnsubscribers.push(
      wsClient.on('dr-updated', (data: { drId?: number }) => {
        if (data?.drId === this.id) this.scheduleWSRefresh()
      }),
    )
  },
  beforeUnmount() {
    wsClient.unsubscribe(this.id)
    this.wsUnsubscribers.forEach(unsub => unsub())
    this.wsUnsubscribers = []
    if (this.wsRefreshTimer) {
      clearTimeout(this.wsRefreshTimer)
      this.wsRefreshTimer = null
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

.approver-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 200;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
}
</style>
