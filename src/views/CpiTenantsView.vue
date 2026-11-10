<template>
    <!-- ── Manage dialog (wide, tabbed) ── -->
    <ui5-dialog
        :header-text="selectedCpiTenant.ID ? `Manage: ${selectedCpiTenant.Name || ''}` : 'New CPI Tenant'"
        :open="showManageModal"
        @close="closeManageModal"
        style="width: 64%; min-width: 680px;">

        <div class="tab-content">

                    <!-- Lifecycle + TMS Extension status -->
                    <div class="status-header">
                        <ui5-text style="font-weight: bold; font-size: 1rem;">Lifecycle</ui5-text>
                        <ui5-tag :design="lifecycleDesign" style="margin-left: 0.5rem;">
                            {{ selectedCpiTenant.LifecycleState || 'draft' }}
                        </ui5-tag>
                        <ui5-text v-if="selectedCpiTenant.BlockingReason"
                            style="color: var(--sapCriticalTextColor); margin-left: 0.75rem; font-size: 0.8rem;">
                            {{ selectedCpiTenant.BlockingReason }}
                        </ui5-text>
                        <span style="margin-left: 1.5rem;" />
                        <ui5-text style="font-weight: bold; font-size: 1rem;">TMS</ui5-text>
                        <ui5-tag :design="tmsExtensionDesign" style="margin-left: 0.5rem;">
                            {{ selectedCpiTenant.TmsExtensionState || 'not_started' }}
                        </ui5-tag>
                        <ui5-text v-if="selectedCpiTenant.TmsBlockingReason"
                            style="color: var(--sapCriticalTextColor); margin-left: 0.75rem; font-size: 0.8rem;">
                            {{ selectedCpiTenant.TmsBlockingReason }}
                        </ui5-text>
                    </div>

                    <!-- ── Base Bootstrap Prerequisites (PIR only) ── -->
                    <div style="margin-bottom: 1rem;">
                        <div class="prereq-group-header">Provider Destinations <span class="prereq-group-note">(delivery-orchestrator subaccount)</span></div>
                        <div class="prereq-grid" style="margin-bottom: 0.5rem;">
                            <div class="prereq-item">
                                <ui5-tag :design="selectedCpiTenant.PirApiDestinationName ? 'Positive' : 'Neutral'" style="font-size: 0.7rem; min-width: 64px;">
                                    {{ selectedCpiTenant.PirApiDestinationName ? 'ready' : 'missing' }}
                                </ui5-tag>
                                <ui5-text style="font-size: 0.8rem; margin-left: 0.5rem;">
                                    {{ selectedCpiTenant.PirApiDestinationName || 'CPIDELIVERY_PIR_{id}' }}
                                </ui5-text>
                            </div>
                        </div>

                        <div class="prereq-group-header">Subscriber Service Instances <span class="prereq-group-note">(CPI tenant subaccount)</span></div>
                        <div class="prereq-grid">
                            <div class="prereq-item">
                                <ui5-tag :design="prereqDesign(selectedCpiTenant.PirApiStatus)" style="font-size: 0.7rem; min-width: 64px;">
                                    {{ selectedCpiTenant.PirApiStatus || 'missing' }}
                                </ui5-tag>
                                <ui5-text style="font-size: 0.8rem; margin-left: 0.5rem;">pir-api (it-rt / api)</ui5-text>
                            </div>
                        </div>
                    </div>

                    <div class="section-divider" />

                    <!-- ── 3-step Wizard ── -->
                    <ui5-wizard style="height: auto;">

                        <!-- Step 1: CF Connection -->
                        <ui5-wizard-step
                            title-text="CF Connection"
                            subtitle-text="Configure & Verify"
                            icon="connected"
                            :selected="wizardStep === 1"
                            @click="wizardStep = 1">
                            <div class="wizard-step-content">
                                <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor); display: block; margin-bottom: 0.75rem;">
                                    Save CF connection details and verify access using a short-lived bearer token. The token is never stored.
                                </ui5-text>

                                <ui5-text class="field-label">Name *</ui5-text>
                                <ui5-input :value="selectedCpiTenant.Name || ''"
                                    @input="selectedCpiTenant.Name = $event.target.value"
                                    placeholder="cpi-mmt-dev" style="width: 100%;" />

                                <ui5-text class="field-label">Tag</ui5-text>
                                <ui5-input :value="selectedCpiTenant.Group || ''" @input="onSelectTag"
                                    placeholder="e.g. Dev, Test, Production" showSuggestions style="width: 100%;">
                                    <ui5-suggestion-item v-for="tag in tagOptions" :key="tag.value" :text="tag.value" />
                                </ui5-input>

                                <div class="section-divider" />

                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                    <ui5-text class="field-label" style="margin-bottom: 0;">CF API Endpoint *</ui5-text>
                                    <ui5-button v-if="cfIdentity.cfApiEndpoint" design="Transparent" icon="locked" title="Open CF passcode login page"
                                        @click="openCfLoginPage" style="height: 1.5rem;">
                                        Login
                                    </ui5-button>
                                </div>
                                <ui5-input :value="cfIdentity.cfApiEndpoint"
                                    @input="cfIdentity.cfApiEndpoint = $event.target.value"
                                    placeholder="https://api.cf.eu10.hana.ondemand.com" style="width: 100%;" />

                                <ui5-text class="field-label">CF Passcode *</ui5-text>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <ui5-input type="Password" :value="cfToken"
                                        @input="onCfTokenInput($event.target.value)"
                                        placeholder="One-time passcode from the Login page" style="flex: 1;" />
                                    <ui5-busy-indicator v-if="loadOrgsLoading" size="Small" active />
                                </div>

                                <ui5-text class="field-label">CF Org *</ui5-text>
                                <ui5-select v-if="cfOrgMode === 'select' && cfOrgOptions.length"
                                    @change="onOrgSelect($event.detail.selectedOption.dataset.guid)"
                                    style="width: 100%;">
                                    <ui5-option value="" selected>— Select org —</ui5-option>
                                    <ui5-option v-for="o in cfOrgOptions" :key="o.guid"
                                        :data-guid="o.guid"
                                        :selected="cfIdentity.cfOrg === o.guid">
                                        {{ o.name }}
                                    </ui5-option>
                                </ui5-select>
                                <ui5-input v-else :value="cfIdentity.cfOrg"
                                    @input="cfIdentity.cfOrg = $event.target.value"
                                    placeholder="CF organisation GUID" style="width: 100%;" />

                                <ui5-text class="field-label">CF Space *</ui5-text>
                                <ui5-busy-indicator v-if="loadSpacesLoading" size="Small" active />
                                <template v-else>
                                    <ui5-select v-if="cfSpaceMode === 'select' && cfSpaceOptions.length"
                                        @change="cfIdentity.cfSpace = $event.detail.selectedOption.dataset.guid"
                                        style="width: 100%;">
                                        <ui5-option value="" selected>— Select space —</ui5-option>
                                        <ui5-option v-for="s in cfSpaceOptions" :key="s.guid"
                                            :data-guid="s.guid"
                                            :selected="cfIdentity.cfSpace === s.guid">
                                            {{ s.name }}
                                        </ui5-option>
                                    </ui5-select>
                                    <ui5-input v-else :value="cfIdentity.cfSpace"
                                        @input="cfIdentity.cfSpace = $event.target.value"
                                        placeholder="CF space GUID for service instances" style="width: 100%;" />
                                </template>

                                <ui5-message-strip v-if="step1Error"
                                    design="Negative" hide-close-button style="margin-bottom: 0.75rem;">
                                    {{ step1Error }}
                                </ui5-message-strip>

                                <div style="display: flex; gap: 0.5rem; margin-top: 1rem; align-items: center;">
                                    <ui5-button
                                        :design="['readying','ready'].includes(selectedCpiTenant.LifecycleState) ? 'Negative' : 'Emphasized'"
                                        :disabled="(!selectedCpiTenant.ID && !selectedCpiTenant.Name) || !cfIdentity.cfApiEndpoint || !cfIdentity.cfOrg || !cfIdentity.cfSpace || !cfToken || step1Loading"
                                        @click="onSaveCfIdentity">
                                        {{ ['readying','ready'].includes(selectedCpiTenant.LifecycleState) ? 'Re-enter CF Connection' : 'Save CF Connection' }}
                                    </ui5-button>
                                    <ui5-busy-indicator v-if="step1Loading" size="Small" active />
                                </div>
                            </div>
                        </ui5-wizard-step>

                        <!-- Step 2: Inspect -->
                        <ui5-wizard-step
                            title-text="Inspect"
                            subtitle-text="Check Prerequisites"
                            icon="search"
                            :selected="wizardStep === 2"
                            :disabled="selectedCpiTenant.LifecycleState === 'draft' || !selectedCpiTenant.ID"
                            @click="wizardStep = 2">
                            <div class="wizard-step-content">
                                <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor); display: block; margin-bottom: 0.75rem;">
                                    Inspect prerequisites before applying bootstrap. Uses the CF token from Step 1.
                                </ui5-text>

                                <ui5-message-strip v-if="!cfToken"
                                    design="Critical" hide-close-button style="margin-bottom: 0.75rem;">
                                    No CF token in this session — return to Step 1 to re-enter passcode.
                                </ui5-message-strip>

                                <template v-else>
                                    <div style="display: flex; gap: 0.5rem; margin-top: 1rem; align-items: center;">
                                        <ui5-button design="Default" :disabled="inspectLoading" @click="onPreview">
                                            Run Inspect
                                        </ui5-button>
                                        <ui5-busy-indicator v-if="inspectLoading" size="Small" active />
                                    </div>
                                    <ui5-message-strip v-if="step2Message && !bootstrapPreview"
                                        :design="step2Message.type" hide-close-button style="margin-top: 0.5rem;">
                                        {{ step2Message.text }}
                                    </ui5-message-strip>

                                    <template v-if="bootstrapPreview">
                                        <div class="section-divider" />
                                        <template v-if="bootstrapPreview.inspection.missingItems?.length">
                                            <ui5-text style="color: var(--sapInformativeTextColor); font-size: 0.85rem; display: block;">Would create:</ui5-text>
                                            <div v-for="item in bootstrapPreview.inspection.missingItems" :key="item" class="list-item">
                                                <ui5-text style="font-size: 0.8rem;">{{ item }}</ui5-text>
                                            </div>
                                        </template>
                                        <template v-if="bootstrapPreview.inspection.permissionIssues?.length">
                                            <ui5-text style="color: var(--sapNegativeTextColor); font-size: 0.85rem; display: block; margin-top: 0.5rem;">Permission issues:</ui5-text>
                                            <div v-for="item in bootstrapPreview.inspection.permissionIssues" :key="item" class="list-item">
                                                <ui5-text style="font-size: 0.8rem;">{{ item }}</ui5-text>
                                            </div>
                                        </template>
                                        <template v-if="bootstrapPreview.inspection.waitingUserAction?.length">
                                            <ui5-text style="color: var(--sapCriticalTextColor); font-size: 0.85rem; display: block; margin-top: 0.5rem;">Waiting for user action:</ui5-text>
                                            <div v-for="item in bootstrapPreview.inspection.waitingUserAction" :key="item" class="list-item">
                                                <ui5-text style="font-size: 0.8rem;">{{ item }}</ui5-text>
                                            </div>
                                        </template>
                                        <ui5-text v-if="!bootstrapPreview.inspection.missingItems?.length
                                            && !bootstrapPreview.inspection.permissionIssues?.length
                                            && !bootstrapPreview.inspection.waitingUserAction?.length"
                                            style="color: var(--sapPositiveTextColor); font-size: 0.85rem; display: block;">
                                            All prerequisites present — ready to apply.
                                        </ui5-text>
                                        <div v-if="!bootstrapPreview.inspection.missingItems?.length
                                            && !bootstrapPreview.inspection.permissionIssues?.length
                                            && !bootstrapPreview.inspection.waitingUserAction?.length"
                                            style="margin-top: 0.75rem; display: flex; gap: 0.5rem; align-items: center;">
                                            <ui5-button design="Emphasized"
                                                v-if="selectedCpiTenant.LifecycleState !== 'ready' && selectedCpiTenant.LifecycleState !== 'readying'"
                                                :disabled="bootstrapLoading" @click="onApply">
                                                Apply
                                            </ui5-button>
                                            <ui5-busy-indicator v-if="bootstrapLoading" size="Small" active />
                                        </div>
                                    </template>
                                </template>
                            </div>
                        </ui5-wizard-step>

                        <!-- Step 3: Job Status -->
                        <ui5-wizard-step
                            title-text="Apply"
                            subtitle-text="Job Status"
                            icon="play"
                            :selected="wizardStep === 3"
                            :disabled="selectedCpiTenant.LifecycleState === 'draft' || !selectedCpiTenant.ID"
                            @click="wizardStep = 3">
                            <div class="wizard-step-content">
                                <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor); display: block; margin-bottom: 0.75rem;">
                                    Monitor the bootstrap job progress. Use Retry or Reset if the job failed.
                                </ui5-text>

                                <ui5-message-strip v-if="selectedCpiTenant.LifecycleState === 'draft'"
                                    design="Critical" hide-close-button style="margin-bottom: 0.75rem;">
                                    Complete Step 1 first.
                                </ui5-message-strip>

                                <ui5-message-strip v-else-if="!cfToken"
                                    design="Critical" hide-close-button style="margin-bottom: 0.75rem;">
                                    No CF token in this session — return to Step 1 to re-enter passcode.
                                    If a bootstrap job is in a failed or partial state, you will be able to retry after re-entering the token.
                                </ui5-message-strip>

                                <template v-else>
                                    <div style="display: flex; gap: 0.5rem; margin-top: 1rem; align-items: center; flex-wrap: wrap;">
                                        <ui5-button design="Default"
                                            v-if="bootstrapJob?.State === 'failed' || bootstrapJob?.State === 'waiting_user_action' || bootstrapJob?.State === 'partially_applied'"
                                            :disabled="bootstrapLoading" @click="onRetry">
                                            Retry
                                        </ui5-button>
                                        <ui5-button design="Negative"
                                            v-if="selectedCpiTenant.LifecycleState === 'readying'"
                                            :disabled="bootstrapLoading" @click="onReset">
                                            Reset
                                        </ui5-button>
                                        <ui5-busy-indicator v-if="bootstrapLoading" size="Small" active />
                                    </div>
                                    <ui5-message-strip v-if="step3Message"
                                        :design="step3Message.type" hide-close-button style="margin-top: 0.5rem;">
                                        {{ step3Message.text }}
                                    </ui5-message-strip>

                                    <template v-if="bootstrapLoading">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem;">
                                            <ui5-busy-indicator size="Small" active />
                                            <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor);">Starting bootstrap job…</ui5-text>
                                        </div>
                                    </template>
                                    <template v-else-if="bootstrapJob">
                                        <div class="section-divider" />
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                            <ui5-text style="font-weight: bold;">Last Job</ui5-text>
                                            <ui5-tag :design="jobStateDesign">{{ bootstrapJob.State }}</ui5-tag>
                                            <ui5-busy-indicator v-if="bootstrapJob.State === 'running'" size="Small" active />
                                        </div>
                                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                                            <div>
                                                <ui5-text style="font-size: 0.8rem; font-weight: bold;">Type: </ui5-text>
                                                <ui5-text style="font-size: 0.8rem;">{{ bootstrapJob.JobType }}</ui5-text>
                                            </div>
                                            <div v-if="bootstrapJob.CurrentStep">
                                                <ui5-text style="font-size: 0.8rem; font-weight: bold;">Step: </ui5-text>
                                                <ui5-text style="font-size: 0.8rem;">{{ bootstrapJob.CurrentStep }}</ui5-text>
                                            </div>
                                            <div v-if="bootstrapJob.ErrorDetail">
                                                <ui5-text style="font-size: 0.8rem; color: var(--sapNegativeTextColor);">
                                                    Error: {{ bootstrapJob.ErrorDetail }}
                                                </ui5-text>
                                            </div>
                                            <div v-if="bootstrapJob.CredentialActions?.length">
                                                <ui5-text style="font-size: 0.8rem; font-weight: bold;">Credential Actions: </ui5-text>
                                                <div v-for="ca in bootstrapJob.CredentialActions" :key="ca.destinationName" class="list-item">
                                                    <ui5-text style="font-size: 0.75rem;">{{ ca.destinationName }} — {{ ca.actionType }}</ui5-text>
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                </template>
                            </div>
                        </ui5-wizard-step>

                    </ui5-wizard>

                    <!-- ── TMS Extension Card ── -->
                    <template v-if="selectedCpiTenant.ID">
                        <div class="section-divider" />
                        <div class="tms-extension-section">
                            <div class="status-header" style="margin-bottom: 0.5rem;">
                                <ui5-text style="font-weight: bold; font-size: 1rem;">TMS Extension</ui5-text>
                                <ui5-text style="font-size: 0.8rem; color: var(--sapContent_LabelColor); margin-left: 0.5rem;">
                                    (optional — only needed for TMS transport)
                                </ui5-text>
                                <ui5-busy-indicator v-if="tmsExtensionLoading" size="Small" active style="margin-left: 0.5rem;" />
                            </div>

                            <!-- Guard: not onboarded -->
                            <ui5-message-strip v-if="selectedCpiTenant.LifecycleState !== 'ready'"
                                design="Information" hide-close-button>
                                Complete tenant onboarding first (lifecycle must be "ready").
                            </ui5-message-strip>

                            <!-- Guard: TMS extension not available -->
                            <ui5-message-strip v-else-if="tmsExtension && !tmsExtension.available"
                                design="Critical" hide-close-button>
                                {{ tmsExtension.availabilityReason === 'CENTRAL_TMS_NOT_CONFIGURED'
                                    ? 'Central TMS is not configured. Configure it in System Configuration before enabling TMS extension.'
                                    : tmsExtension.availabilityReason === 'CENTRAL_TMS_NOT_LOADED'
                                    ? 'Central TMS configuration exists but the runtime client has not loaded yet. Check the TMS destination in BTP or wait for the service to retry.'
                                    : `TMS extension is not available: ${tmsExtension.availabilityReason}` }}
                            </ui5-message-strip>

                            <!-- Available -->
                            <template v-else-if="!tmsExtension || tmsExtension.available">
                                <!-- TMS detail statuses (when TMS bootstrap has been attempted) -->
                                <template v-if="['node_confirmed','bootstrapping','bootstrapped'].includes(selectedCpiTenant.TmsExtensionState)">
                                    <div class="prereq-group-header">TMS Resources</div>
                                    <div class="prereq-grid" style="margin-bottom: 0.75rem;">
                                        <div class="prereq-item">
                                            <ui5-tag :design="selectedCpiTenant.CasEngineDestinationName ? 'Positive' : 'Neutral'" style="font-size: 0.7rem; min-width: 64px;">
                                                {{ selectedCpiTenant.CasEngineDestinationName ? 'ready' : 'missing' }}
                                            </ui5-tag>
                                            <ui5-text style="font-size: 0.8rem; margin-left: 0.5rem;">
                                                {{ selectedCpiTenant.CasEngineDestinationName || 'CPIDELIVERY_CAS_{id}' }}
                                            </ui5-text>
                                        </div>
                                        <div v-for="p in tmsPrereqStatuses" :key="p.key" class="prereq-item">
                                            <ui5-tag :design="prereqDesign(p.value)" style="font-size: 0.7rem; min-width: 64px;">
                                                {{ p.value || 'missing' }}
                                            </ui5-tag>
                                            <ui5-text style="font-size: 0.8rem; margin-left: 0.5rem;">{{ p.label }}</ui5-text>
                                        </div>
                                    </div>
                                </template>

                                <!-- Node info (when a node is selected) -->
                                <div v-if="selectedCpiTenant.TmsSourceNodeName
                                        && selectedCpiTenant.TmsExtensionState !== 'not_started'"
                                    class="status-header" style="margin-bottom: 0.5rem;">
                                    <ui5-text style="font-size: 0.85rem;">
                                        Node: <strong>{{ selectedCpiTenant.TmsSourceNodeName }} (#{{ selectedCpiTenant.TmsSourceNodeID }})</strong>
                                    </ui5-text>
                                    <ui5-button v-if="selectedCpiTenant.TmsExtensionState !== 'bootstrapping'"
                                        design="Transparent" style="margin-left: 0.75rem;" :disabled="tmsLoading"
                                        @click="tmsChangeNode = true">
                                        Change Node
                                    </ui5-button>
                                </div>

                                <!-- Inline node change (shared across states) -->
                                <template v-if="tmsChangeNode && selectedCpiTenant.TmsExtensionState !== 'not_started'">
                                    <div style="margin-bottom: 0.75rem;">
                                        <ui5-select style="width: 100%; margin-bottom: 0.5rem;" :disabled="tmsLoading"
                                            @change="selectedTmsNode = tmsNodes.find(n => n.id === Number($event.detail.selectedOption.value)) ?? null">
                                            <ui5-option value="">— select a node —</ui5-option>
                                            <ui5-option v-for="node in tmsNodes" :key="node.id" :value="String(node.id)">
                                                {{ node.name }}{{ node.description ? ' — ' + node.description : '' }}
                                            </ui5-option>
                                        </ui5-select>
                                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                                            <ui5-button design="Emphasized" :disabled="!selectedTmsNode || tmsLoading" @click="onSelectNode">Select</ui5-button>
                                            <ui5-button design="Transparent" @click="tmsChangeNode = false">Cancel</ui5-button>
                                            <ui5-busy-indicator v-if="tmsLoading" size="Small" active />
                                        </div>
                                    </div>
                                </template>

                                <!-- ── State: not_started ── -->
                                <template v-if="!selectedCpiTenant.TmsExtensionState || selectedCpiTenant.TmsExtensionState === 'not_started'">
                                    <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor); display: block; margin-bottom: 0.75rem;">
                                        TMS extension creates CAS service instances and subscriber destinations in the tenant CF space,
                                        enabling Transport Management Service for delivering integration content.
                                    </ui5-text>
                                    <ui5-text class="field-label">TMS Source Node *</ui5-text>
                                    <ui5-select style="width: 100%;" :disabled="tmsLoading"
                                        @change="selectedTmsNode = tmsNodes.find(n => n.id === Number($event.detail.selectedOption.value)) ?? null">
                                        <ui5-option value="">— select a node —</ui5-option>
                                        <ui5-option v-for="node in tmsNodes" :key="node.id" :value="String(node.id)">
                                            {{ node.name }}{{ node.description ? ' — ' + node.description : '' }}
                                        </ui5-option>
                                    </ui5-select>
                                    <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; align-items: center;">
                                        <ui5-button design="Emphasized" :disabled="!selectedTmsNode || tmsLoading" @click="onSelectNode">
                                            Select Node
                                        </ui5-button>
                                        <ui5-busy-indicator v-if="tmsLoading" size="Small" active />
                                    </div>
                                </template>

                                <!-- ── State: node_confirmed ── -->
                                <template v-else-if="selectedCpiTenant.TmsExtensionState === 'node_confirmed'">
                                    <ui5-message-strip v-if="selectedCpiTenant.TmsBlockingReason"
                                        design="Critical" hide-close-button style="margin-bottom: 0.75rem;">
                                        {{ selectedCpiTenant.TmsBlockingReason === 'TMS_NODE_CHANGED' ? 'Node changed — re-apply to update TMS resources.' :
                                           selectedCpiTenant.TmsBlockingReason === 'PIR_KEY_CHANGED' ? 'PIR key changed — re-apply to update TMS resources.' :
                                           selectedCpiTenant.TmsBlockingReason === 'CENTRAL_TMS_CHANGED' ? 'Central TMS changed — select node and re-apply.' :
                                           selectedCpiTenant.TmsBlockingReason }}
                                    </ui5-message-strip>
                                    <ui5-message-strip v-if="!cfToken"
                                        design="Critical" hide-close-button style="margin-bottom: 0.75rem;">
                                        No CF token — return to Step 1 and re-enter passcode before Inspect or Apply.
                                    </ui5-message-strip>
                                    <!-- Routes (read-only display) -->
                                    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;">
                                        <ui5-button design="Default" :disabled="tmsLoading" @click="onRefreshRoutes">Refresh Routes</ui5-button>
                                        <ui5-busy-indicator v-if="tmsLoading" size="Small" active />
                                    </div>
                                    <template v-if="tmsRoutes.length > 0">
                                        <ui5-text style="font-weight: bold; margin-bottom: 0.5rem;">Routes ({{ tmsRoutes.length }})</ui5-text>
                                        <div v-for="route in tmsRoutes" :key="route.id" class="route-item">
                                            <ui5-text style="font-size: 0.85rem;">{{ route.name }} — {{ routeLabel(route) }}</ui5-text>
                                        </div>
                                    </template>
                                    <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; align-items: center;">
                                        <ui5-button design="Default" :disabled="!cfToken || tmsInspectLoading || tmsApplyLoading" @click="onTmsPreview">
                                            Inspect
                                        </ui5-button>
                                        <ui5-button design="Emphasized" :disabled="!cfToken || tmsApplyLoading || tmsInspectLoading" @click="onTmsApply">
                                            Apply
                                        </ui5-button>
                                        <ui5-busy-indicator v-if="tmsInspectLoading || tmsApplyLoading" size="Small" active />
                                    </div>
                                    <template v-if="tmsPreview">
                                            <div class="section-divider" />
                                            <template v-if="tmsPreview.inspection.missingItems?.length">
                                                <ui5-text style="color: var(--sapInformativeTextColor); font-size: 0.85rem; display: block;">Would create:</ui5-text>
                                                <div v-for="item in tmsPreview.inspection.missingItems" :key="item" class="list-item">
                                                    <ui5-text style="font-size: 0.8rem;">{{ item }}</ui5-text>
                                                </div>
                                            </template>
                                            <template v-if="tmsPreview.inspection.permissionIssues?.length">
                                                <ui5-text style="color: var(--sapNegativeTextColor); font-size: 0.85rem; display: block; margin-top: 0.5rem;">Permission issues:</ui5-text>
                                                <div v-for="item in tmsPreview.inspection.permissionIssues" :key="item" class="list-item">
                                                    <ui5-text style="font-size: 0.8rem;">{{ item }}</ui5-text>
                                                </div>
                                            </template>
                                            <template v-if="tmsPreview.inspection.waitingUserAction?.length">
                                                <ui5-text style="color: var(--sapCriticalTextColor); font-size: 0.85rem; display: block; margin-top: 0.5rem;">Waiting for user action:</ui5-text>
                                                <div v-for="item in tmsPreview.inspection.waitingUserAction" :key="item" class="list-item">
                                                    <ui5-text style="font-size: 0.8rem;">{{ item }}</ui5-text>
                                                </div>
                                            </template>
                                            <ui5-text v-if="!tmsPreview.inspection.missingItems?.length
                                                && !tmsPreview.inspection.permissionIssues?.length
                                                && !tmsPreview.inspection.waitingUserAction?.length"
                                                style="color: var(--sapPositiveTextColor); font-size: 0.85rem; display: block;">
                                                All TMS prerequisites present.
                                            </ui5-text>
                                        </template>
                                </template>

                                <!-- ── State: bootstrapping ── -->
                                <template v-else-if="selectedCpiTenant.TmsExtensionState === 'bootstrapping'">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                        <ui5-busy-indicator size="Small" active />
                                        <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor);">TMS bootstrap in progress…</ui5-text>
                                    </div>
                                    <template v-if="tmsExtension?.latestJob">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                            <ui5-text style="font-weight: bold;">TMS Job</ui5-text>
                                            <ui5-tag design="Information">{{ tmsExtension.latestJob.State }}</ui5-tag>
                                        </div>
                                        <div v-if="tmsExtension.latestJob.CurrentStep">
                                            <ui5-text style="font-size: 0.8rem; font-weight: bold;">Step: </ui5-text>
                                            <ui5-text style="font-size: 0.8rem;">{{ tmsExtension.latestJob.CurrentStep }}</ui5-text>
                                        </div>
                                    </template>
                                </template>

                                <!-- ── State: bootstrapped ── -->
                                <template v-else-if="selectedCpiTenant.TmsExtensionState === 'bootstrapped'">
                                    <ui5-message-strip design="Positive" hide-close-button style="margin-bottom: 0.75rem;">
                                        TMS extension is active.
                                    </ui5-message-strip>
                                    <ui5-message-strip v-if="!cfToken"
                                        design="Information" hide-close-button style="margin-bottom: 0.75rem;">
                                        Re-Apply requires a CF token — return to Step 1 to re-enter passcode if needed.
                                    </ui5-message-strip>
                                    <div style="display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.75rem;">
                                        <div v-if="selectedCpiTenant.CasEngineDestinationName">
                                            <ui5-text style="font-size: 0.8rem; font-weight: bold;">CAS Destination: </ui5-text>
                                            <ui5-text style="font-size: 0.8rem; font-family: var(--sapFontMonospaceFamily, monospace);">{{ selectedCpiTenant.CasEngineDestinationName }}</ui5-text>
                                        </div>
                                        <div v-if="tmsExtension?.latestJob?.EndedAt">
                                            <ui5-text style="font-size: 0.8rem; font-weight: bold;">Last TMS Job: </ui5-text>
                                            <ui5-text style="font-size: 0.8rem;">{{ new Date(tmsExtension.latestJob.EndedAt).toLocaleString() }}</ui5-text>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                                        <ui5-button design="Default" :disabled="!cfToken || tmsApplyLoading" @click="onTmsApply">
                                            Re-Apply
                                        </ui5-button>
                                        <ui5-busy-indicator v-if="tmsApplyLoading" size="Small" active />
                                    </div>
                                </template>

                                <!-- TMS card message -->
                                <ui5-message-strip v-if="tmsCardMessage"
                                    :design="tmsCardMessage.type" hide-close-button style="margin-top: 0.5rem;">
                                    {{ tmsCardMessage.text }}
                                </ui5-message-strip>
                            </template>
                        </div>
                    </template>

                </div>

        <ui5-toolbar slot="footer">
            <ui5-toolbar-button design="Transparent" text="Close" @click="closeManageModal" />
        </ui5-toolbar>
    </ui5-dialog>

    <!-- ── Tenant table ── -->
    <data-table title="CPI Tenants" :columns="cpiTenantColums" :data="cpiTenants"
        :custom-tool-bars="hasScope('CpiTenant.Manage') ? toolBars : []"
        :handle-add="hasScope('CpiTenant.Manage') ? handleAdd : undefined"
        :row-key="(row: CpiTenant) => row.ID"
        :row-actions="hasScope('CpiTenant.Manage') ? rowActions : []"
        :key="cpiTenants.length"
        :loading="loading" />
</template>

<script lang="ts">
import { defineComponent, h } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { cpiTenantColums, type ToolBar, type RowAction } from '@/service/consts'
import {
    DeleteCpiTenant, GetCpiTenants, UpsertCpiTenant,
    SaveCfIdentity, ListCfOrgs, ListCfSpaces, ExchangeCfPasscode,
    PreviewBootstrap, ApplyBootstrap, GetBootstrapStatus, RetryBootstrap, ResetBootstrap,
    SelectTmsNode, GetTmsExtensionRoutes,
    GetTmsExtension, PreviewTmsExtension, ApplyTmsExtension, ResetTmsExtension,
    GetCentralTmsContext, GetTransportNodes,
} from '@/service/api'
import type {
    CpiTenant, BootstrapPreview, BootstrapJob,
    TransportRoute, TenantLifecycleState,
    CentralTmsContext, TransportNode, TmsExtensionOverview, TmsExtensionState,
} from '@/service/model'
import "@ui5/webcomponents/dist/TableRowAction.js"
import "@ui5/webcomponents-icons/dist/connected.js"
import "@ui5/webcomponents-icons/dist/org-chart.js"
import "@ui5/webcomponents-icons/dist/edit.js"
import "@ui5/webcomponents-icons/dist/key.js"
import "@ui5/webcomponents-icons/dist/search.js"
import "@ui5/webcomponents-icons/dist/play.js"
import "@ui5/webcomponents/dist/BusyIndicator.js"
import "@ui5/webcomponents/dist/Dialog.js"
import "@ui5/webcomponents/dist/MessageStrip.js"
import "@ui5/webcomponents/dist/Tag.js"
import "@ui5/webcomponents/dist/Toolbar.js"
import "@ui5/webcomponents/dist/ToolbarButton.js"
import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents/dist/ComboBox.js"
import "@ui5/webcomponents/dist/ComboBoxItem.js"
import "@ui5/webcomponents/dist/Input.js"
import "@ui5/webcomponents/dist/Link.js"
import "@ui5/webcomponents/dist/SuggestionItem.js"
import "@ui5/webcomponents/dist/Text.js"
import "@ui5/webcomponents/dist/Select.js"
import "@ui5/webcomponents/dist/Option.js"
import "@ui5/webcomponents-fiori/dist/Wizard.js"
import "@ui5/webcomponents-fiori/dist/WizardStep.js"
import { useAuth } from '@/composables/useAuth'

export default defineComponent({
    components: { DataTable },
    setup() {
        const { hasScope } = useAuth()
        return { hasScope }
    },
    data() {
        const toolBars: ToolBar<CpiTenant>[] = [
            { text: 'Delete', func: (rows: CpiTenant[]) => this.handleDelete(rows) },
        ]
        const rowActions: RowAction<CpiTenant>[] = [
            {
                render: () => h('ui5-table-row-action', { icon: 'edit', text: 'Manage', interactive: true }),
                func: (row: CpiTenant) => this.handleManage(row),
            },
        ]
        return {
            cpiTenantColums,
            cpiTenants: [] as CpiTenant[],
            showManageModal: false,
            toolBars,
            rowActions,
            selectedCpiTenant: {} as CpiTenant,
            centralTmsContext: null as CentralTmsContext | null, // kept for SystemConfigView; not used in TMS guard
            loading: false,
            // Bootstrap wizard step: 1=CF Connection, 2=Inspect, 3=Apply
            wizardStep: 1 as 1 | 2 | 3,
            // Step 1 state
            cfIdentity: { cfApiEndpoint: '', cfOrg: '', cfSpace: '' },
            cfToken: '',
            step1Loading: false,
            step1Error: '',
            // CF org/space discovery
            cfOrgOptions: [] as { guid: string; name: string }[],
            cfSpaceOptions: [] as { guid: string; name: string }[],
            loadOrgsLoading: false,
            loadSpacesLoading: false,
            _loadOrgsDebounce: null as ReturnType<typeof setTimeout> | null,
            cfOrgMode: 'select' as 'select' | 'manual',
            cfSpaceMode: 'select' as 'select' | 'manual',
            // Per-step inline messages
            step2Message: null as { type: 'Positive' | 'Negative'; text: string } | null,
            step3Message: null as { type: 'Positive' | 'Negative'; text: string } | null,
            // Base bootstrap state
            bootstrapLoading: false,
            inspectLoading: false,
            bootstrapPreview: null as BootstrapPreview | null,
            bootstrapJob: null as BootstrapJob | null,
            pollTimer: null as ReturnType<typeof setInterval> | null,
            // TMS Extension card state
            tmsExtension: null as TmsExtensionOverview | null,
            tmsExtensionLoading: false,
            tmsInspectLoading: false,
            tmsApplyLoading: false,
            tmsPreview: null as BootstrapPreview | null,
            tmsCardMessage: null as { type: 'Positive' | 'Negative'; text: string } | null,
            tmsPollTimer: null as ReturnType<typeof setInterval> | null,
            tmsChangeNode: false,
            // TMS Node / routes (shared)
            selectedTmsNode: null as TransportNode | null,
            tmsNodes: [] as TransportNode[],
            tmsLoading: false,
            tmsRoutes: [] as TransportRoute[],
        }
    },
    computed: {
        lifecycleDesign(): string {
            const map: Record<TenantLifecycleState, string> = {
                draft: 'Information',
                configured: 'Set2',
                readying: 'Information',
                ready: 'Positive',
            }
            return map[this.selectedCpiTenant.LifecycleState] ?? 'Neutral'
        },
        tmsExtensionDesign(): string {
            const map: Record<TmsExtensionState, string> = {
                not_started: 'Neutral',
                node_confirmed: 'Set2',
                bootstrapping: 'Information',
                bootstrapped: 'Positive',
            }
            return map[this.selectedCpiTenant.TmsExtensionState] ?? 'Neutral'
        },
        jobStateDesign(): string {
            const map: Record<string, string> = {
                running: 'Information', waiting_user_action: 'Critical',
                partially_applied: 'Critical', failed: 'Negative', finished: 'Positive',
            }
            return map[this.bootstrapJob?.State ?? ''] ?? 'Neutral'
        },
        tmsPrereqStatuses() {
            const t = this.selectedCpiTenant
            return [
                { key: 'CasApplicationStatus', label: 'CAS (application)', value: t.CasApplicationStatus },
                { key: 'CasStandardStatus', label: 'CAS (standard)', value: t.CasStandardStatus },
                { key: 'CloudIntegrationDestStatus', label: 'CloudIntegration', value: t.CloudIntegrationDestStatus },
                { key: 'ContentAssemblyDestStatus', label: 'ContentAssemblyService', value: t.ContentAssemblyDestStatus },
                { key: 'TransportManagementDestStatus', label: 'TransportManagementService', value: t.TransportManagementDestStatus },
            ]
        },
        tagOptions(): { label: string; value: string }[] {
            const groups = Array.from(new Set(this.cpiTenants.map(t => t.Group).filter(g => g)))
            return groups.map(g => ({ label: g, value: g }))
        },
    },
    methods: {
        prereqDesign(status: string): string {
            const map: Record<string, string> = {
                missing: 'Neutral', ready: 'Positive', failed: 'Negative', registering: 'Information',
            }
            return map[status] ?? 'Neutral'
        },

        routeLabel(route: TransportRoute): string {
            const src = this.tmsNodes.find(n => n.id === route.sourceNodeId)?.name ?? `#${route.sourceNodeId}`
            const tgt = this.tmsNodes.find(n => n.id === route.targetNodeId)?.name ?? `#${route.targetNodeId}`
            return `${src} → ${tgt}`
        },

        // ── Dialog management ──────────────────────────────────────────────────

        handleAdd() {
            this.selectedCpiTenant = {} as CpiTenant
            this.bootstrapPreview = null
            this.tmsPreview = null
            this.tmsRoutes = []
            this.cfToken = ''
            this.cfIdentity = { cfApiEndpoint: '', cfOrg: '', cfSpace: '' }
            this.cfOrgOptions = []
            this.cfSpaceOptions = []
            this.cfOrgMode = 'select'
            this.cfSpaceMode = 'select'
            this.wizardStep = 1
            this.tmsExtension = null
            this.tmsChangeNode = false
            this.showManageModal = true
            this.loadTmsNodes()
        },
        async handleManage(row: CpiTenant) {
            this.selectedCpiTenant = { ...row }
            this.bootstrapPreview = null
            this.tmsPreview = null
            this.tmsRoutes = []
            this.cfToken = ''
            this.cfIdentity = {
                cfApiEndpoint: row.CfApiEndpoint || '',
                cfOrg: row.CfOrg || '',
                cfSpace: row.CfSpace || '',
            }
            this.cfOrgOptions = []
            this.cfSpaceOptions = []
            this.cfOrgMode = 'select'
            this.cfSpaceMode = 'select'
            this.tmsExtension = null
            this.tmsChangeNode = false
            this.tmsCardMessage = null
            // Step derivation: draft → 1; configured → 2; readying/ready → 3
            this.wizardStep = row.LifecycleState === 'draft' ? 1
                : (row.LifecycleState === 'configured' ? 2 : 3)
            this.showManageModal = true
            await this.refreshSelectedTenant()
            await this.loadBootstrapJob()
            if (this.selectedCpiTenant.LifecycleState === 'readying') this.startPoll()
            await this.loadTmsNodes()
            if (row.TmsSourceNodeName) await this.loadRoutes()
            await this.loadTmsExtension()
            if (this.selectedCpiTenant.TmsExtensionState === 'bootstrapping') this.startTmsPoll()
        },
        closeManageModal() {
            this.showManageModal = false
            this.stopPoll()
            this.stopTmsPoll()
            this.cfToken = ''
            this.cfIdentity = { cfApiEndpoint: '', cfOrg: '', cfSpace: '' }
            this.bootstrapPreview = null
            this.bootstrapJob = null
            this.step2Message = null
            this.step3Message = null
            this.tmsExtension = null
            this.tmsPreview = null
            this.tmsCardMessage = null
            this.selectedTmsNode = null
            this.tmsRoutes = []
            this.tmsChangeNode = false
        },

        // ── CRUD ───────────────────────────────────────────────────────────────

        async refresh() {
            this.loading = true
            try {
                this.cpiTenants = await GetCpiTenants() || []
                this.cpiTenants.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''))
            } finally {
                this.loading = false
            }
        },
        async handleDelete(rows: CpiTenant[]) {
            if (rows.length === 0) {
                window.$toast.warning('Please select at least one CPI Tenant')
                return
            }
            await DeleteCpiTenant(rows[0].ID)
            await this.refresh()
        },

        // ── Bootstrap Step 1 ──────────────────────────────────────────────────

        openCfLoginPage() {
            const base = this.cfIdentity.cfApiEndpoint.replace(/^https?:\/\/api\./, 'https://login.').replace(/\/$/, '')
            window.open(`${base}/passcode`, '_blank', 'noopener')
        },

        onCfTokenInput(value: string) {
            this.cfToken = value
            // For existing tenants, preserve the stored org/space when re-entering a token.
            // Only clear org/space for new tenants (no ID) where the user is starting fresh.
            if (!this.selectedCpiTenant.ID) {
                if (this.cfOrgOptions.length || this.cfSpaceOptions.length) {
                    this.cfOrgOptions = []
                    this.cfSpaceOptions = []
                    this.cfOrgMode = 'select'
                    this.cfSpaceMode = 'select'
                    this.cfIdentity.cfOrg = ''
                    this.cfIdentity.cfSpace = ''
                }
            }
            clearTimeout(this._loadOrgsDebounce ?? undefined)
            if (value && this.cfIdentity.cfApiEndpoint) {
                this._loadOrgsDebounce = setTimeout(() => this.loadCfOrgs(), 600)
            }
        },

        async loadCfOrgs() {
            if (!this.cfIdentity.cfApiEndpoint || !this.cfToken) return
            this.loadOrgsLoading = true
            this.cfOrgOptions = []
            this.cfSpaceOptions = []
            this.cfOrgMode = 'select'
            this.cfSpaceMode = 'select'
            // Only clear org/space for new tenants; existing tenants keep their stored values.
            if (!this.selectedCpiTenant.ID) {
                this.cfIdentity.cfOrg = ''
                this.cfIdentity.cfSpace = ''
            }
            try {
                const { accessToken } = await ExchangeCfPasscode(this.cfIdentity.cfApiEndpoint, this.cfToken)
                this.cfToken = accessToken
                this.cfOrgOptions = await ListCfOrgs(this.cfIdentity.cfApiEndpoint, this.cfToken)
            } catch {
                this.cfOrgMode = 'manual'
            } finally {
                this.loadOrgsLoading = false
            }
        },

        async onOrgSelect(guid: string) {
            this.cfIdentity.cfOrg = guid
            this.cfSpaceOptions = []
            this.cfIdentity.cfSpace = ''
            this.cfSpaceMode = 'select'
            if (!guid) return
            this.loadSpacesLoading = true
            try {
                this.cfSpaceOptions = await ListCfSpaces(this.cfIdentity.cfApiEndpoint, this.cfToken, guid)
            } catch {
                this.cfSpaceMode = 'manual'
            } finally {
                this.loadSpacesLoading = false
            }
        },

        async onSaveCfIdentity() {
            this.step1Loading = true
            try {
                if (!this.selectedCpiTenant.ID) {
                    // New tenant: create placeholder with Name + Group to obtain an ID.
                    const created = await UpsertCpiTenant({ Name: this.selectedCpiTenant.Name, Group: this.selectedCpiTenant.Group } as CpiTenant)
                    this.selectedCpiTenant = { ...this.selectedCpiTenant, ID: created.ID }
                } else {
                    // Existing tenant: save Name + Group if changed.
                    await UpsertCpiTenant({ ID: this.selectedCpiTenant.ID, Name: this.selectedCpiTenant.Name, Group: this.selectedCpiTenant.Group } as CpiTenant)
                }
                await SaveCfIdentity(this.selectedCpiTenant.ID, {
                    cfApiEndpoint: this.cfIdentity.cfApiEndpoint,
                    cfOrg: this.cfIdentity.cfOrg,
                    cfSpace: this.cfIdentity.cfSpace,
                    cfToken: this.cfToken,
                })
                await this.refresh()
                const updated = this.cpiTenants.find(t => t.ID === this.selectedCpiTenant.ID)
                if (updated) this.selectedCpiTenant = { ...updated }
                this.step1Error = ''
                this.wizardStep = 2
                // Ensure TMS node list is available for the TMS Extension card.
                await this.loadTmsNodes()
            } catch (e: any) {
                this.step1Error = e?.message ?? 'CF identity verification failed'
            } finally {
                this.step1Loading = false
            }
        },

        // ── Bootstrap Steps 2+3 ───────────────────────────────────────────────

        async refreshSelectedTenant() {
            await this.refresh()
            const updated = this.cpiTenants.find(t => t.ID === this.selectedCpiTenant.ID)
            if (updated) this.selectedCpiTenant = { ...updated }
        },

        async loadBootstrapJob() {
            if (!this.selectedCpiTenant.ID) return
            try {
                this.bootstrapJob = await GetBootstrapStatus(this.selectedCpiTenant.ID)
            } catch {
                this.bootstrapJob = null
            }
        },

        startPoll() {
            if (this.pollTimer) return
            this.pollTimer = setInterval(async () => {
                if (!this.selectedCpiTenant.ID) { this.stopPoll(); return }
                await this.refreshSelectedTenant()
                await this.loadBootstrapJob()
                if (this.selectedCpiTenant.LifecycleState !== 'readying') {
                    this.stopPoll()
                }
            }, 3000)
        },
        stopPoll() {
            if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
        },
        async onPreview() {
            this.inspectLoading = true
            this.bootstrapPreview = null
            this.step2Message = null
            try {
                this.bootstrapPreview = await PreviewBootstrap(this.selectedCpiTenant.ID, this.cfToken)
                window.$toast.success('Bootstrap inspection completed')
            } catch (e: any) {
                if (e?.status === 401) this.cfToken = ''
                const msg = e?.message ?? 'Inspect failed'
                this.step2Message = { type: 'Negative', text: msg }
            } finally {
                this.inspectLoading = false
            }
        },
        async onApply() {
            this.bootstrapLoading = true
            this.bootstrapPreview = null
            this.step2Message = null
            try {
                const { jobId } = await ApplyBootstrap(this.selectedCpiTenant.ID, this.cfToken)
                this.bootstrapJob = { ID: jobId, State: 'running', JobType: 'apply' } as any
                this.wizardStep = 3
                this.stopPoll()
                this.startPoll()
                window.$toast.success('Bootstrap apply started')
            } catch (e: any) {
                if (e?.status === 401) this.cfToken = ''
                const msg = e?.message ?? 'Apply failed'
                this.step2Message = { type: 'Negative', text: msg }
            } finally {
                this.bootstrapLoading = false
            }
        },
        async onRetry() {
            this.bootstrapLoading = true
            this.step3Message = null
            try {
                const { jobId } = await RetryBootstrap(this.selectedCpiTenant.ID, this.cfToken)
                this.bootstrapJob = { ID: jobId, State: 'running', JobType: 'retry' } as any
                this.stopPoll()
                this.startPoll()
                window.$toast.success('Bootstrap retry started')
            } catch (e: any) {
                if (e?.status === 401) this.cfToken = ''
                const msg = e?.message ?? 'Retry failed'
                this.step3Message = { type: 'Negative', text: msg }
            } finally {
                this.bootstrapLoading = false
            }
        },
        async onReset() {
            this.bootstrapLoading = true
            this.step3Message = null
            try {
                await ResetBootstrap(this.selectedCpiTenant.ID)
                await this.refreshSelectedTenant()
                await this.loadBootstrapJob()
                this.step3Message = { type: 'Positive', text: 'Bootstrap reset — tenant returned to configured state.' }
                window.$toast.success('Bootstrap reset — tenant returned to configured state')
            } catch (e: any) {
                const msg = e?.message ?? 'Reset failed'
                this.step3Message = { type: 'Negative', text: msg }
            } finally {
                this.bootstrapLoading = false
            }
        },

        // ── TMS Extension ─────────────────────────────────────────────────────

        async loadTmsExtension() {
            if (!this.selectedCpiTenant.ID) return
            this.tmsExtensionLoading = true
            try {
                this.tmsExtension = await GetTmsExtension(this.selectedCpiTenant.ID)
            } catch {
                this.tmsExtension = null
            } finally {
                this.tmsExtensionLoading = false
            }
        },

        async loadRoutes() {
            if (!this.selectedCpiTenant.ID) return
            try {
                const res = await GetTmsExtensionRoutes(this.selectedCpiTenant.ID)
                this.tmsRoutes = res.routes || []
            } catch {
                this.tmsRoutes = []
            }
        },
        async onRefreshRoutes() {
            this.tmsLoading = true
            try { await this.loadRoutes() } finally { this.tmsLoading = false }
        },
        async loadTmsNodes() {
            try {
                this.tmsNodes = await GetTransportNodes()
            } catch (e: any) {
                this.tmsCardMessage = { type: 'Negative', text: e?.message ?? 'Failed to load TMS nodes' }
            }
        },
        async onSelectNode() {
            if (!this.selectedTmsNode) return
            this.tmsLoading = true
            this.tmsCardMessage = null
            try {
                await SelectTmsNode(this.selectedCpiTenant.ID, { nodeId: this.selectedTmsNode.id, nodeName: this.selectedTmsNode.name })
                await this.refreshSelectedTenant()
                this.tmsChangeNode = false
                this.selectedTmsNode = null
                this.tmsCardMessage = { type: 'Positive', text: `Node "${this.selectedCpiTenant.TmsSourceNodeName}" selected — configure routes in TMS UI.` }
                await this.loadRoutes()
                await this.loadTmsExtension()
            } catch (e: any) {
                this.tmsCardMessage = { type: 'Negative', text: e?.message ?? 'Node selection failed' }
            } finally {
                this.tmsLoading = false
            }
        },

        async onTmsPreview() {
            this.tmsInspectLoading = true
            this.tmsPreview = null
            this.tmsCardMessage = null
            try {
                this.tmsPreview = await PreviewTmsExtension(this.selectedCpiTenant.ID, this.cfToken)
                window.$toast.success('TMS inspection completed')
            } catch (e: any) {
                if (e?.status === 401) this.cfToken = ''
                this.tmsCardMessage = { type: 'Negative', text: e?.message ?? 'TMS inspect failed' }
            } finally {
                this.tmsInspectLoading = false
            }
        },

        async onTmsApply() {
            this.tmsApplyLoading = true
            this.tmsPreview = null
            this.tmsCardMessage = null
            try {
                await ApplyTmsExtension(this.selectedCpiTenant.ID, this.cfToken)
                await this.refreshSelectedTenant()
                await this.loadTmsExtension()
                this.startTmsPoll()
                window.$toast.success('TMS extension apply started')
            } catch (e: any) {
                if (e?.status === 401) this.cfToken = ''
                this.tmsCardMessage = { type: 'Negative', text: e?.message ?? 'TMS apply failed' }
            } finally {
                this.tmsApplyLoading = false
            }
        },

        async onTmsReset() {
            this.tmsApplyLoading = true
            this.tmsCardMessage = null
            try {
                await ResetTmsExtension(this.selectedCpiTenant.ID)
                await this.refreshSelectedTenant()
                await this.loadTmsExtension()
                this.tmsCardMessage = { type: 'Positive', text: 'TMS extension reset to not_started.' }
                window.$toast.success('TMS extension reset')
            } catch (e: any) {
                this.tmsCardMessage = { type: 'Negative', text: e?.message ?? 'TMS reset failed' }
            } finally {
                this.tmsApplyLoading = false
            }
        },

        startTmsPoll() {
            if (this.tmsPollTimer) return
            this.tmsPollTimer = setInterval(async () => {
                if (!this.selectedCpiTenant.ID) { this.stopTmsPoll(); return }
                await this.refreshSelectedTenant()
                await this.loadTmsExtension()
                if (this.selectedCpiTenant.TmsExtensionState !== 'bootstrapping') {
                    this.stopTmsPoll()
                }
            }, 3000)
        },
        stopTmsPoll() {
            if (this.tmsPollTimer) { clearInterval(this.tmsPollTimer); this.tmsPollTimer = null }
        },

        // ── Form helpers ───────────────────────────────────────────────────────

        onSelectTag(event: any) {
            this.selectedCpiTenant.Group = event.target.value
        },
    },
    async created() {
        await this.refresh()
        try {
            this.centralTmsContext = await GetCentralTmsContext()
        } catch {
            this.centralTmsContext = null
        }
    },
    unmounted() {
        this.stopPoll()
        this.stopTmsPoll()
    },
})
</script>

<style scoped>
.flex-vertical {
    display: flex;
    flex-direction: column;
}

.field-label {
    font-weight: bold;
    margin-top: 0.75rem;
}

.field-label:first-child {
    margin-top: 0;
}

.tab-content {
    padding: 1rem 0.25rem;
}

.wizard-step-content {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0;
}

.status-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
}

.prereq-group-header {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sapContent_LabelColor);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0.75rem 0 0.3rem;
}

.prereq-group-header:first-child {
    margin-top: 0;
}

.prereq-group-note {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: var(--sapNeutralTextColor);
    margin-left: 0.35rem;
}

.prereq-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem 1rem;
}

.prereq-item {
    display: flex;
    align-items: center;
}

.section-divider {
    border-top: 1px solid var(--sapList_BorderColor);
    margin: 1rem 0;
}

.list-item {
    display: flex;
    align-items: center;
    padding: 0.15rem 0.5rem;
}

.route-item {
    display: flex;
    align-items: center;
    padding: 0.2rem 0.5rem;
    background: var(--sapList_Background);
    border-radius: 4px;
    margin-bottom: 0.25rem;
}

.tms-extension-section {
    padding: 0.25rem 0;
}
</style>
