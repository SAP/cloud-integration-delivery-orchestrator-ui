<template>
    <!-- ── Manage dialog (wide, tabbed) ── -->
    <ui5-dialog
        :header-text="selectedCpiTenant.ID ? `Manage: ${selectedCpiTenant.Name || ''}` : 'New CPI Tenant'"
        :open="showManageModal"
        @close="closeManageModal"
        style="width: 64%; min-width: 680px;">

        <ui5-tabcontainer>

            <!-- ── Tab: Tenant Info (existing tenants only) ── -->
            <ui5-tab v-if="selectedCpiTenant.ID" text="Tenant Info">
                <div class="flex-vertical tab-content">
                    <ui5-text class="field-label">Name</ui5-text>
                    <ui5-input :value="selectedCpiTenant.Name || ''" @change="selectedCpiTenant.Name = $event.target.value"
                        style="width: 100%;" />

                    <ui5-text class="field-label">Tag</ui5-text>
                    <ui5-input :value="selectedCpiTenant.Group || ''" @change="onSelectTag"
                        placeholder="e.g. Dev, Test, Production" showSuggestions style="width: 100%;">
                        <ui5-suggestion-item v-for="tag in tagOptions" :key="tag.value" :text="tag.value" />
                    </ui5-input>

                    <template v-if="selectedCpiTenant.PirApiUrl">
                        <div class="section-divider" />
                        <ui5-text class="field-label">PIR API URL</ui5-text>
                        <ui5-link :href="selectedCpiTenant.PirApiUrl" target="_blank" style="font-size: 0.85rem; word-break: break-all;">
                            {{ selectedCpiTenant.PirApiUrl }}
                        </ui5-link>
                    </template>

                    <div style="padding-top: 1rem;">
                        <ui5-button design="Emphasized" @click="onSave" :disabled="saving">Save</ui5-button>
                    </div>
                </div>
            </ui5-tab>

            <!-- ── Tab: Bootstrap ── -->
            <ui5-tab text="Bootstrap">
                <div class="tab-content">

                    <!-- Lifecycle + BlockingReason -->
                    <div class="status-header">
                        <ui5-text style="font-weight: bold; font-size: 1rem;">Lifecycle</ui5-text>
                        <ui5-tag :design="lifecycleDesign" style="margin-left: 0.5rem;">
                            {{ selectedCpiTenant.LifecycleState || 'draft' }}
                        </ui5-tag>
                        <ui5-text v-if="selectedCpiTenant.BlockingReason"
                            style="color: var(--sapCriticalTextColor); margin-left: 0.75rem; font-size: 0.8rem;">
                            {{ selectedCpiTenant.BlockingReason }}
                        </ui5-text>
                    </div>

                    <!-- ── Prerequisite grid — 3 groups ── -->
                    <div style="margin-bottom: 1rem;">

                        <!-- Group 1: Provider-side Destinations (in cpi-delivery subaccount) -->
                        <div class="prereq-group-header">Provider Destinations <span class="prereq-group-note">(cpi-delivery subaccount)</span></div>
                        <div class="prereq-grid" style="margin-bottom: 0.5rem;">
                            <div class="prereq-item">
                                <ui5-tag :design="selectedCpiTenant.PirApiDestinationName ? 'Positive' : 'Neutral'" style="font-size: 0.7rem; min-width: 64px;">
                                    {{ selectedCpiTenant.PirApiDestinationName ? 'ready' : 'missing' }}
                                </ui5-tag>
                                <ui5-text style="font-size: 0.8rem; margin-left: 0.5rem;">
                                    {{ selectedCpiTenant.PirApiDestinationName || 'CPIDELIVERY_PIR_{id}' }}
                                </ui5-text>
                            </div>
                            <div class="prereq-item">
                                <ui5-tag :design="selectedCpiTenant.CasEngineDestinationName ? 'Positive' : 'Neutral'" style="font-size: 0.7rem; min-width: 64px;">
                                    {{ selectedCpiTenant.CasEngineDestinationName ? 'ready' : 'missing' }}
                                </ui5-tag>
                                <ui5-text style="font-size: 0.8rem; margin-left: 0.5rem;">
                                    {{ selectedCpiTenant.CasEngineDestinationName || 'CPIDELIVERY_CAS_{id}' }}
                                </ui5-text>
                            </div>
                        </div>

                        <!-- Group 2: Subscriber Service Instances -->
                        <div class="prereq-group-header">Subscriber Service Instances <span class="prereq-group-note">(CPI tenant subaccount)</span></div>
                        <div class="prereq-grid" style="margin-bottom: 0.5rem;">
                            <div v-for="p in subscriberInstanceStatuses" :key="p.key" class="prereq-item">
                                <ui5-tag :design="prereqDesign(p.value)" style="font-size: 0.7rem; min-width: 64px;">
                                    {{ p.value || 'missing' }}
                                </ui5-tag>
                                <ui5-text style="font-size: 0.8rem; margin-left: 0.5rem;">{{ p.label }}</ui5-text>
                            </div>
                        </div>

                        <!-- Group 3: Subscriber Destinations -->
                        <div class="prereq-group-header">Subscriber Destinations <span class="prereq-group-note">(CPI tenant Destination Service)</span></div>
                        <div class="prereq-grid">
                            <div v-for="p in subscriberDestStatuses" :key="p.key" class="prereq-item">
                                <ui5-tag :design="prereqDesign(p.value)" style="font-size: 0.7rem; min-width: 64px;">
                                    {{ p.value || 'missing' }}
                                </ui5-tag>
                                <ui5-text style="font-size: 0.8rem; margin-left: 0.5rem;">{{ p.label }}</ui5-text>
                            </div>
                        </div>
                    </div>

                    <div class="section-divider" />

                    <!-- ── 4-step Wizard ── -->
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

                                <template v-if="!selectedCpiTenant.ID">
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
                                </template>

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

                        <!-- Step 2: TMS Node Selection -->
                        <ui5-wizard-step
                            title-text="TMS Node"
                            subtitle-text="Register Source Node"
                            icon="org-chart"
                            :selected="wizardStep === 2"
                            :disabled="selectedCpiTenant.LifecycleState === 'draft' || !selectedCpiTenant.ID"
                            @click="wizardStep = 2">
                            <div class="wizard-step-content">
                                <ui5-message-strip v-if="selectedCpiTenant.LifecycleState === 'draft'"
                                    design="Critical" hide-close-button style="margin-bottom: 0.75rem;">
                                    Complete Step 1 (CF Connection) first.
                                </ui5-message-strip>

                                <template v-else>
                                    <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor); display: block; margin-bottom: 0.75rem;">
                                        Select and register a TMS source node. This is required before Apply — the node name is written into the
                                        <strong>TransportManagementService</strong> destination as <code>sourceSystemId</code>.
                                    </ui5-text>

                                    <div class="status-header" style="margin-bottom: 0.5rem;">
                                        <ui5-text style="font-size: 0.85rem; font-weight: bold;">Registration Status</ui5-text>
                                        <ui5-tag :design="tmsStatusDesign" style="margin-left: 0.5rem; font-size: 0.7rem;">
                                            {{ selectedCpiTenant.TmsNodeRegistrationStatus || 'missing' }}
                                        </ui5-tag>
                                        <ui5-text v-if="selectedCpiTenant.TmsSourceNodeName"
                                            style="color: var(--sapNeutralTextColor); margin-left: 0.75rem; font-size: 0.85rem;">
                                            Node: <strong>{{ selectedCpiTenant.TmsSourceNodeName }}(#{{ selectedCpiTenant.TmsSourceNodeID }})</strong>
                                        </ui5-text>
                                    </div>

                                    <!-- Node selection — shown when not yet registered (missing) -->
                                    <template v-if="!selectedCpiTenant.TmsNodeRegistrationStatus
                                        || selectedCpiTenant.TmsNodeRegistrationStatus === 'missing'">
                                        <ui5-text class="field-label">TMS Source Node *</ui5-text>
                                        <ui5-select style="width: 100%;" :disabled="tmsLoading"
                                            @change="selectedTmsNode = tmsNodes.find(n => n.id === Number($event.detail.selectedOption.value)) ?? null">
                                            <ui5-option value="">— select a node —</ui5-option>
                                            <ui5-option v-for="node in tmsNodes" :key="node.id" :value="String(node.id)">
                                                {{ node.name }}{{ node.description ? ' — ' + node.description : '' }}
                                            </ui5-option>
                                        </ui5-select>
                                        <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; align-items: center;">
                                            <ui5-button design="Emphasized" :disabled="!selectedTmsNode || tmsLoading" @click="onRegisterTmsNode">
                                                Verify &amp; Register
                                            </ui5-button>
                                            <ui5-busy-indicator v-if="tmsLoading" size="Small" active />
                                        </div>
                                        <ui5-message-strip v-if="step2Message"
                                            :design="step2Message.type" hide-close-button style="margin-top: 0.5rem;">
                                            {{ step2Message.text }}
                                        </ui5-message-strip>
                                    </template>

                                    <!-- Route confirmation — shown after registering -->
                                    <template v-if="selectedCpiTenant.TmsNodeRegistrationStatus === 'registering'">
                                        <div class="section-divider" />
                                        <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor);">
                                            Node <strong>{{ selectedCpiTenant.TmsSourceNodeName }}</strong> registered.
                                            Configure Routes in the TMS UI, then confirm below.
                                        </ui5-text>
                                        <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; align-items: center;">
                                            <ui5-button design="Default" :disabled="tmsLoading" @click="onRefreshRoutes">
                                                I have configured Routes — Refresh
                                            </ui5-button>
                                            <ui5-busy-indicator v-if="tmsLoading" size="Small" active />
                                        </div>
                                        <template v-if="tmsRoutes.length > 0">
                                            <div class="section-divider" />
                                            <ui5-text style="font-weight: bold; margin-bottom: 0.5rem;">Routes ({{ tmsRoutes.length }})</ui5-text>
                                            <div v-for="route in tmsRoutes" :key="route.id" class="route-item">
                                                <ui5-text style="font-size: 0.85rem;">
                                                    {{ route.name }} —
                                                    <template v-if="route.sourceNodeId === selectedCpiTenant.TmsSourceNodeID">
                                                        outbound: {{ tmsNodes.find(n => n.id === route.sourceNodeId)?.name ?? '?' }}(#{{ route.sourceNodeId }}) → {{ tmsNodes.find(n => n.id === route.targetNodeId)?.name ?? '?' }}(#{{ route.targetNodeId }})
                                                    </template>
                                                    <template v-else>
                                                        inbound: {{ tmsNodes.find(n => n.id === route.sourceNodeId)?.name ?? '?' }}(#{{ route.sourceNodeId }}) → {{ tmsNodes.find(n => n.id === route.targetNodeId)?.name ?? '?' }}(#{{ route.targetNodeId }})
                                                    </template>
                                                </ui5-text>
                                            </div>
                                            <div style="margin-top: 0.75rem;">
                                                <ui5-button design="Positive" :disabled="tmsLoading" @click="onConfirmRoutes">
                                                    Confirm Routes — Mark Ready
                                                </ui5-button>
                                            </div>
                                        </template>
                                        <ui5-text v-else-if="!tmsLoading"
                                            style="color: var(--sapNeutralTextColor); font-size: 0.85rem; margin-top: 0.75rem; display: block;">
                                            No routes found yet. Configure routes in TMS UI, then click Refresh.
                                        </ui5-text>
                                        <ui5-message-strip v-if="step2Message"
                                            :design="step2Message.type" hide-close-button style="margin-top: 0.5rem;">
                                            {{ step2Message.text }}
                                        </ui5-message-strip>
                                    </template>

                                    <!-- Ready state -->
                                    <template v-if="selectedCpiTenant.TmsNodeRegistrationStatus === 'ready'">
                                        <ui5-message-strip design="Positive" hide-close-button style="margin-top: 0.5rem;">
                                            TMS Node registered and routes confirmed — proceed to Inspect.
                                        </ui5-message-strip>
                                        <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                                            <ui5-button design="Transparent" :disabled="tmsLoading" @click="onRefreshRoutes">
                                                Refresh Routes
                                            </ui5-button>
                                            <ui5-busy-indicator v-if="tmsLoading" size="Small" active />
                                        </div>
                                        <template v-if="tmsRoutes.length > 0">
                                            <div class="section-divider" />
                                            <ui5-text style="font-weight: bold; margin-bottom: 0.5rem;">Routes ({{ tmsRoutes.length }})</ui5-text>
                                            <div v-for="route in tmsRoutes" :key="route.id" class="route-item">
                                                <ui5-text style="font-size: 0.85rem;">{{ route.name }} — {{ tmsNodes.find(n => n.id === route.sourceNodeId)?.name ?? '?' }}(#{{ route.sourceNodeId }}) → {{ tmsNodes.find(n => n.id === route.targetNodeId)?.name ?? '?' }}(#{{ route.targetNodeId }})</ui5-text>
                                            </div>
                                        </template>
                                    </template>
                                </template>
                            </div>
                        </ui5-wizard-step>

                        <!-- Step 3: Inspect -->
                        <ui5-wizard-step
                            title-text="Inspect"
                            subtitle-text="Check Prerequisites"
                            icon="search"
                            :selected="wizardStep === 3"
                            :disabled="selectedCpiTenant.TmsNodeRegistrationStatus !== 'ready'"
                            @click="wizardStep = 3">
                            <div class="wizard-step-content">
                                <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor); display: block; margin-bottom: 0.75rem;">
                                    Inspect prerequisites before applying bootstrap. Uses the CF token from Step 1.
                                </ui5-text>

                                <ui5-message-strip v-if="selectedCpiTenant.TmsNodeRegistrationStatus !== 'ready'"
                                    design="Critical" hide-close-button style="margin-bottom: 0.75rem;">
                                    Complete Step 2 (TMS Node) first.
                                </ui5-message-strip>

                                <ui5-message-strip v-else-if="!cfToken"
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
                                    <ui5-message-strip v-if="step3Message && !bootstrapPreview"
                                        :design="step3Message.type" hide-close-button style="margin-top: 0.5rem;">
                                        {{ step3Message.text }}
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

                        <!-- Step 4: Job Status -->
                        <ui5-wizard-step
                            title-text="Apply"
                            subtitle-text="Job Status"
                            icon="play"
                            :selected="wizardStep === 4"
                            :disabled="selectedCpiTenant.TmsNodeRegistrationStatus !== 'ready' || selectedCpiTenant.LifecycleState === 'draft'"
                            @click="wizardStep = 4">
                            <div class="wizard-step-content">
                                <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor); display: block; margin-bottom: 0.75rem;">
                                    Monitor the bootstrap job progress. Use Retry or Reset if the job failed.
                                </ui5-text>

                                <ui5-message-strip v-if="selectedCpiTenant.LifecycleState === 'draft'"
                                    design="Critical" hide-close-button style="margin-bottom: 0.75rem;">
                                    Complete Steps 1 and 2 first.
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
                                    <ui5-message-strip v-if="step4Message"
                                        :design="step4Message.type" hide-close-button style="margin-top: 0.5rem;">
                                        {{ step4Message.text }}
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

                </div>
            </ui5-tab>


        </ui5-tabcontainer>

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
    RegisterTmsNode, GetTmsNodeRoutes, ConfirmTmsRoutes,
    GetCentralTmsContext, GetTransportNodes,
} from '@/service/api'
import type {
    CpiTenant, BootstrapPreview, BootstrapJob,
    TransportRoute, TenantLifecycleState, PrerequisiteStatus, CentralTmsContext, TransportNode,
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
import "@ui5/webcomponents/dist/TabContainer.js"
import "@ui5/webcomponents/dist/Tab.js"
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
            centralTmsContext: null as CentralTmsContext | null,
            loading: false,
            saving: false,
            // Bootstrap wizard step: 1=CF Connection, 2=TMS Node, 3=Inspect, 4=Apply
            wizardStep: 1 as 1 | 2 | 3 | 4,
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
            // Per-step inline message (replaces toast for modal operations)
            step2Message: null as { type: 'Positive' | 'Negative'; text: string } | null,
            step3Message: null as { type: 'Positive' | 'Negative'; text: string } | null,
            step4Message: null as { type: 'Positive' | 'Negative'; text: string } | null,
            // Step 2+3 state
            bootstrapLoading: false,
            inspectLoading: false,
            bootstrapPreview: null as BootstrapPreview | null,
            bootstrapJob: null as BootstrapJob | null,
            pollTimer: null as ReturnType<typeof setInterval> | null,
            // TMS Node state
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
                not_ready: 'Critical',
                readying: 'Information',
                ready: 'Positive',
            }
            return map[this.selectedCpiTenant.LifecycleState] ?? 'Neutral'
        },
        tmsStatusDesign(): string {
            const map: Partial<Record<PrerequisiteStatus, string>> = {
                missing: 'Neutral', registering: 'Information', ready: 'Positive',
            }
            return map[this.selectedCpiTenant.TmsNodeRegistrationStatus] ?? 'Neutral'
        },
        jobStateDesign(): string {
            const map: Record<string, string> = {
                running: 'Information', waiting_user_action: 'Critical',
                partially_applied: 'Critical', failed: 'Negative', finished: 'Positive',
            }
            return map[this.bootstrapJob?.State ?? ''] ?? 'Neutral'
        },
        subscriberInstanceStatuses() {
            const t = this.selectedCpiTenant
            return [
                { key: 'PirApiStatus', label: 'pir-api (it-rt / api)', value: t.PirApiStatus },
                { key: 'CasApplicationStatus', label: 'content-agent-engine (CAS / application)', value: t.CasApplicationStatus },
                { key: 'CasStandardStatus', label: 'content-agent-assembly (CAS / standard)', value: t.CasStandardStatus },
            ]
        },
        subscriberDestStatuses() {
            const t = this.selectedCpiTenant
            return [
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

        // ── Dialog management ──────────────────────────────────────────────────

        handleAdd() {
            this.selectedCpiTenant = {} as CpiTenant
            this.bootstrapPreview = null
            this.tmsRoutes = []
            this.cfToken = ''
            this.cfIdentity = { cfApiEndpoint: '', cfOrg: '', cfSpace: '' }
            this.cfOrgOptions = []
            this.cfSpaceOptions = []
            this.cfOrgMode = 'select'
            this.cfSpaceMode = 'select'
            this.wizardStep = 1
            this.showManageModal = true
        },
        async handleManage(row: CpiTenant) {
            this.selectedCpiTenant = { ...row }
            this.bootstrapPreview = null
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
            this.wizardStep = row.LifecycleState === 'draft' ? 1
                : (row.TmsNodeRegistrationStatus !== 'ready' ? 2
                : (row.LifecycleState === 'configured' ? 3 : 4))
            this.showManageModal = true
            await this.refreshSelectedTenant()
            await this.loadBootstrapJob()
            if (this.selectedCpiTenant.LifecycleState === 'readying') this.startPoll()
            if (row.TmsSourceNodeName) await this.loadRoutes()
            await this.loadTmsNodes()
        },
        closeManageModal() {
            this.showManageModal = false
            this.stopPoll()
            this.cfToken = ''
            this.cfIdentity = { cfApiEndpoint: '', cfOrg: '', cfSpace: '' }
            this.bootstrapPreview = null
            this.bootstrapJob = null
            this.step2Message = null
            this.step3Message = null
            this.step4Message = null
            this.selectedTmsNode = null
            this.tmsRoutes = []
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
        async onSave() {
            this.saving = true
            try {
                const result = await UpsertCpiTenant(this.selectedCpiTenant)
                await this.refresh()
                const updated = this.cpiTenants.find(t => t.ID === (result.ID || this.selectedCpiTenant.ID))
                if (updated) this.selectedCpiTenant = { ...updated }
                window.$toast.success('Tenant saved')
            } catch (e: any) {
                window.$toast.error(e?.message ?? 'Save failed')
            } finally {
                this.saving = false
            }
        },

        // ── Bootstrap Step 1 ──────────────────────────────────────────────────

        openCfLoginPage() {
            // Derive login URL: https://api.cf.<region>.hana.ondemand.com → https://login.cf.<region>.hana.ondemand.com/passcode
            const base = this.cfIdentity.cfApiEndpoint.replace(/^https?:\/\/api\./, 'https://login.').replace(/\/$/, '')
            window.open(`${base}/passcode`, '_blank', 'noopener')
        },

        onCfTokenInput(value: string) {
            this.cfToken = value
            // Token changed — stale org/space options are invalid, reset
            if (this.cfOrgOptions.length || this.cfSpaceOptions.length) {
                this.cfOrgOptions = []
                this.cfSpaceOptions = []
                this.cfOrgMode = 'select'
                this.cfSpaceMode = 'select'
                this.cfIdentity.cfOrg = ''
                this.cfIdentity.cfSpace = ''
            }
            // Auto-load orgs once passcode looks complete (non-empty + endpoint set).
            // Debounced so rapid typing doesn't fire multiple requests.
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
            this.cfIdentity.cfOrg = ''
            this.cfIdentity.cfSpace = ''
            try {
                // Exchange passcode → Bearer token first, then list orgs
                const { accessToken } = await ExchangeCfPasscode(this.cfIdentity.cfApiEndpoint, this.cfToken)
                this.cfToken = accessToken
                this.cfOrgOptions = await ListCfOrgs(this.cfIdentity.cfApiEndpoint, this.cfToken)
            } catch (e: any) {
                window.$toast.error(e?.message ?? 'Failed to load CF orgs — check passcode and endpoint')
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
            } catch (e: any) {
                window.$toast.error(e?.message ?? 'Failed to load CF spaces')
                this.cfSpaceMode = 'manual'
            } finally {
                this.loadSpacesLoading = false
            }
        },

        async onSaveCfIdentity() {
            this.step1Loading = true
            try {
                // For new tenants, create the placeholder record (Name + Group only) to obtain an ID.
                // CF identity fields must not flow through UpsertCpiTenant.
                if (!this.selectedCpiTenant.ID) {
                    const created = await UpsertCpiTenant({ Name: this.selectedCpiTenant.Name, Group: this.selectedCpiTenant.Group } as CpiTenant)
                    this.selectedCpiTenant = { ...this.selectedCpiTenant, ID: created.ID }
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
            } catch (e: any) {
                this.step1Error = e?.message ?? 'CF identity verification failed'
            } finally {
                this.step1Loading = false
            }
        },

        // ── Bootstrap Steps 2+3 ───────────────────────────────────────────────

        // refreshSelectedTenant fetches the latest tenant list and updates selectedCpiTenant.
        async refreshSelectedTenant() {
            await this.refresh()
            const updated = this.cpiTenants.find(t => t.ID === this.selectedCpiTenant.ID)
            if (updated) this.selectedCpiTenant = { ...updated }
        },

        // loadBootstrapJob fetches the latest bootstrap job for display only.
        // It never drives tenant state updates.
        async loadBootstrapJob() {
            if (!this.selectedCpiTenant.ID) return
            try {
                this.bootstrapJob = await GetBootstrapStatus(this.selectedCpiTenant.ID)
            } catch {
                this.bootstrapJob = null
            }
        },

        // startPoll polls the tenant's own lifecycle state every 3 seconds while it is
        // in 'readying'. Independently refreshes the bootstrap job for display.
        // Stops when the tenant leaves 'readying'.
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
            this.step3Message = null
            try {
                this.bootstrapPreview = await PreviewBootstrap(this.selectedCpiTenant.ID, this.cfToken)
                window.$toast.success('[DEBUG] step3: Inspect ok')
            } catch (e: any) {
                if (e?.status === 401) this.cfToken = ''
                const msg = e?.message ?? 'Inspect failed'
                this.step3Message = { type: 'Negative', text: msg }
                window.$toast.error('[DEBUG] step3: ' + msg)
            } finally {
                this.inspectLoading = false
            }
        },
        async onApply() {
            this.bootstrapLoading = true
            this.bootstrapPreview = null
            this.step3Message = null
            try {
                const { jobId } = await ApplyBootstrap(this.selectedCpiTenant.ID, this.cfToken)
                this.bootstrapJob = { ID: jobId, State: 'running', JobType: 'apply' } as any
                this.wizardStep = 4
                this.stopPoll()
                this.startPoll()
                window.$toast.success('[DEBUG] step3: Apply ok job#' + jobId)
            } catch (e: any) {
                if (e?.status === 401) this.cfToken = ''
                const msg = e?.message ?? 'Apply failed'
                this.step3Message = { type: 'Negative', text: msg }
                window.$toast.error('[DEBUG] step3: ' + msg)
            } finally {
                this.bootstrapLoading = false
            }
        },
        async onRetry() {
            this.bootstrapLoading = true
            this.step4Message = null
            try {
                const { jobId } = await RetryBootstrap(this.selectedCpiTenant.ID, this.cfToken)
                this.bootstrapJob = { ID: jobId, State: 'running', JobType: 'retry' } as any
                this.stopPoll()
                this.startPoll()
                window.$toast.success('[DEBUG] step4: Retry ok job#' + jobId)
            } catch (e: any) {
                if (e?.status === 401) this.cfToken = ''
                const msg = e?.message ?? 'Retry failed'
                this.step4Message = { type: 'Negative', text: msg }
                window.$toast.error('[DEBUG] step4: ' + msg)
            } finally {
                this.bootstrapLoading = false
            }
        },
        async onReset() {
            this.bootstrapLoading = true
            this.step4Message = null
            try {
                await ResetBootstrap(this.selectedCpiTenant.ID)
                await this.refreshSelectedTenant()
                await this.loadBootstrapJob()
                this.step4Message = { type: 'Positive', text: 'Bootstrap reset — tenant returned to configured state.' }
                window.$toast.success('[DEBUG] step4: Reset ok')
            } catch (e: any) {
                const msg = e?.message ?? 'Reset failed'
                this.step4Message = { type: 'Negative', text: msg }
                window.$toast.error('[DEBUG] step4: ' + msg)
            } finally {
                this.bootstrapLoading = false
            }
        },

        // ── TMS Node ───────────────────────────────────────────────────────────

        async loadRoutes() {
            if (!this.selectedCpiTenant.ID) return
            try {
                const res = await GetTmsNodeRoutes(this.selectedCpiTenant.ID)
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
                const nodes = await GetTransportNodes()
                this.tmsNodes = nodes
            } catch (e: any) {
                const msg = e?.message ?? 'Failed to load TMS nodes'
                this.step2Message = { type: 'Negative', text: msg }
                window.$toast.error('[DEBUG] step2: ' + msg)
            }
        },
        async onRegisterTmsNode() {
            if (!this.selectedTmsNode) return
            this.tmsLoading = true
            this.step2Message = null
            try {
                await RegisterTmsNode(this.selectedCpiTenant.ID, { nodeId: this.selectedTmsNode.id, nodeName: this.selectedTmsNode.name })
                await this.refresh()
                const updated = this.cpiTenants.find(t => t.ID === this.selectedCpiTenant.ID)
                if (updated) this.selectedCpiTenant = { ...updated }
                this.step2Message = { type: 'Positive', text: `Node "${this.selectedTmsNode.name}" verified — configure Routes in TMS UI.` }
                window.$toast.success('[DEBUG] step2: Register ok')
            } catch (e: any) {
                const msg = e?.message ?? 'Registration failed'
                this.step2Message = { type: 'Negative', text: msg }
                window.$toast.error('[DEBUG] step2: ' + msg)
            } finally {
                this.tmsLoading = false
            }
        },
        async onConfirmRoutes() {
            this.tmsLoading = true
            this.step2Message = null
            try {
                const res = await ConfirmTmsRoutes(this.selectedCpiTenant.ID)
                this.tmsRoutes = res.routes || []
                await this.refresh()
                const updated = this.cpiTenants.find(t => t.ID === this.selectedCpiTenant.ID)
                if (updated) this.selectedCpiTenant = { ...updated }
                this.step2Message = { type: 'Positive', text: 'Routes confirmed — TMS Node registration complete.' }
                window.$toast.success('[DEBUG] step2: Confirm ok')
                this.wizardStep = 3
            } catch (e: any) {
                const msg = e?.message ?? 'Confirm failed'
                this.step2Message = { type: 'Negative', text: msg }
                window.$toast.error('[DEBUG] step2: ' + msg)
            } finally {
                this.tmsLoading = false
            }
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
</style>
