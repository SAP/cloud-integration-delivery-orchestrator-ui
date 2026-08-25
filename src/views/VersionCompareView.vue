<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { GetVersionCompareSummary, TriggerVersionCompare, GetIncludedPackages, UpdateIncludedPackages, GetCpiTenants, GetPackages, AdhocVersionCompare } from '@/service/api'
import type { VersionCompareSummaryItem, SnapshotStatus, CpiTenant, Package } from '@/service/model'
import { toLocalTime } from '@/service/consts'
import { useAuth } from '@/composables/useAuth'

import "@ui5/webcomponents/dist/Card.js"
import "@ui5/webcomponents/dist/CardHeader.js"
import "@ui5/webcomponents/dist/Tag.js"
import "@ui5/webcomponents/dist/Text.js"
import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents/dist/BusyIndicator.js"
import "@ui5/webcomponents/dist/Dialog.js"
import "@ui5/webcomponents/dist/Toolbar.js"
import "@ui5/webcomponents/dist/ToolbarButton.js"
import "@ui5/webcomponents/dist/Select.js"
import "@ui5/webcomponents/dist/Option.js"
import "@ui5/webcomponents/dist/CheckBox.js"
import "@ui5/webcomponents/dist/Input.js"
import "@ui5/webcomponents/dist/List.js"
import "@ui5/webcomponents/dist/ListItemStandard.js"
import "@ui5/webcomponents/dist/Title.js"
import "@ui5/webcomponents-icons/dist/search.js"
import "@ui5/webcomponents-icons/dist/compare.js"
import "@ui5/webcomponents-icons/dist/synchronize.js"
import "@ui5/webcomponents-icons/dist/action-settings.js"
import "@ui5/webcomponents/dist/ToggleButton.js"

const router = useRouter()
const { hasScope } = useAuth()
const summaries = ref<VersionCompareSummaryItem[]>([])
const loading = ref(false)
const triggeringRules = ref<Set<number>>(new Set())

// --- Included Packages Dialog State ---
const showIncludedDialog = ref(false)
const savingIncluded = ref(false)
const currentIncluded = ref<{ packageID: string; description: string }[]>([])

// Tenant selection state
const tenants = ref<CpiTenant[]>([])
const selectedTenantId = ref<number | null>(null)
const tenantPackages = ref<Package[]>([])
const loadingPackages = ref(false)
const checkedPkgIds = ref<Set<string>>(new Set())
const pkgSearchQuery = ref('')

const loadSummaries = async () => {
  loading.value = true
  try {
    summaries.value = await GetVersionCompareSummary()
  } finally {
    loading.value = false
  }
}

const handleTrigger = async (ruleId: number, event: Event) => {
  event.stopPropagation()
  if (triggeringRules.value.has(ruleId)) return
  triggeringRules.value.add(ruleId)
  try {
    const result = await TriggerVersionCompare(ruleId)
    if (result.status === 'running') {
      window.$toast?.success?.('Scan triggered')
    }
    await loadSummaries()
  } catch (e) {
    // error already displayed by http interceptor
  } finally {
    triggeringRules.value.delete(ruleId)
  }
}

const navigateToDetail = (ruleId: number) => {
  router.push(`/jobs/version-compare/${ruleId}`)
}

const statusDesign = (status: SnapshotStatus): string => {
  switch (status) {
    case 'completed': return 'Positive'
    case 'running': return 'Information'
    case 'failed': return 'Negative'
    case 'none': return 'Neutral'
    default: return 'Neutral'
  }
}

const statusLabel = (status: SnapshotStatus): string => {
  switch (status) {
    case 'completed': return 'Completed'
    case 'running': return 'Running'
    case 'failed': return 'Failed'
    case 'none': return 'Not Scanned'
    default: return status
  }
}

// --- Included Packages Dialog Logic ---

/** Tenant packages filtered by search keyword */
const filteredPackages = computed(() => {
  const q = pkgSearchQuery.value.trim().toLowerCase()
  if (!q) return tenantPackages.value
  return tenantPackages.value.filter(p =>
    p.Id.toLowerCase().includes(q) || p.Name.toLowerCase().includes(q)
  )
})

const openIncludedDialog = async () => {
  // Reset state
  selectedTenantId.value = null
  tenantPackages.value = []
  checkedPkgIds.value = new Set()
  pkgSearchQuery.value = ''

  // Load whitelist + tenants in parallel
  const [includedData, tenantData] = await Promise.all([
    GetIncludedPackages().catch(() => ({ packages: [] as any[] })),
    GetCpiTenants().catch(() => [] as CpiTenant[]),
  ])

  // Initialize checked set from current whitelist
  const pkgs = (includedData.packages ?? [])
  checkedPkgIds.value = new Set(pkgs.map((p: any) => p.PackageID))
  currentIncluded.value = pkgs.map((p: any) => ({ packageID: p.PackageID, description: p.Description }))
  tenants.value = tenantData ?? []
  showIncludedDialog.value = true
}

const onTenantChange = async (event: Event) => {
  const value = (event as any).detail?.selectedOption?.value
  if (!value) return
  const tenantId = Number(value)
  selectedTenantId.value = tenantId
  pkgSearchQuery.value = ''

  const tenant = tenants.value.find(t => t.ID === tenantId)
  if (!tenant) return
  loadingPackages.value = true
  try {
    tenantPackages.value = (await GetPackages(tenant.ID)) ?? []
  } catch {
    tenantPackages.value = []
  } finally {
    loadingPackages.value = false
  }
}

const togglePkgSelection = (pkgId: string, checked: boolean) => {
  const next = new Set(checkedPkgIds.value)
  if (checked) {
    next.add(pkgId)
  } else {
    next.delete(pkgId)
  }
  checkedPkgIds.value = next
}

const saveIncludedPackages = async () => {
  savingIncluded.value = true
  try {
    // Build list from checked IDs, use tenant package Name as description
    const pkgMap = new Map(tenantPackages.value.map(p => [p.Id, p.Name]))
    const packages = [...checkedPkgIds.value].map(id => ({
      packageID: id,
      description: pkgMap.get(id) || '',
    }))
    await UpdateIncludedPackages(packages)
    window.$toast?.success?.('Included packages updated')
    showIncludedDialog.value = false
  } catch {
    // error displayed by http interceptor
  } finally {
    savingIncluded.value = false
  }
}

onMounted(loadSummaries)

// --- Adhoc Compare Dialog ---
const showAdhocDialog = ref(false)
const adhocTenants = ref<CpiTenant[]>([])
const adhocSelected = ref<Set<number>>(new Set())
const adhocLoading = ref(false)

const openAdhocDialog = async () => {
  adhocSelected.value = new Set()
  adhocLoading.value = false
  if (tenants.value.length === 0) {
    tenants.value = await GetCpiTenants().catch(() => [] as CpiTenant[])
  }
  adhocTenants.value = tenants.value
  showAdhocDialog.value = true
}

const toggleAdhocTenant = (tenantId: number, checked: boolean) => {
  const next = new Set(adhocSelected.value)
  if (checked) next.add(tenantId)
  else next.delete(tenantId)
  adhocSelected.value = next
}

const handleAdhocCompare = async () => {
  if (adhocSelected.value.size < 2) return
  adhocLoading.value = true
  try {
    const tenantIDs = [...adhocSelected.value]
    const result = await AdhocVersionCompare(tenantIDs)
    showAdhocDialog.value = false
    router.push({ name: 'Adhoc Version Compare', state: { adhocData: JSON.stringify(result) } })
  } catch {
    // error displayed by http interceptor
  } finally {
    adhocLoading.value = false
  }
}
</script>

<template>
  <div class="vc-container">
    <div class="vc-header">
      <ui5-text style="font-size: 1.25rem; font-weight: bold;">Version Compare</ui5-text>
      <div class="vc-header-actions">
        <ui5-button v-if="hasScope('VersionCompare.Adhoc')" design="Attention" icon="compare" @click="openAdhocDialog">Adhoc Compare</ui5-button>
        <ui5-button design="Transparent" icon="action-settings" @click="openIncludedDialog">Manage Included Packages</ui5-button>
        <ui5-button design="Emphasized" @click="loadSummaries" :disabled="loading">Refresh</ui5-button>
      </div>
    </div>

    <!-- Included Packages Dialog -->
    <ui5-dialog :open="showIncludedDialog" @close="showIncludedDialog = false" header-text="Manage Included Packages" style="width: 50rem;">
      <div class="ipd-content">
        <ui5-text style="font-size: 0.8rem; color: var(--sapNeutralTextColor); margin-bottom: 0.75rem; display: block;">
          Select a tenant, then check the packages to include in version compare. When nothing is checked, all packages are compared.
        </ui5-text>

        <!-- Current whitelist (read-only) -->
        <div v-if="currentIncluded.length > 0" class="ipd-current">
          <ui5-title level="H5">Currently included ({{ currentIncluded.length }})</ui5-title>
          <ui5-list class="ipd-current-list">
            <ui5-li
              v-for="pkg in currentIncluded"
              :key="pkg.packageID"
              :description="pkg.packageID"
            >{{ pkg.description || pkg.packageID }}</ui5-li>
          </ui5-list>
        </div>

        <div class="ipd-tenant-row">
          <ui5-select style="flex: 1;" @change="onTenantChange">
            <ui5-option value="" :selected="!selectedTenantId">-- Select a tenant --</ui5-option>
            <ui5-option v-for="t in tenants" :key="t.ID" :value="String(t.ID)">{{ t.Name }}</ui5-option>
          </ui5-select>
        </div>

        <ui5-busy-indicator :active="loadingPackages" size="S" style="width: 100%;">
          <div v-if="selectedTenantId && !loadingPackages && tenantPackages.length > 0">
            <ui5-input
              placeholder="Search packages..."
              :value="pkgSearchQuery"
              @input="pkgSearchQuery = ($event as any).target.value"
              show-clear-icon
              style="width: 100%; margin-bottom: 0.5rem;"
            >
              <ui5-icon slot="icon" name="search" />
            </ui5-input>
            <div v-if="filteredPackages.length > 0" class="ipd-pkg-select">
              <div class="ipd-pkg-item" v-for="pkg in filteredPackages" :key="pkg.Id">
                <ui5-checkbox
                  :text="`${pkg.Id} — ${pkg.Name}`"
                  :checked="checkedPkgIds.has(pkg.Id)"
                  @change="togglePkgSelection(pkg.Id, ($event as any).target.checked)"
                />
              </div>
            </div>
            <div v-else class="ipd-empty-available">
              <ui5-text style="font-size: 0.8rem; color: var(--sapNeutralTextColor); font-style: italic;">
                No packages match "{{ pkgSearchQuery }}".
              </ui5-text>
            </div>
          </div>
          <div v-else-if="selectedTenantId && !loadingPackages && tenantPackages.length === 0" class="ipd-empty-available">
            <ui5-text style="font-size: 0.8rem; color: var(--sapNeutralTextColor); font-style: italic;">
              No packages found in this tenant.
            </ui5-text>
          </div>
        </ui5-busy-indicator>
      </div>
      <ui5-toolbar slot="footer">
        <ui5-toolbar-button design="Emphasized" text="Save" @click="saveIncludedPackages" :disabled="savingIncluded || !selectedTenantId" />
        <ui5-toolbar-button design="Transparent" text="Cancel" @click="showIncludedDialog = false" />
      </ui5-toolbar>
    </ui5-dialog>

    <ui5-busy-indicator :active="loading" size="M" style="width: 100%;">
      <div class="vc-grid" v-if="summaries.length > 0">
        <ui5-card
          v-for="item in summaries"
          :key="item.deliveryRuleID"
          class="vc-card"
          @click="navigateToDetail(item.deliveryRuleID)"
        >
          <ui5-card-header
            slot="header"
            :title-text="item.deliveryRuleName"
            :subtitle-text="`Source: ${item.sourceTenantName}`"
            interactive
          />
          <div class="card-body">
            <div class="card-row">
              <ui5-tag :design="statusDesign(item.status)">{{ statusLabel(item.status) }}</ui5-tag>
              <ui5-tag design="Set2" color-scheme="6">{{ item.tenantCount }} tenants</ui5-tag>
            </div>

            <div v-if="item.status === 'completed'" class="card-stats">
              <div class="stat">
                <span class="stat-value stat-total">{{ item.totalArtifacts }}</span>
                <span class="stat-label">Total</span>
              </div>
              <div class="stat">
                <span class="stat-value stat-matched">{{ item.matchedCount }}</span>
                <span class="stat-label">Matched</span>
              </div>
              <div class="stat">
                <span class="stat-value stat-mismatched">{{ item.mismatchedCount }}</span>
                <span class="stat-label">Mismatched</span>
              </div>
            </div>

            <div v-if="item.triggeredAt" class="card-meta">
              <ui5-text style="font-size: 0.75rem; color: var(--sapNeutralTextColor);">
                Last scan: {{ toLocalTime(item.triggeredAt) }}
              </ui5-text>
            </div>

            <div class="card-actions">
              <ui5-button
                design="Transparent"
                icon="synchronize"
                :disabled="item.status === 'running' || triggeringRules.has(item.deliveryRuleID)"
                @click="handleTrigger(item.deliveryRuleID, $event)"
              >
                {{ item.status === 'running' ? 'Scanning...' : 'Trigger Scan' }}
              </ui5-button>
            </div>
          </div>
        </ui5-card>
      </div>

      <div v-else-if="!loading" class="vc-empty">
        <ui5-text>No active delivery rules found.</ui5-text>
      </div>
    </ui5-busy-indicator>

    <!-- Adhoc Compare Dialog -->
    <ui5-dialog :open="showAdhocDialog" @close="showAdhocDialog = false" header-text="Adhoc Version Compare" style="width: 36rem;">
      <div class="adhoc-content">
        <ui5-text style="font-size: 0.8rem; color: var(--sapNeutralTextColor); margin-bottom: 0.75rem; display: block;">
          Select 2 or more tenants to compare. The first selected tenant is used as the baseline.
        </ui5-text>

        <div class="adhoc-tenant-grid">
          <ui5-toggle-button
            v-for="t in adhocTenants"
            :key="t.ID"
            :pressed="adhocSelected.has(t.ID)"
            @click="toggleAdhocTenant(t.ID, !adhocSelected.has(t.ID))"
            design="Default"
          >{{ t.Name }}</ui5-toggle-button>
        </div>

        <ui5-text v-if="adhocSelected.size > 0" style="font-size: 0.8rem; margin-top: 0.75rem; display: block;">
          {{ adhocSelected.size }} tenant(s) selected
        </ui5-text>
      </div>

      <ui5-toolbar slot="footer">
        <ui5-toolbar-button
          design="Emphasized"
          :text="adhocLoading ? 'Comparing...' : 'Compare'"
          @click="handleAdhocCompare"
          :disabled="adhocSelected.size < 2 || adhocLoading"
        />
        <ui5-toolbar-button design="Transparent" text="Cancel" @click="showAdhocDialog = false" :disabled="adhocLoading" />
      </ui5-toolbar>
    </ui5-dialog>
  </div>
</template>

<style scoped>
.vc-container {
  padding: 1rem 2rem;
}

.vc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.vc-header-actions {
  display: flex;
  gap: 0.5rem;
}

.vc-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.vc-card {
  width: 22rem;
  cursor: pointer;
}

.card-body {
  padding: 0.75rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.card-stats {
  display: flex;
  gap: 1.5rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
}

.stat-total {
  color: var(--sapNeutralTextColor);
}

.stat-matched {
  color: var(--sapPositiveColor);
}

.stat-mismatched {
  color: var(--sapCriticalColor);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--sapNeutralTextColor);
}

.card-meta {
  border-top: 1px solid var(--sapGroup_ContentBorderColor);
  padding-top: 0.5rem;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
}

.vc-empty {
  text-align: center;
  padding: 3rem;
}

/* Included Packages Dialog */
.ipd-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.ipd-current {
  margin-bottom: 0.75rem;
}

.ipd-current-list {
  max-height: 20rem;
  overflow-y: auto;
}

.ipd-tenant-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.ipd-pkg-select {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  max-height: 20rem;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.ipd-pkg-item {
  padding: 0.125rem 0;
}

.ipd-empty-available {
  padding: 1rem;
  text-align: center;
}

/* Adhoc Compare Dialog */
.adhoc-content {
  padding: 1rem;
}

.adhoc-tenant-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
