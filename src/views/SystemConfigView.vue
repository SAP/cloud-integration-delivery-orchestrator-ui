<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { GetDatabaseInfo, GetJiraConfig, UpdateJiraConfig, TestJiraConnection, GetAnsStatus, TestAnsConnection, GetCentralTmsContext, UpsertCentralTmsContext, GetCpiTenants } from '@/service/api'
import type { ConnectivityStatus, JiraConfig, AnsStatus, CentralTmsContext, CpiTenant } from '@/service/model'
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
import "@ui5/webcomponents/dist/Switch.js"
import "@ui5/webcomponents/dist/Toolbar.js"
import "@ui5/webcomponents/dist/ToolbarButton.js"
import "@ui5/webcomponents/dist/MessageStrip.js"
import "@ui5/webcomponents-icons/dist/edit.js"
import "@ui5/webcomponents-icons/dist/connected.js"

// ── Helpers ─────────────────────────────────────────────────────────────────

const statusDesign = (status?: string): string => {
  if (status === 'ok') return 'Positive'
  if (status === 'error') return 'Negative'
  return 'Neutral'
}

// ── Central TMS Context ──────────────────────────────────────────────────────

const tmsContext = ref<CentralTmsContext | null>(null)
const tmsContextLoading = ref(false)
const showTmsEditDialog = ref(false)
const tmsEditDestName = ref('')
const tmsSaving = ref(false)

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

// ── Jira Config ──────────────────────────────────────────────────────────────

const jiraConfig = ref<JiraConfig | null>(null)
const jiraLoading = ref(false)
const showJiraEditDialog = ref(false)
const jiraEditDest = ref('')
const jiraEditEnabled = ref(false)
const jiraSaving = ref(false)
const jiraTestResult = ref<ConnectivityStatus | null>(null)
const jiraTesting = ref(false)

const loadJiraConfig = async () => {
  jiraLoading.value = true
  try {
    jiraConfig.value = await GetJiraConfig()
  } catch {
    jiraConfig.value = null
  } finally {
    jiraLoading.value = false
  }
}

const openJiraEditDialog = () => {
  jiraEditDest.value = jiraConfig.value?.destinationName ?? ''
  jiraEditEnabled.value = jiraConfig.value?.enabled ?? false
  showJiraEditDialog.value = true
}

const onSaveJiraConfig = async () => {
  jiraSaving.value = true
  try {
    jiraConfig.value = await UpdateJiraConfig({
      destinationName: jiraEditDest.value.trim(),
      enabled: jiraEditEnabled.value,
    })
    window.$toast.success('Jira configuration saved')
    showJiraEditDialog.value = false
    jiraTestResult.value = null
  } catch {
    // Error displayed by http interceptor
  } finally {
    jiraSaving.value = false
  }
}

const handleTestJira = async () => {
  jiraTesting.value = true
  jiraTestResult.value = null
  try {
    jiraTestResult.value = await TestJiraConnection()
  } catch (e: any) {
    jiraTestResult.value = { name: 'jira', type: 'jira', status: 'error', message: e?.message ?? 'test failed' }
  } finally {
    jiraTesting.value = false
  }
}

// ── ANS (Notifications) ─────────────────────────────────────────────────────

const ansStatus = ref<AnsStatus | null>(null)
const ansLoading = ref(false)
const ansTestResult = ref<ConnectivityStatus | null>(null)
const ansTesting = ref(false)

const loadAnsStatus = async () => {
  ansLoading.value = true
  try {
    ansStatus.value = await GetAnsStatus()
  } catch {
    ansStatus.value = null
  } finally {
    ansLoading.value = false
  }
}

const handleTestAns = async () => {
  ansTesting.value = true
  ansTestResult.value = null
  try {
    ansTestResult.value = await TestAnsConnection()
  } catch (e: any) {
    ansTestResult.value = { name: 'ANS', type: 'ans', status: 'error', message: e?.message ?? 'test failed' }
  } finally {
    ansTesting.value = false
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
  await Promise.allSettled([loadTmsContext(), loadJiraConfig(), loadAnsStatus(), loadTenants(), loadDatabaseInfo()])
})
</script>

<template>
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

  <!-- Edit Jira Config Dialog -->
  <ui5-dialog
    header-text="Configure Jira Integration"
    :open="showJiraEditDialog"
    @before-close="showJiraEditDialog = false"
    style="width: 36rem;">
    <div class="sc-dialog-content">
      <ui5-message-strip design="Information" hide-close-button style="margin-bottom: 1rem;">
        Configure the BTP Destination that connects to your Jira instance.
        The destination should use BasicAuthentication with the Jira base URL
        (e.g. https://jira.example.com) and a service account's credentials.
      </ui5-message-strip>
      <ui5-label required>Destination Name</ui5-label>
      <ui5-input
        :value="jiraEditDest"
        @input="jiraEditDest = ($event as any).target.value"
        placeholder="e.g. cpi-delivery-jira"
        style="width: 100%;" />
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem;">
        <ui5-label>Enabled</ui5-label>
        <ui5-switch
          :checked="jiraEditEnabled"
          @change="jiraEditEnabled = ($event as any).target.checked" />
      </div>
    </div>
    <ui5-toolbar slot="footer">
      <ui5-toolbar-button design="Emphasized" text="Save" :disabled="jiraSaving" @click="onSaveJiraConfig" />
      <ui5-toolbar-button design="Transparent" text="Cancel" @click="showJiraEditDialog = false" />
    </ui5-toolbar>
  </ui5-dialog>

  <div class="page">
    <!-- Header -->
    <div class="page-header">
      <ui5-title level="H4">System Configuration & External Dependencies</ui5-title>
    </div>

    <!-- Central TMS -->
    <ui5-panel header-text="Central TMS" fixed>
      <ui5-busy-indicator :active="tmsContextLoading" :delay="0" size="M" style="width: 100%;">
        <div class="panel-body">
          <ui5-message-strip v-if="!tmsContext?.TmsApiDestinationName && !tmsContextLoading" design="Critical" hide-close-button>
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
              <ui5-label>&nbsp;</ui5-label>
              <ui5-button design="Transparent" icon="edit" @click="openTmsEditDialog">
                {{ tmsContext?.TmsApiDestinationName ? 'Edit' : 'Configure' }}
              </ui5-button>
            </div>
          </div>
        </div>
      </ui5-busy-indicator>
    </ui5-panel>

    <!-- Git Repository -->
    <GitRepoConfigCard />

    <!-- Jira Integration -->
    <ui5-panel header-text="Jira Integration" fixed>
      <ui5-busy-indicator :active="jiraLoading" :delay="0" size="M" style="width: 100%;">
        <div class="panel-body">
          <div class="info-row">
            <div class="info-field">
              <ui5-label>Destination</ui5-label>
              <ui5-text>{{ jiraConfig?.destinationName || '—' }}</ui5-text>
            </div>
            <div class="info-field" v-if="jiraConfig?.endpoint">
              <ui5-label>Endpoint</ui5-label>
              <ui5-text class="mono">{{ jiraConfig.endpoint }}</ui5-text>
            </div>
            <div class="info-field">
              <ui5-label>Enabled</ui5-label>
              <ui5-tag :design="jiraConfig?.enabled ? 'Positive' : 'Neutral'" style="font-size: 0.75rem;">
                {{ jiraConfig?.enabled ? 'Yes' : 'No' }}
              </ui5-tag>
            </div>
            <div class="info-field">
              <ui5-label>Status</ui5-label>
              <ui5-tag v-if="jiraTestResult" :design="statusDesign(jiraTestResult.status)" style="font-size: 0.75rem;">
                {{ jiraTestResult.status === 'ok' ? 'OK' : jiraTestResult.message }}
              </ui5-tag>
              <ui5-text v-else style="color: var(--sapContent_LabelColor);">—</ui5-text>
            </div>
            <div class="info-field">
              <ui5-label>&nbsp;</ui5-label>
              <div style="display: flex; gap: 0.25rem;">
                <ui5-button design="Transparent" icon="edit" @click="openJiraEditDialog" tooltip="Edit" />
                <ui5-button design="Transparent" icon="connected" @click="handleTestJira"
                  :disabled="!jiraConfig?.destinationName || jiraTesting" tooltip="Test Connection" />
              </div>
            </div>
          </div>
        </div>
      </ui5-busy-indicator>
    </ui5-panel>

    <!-- Notifications (ANS) -->
    <ui5-panel header-text="Notifications (SAP Alert Notification Service)" fixed>
      <ui5-busy-indicator :active="ansLoading" :delay="0" size="M" style="width: 100%;">
        <div class="panel-body">
          <ui5-message-strip v-if="ansStatus && !ansStatus.bound && !ansLoading" design="Information" hide-close-button>
            Alert Notification Service is not bound. Delivery event notifications (Email, Slack, Teams) are currently disabled.
            Bind the alert-notification service instance to enable notifications.
          </ui5-message-strip>
          <div class="info-row">
            <div class="info-field">
              <ui5-label>Status</ui5-label>
              <ui5-tag :design="ansStatus?.bound ? 'Positive' : 'Neutral'" style="font-size: 0.75rem;">
                {{ ansStatus?.bound ? 'Connected' : 'Not bound' }}
              </ui5-tag>
            </div>
            <div class="info-field" v-if="ansStatus?.endpoint">
              <ui5-label>Endpoint</ui5-label>
              <ui5-text class="mono">{{ ansStatus.endpoint }}</ui5-text>
            </div>
            <div class="info-field" v-if="ansTestResult">
              <ui5-label>Test</ui5-label>
              <ui5-tag :design="statusDesign(ansTestResult.status)" style="font-size: 0.75rem;">
                {{ ansTestResult.status === 'ok' ? 'OK' : ansTestResult.message }}
              </ui5-tag>
            </div>
            <div class="info-field" v-if="ansStatus?.bound">
              <ui5-label>&nbsp;</ui5-label>
              <ui5-button design="Transparent" icon="connected" @click="handleTestAns"
                :disabled="ansTesting" tooltip="Test Connection" />
            </div>
          </div>
          <ui5-message-strip v-if="ansStatus?.bound" design="Information" hide-close-button style="margin-top: 0.5rem;">
            Notification delivery (Email, Slack, Teams) is managed via the SAP Alert Notification Service cockpit.
            Configure conditions, actions, and subscriptions there to route delivery events.
          </ui5-message-strip>
        </div>
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
          </ui5-table-header-row>
          <ui5-table-row v-for="t in tenants" :key="t.ID">
            <ui5-table-cell><ui5-text>{{ t.Name }}</ui5-text></ui5-table-cell>
            <ui5-table-cell><ui5-text class="mono">{{ t.PirApiDestinationName || '—' }}</ui5-text></ui5-table-cell>
            <ui5-table-cell>
              <ui5-tag design="Set2" style="font-size: 0.7rem;">{{ t.LifecycleState || '—' }}</ui5-tag>
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
          <ui5-tag v-if="dbInfo" :design="statusDesign(dbInfo.status)" style="font-size: 0.75rem;">
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

/* Info panels (TMS, Jira, Database) */
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
