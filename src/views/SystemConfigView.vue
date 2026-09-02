<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { CheckConnectivity, GetLastConnectivity, GetDatabaseInfo, GetIntegrations, UpdateIntegration, TestIntegration, GetCentralTmsContext, UpsertCentralTmsContext, GetCpiTenants } from '@/service/api'
import type { ConnectivityStatus, IntegrationConfig, CentralTmsContext, CpiTenant } from '@/service/model'
import GitRepoConfigCard from '@/components/GitRepoConfigCard.vue'

import "@ui5/webcomponents/dist/Title.js"
import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents/dist/BusyIndicator.js"
import "@ui5/webcomponents/dist/Panel.js"
import "@ui5/webcomponents/dist/Table.js"
import "@ui5/webcomponents/dist/TableRow.js"
import "@ui5/webcomponents/dist/TableCell.js"
import "@ui5/webcomponents/dist/TableHeaderRow.js"
import "@ui5/webcomponents/dist/TableHeaderCell.js"
import "@ui5/webcomponents/dist/Tag.js"
import "@ui5/webcomponents/dist/Text.js"
import "@ui5/webcomponents/dist/Label.js"
import "@ui5/webcomponents/dist/Input.js"
import "@ui5/webcomponents/dist/CheckBox.js"
import "@ui5/webcomponents/dist/Dialog.js"
import "@ui5/webcomponents/dist/Toolbar.js"
import "@ui5/webcomponents/dist/ToolbarButton.js"
import "@ui5/webcomponents/dist/MessageStrip.js"
import "@ui5/webcomponents-icons/dist/refresh.js"
import "@ui5/webcomponents-icons/dist/edit.js"
import "@ui5/webcomponents-icons/dist/connected.js"

// ── Connectivity Results (cached) ────────────────────────────────────────────

const connectivityResults = ref<ConnectivityStatus[]>([])
const connectivityLoading = ref(false)
const checkedAt = ref('')

const getStatus = (type: string, name?: string): ConnectivityStatus | undefined => {
  return connectivityResults.value.find(r => r.type === type && (name ? r.name === name : true))
}

const statusDesign = (status?: string): string => {
  if (status === 'ok') return 'Positive'
  if (status === 'error') return 'Negative'
  return 'Neutral'
}

const runConnectivityCheck = async () => {
  connectivityLoading.value = true
  try {
    const report = await CheckConnectivity()
    connectivityResults.value = report.results || []
    checkedAt.value = new Date(report.checkedAt).toLocaleString()
  } catch {
    // Error displayed by http interceptor
  } finally {
    connectivityLoading.value = false
  }
}

const loadLastConnectivity = async () => {
  try {
    const report = await GetLastConnectivity()
    connectivityResults.value = report.results || []
    checkedAt.value = new Date(report.checkedAt).toLocaleString()
  } catch {
    // silently ignore — first visit or no cached report
  }
}

// ── Central TMS Context ──────────────────────────────────────────────────────

const tmsContext = ref<CentralTmsContext | null>(null)
const tmsContextLoading = ref(false)
const showTmsEditDialog = ref(false)
const tmsEditDestName = ref('')
const tmsSaving = ref(false)
const tmsConfigured = computed(() => !!tmsContext.value?.TmsApiDestinationName)

const loadTmsContext = async () => {
  tmsContextLoading.value = true
  try {
    tmsContext.value = await GetCentralTmsContext()
  } catch {
    tmsContext.value = null
  } finally {
    tmsContextLoading.value = false
  }
}

const openTmsEditDialog = () => {
  tmsEditDestName.value = tmsContext.value?.TmsApiDestinationName ?? ''
  showTmsEditDialog.value = true
}

const onSaveTmsContext = async () => {
  if (!tmsEditDestName.value.trim()) return
  tmsSaving.value = true
  try {
    tmsContext.value = await UpsertCentralTmsContext({ TmsApiDestinationName: tmsEditDestName.value.trim() })
    window.$toast.success('Central TMS context saved')
    showTmsEditDialog.value = false
  } catch {
    // Error displayed by http interceptor
  } finally {
    tmsSaving.value = false
  }
}

// ── Integration Registry ─────────────────────────────────────────────────────

const integrations = ref<IntegrationConfig[]>([])
const integrationsLoading = ref(false)
const showEditDialog = ref(false)
const editingConfig = ref<IntegrationConfig | null>(null)
const testResults = reactive<Record<string, { status: string; message?: string }>>({})

const loadIntegrations = async () => {
  integrationsLoading.value = true
  try {
    integrations.value = await GetIntegrations() || []
  } catch {
    // Error displayed by http interceptor
  } finally {
    integrationsLoading.value = false
  }
}

const handleEditIntegration = (cfg: IntegrationConfig) => {
  editingConfig.value = { ...cfg }
  showEditDialog.value = true
}

const onSaveIntegration = async () => {
  if (!editingConfig.value) return
  try {
    await UpdateIntegration(editingConfig.value.type, {
      destinationName: editingConfig.value.destinationName,
      enabled: editingConfig.value.enabled,
      description: editingConfig.value.description,
    })
    window.$toast.success(`Integration '${editingConfig.value.type}' updated`)
    showEditDialog.value = false
    await loadIntegrations()
  } catch {
    // Error displayed by http interceptor
  }
}

const handleTestIntegration = async (cfg: IntegrationConfig) => {
  delete testResults[cfg.type]
  try {
    const result = await TestIntegration(cfg.type)
    testResults[cfg.type] = result
  } catch (e: any) {
    testResults[cfg.type] = { status: 'error', message: e?.message ?? 'test failed' }
  }
}

// ── CPI Tenants ──────────────────────────────────────────────────────────────

const tenants = ref<CpiTenant[]>([])
const tenantsLoading = ref(false)

const loadTenants = async () => {
  tenantsLoading.value = true
  try {
    tenants.value = await GetCpiTenants() || []
  } catch { /* ignore */ } finally {
    tenantsLoading.value = false
  }
}

// ── Database ─────────────────────────────────────────────────────────────────

const dbInfo = ref<{ host: string; port: string; dbName: string; status: string } | null>(null)

const loadDatabaseInfo = async () => {
  try {
    dbInfo.value = await GetDatabaseInfo()
  } catch { /* ignore */ }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.allSettled([loadTmsContext(), loadIntegrations(), loadTenants(), loadDatabaseInfo(), loadLastConnectivity()])
})
</script>

<template>
  <!-- Edit Integration Dialog -->
  <ui5-dialog
    header-text="Edit Integration"
    :open="showEditDialog"
    @before-close="showEditDialog = false"
    style="width: 32rem;">
    <div class="sc-dialog-content" v-if="editingConfig">
      <ui5-label required>Destination Name</ui5-label>
      <ui5-input
        :value="editingConfig.destinationName"
        @input="editingConfig.destinationName = ($event as any).target.value"
        placeholder="e.g. cpi-delivery-github"
        style="width: 100%;" />
      <ui5-label style="margin-top: 0.75rem;">Description</ui5-label>
      <ui5-input
        :value="editingConfig.description"
        @input="editingConfig.description = ($event as any).target.value"
        placeholder="Optional description"
        style="width: 100%;" />
      <ui5-checkbox
        style="margin-top: 0.75rem;"
        :checked="editingConfig.enabled"
        @change="editingConfig.enabled = ($event as any).target.checked"
        text="Enabled" />
    </div>
    <ui5-toolbar slot="footer">
      <ui5-toolbar-button design="Emphasized" text="Save" @click="onSaveIntegration" />
      <ui5-toolbar-button design="Transparent" text="Cancel" @click="showEditDialog = false" />
    </ui5-toolbar>
  </ui5-dialog>

  <!-- Edit Central TMS Context Dialog -->
  <ui5-dialog
    header-text="Configure Central TMS"
    :open="showTmsEditDialog"
    @before-close="showTmsEditDialog = false"
    style="width: 36rem;">
    <div class="sc-dialog-content">
      <ui5-message-strip design="Information" hide-close-button style="margin-bottom: 1rem;">
        Enter the name of the BTP destination in the provider subaccount that holds TMS OAuth credentials.
      </ui5-message-strip>
      <ui5-label required>TMS API Destination Name</ui5-label>
      <ui5-input
        :value="tmsEditDestName"
        @input="tmsEditDestName = ($event as any).target.value"
        placeholder="e.g. tms"
        style="width: 100%;" />
    </div>
    <ui5-toolbar slot="footer">
      <ui5-toolbar-button design="Emphasized" text="Save" :disabled="!tmsEditDestName.trim() || tmsSaving" @click="onSaveTmsContext" />
      <ui5-toolbar-button design="Transparent" text="Cancel" @click="showTmsEditDialog = false" />
    </ui5-toolbar>
  </ui5-dialog>

  <div class="page">
    <!-- Header -->
    <div class="page-header">
      <ui5-title level="H4">System Configuration & External Dependencies</ui5-title>
      <div class="page-header-actions">
        <ui5-text v-if="checkedAt" style="color: var(--sapContent_LabelColor); font-size: 0.8rem;">Last checked: {{ checkedAt }}</ui5-text>
        <ui5-button design="Emphasized" icon="refresh" :disabled="connectivityLoading" @click="runConnectivityCheck">
          Check All
        </ui5-button>
      </div>
    </div>

    <!-- Central TMS -->
    <ui5-panel header-text="Central TMS" fixed>
      <ui5-busy-indicator :active="tmsContextLoading" :delay="0" size="M" style="width: 100%;">
        <div class="panel-body">
          <ui5-message-strip v-if="!tmsConfigured && !tmsContextLoading" design="Critical" hide-close-button>
            Central TMS is not configured. Bootstrap and transport request operations will be blocked. Click "Configure" to set the TMS API destination name.
          </ui5-message-strip>
          <div class="info-row">
            <div class="info-field">
              <ui5-label>Destination</ui5-label>
              <ui5-text>{{ tmsContext?.TmsApiDestinationName || '—' }}</ui5-text>
            </div>
            <div class="info-field" v-if="tmsContext?.TmsApiEndpoint">
              <ui5-label>Endpoint</ui5-label>
              <ui5-text class="mono">{{ tmsContext.TmsApiEndpoint }}</ui5-text>
            </div>
            <div class="info-field" v-if="tmsContext?.LastValidatedAt">
              <ui5-label>Last Validated</ui5-label>
              <ui5-text>{{ new Date(tmsContext.LastValidatedAt).toLocaleString() }}</ui5-text>
            </div>
            <div class="info-field">
              <ui5-label>Status</ui5-label>
              <ui5-tag v-if="getStatus('tms')" :design="statusDesign(getStatus('tms')?.status)" style="font-size: 0.75rem;">
                {{ getStatus('tms')?.status === 'ok' ? 'OK' : getStatus('tms')?.message }}
              </ui5-tag>
              <ui5-text v-else style="color: var(--sapContent_LabelColor);">—</ui5-text>
            </div>
            <div class="info-field">
              <ui5-label>&nbsp;</ui5-label>
              <ui5-button design="Transparent" icon="edit" @click="openTmsEditDialog">
                {{ tmsConfigured ? 'Edit' : 'Configure' }}
              </ui5-button>
            </div>
          </div>
        </div>
      </ui5-busy-indicator>
    </ui5-panel>

    <!-- Git Repository -->
    <GitRepoConfigCard />

    <!-- Integration Registry -->
    <ui5-panel header-text="Integration Registry" fixed>
      <ui5-busy-indicator :active="integrationsLoading" :delay="0" size="M" style="width: 100%;">
        <ui5-table>
          <ui5-table-header-row slot="headerRow">
            <ui5-table-header-cell>Type</ui5-table-header-cell>
            <ui5-table-header-cell>Destination</ui5-table-header-cell>
            <ui5-table-header-cell>Enabled</ui5-table-header-cell>
            <ui5-table-header-cell>Status</ui5-table-header-cell>
            <ui5-table-header-cell>Actions</ui5-table-header-cell>
          </ui5-table-header-row>
          <ui5-table-row v-for="cfg in integrations" :key="cfg.type">
            <ui5-table-cell>
              <ui5-tag design="Set2" color-scheme="6" style="font-size: 0.75rem;">{{ cfg.type }}</ui5-tag>
            </ui5-table-cell>
            <ui5-table-cell><ui5-text>{{ cfg.destinationName || '—' }}</ui5-text></ui5-table-cell>
            <ui5-table-cell>
              <ui5-tag :design="cfg.enabled ? 'Positive' : 'Neutral'" style="font-size: 0.75rem;">
                {{ cfg.enabled ? 'Yes' : 'No' }}
              </ui5-tag>
            </ui5-table-cell>
            <ui5-table-cell>
              <ui5-tag v-if="testResults[cfg.type]" :design="statusDesign(testResults[cfg.type].status)" style="font-size: 0.7rem;">
                {{ testResults[cfg.type].status === 'ok' ? 'OK' : testResults[cfg.type].message }}
              </ui5-tag>
              <ui5-tag v-else-if="getStatus('integration', cfg.type)" :design="statusDesign(getStatus('integration', cfg.type)?.status)" style="font-size: 0.7rem;">
                {{ getStatus('integration', cfg.type)?.status === 'ok' ? 'OK' : getStatus('integration', cfg.type)?.message }}
              </ui5-tag>
              <ui5-text v-else style="color: var(--sapContent_LabelColor);">—</ui5-text>
            </ui5-table-cell>
            <ui5-table-cell>
              <ui5-button design="Transparent" icon="edit" @click="handleEditIntegration(cfg)" tooltip="Edit" />
              <ui5-button design="Transparent" icon="connected" @click="handleTestIntegration(cfg)"
                :disabled="!cfg.destinationName" tooltip="Test Connection" />
            </ui5-table-cell>
          </ui5-table-row>
        </ui5-table>
      </ui5-busy-indicator>
    </ui5-panel>

    <!-- CPI Tenants -->
    <ui5-panel header-text="CPI Tenants" fixed>
      <ui5-busy-indicator :active="tenantsLoading" :delay="0" size="M" style="width: 100%;">
        <ui5-table>
          <ui5-table-header-row slot="headerRow">
            <ui5-table-header-cell>Tenant</ui5-table-header-cell>
            <ui5-table-header-cell>PIR Destination</ui5-table-header-cell>
            <ui5-table-header-cell>Lifecycle</ui5-table-header-cell>
            <ui5-table-header-cell>Status</ui5-table-header-cell>
          </ui5-table-header-row>
          <ui5-table-row v-for="t in tenants" :key="t.ID">
            <ui5-table-cell><ui5-text>{{ t.Name }}</ui5-text></ui5-table-cell>
            <ui5-table-cell><ui5-text class="mono">{{ t.PirApiDestinationName || '—' }}</ui5-text></ui5-table-cell>
            <ui5-table-cell>
              <ui5-tag design="Set2" style="font-size: 0.7rem;">{{ t.LifecycleState || '—' }}</ui5-tag>
            </ui5-table-cell>
            <ui5-table-cell>
              <ui5-tag v-if="getStatus('cpi_tenant', t.Name)" :design="statusDesign(getStatus('cpi_tenant', t.Name)?.status)" style="font-size: 0.7rem;">
                {{ getStatus('cpi_tenant', t.Name)?.status === 'ok' ? 'OK' : 'Error' }}
              </ui5-tag>
              <ui5-text v-else style="color: var(--sapContent_LabelColor);">—</ui5-text>
            </ui5-table-cell>
          </ui5-table-row>
        </ui5-table>
      </ui5-busy-indicator>
    </ui5-panel>

    <!-- Database -->
    <ui5-panel header-text="Database" fixed>
      <div class="info-row">
        <div class="info-field">
          <ui5-label>Host</ui5-label>
          <ui5-text class="mono">{{ dbInfo?.host || '—' }}:{{ dbInfo?.port || '' }}</ui5-text>
        </div>
        <div class="info-field">
          <ui5-label>Database</ui5-label>
          <ui5-text>{{ dbInfo?.dbName || '—' }}</ui5-text>
        </div>
        <div class="info-field">
          <ui5-label>Status</ui5-label>
          <ui5-tag v-if="getStatus('database')" :design="statusDesign(getStatus('database')?.status)" style="font-size: 0.75rem;">
            {{ getStatus('database')?.status === 'ok' ? 'OK' : getStatus('database')?.message }}
          </ui5-tag>
          <ui5-tag v-else-if="dbInfo" :design="statusDesign(dbInfo.status)" style="font-size: 0.75rem;">
            {{ dbInfo.status === 'ok' ? 'OK' : 'Error' }}
          </ui5-tag>
          <ui5-text v-else style="color: var(--sapContent_LabelColor);">—</ui5-text>
        </div>
      </div>
    </ui5-panel>
  </div>
</template>

<style scoped>
/* Page layout */
.page {
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Info panels (TMS, Database) */
.panel-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 2rem;
  padding: 0.5rem 1rem;
}

.info-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

/* Utility */
.mono {
  font-family: var(--sapFontMonospaceFamily, monospace);
  font-size: 0.8rem;
}

/* Dialog */
.sc-dialog-content {
  display: flex;
  flex-direction: column;
}

/* Ensure Web Components stretch full width */
ui5-panel {
  width: 100%;
}

ui5-table {
  width: 100%;
}
</style>
