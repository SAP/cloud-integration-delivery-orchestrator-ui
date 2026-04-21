<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { CheckConnectivity, GetIntegrations, UpdateIntegration, GetCentralTmsContext, UpsertCentralTmsContext } from '@/service/api'
import type { ConnectivityStatus, IntegrationConfig, CentralTmsContext } from '@/service/model'

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

// ── Integration Registry ──────────────────────────────────────────────────────

const integrations = ref<IntegrationConfig[]>([])
const integrationsLoading = ref(false)
const showEditDialog = ref(false)
const editingConfig = ref<IntegrationConfig | null>(null)

const loadIntegrations = async () => {
  integrationsLoading.value = true
  try {
    integrations.value = await GetIntegrations() || []
  } catch (e: any) {
    window.$toast.error('Failed to load integrations: ' + (e?.response?.data?.message ?? e?.message ?? ''))
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
  } catch (e: any) {
    window.$toast.error('Failed to update: ' + (e?.response?.data?.message ?? e?.message ?? ''))
  }
}

// ── System Connectivity ───────────────────────────────────────────────────────

const connectivityResults = ref<ConnectivityStatus[]>([])
const connectivityLoading = ref(false)
const checkedAt = ref('')

const infraResults = computed(() => connectivityResults.value.filter(r => r.type === 'database' || r.type === 'tms'))
const cpiTenantResults = computed(() => connectivityResults.value.filter(r => r.type === 'cpi_tenant'))
const integrationResults = computed(() => connectivityResults.value.filter(r => r.type === 'integration'))

const runConnectivityCheck = async () => {
  connectivityLoading.value = true
  try {
    const report = await CheckConnectivity()
    connectivityResults.value = report.results || []
    checkedAt.value = new Date(report.checkedAt).toLocaleString()
  } catch (e: any) {
    window.$toast.error('Connectivity check failed: ' + (e?.response?.data?.message ?? e?.message ?? ''))
  } finally {
    connectivityLoading.value = false
  }
}

const statusDesign = (status: string): string => {
  if (status === 'ok') return 'Positive'
  if (status === 'error') return 'Negative'
  return 'Neutral'
}

const statusLabel = (status: string): string => {
  if (status === 'ok') return 'OK'
  if (status === 'error') return 'Error'
  if (status === 'disabled') return 'Disabled'
  return status
}

// ── Central TMS Context ───────────────────────────────────────────────────────

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
  } catch (e: any) {
    // 404 = not yet configured — not an error
    if (e?.response?.status !== 404) {
      window.$toast.error('Failed to load Central TMS context: ' + (e?.response?.data?.message ?? e?.message ?? ''))
    }
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
  } catch (e: any) {
    window.$toast.error('Failed to save: ' + (e?.response?.data?.message ?? e?.message ?? ''))
  } finally {
    tmsSaving.value = false
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([loadIntegrations(), loadTmsContext()])
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
        This destination is used both for TMS API calls and as the credential source for each tenant's
        TransportManagementService destination during bootstrap.
      </ui5-message-strip>
      <ui5-label required>TMS API Destination Name</ui5-label>
      <ui5-input
        :value="tmsEditDestName"
        @input="tmsEditDestName = ($event as any).target.value"
        placeholder="e.g. tms"
        style="width: 100%;" />
    </div>
    <ui5-toolbar slot="footer">
      <ui5-toolbar-button
        design="Emphasized"
        text="Save"
        :disabled="!tmsEditDestName.trim() || tmsSaving"
        @click="onSaveTmsContext" />
      <ui5-toolbar-button design="Transparent" text="Cancel" @click="showTmsEditDialog = false" />
    </ui5-toolbar>
  </ui5-dialog>

  <div class="sc-container">
    <!-- Header -->
    <div class="sc-header">
      <ui5-title level="H4">System Configuration</ui5-title>
      <ui5-button design="Emphasized" icon="refresh" :disabled="connectivityLoading" @click="runConnectivityCheck">
        Check Connectivity
      </ui5-button>
    </div>

    <!-- Central TMS Context -->
    <ui5-panel header-text="Central TMS" fixed>
      <ui5-busy-indicator :active="tmsContextLoading" size="M" style="width: 100%;">
        <div class="sc-tms-body">
          <ui5-message-strip
            v-if="!tmsConfigured && !tmsContextLoading"
            design="Critical"
            hide-close-button
            style="margin-bottom: 1rem;">
            Central TMS is not configured. Tenant bootstrap will be blocked until a TMS API destination name is provided.
          </ui5-message-strip>

          <div class="sc-tms-fields">
            <div class="sc-tms-field">
              <span class="sc-tms-label">TMS API Destination Name</span>
              <span class="sc-tms-value">
                <ui5-tag v-if="tmsConfigured" design="Positive" style="font-size: 0.8rem;">
                  {{ tmsContext!.TmsApiDestinationName }}
                </ui5-tag>
                <ui5-tag v-else design="Negative" style="font-size: 0.8rem;">Not configured</ui5-tag>
              </span>
            </div>
            <div class="sc-tms-field" v-if="tmsContext?.LastValidatedAt">
              <span class="sc-tms-label">Last Validated</span>
              <span class="sc-tms-value">{{ new Date(tmsContext.LastValidatedAt).toLocaleString() }}</span>
            </div>
            <div class="sc-tms-field" v-if="tmsContext?.TmsApiEndpoint">
              <span class="sc-tms-label">TMS API Endpoint</span>
              <span class="sc-tms-value sc-tms-endpoint">{{ tmsContext.TmsApiEndpoint }}</span>
            </div>
          </div>

          <div style="margin-top: 1rem;">
            <ui5-button design="Transparent" icon="edit" @click="openTmsEditDialog">
              {{ tmsConfigured ? 'Edit' : 'Configure' }}
            </ui5-button>
          </div>
        </div>
      </ui5-busy-indicator>
    </ui5-panel>

    <!-- Integration Registry -->
    <ui5-panel header-text="Integration Registry" fixed>
      <ui5-busy-indicator :active="integrationsLoading" size="M" style="width: 100%;">
        <ui5-table>
          <ui5-table-header-row slot="headerRow">
            <ui5-table-header-cell>Type</ui5-table-header-cell>
            <ui5-table-header-cell>Destination Name</ui5-table-header-cell>
            <ui5-table-header-cell>Description</ui5-table-header-cell>
            <ui5-table-header-cell width="90px">Enabled</ui5-table-header-cell>
            <ui5-table-header-cell width="60px"></ui5-table-header-cell>
          </ui5-table-header-row>
          <ui5-table-row v-for="cfg in integrations" :key="cfg.type">
            <ui5-table-cell>
              <ui5-tag design="Set2" color-scheme="6" style="font-size: 0.75rem;">{{ cfg.type }}</ui5-tag>
            </ui5-table-cell>
            <ui5-table-cell>{{ cfg.destinationName || '—' }}</ui5-table-cell>
            <ui5-table-cell>{{ cfg.description || '—' }}</ui5-table-cell>
            <ui5-table-cell>
              <ui5-tag :design="cfg.enabled ? 'Positive' : 'Neutral'" style="font-size: 0.75rem;">
                {{ cfg.enabled ? 'Enabled' : 'Disabled' }}
              </ui5-tag>
            </ui5-table-cell>
            <ui5-table-cell>
              <ui5-button design="Transparent" icon="edit" @click="handleEditIntegration(cfg)" />
            </ui5-table-cell>
          </ui5-table-row>
        </ui5-table>
      </ui5-busy-indicator>
    </ui5-panel>

    <!-- Connectivity Check -->
    <ui5-panel header-text="System Connectivity" fixed>
      <ui5-message-strip
        v-if="checkedAt && !connectivityLoading"
        design="Information"
        hide-close-button
        style="margin-bottom: 1rem;">
        Last checked: {{ checkedAt }}
      </ui5-message-strip>

      <ui5-busy-indicator :active="connectivityLoading" size="M" style="width: 100%;">
        <!-- Not yet checked -->
        <div v-if="connectivityResults.length === 0 && !connectivityLoading" class="sc-empty">
          <ui5-text>Click "Check Connectivity" to verify all external dependencies.</ui5-text>
        </div>

        <div v-else class="sc-results">
          <!-- Infrastructure (DB + TMS) -->
          <div v-if="infraResults.length > 0" class="sc-section">
            <ui5-title level="H6" class="sc-section-title">Infrastructure</ui5-title>
            <div class="sc-cards">
              <div v-for="item in infraResults" :key="item.name" class="sc-card">
                <div class="sc-card-header">
                  <span class="sc-card-name">{{ item.name }}</span>
                  <ui5-tag :design="statusDesign(item.status)" style="font-size: 0.75rem;">
                    {{ statusLabel(item.status) }}
                  </ui5-tag>
                </div>
                <ui5-tag design="Set2" color-scheme="1" style="font-size: 0.7rem; align-self: flex-start;">{{ item.type }}</ui5-tag>
                <span v-if="item.message" class="sc-card-message" :title="item.message">{{ item.message }}</span>
              </div>
            </div>
          </div>

          <!-- CPI Tenants -->
          <div v-if="cpiTenantResults.length > 0" class="sc-section">
            <ui5-title level="H6" class="sc-section-title">CPI Tenants</ui5-title>
            <div class="sc-cards">
              <div v-for="item in cpiTenantResults" :key="item.name" class="sc-card">
                <div class="sc-card-header">
                  <span class="sc-card-name">{{ item.name }}</span>
                  <ui5-tag :design="statusDesign(item.status)" style="font-size: 0.75rem;">
                    {{ statusLabel(item.status) }}
                  </ui5-tag>
                </div>
                <ui5-tag design="Set2" color-scheme="3" style="font-size: 0.7rem; align-self: flex-start;">CPI Tenant</ui5-tag>
                <span v-if="item.message" class="sc-card-message" :title="item.message">{{ item.message }}</span>
              </div>
            </div>
          </div>

          <!-- Singleton Destinations (Integrations) -->
          <div v-if="integrationResults.length > 0" class="sc-section">
            <ui5-title level="H6" class="sc-section-title">Singleton Destinations</ui5-title>
            <div class="sc-cards">
              <div v-for="item in integrationResults" :key="item.name" class="sc-card">
                <div class="sc-card-header">
                  <span class="sc-card-name">{{ item.name }}</span>
                  <ui5-tag :design="statusDesign(item.status)" style="font-size: 0.75rem;">
                    {{ statusLabel(item.status) }}
                  </ui5-tag>
                </div>
                <ui5-tag design="Set2" color-scheme="6" style="font-size: 0.7rem; align-self: flex-start;">Integration</ui5-tag>
                <span v-if="item.message" class="sc-card-message" :title="item.message">{{ item.message }}</span>
              </div>
            </div>
          </div>
        </div>
      </ui5-busy-indicator>
    </ui5-panel>
  </div>
</template>

<style scoped>
.sc-container {
  padding: 1rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.sc-empty {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.sc-dialog-content {
  display: flex;
  flex-direction: column;
}

.sc-results {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sc-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sc-section-title {
  margin-bottom: 0.5rem;
  color: var(--sapTitleColor);
}

.sc-cards {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.sc-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.875rem 1rem;
  min-width: 14rem;
  max-width: 22rem;
  border: 1px solid var(--sapList_BorderColor);
  border-radius: var(--sapElement_BorderCornerRadius, 0.5rem);
  background: var(--sapList_Background);
}

.sc-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.sc-card-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sapTextColor);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sc-card-message {
  font-size: 0.75rem;
  color: var(--sapNeutralTextColor);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sc-tms-body {
  padding: 0.25rem 0;
}

.sc-tms-fields {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.sc-tms-field {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sc-tms-label {
  font-size: 0.875rem;
  color: var(--sapContent_LabelColor);
  min-width: 14rem;
}

.sc-tms-value {
  font-size: 0.875rem;
  color: var(--sapTextColor);
}

.sc-tms-endpoint {
  font-family: var(--sapFontMonospaceFamily, monospace);
  font-size: 0.8rem;
  color: var(--sapNeutralTextColor);
}
</style>
