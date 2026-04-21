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

                    <div style="padding-top: 1rem;">
                        <ui5-button design="Emphasized" @click="onSave" :disabled="saving">Save</ui5-button>
                    </div>
                </div>
            </ui5-tab>

            <!-- ── Tab: Bootstrap ── -->
            <ui5-tab text="Bootstrap">
                <div class="tab-content">

                    <!-- Status row -->
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

                    <!-- Prerequisite grid -->
                    <div class="prereq-grid" style="margin-bottom: 1rem;">
                        <div v-for="p in prerequisiteStatuses" :key="p.key" class="prereq-item">
                            <ui5-tag :design="prereqDesign(p.value)" style="font-size: 0.7rem; min-width: 64px;">
                                {{ p.value || 'missing' }}
                            </ui5-tag>
                            <ui5-text style="font-size: 0.8rem; margin-left: 0.5rem;">{{ p.label }}</ui5-text>
                        </div>
                    </div>

                    <!-- Step indicator bar -->
                    <div class="step-bar">
                        <div v-for="(s, i) in [{label:'CF Connection'},{label:'Inspect'},{label:'Apply'}]" :key="i"
                            style="display: flex; align-items: center;">
                            <div class="step-pill"
                                :class="bootstrapStep === i+1 ? 'step-active' : bootstrapStep > i+1 ? 'step-done' : 'step-pending'"
                                @click="bootstrapStep = (i+1) as 1|2|3"
                                style="cursor: pointer;">
                                <span class="step-num">{{ i + 1 }}</span>
                                <span>{{ s.label }}</span>
                            </div>
                            <div v-if="i < 2" class="step-connector" />
                        </div>
                    </div>

                    <!-- Step 1: CF Connection -->
                    <template v-if="bootstrapStep === 1">
                        <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor); display: block; margin: 0.75rem 0;">
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

                        <!-- CF Passcode — exchanged for Bearer token on Load Orgs -->
                        <ui5-text class="field-label">CF Passcode *</ui5-text>
                        <ui5-input type="Password" :value="cfToken"
                            @input="onCfTokenInput($event.target.value)"
                            placeholder="One-time passcode from the Login page" style="width: 100%;" />

                        <div style="margin: 0.5rem 0 0.75rem;">
                            <ui5-button design="Default" icon="refresh"
                                :disabled="!cfIdentity.cfApiEndpoint || !cfToken || loadOrgsLoading"
                                @click="loadCfOrgs">
                                Load Orgs
                            </ui5-button>
                            <ui5-busy-indicator v-if="loadOrgsLoading" size="Small" active style="margin-left: 0.5rem;" />
                        </div>

                        <!-- CF Org: select or manual fallback -->
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

                        <!-- CF Space: select (after org chosen) or manual fallback -->
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

                        <div style="display: flex; gap: 0.5rem; margin-top: 1rem; align-items: center;">
                            <ui5-button design="Emphasized"
                                :disabled="(!selectedCpiTenant.ID && !selectedCpiTenant.Name) || !cfIdentity.cfApiEndpoint || !cfIdentity.cfOrg || !cfIdentity.cfSpace || !cfToken || step1Loading"
                                @click="onSaveCfIdentity">
                                Save &amp; Verify
                            </ui5-button>
                            <ui5-busy-indicator v-if="step1Loading" size="Small" active />
                        </div>
                    </template>

                    <!-- Step 2: Inspect -->
                    <template v-else-if="bootstrapStep === 2">
                        <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor); display: block; margin: 0.75rem 0;">
                            Use the same CF bearer token from Step 1 to inspect prerequisites. Steps 2 and 3 must complete in the same token session.
                        </ui5-text>

                        <ui5-message-strip v-if="selectedCpiTenant.LifecycleState === 'draft'"
                            design="Warning" hide-close-button style="margin-bottom: 0.75rem;">
                            Complete Step 1 first.
                        </ui5-message-strip>

                        <template v-else>
                            <ui5-text class="field-label">CF Bearer Token *</ui5-text>
                            <ui5-input type="Password" :value="cfToken"
                                @input="cfToken = $event.target.value"
                                placeholder="Same token as Step 1" style="width: 100%;" />

                            <div style="display: flex; gap: 0.5rem; margin-top: 1rem; align-items: center;">
                                <ui5-button design="Default" :disabled="!cfToken || bootstrapLoading" @click="onPreview">
                                    Run Inspect
                                </ui5-button>
                                <ui5-busy-indicator v-if="bootstrapLoading && !bootstrapPreview" size="Small" active />
                            </div>

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
                            </template>
                        </template>
                    </template>

                    <!-- Step 3: Apply -->
                    <template v-else>
                        <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor); display: block; margin: 0.75rem 0;">
                            Apply creates all missing CF-side prerequisites. Must use the same token session as Step 2.
                        </ui5-text>

                        <ui5-message-strip v-if="selectedCpiTenant.LifecycleState === 'draft'"
                            design="Warning" hide-close-button style="margin-bottom: 0.75rem;">
                            Complete Step 1 first.
                        </ui5-message-strip>

                        <template v-else>
                            <ui5-text class="field-label">CF Bearer Token *</ui5-text>
                            <ui5-input type="Password" :value="cfToken"
                                @input="cfToken = $event.target.value"
                                placeholder="Same token as Step 2" style="width: 100%;" />

                            <div style="display: flex; gap: 0.5rem; margin-top: 1rem; align-items: center; flex-wrap: wrap;">
                                <ui5-button design="Emphasized"
                                    v-if="selectedCpiTenant.LifecycleState !== 'ready' && selectedCpiTenant.LifecycleState !== 'readying'"
                                    :disabled="!cfToken || bootstrapLoading" @click="onApply">
                                    Apply
                                </ui5-button>
                                <ui5-button design="Default"
                                    v-if="bootstrapJob?.State === 'failed' || bootstrapJob?.State === 'waiting_user_action' || bootstrapJob?.State === 'partially_applied'"
                                    :disabled="!cfToken || bootstrapLoading" @click="onRetry">
                                    Retry
                                </ui5-button>
                                <ui5-button design="Negative"
                                    v-if="selectedCpiTenant.LifecycleState === 'readying'"
                                    :disabled="bootstrapLoading" @click="onReset">
                                    Reset
                                </ui5-button>
                                <ui5-busy-indicator v-if="bootstrapLoading" size="Small" active />
                            </div>

                            <template v-if="bootstrapJob">
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
                    </template>

                </div>
            </ui5-tab>

            <!-- ── Tab: TMS Node ── -->
            <ui5-tab text="TMS Node">
                <div class="tab-content">

                    <div class="status-header">
                        <ui5-text style="font-weight: bold; font-size: 1rem;">Registration Status</ui5-text>
                        <ui5-tag :design="tmsStatusDesign" style="margin-left: 0.5rem;">
                            {{ selectedCpiTenant.TmsNodeRegistrationStatus || 'missing' }}
                        </ui5-tag>
                        <ui5-text v-if="selectedCpiTenant.TmsSourceNodeName"
                            style="color: var(--sapNeutralTextColor); margin-left: 0.75rem; font-size: 0.85rem;">
                            Node: {{ selectedCpiTenant.TmsSourceNodeName }}
                        </ui5-text>
                    </div>

                    <ui5-message-strip v-if="selectedCpiTenant.LifecycleState !== 'ready'"
                        design="Warning" hide-close-button style="margin-top: 0.75rem;">
                        Bootstrap must complete (LifecycleState = ready) before registering a TMS Node.
                    </ui5-message-strip>

                    <template v-else>

                        <template v-if="selectedCpiTenant.TmsNodeRegistrationStatus === 'missing'
                            || selectedCpiTenant.TmsNodeRegistrationStatus === 'failed'">
                            <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor); margin: 0.75rem 0 0.5rem; display: block;">
                                Manual mode: enter the name of an existing TMS Node to register.
                            </ui5-text>
                            <ui5-text class="field-label">TMS Source Node Name *</ui5-text>
                            <ui5-input :value="tmsNodeName" @input="tmsNodeName = $event.target.value"
                                placeholder="Existing TMS node name" style="width: 100%;" :disabled="tmsLoading" />
                            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; align-items: center;">
                                <ui5-button design="Emphasized" :disabled="!tmsNodeName || tmsLoading" @click="onManualRegisterTmsNode">
                                    Verify &amp; Register
                                </ui5-button>
                                <ui5-busy-indicator v-if="tmsLoading" size="Small" active />
                            </div>
                        </template>

                        <template v-else-if="selectedCpiTenant.TmsNodeRegistrationStatus === 'registering'">
                            <div class="section-divider" />
                            <ui5-title level="H6" style="margin-bottom: 0.5rem;">Route Configuration</ui5-title>
                            <ui5-text style="font-size: 0.85rem; color: var(--sapContent_LabelColor);">
                                Node <strong>{{ selectedCpiTenant.TmsSourceNodeName }}</strong> has been registered.
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
                                    <ui5-text style="font-size: 0.85rem;">{{ route.name }} — Node {{ route.sourceNode.id }} → {{ route.targetNode.id }}</ui5-text>
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
                        </template>

                        <template v-else-if="selectedCpiTenant.TmsNodeRegistrationStatus === 'ready'">
                            <ui5-message-strip design="Positive" hide-close-button style="margin-top: 0.75rem;">
                                TMS Node is registered and routes are confirmed. This tenant is fully operational.
                            </ui5-message-strip>
                            <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; align-items: center;">
                                <ui5-button design="Transparent" :disabled="tmsLoading" @click="onRefreshRoutes">
                                    Refresh Routes
                                </ui5-button>
                                <ui5-busy-indicator v-if="tmsLoading" size="Small" active />
                            </div>
                            <template v-if="tmsRoutes.length > 0">
                                <div class="section-divider" />
                                <ui5-text style="font-weight: bold; margin-bottom: 0.5rem;">Routes ({{ tmsRoutes.length }})</ui5-text>
                                <div v-for="route in tmsRoutes" :key="route.id" class="route-item">
                                    <ui5-text style="font-size: 0.85rem;">{{ route.name }} — Node {{ route.sourceNode.id }} → {{ route.targetNode.id }}</ui5-text>
                                </div>
                            </template>
                        </template>

                    </template>

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
    GetCentralTmsContext,
} from '@/service/api'
import type {
    CpiTenant, BootstrapPreview, BootstrapJob,
    TmsNodeRoute, TenantLifecycleState, PrerequisiteStatus, CentralTmsContext,
} from '@/service/model'
import "@ui5/webcomponents/dist/TableRowAction.js"
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
            // Bootstrap step tracking: 1 = CF Identity, 2 = Inspect, 3 = Apply
            bootstrapStep: 1 as 1 | 2 | 3,
            // Step 1 state
            cfIdentity: { cfApiEndpoint: '', cfOrg: '', cfSpace: '' },
            cfToken: '',
            step1Loading: false,
            // CF org/space discovery
            cfOrgOptions: [] as { guid: string; name: string }[],
            cfSpaceOptions: [] as { guid: string; name: string }[],
            loadOrgsLoading: false,
            loadSpacesLoading: false,
            cfOrgMode: 'select' as 'select' | 'manual',
            cfSpaceMode: 'select' as 'select' | 'manual',
            // Step 2+3 state
            bootstrapLoading: false,
            bootstrapPreview: null as BootstrapPreview | null,
            bootstrapJob: null as BootstrapJob | null,
            pollTimer: null as ReturnType<typeof setInterval> | null,
            // TMS Node state
            tmsNodeName: '',
            tmsLoading: false,
            tmsRoutes: [] as TmsNodeRoute[],
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
            const map: Record<PrerequisiteStatus, string> = {
                missing: 'Neutral', registering: 'Information', ready: 'Positive', failed: 'Negative',
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
        prerequisiteStatuses() {
            const t = this.selectedCpiTenant
            return [
                { key: 'PirApiStatus', label: 'PIR API', value: t.PirApiStatus },
                { key: 'CasApplicationStatus', label: 'CAS Application', value: t.CasApplicationStatus },
                { key: 'CasStandardStatus', label: 'CAS Standard', value: t.CasStandardStatus },
                { key: 'CloudIntegrationDestStatus', label: 'CloudIntegration Dest', value: t.CloudIntegrationDestStatus },
                { key: 'ContentAssemblyDestStatus', label: 'ContentAssembly Dest', value: t.ContentAssemblyDestStatus },
                { key: 'TransportManagementDestStatus', label: 'TMS Dest', value: t.TransportManagementDestStatus },
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
            this.bootstrapStep = 1
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
            this.bootstrapStep = row.LifecycleState === 'draft' ? 1
                : (row.LifecycleState === 'configured' ? 2 : 3)
            this.showManageModal = true
            await this.refreshSelectedTenant()
            await this.loadBootstrapJob()
            if (this.selectedCpiTenant.LifecycleState === 'readying') this.startPoll()
            if (row.TmsSourceNodeName) await this.loadRoutes()
        },
        closeManageModal() {
            this.showManageModal = false
            this.stopPoll()
            this.cfToken = ''
            this.cfIdentity = { cfApiEndpoint: '', cfOrg: '', cfSpace: '' }
            this.bootstrapPreview = null
            this.bootstrapJob = null
            this.tmsNodeName = ''
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
                window.$toast.error(e?.response?.data?.message ?? 'Save failed')
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
                window.$toast.error(e?.response?.data?.message ?? 'Failed to load CF orgs — check passcode and endpoint')
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
                window.$toast.error(e?.response?.data?.message ?? 'Failed to load CF spaces')
                this.cfSpaceMode = 'manual'
            } finally {
                this.loadSpacesLoading = false
            }
        },

        async onSaveCfIdentity() {
            this.step1Loading = true
            try {
                // For new tenants, create the DB record first to obtain an ID
                if (!this.selectedCpiTenant.ID) {
                    const created = await UpsertCpiTenant(this.selectedCpiTenant)
                    this.selectedCpiTenant = { ...this.selectedCpiTenant, ID: created.ID }
                }
                await SaveCfIdentity(this.selectedCpiTenant.ID, {
                    cfApiEndpoint: this.cfIdentity.cfApiEndpoint,
                    cfOrg: this.cfIdentity.cfOrg,
                    cfSpace: this.cfIdentity.cfSpace,
                    cfToken: this.cfToken,
                })
                window.$toast.success('CF identity saved and verified — proceed to Inspect (Step 2)')
                await this.refresh()
                const updated = this.cpiTenants.find(t => t.ID === this.selectedCpiTenant.ID)
                if (updated) this.selectedCpiTenant = { ...updated }
                this.bootstrapStep = 2
            } catch (e: any) {
                window.$toast.error(e?.response?.data?.message ?? 'CF identity verification failed')
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
            this.bootstrapLoading = true
            this.bootstrapPreview = null
            try {
                this.bootstrapPreview = await PreviewBootstrap(this.selectedCpiTenant.ID, this.cfToken)
                this.bootstrapStep = 3
            } catch (e: any) {
                window.$toast.error(e?.response?.data?.message ?? 'Inspect failed')
            } finally {
                this.bootstrapLoading = false
            }
        },
        async onApply() {
            this.bootstrapLoading = true
            this.bootstrapPreview = null
            try {
                const { jobId } = await ApplyBootstrap(this.selectedCpiTenant.ID, this.cfToken)
                window.$toast.success(`Bootstrap job #${jobId} started`)
                this.stopPoll()
                this.startPoll()
            } catch (e: any) {
                window.$toast.error(e?.response?.data?.message ?? 'Apply failed')
            } finally {
                this.bootstrapLoading = false
            }
        },
        async onRetry() {
            this.bootstrapLoading = true
            try {
                const { jobId } = await RetryBootstrap(this.selectedCpiTenant.ID, this.cfToken)
                window.$toast.success(`Retry job #${jobId} started`)
                this.stopPoll()
                this.startPoll()
            } catch (e: any) {
                window.$toast.error(e?.response?.data?.message ?? 'Retry failed')
            } finally {
                this.bootstrapLoading = false
            }
        },
        async onReset() {
            this.bootstrapLoading = true
            try {
                await ResetBootstrap(this.selectedCpiTenant.ID)
                window.$toast.success('Bootstrap reset')
                await this.refreshSelectedTenant()
                await this.loadBootstrapJob()
            } catch (e: any) {
                window.$toast.error(e?.response?.data?.message ?? 'Reset failed')
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
        async onAutoRegisterTmsNode() {
            this.tmsLoading = true
            try {
                await RegisterTmsNode(this.selectedCpiTenant.ID, { mode: 'auto' })
                window.$toast.success('Node created automatically — configure Routes in TMS UI')
                await this.refresh()
                const updated = this.cpiTenants.find(t => t.ID === this.selectedCpiTenant.ID)
                if (updated) this.selectedCpiTenant = { ...updated }
            } catch (e: any) {
                window.$toast.error(e?.response?.data?.message ?? 'Auto registration failed')
            } finally {
                this.tmsLoading = false
            }
        },
        async onManualRegisterTmsNode() {
            this.tmsLoading = true
            try {
                await RegisterTmsNode(this.selectedCpiTenant.ID, { mode: 'manual', nodeName: this.tmsNodeName })
                window.$toast.success(`Node "${this.tmsNodeName}" verified — configure Routes in TMS UI`)
                await this.refresh()
                const updated = this.cpiTenants.find(t => t.ID === this.selectedCpiTenant.ID)
                if (updated) this.selectedCpiTenant = { ...updated }
            } catch (e: any) {
                window.$toast.error(e?.response?.data?.message ?? 'Manual registration failed')
            } finally {
                this.tmsLoading = false
            }
        },
        async onConfirmRoutes() {
            this.tmsLoading = true
            try {
                const res = await ConfirmTmsRoutes(this.selectedCpiTenant.ID)
                this.tmsRoutes = res.routes || []
                window.$toast.success('Routes confirmed — TMS Node registration complete')
                await this.refresh()
                const updated = this.cpiTenants.find(t => t.ID === this.selectedCpiTenant.ID)
                if (updated) this.selectedCpiTenant = { ...updated }
            } catch (e: any) {
                window.$toast.error(e?.response?.data?.message ?? 'Confirm failed')
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

.step-bar {
    display: flex;
    align-items: center;
    margin-bottom: 1.25rem;
}

.step-pill {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.82rem;
    font-weight: 600;
    border: 1.5px solid transparent;
    transition: background 0.15s;
}

.step-active {
    background: var(--sapButton_Emphasized_Background, #0a6ed1);
    color: var(--sapButton_Emphasized_TextColor, #fff);
    border-color: var(--sapButton_Emphasized_BorderColor, #0a6ed1);
}

.step-done {
    background: var(--sapSuccessBackground, #f1fdf6);
    color: var(--sapPositiveTextColor, #107e3e);
    border-color: var(--sapPositiveColor, #107e3e);
}

.step-pending {
    background: var(--sapNeutralBackground, #f2f2f2);
    color: var(--sapNeutralTextColor, #6a6d70);
    border-color: var(--sapNeutralBorderColor, #bfbfbf);
}

.step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    background: rgba(255,255,255,0.25);
    font-size: 0.78rem;
    font-weight: bold;
}

.step-connector {
    flex: 1;
    height: 2px;
    min-width: 1.5rem;
    background: var(--sapList_BorderColor, #d9d9d9);
    margin: 0 0.25rem;
}

.status-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
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
