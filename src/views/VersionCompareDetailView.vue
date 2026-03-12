<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { QueryVersionCompare, TriggerVersionCompare, GetDeliveryRule } from '@/service/api'
import type {
  VersionCompareResponse,
  VersionCompareTenantInfo,
  VersionComparePackage,
  VersionCompareArtifact,
  VersionCompareArtifactTenantInfo,
} from '@/service/model'
import { toLocalTime } from '@/service/consts'

import "@ui5/webcomponents/dist/Tag.js"
import "@ui5/webcomponents/dist/Text.js"
import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents/dist/BusyIndicator.js"
import "@ui5/webcomponents/dist/CheckBox.js"
import "@ui5/webcomponents/dist/Title.js"
import "@ui5/webcomponents/dist/Panel.js"
import "@ui5/webcomponents/dist/Table.js"
import "@ui5/webcomponents/dist/TableRow.js"
import "@ui5/webcomponents/dist/TableCell.js"
import "@ui5/webcomponents/dist/TableHeaderRow.js"
import "@ui5/webcomponents/dist/TableHeaderCell.js"

const props = defineProps<{ ruleId: number }>()
const router = useRouter()

const data = ref<VersionCompareResponse | null>(null)
const ruleName = ref('')
const loading = ref(false)
const triggering = ref(false)

// Filter state
const showDesignTime = ref(true)
const showRunTime = ref(true)
const mismatchOnly = ref(true)

// Package filter: track which packageIDs are selected (all selected by default)
// Using Record<string, boolean> instead of Set for reliable Vue reactivity tracking
const selectedPackages = ref<Record<string, boolean>>({})
const pkgFilterInitialized = ref(false)
// All available package IDs from the response
const allPackageIDs = computed(() => {
  return (data.value?.packages ?? []).map(p => p.packageID)
})

const tenants = computed<VersionCompareTenantInfo[]>(() => data.value?.tenants ?? [])
const sourceTenant = computed(() => tenants.value.find(t => t.isSource))
const targetTenants = computed(() => tenants.value.filter(t => !t.isSource))

// Apply local package filter on top of server-filtered data
const filteredPackages = computed<VersionComparePackage[]>(() => {
  const pkgs = data.value?.packages ?? []
  if (!pkgFilterInitialized.value) return pkgs
  return pkgs.filter(p => selectedPackages.value[p.packageID] === true)
})

const totalArtifacts = computed(() => {
  let count = 0
  for (const pkg of filteredPackages.value) {
    count += (pkg.artifacts ?? []).length
  }
  return count
})

const loadData = async () => {
  loading.value = true
  try {
    data.value = await QueryVersionCompare(props.ruleId, {
      designTime: showDesignTime.value,
      runTime: showRunTime.value,
      mismatchOnly: mismatchOnly.value,
    })
    // On first load, select all packages
    if (!pkgFilterInitialized.value && allPackageIDs.value.length > 0) {
      const map: Record<string, boolean> = {}
      for (const id of allPackageIDs.value) map[id] = true
      selectedPackages.value = map
      pkgFilterInitialized.value = true
    }
  } finally {
    loading.value = false
  }
}

const handleTrigger = async () => {
  if (triggering.value) return
  triggering.value = true
  try {
    const result = await TriggerVersionCompare(props.ruleId)
    if (result.status === 'running') {
      window.$message?.success?.('Scan triggered')
    }
    pollUntilComplete()
  } catch (e) {
    // error displayed by http interceptor
  } finally {
    triggering.value = false
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

const pollUntilComplete = () => {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    await loadData()
    if (data.value && data.value.status !== 'running') {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }
  }, 3000)
}

const goBack = () => {
  router.push('/jobs/version-compare')
}

const statusDesign = (status: string): string => {
  switch (status) {
    case 'completed': return 'Positive'
    case 'running': return 'Information'
    case 'failed': return 'Negative'
    case 'none': return 'Neutral'
    default: return 'Neutral'
  }
}

const statusLabel = (status: string): string => {
  switch (status) {
    case 'completed': return 'Completed'
    case 'running': return 'Running'
    case 'failed': return 'Failed'
    case 'none': return 'Not Scanned'
    default: return status
  }
}

// Get tenant version info from artifact, handling string/number key coercion
const getTenantInfo = (art: VersionCompareArtifact, tenantId: number): VersionCompareArtifactTenantInfo | undefined => {
  return art.versions?.[tenantId]
}

// Build display cell content for a tenant column
const versionDisplay = (info: VersionCompareArtifactTenantInfo | undefined, field: 'designTime' | 'runTime'): string => {
  if (!info) return ''
  if (field === 'designTime') {
    if (info.designTimeDraft) return 'DRAFT'
    return info.designTimeVersion || '-'
  }
  return info.runtimeVersion || '-'
}

// CPI API returns ModifiedAt as epoch millis string (e.g. "1678901234567")
const formatModifiedAt = (raw?: string): string => {
  if (!raw) return '-'
  const ms = Number(raw)
  if (!isNaN(ms) && ms > 0) return toLocalTime(new Date(ms).toISOString())
  return toLocalTime(raw)
}

const togglePackage = (pkgID: string, checked: boolean) => {
  selectedPackages.value[pkgID] = checked
}

const selectAllPackages = () => {
  const map: Record<string, boolean> = {}
  for (const id of allPackageIDs.value) map[id] = true
  selectedPackages.value = map
}

const deselectAllPackages = () => {
  selectedPackages.value = {}
}

watch([showDesignTime, showRunTime, mismatchOnly], () => {
  if (data.value?.status === 'completed') {
    loadData()
  }
})

onMounted(async () => {
  // Fetch rule name in parallel with snapshot data
  const rulePromise = GetDeliveryRule(props.ruleId).then(r => { ruleName.value = r.Name }).catch(() => {})
  const dataPromise = loadData()
  await Promise.all([rulePromise, dataPromise])

  if (data.value?.status === 'running') {
    pollUntilComplete()
  }
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="vcd-container">
    <!-- Header -->
    <div class="vcd-header">
      <div class="vcd-header-left">
        <ui5-button design="Transparent" icon="nav-back" @click="goBack" />
        <ui5-title level="H4">Version Compare{{ ruleName ? ` - Rule: ${ruleName}` : '' }}</ui5-title>
        <ui5-tag v-if="data" :design="statusDesign(data.status)">
          {{ statusLabel(data.status) }}
        </ui5-tag>
      </div>
      <div class="vcd-header-right">
        <ui5-button
          design="Emphasized"
          icon="synchronize"
          :disabled="data?.status === 'running' || triggering"
          @click="handleTrigger"
        >
          {{ data?.status === 'running' ? 'Scanning...' : 'Trigger Scan' }}
        </ui5-button>
        <ui5-button design="Transparent" icon="refresh" @click="loadData" :disabled="loading">Refresh</ui5-button>
      </div>
    </div>

    <!-- Meta info -->
    <div v-if="data && data.status !== 'none'" class="vcd-meta">
      <ui5-text v-if="sourceTenant" style="font-size: 0.85rem;">
        Source: <strong>{{ sourceTenant.name }}</strong>
      </ui5-text>
      <ui5-text v-if="data.triggeredBy" style="font-size: 0.85rem;">
        Snapshot: {{ data.triggeredAt ? toLocalTime(data.triggeredAt) : '' }} by {{ data.triggeredBy }}
      </ui5-text>
      <ui5-text v-if="data.error" style="font-size: 0.85rem; color: var(--sapNegativeColor);">
        Error: {{ data.error }}
      </ui5-text>
    </div>

    <!-- Filters: DT / RT / Mismatch Only -->
    <div v-if="data?.status === 'completed'" class="vcd-filters">
      <ui5-checkbox
        :checked="showDesignTime"
        text="Design Time"
        @change="showDesignTime = ($event as any).target.checked"
      />
      <ui5-checkbox
        :checked="showRunTime"
        text="Runtime"
        @change="showRunTime = ($event as any).target.checked"
      />
      <ui5-checkbox
        :checked="mismatchOnly"
        text="Mismatch Only"
        @change="mismatchOnly = ($event as any).target.checked"
      />
      <ui5-text style="font-size: 0.85rem; color: var(--sapNeutralTextColor); margin-left: auto;">
        {{ totalArtifacts }} artifacts shown
      </ui5-text>
    </div>

    <!-- Package filter checkboxes -->
    <div v-if="data?.status === 'completed' && allPackageIDs.length > 1" class="vcd-pkg-filter">
      <div class="vcd-pkg-filter-header">
        <ui5-text style="font-size: 0.85rem; font-weight: 600;">Packages:</ui5-text>
        <ui5-button design="Transparent" @click="selectAllPackages" style="font-size: 0.75rem;">Select All</ui5-button>
        <ui5-button design="Transparent" @click="deselectAllPackages" style="font-size: 0.75rem;">Deselect All</ui5-button>
      </div>
      <div class="vcd-pkg-filter-list">
        <ui5-checkbox
          v-for="pkgID in allPackageIDs"
          :key="pkgID"
          :checked="selectedPackages[pkgID] === true"
          :text="pkgID"
          @change="togglePackage(pkgID, ($event as any).target.checked)"
        />
      </div>
    </div>

    <!-- Loading -->
    <ui5-busy-indicator :active="loading" size="M" style="width: 100%;">
      <!-- Not scanned -->
      <div v-if="data?.status === 'none'" class="vcd-empty">
        <ui5-text>No scan data available. Click "Trigger Scan" to start.</ui5-text>
      </div>

      <!-- Running -->
      <div v-else-if="data?.status === 'running'" class="vcd-empty">
        <ui5-busy-indicator active size="M" />
        <ui5-text style="margin-top: 1rem;">Scanning artifact versions across tenants...</ui5-text>
      </div>

      <!-- Completed: comparison table grouped by package -->
      <div v-else-if="data?.status === 'completed'" class="vcd-packages">
        <ui5-panel
          v-for="pkg in filteredPackages"
          :key="pkg.packageID"
          :header-text="`${pkg.packageID} (${(pkg.artifacts ?? []).length} artifacts)`"
          class="vcd-panel"
        >
          <ui5-table overflow-mode="Scroll" class="compare-table">
            <ui5-table-header-row slot="headerRow">
              <ui5-table-header-cell min-width="180px">Artifact</ui5-table-header-cell>
              <ui5-table-header-cell width="100px">Type</ui5-table-header-cell>
              <ui5-table-header-cell v-if="sourceTenant" min-width="140px">{{ sourceTenant.name }}</ui5-table-header-cell>
              <ui5-table-header-cell v-for="tenant in targetTenants" :key="tenant.id" min-width="140px">
                {{ tenant.name }}
              </ui5-table-header-cell>
              <ui5-table-header-cell v-if="sourceTenant" min-width="120px">Modified By</ui5-table-header-cell>
              <ui5-table-header-cell v-if="sourceTenant" min-width="140px">Modified At</ui5-table-header-cell>
            </ui5-table-header-row>

            <ui5-table-row v-for="art in (pkg.artifacts ?? [])" :key="art.id">
              <ui5-table-cell>
                <span class="col-artifact" :title="art.id">{{ art.name || art.id }}</span>
              </ui5-table-cell>
              <ui5-table-cell>
                <ui5-tag design="Set2" color-scheme="6" style="font-size: 0.7rem;">
                  {{ art.type === 'iflow' ? 'IF' : art.type === 'scriptcollection' ? 'SC' : art.type }}
                </ui5-tag>
              </ui5-table-cell>

              <!-- Source tenant cell: DT + RT stacked, no match indicator -->
              <ui5-table-cell v-if="sourceTenant">
                <div class="version-cell">
                  <template v-if="getTenantInfo(art, sourceTenant.id)">
                    <div v-if="showDesignTime" class="version-row">
                      <span class="version-label">DT</span>
                      <span>{{ versionDisplay(getTenantInfo(art, sourceTenant.id), 'designTime') }}</span>
                      <ui5-tag v-if="getTenantInfo(art, sourceTenant.id)?.designTimeDraft" design="Critical" class="draft-tag">DRAFT</ui5-tag>
                    </div>
                    <div v-if="showRunTime" class="version-row">
                      <span class="version-label">RT</span>
                      <span>{{ versionDisplay(getTenantInfo(art, sourceTenant.id), 'runTime') }}</span>
                      <ui5-tag
                        v-if="getTenantInfo(art, sourceTenant.id)?.runtimeStatus && getTenantInfo(art, sourceTenant.id)?.runtimeStatus !== 'STARTED'"
                        design="Negative"
                        class="rt-status-tag"
                      >
                        {{ getTenantInfo(art, sourceTenant.id)?.runtimeStatus }}
                      </ui5-tag>
                    </div>
                  </template>
                  <span v-else class="cell-missing">-</span>
                </div>
              </ui5-table-cell>

              <!-- Target tenant cells: DT + RT stacked, with match indicators -->
              <ui5-table-cell v-for="tenant in targetTenants" :key="tenant.id">
                <div class="version-cell" v-if="getTenantInfo(art, tenant.id)">
                  <!-- Design Time row -->
                  <div v-if="showDesignTime" class="version-row"
                    :class="{
                      'row-match': getTenantInfo(art, tenant.id)?.designTimeMatch === true,
                      'row-mismatch': getTenantInfo(art, tenant.id)?.designTimeMatch === false,
                    }"
                  >
                    <span class="version-label">DT</span>
                    <span>{{ versionDisplay(getTenantInfo(art, tenant.id), 'designTime') }}</span>
                    <ui5-tag v-if="getTenantInfo(art, tenant.id)?.designTimeDraft" design="Critical" class="draft-tag">DRAFT</ui5-tag>
                  </div>
                  <!-- Runtime row -->
                  <div v-if="showRunTime" class="version-row"
                    :class="{
                      'row-match': getTenantInfo(art, tenant.id)?.runtimeMatch === true,
                      'row-mismatch': getTenantInfo(art, tenant.id)?.runtimeMatch === false,
                    }"
                  >
                    <span class="version-label">RT</span>
                    <span>{{ versionDisplay(getTenantInfo(art, tenant.id), 'runTime') }}</span>
                    <ui5-tag
                      v-if="getTenantInfo(art, tenant.id)?.runtimeStatus && getTenantInfo(art, tenant.id)?.runtimeStatus !== 'STARTED'"
                      design="Negative"
                      class="rt-status-tag"
                    >
                      {{ getTenantInfo(art, tenant.id)?.runtimeStatus }}
                    </ui5-tag>

                  </div>
                  <!-- Error tooltip -->
                  <div v-if="getTenantInfo(art, tenant.id)?.error" class="version-error" :title="getTenantInfo(art, tenant.id)?.error">
                    {{ getTenantInfo(art, tenant.id)?.error }}
                  </div>
                </div>
                <!-- Artifact not found on this tenant -->
                <div v-else class="version-cell">
                  <span class="cell-missing" title="Artifact not found on this tenant">N/A</span>
                </div>
              </ui5-table-cell>

              <!-- Modified By column: source tenant's last DT committer -->
              <ui5-table-cell v-if="sourceTenant">
                <span class="modified-by" :title="getTenantInfo(art, sourceTenant.id)?.modifiedBy">
                  {{ getTenantInfo(art, sourceTenant.id)?.modifiedBy ?? '-' }}
                </span>
              </ui5-table-cell>

              <!-- Modified At column: source tenant's last DT modification time -->
              <ui5-table-cell v-if="sourceTenant">
                <span class="modified-at" :title="getTenantInfo(art, sourceTenant.id)?.modifiedAt">
                  {{ formatModifiedAt(getTenantInfo(art, sourceTenant.id)?.modifiedAt) }}
                </span>
              </ui5-table-cell>
            </ui5-table-row>
          </ui5-table>
        </ui5-panel>

        <div v-if="filteredPackages.length === 0" class="vcd-empty">
          <ui5-text>No artifacts match the current filters.</ui5-text>
        </div>
      </div>

      <!-- Failed -->
      <div v-else-if="data?.status === 'failed'" class="vcd-empty">
        <ui5-text style="color: var(--sapNegativeColor);">
          Scan failed: {{ data.error }}
        </ui5-text>
        <ui5-button design="Emphasized" @click="handleTrigger" style="margin-top: 1rem;">Retry</ui5-button>
      </div>
    </ui5-busy-indicator>
  </div>
</template>

<style scoped>
.vcd-container {
  padding: 1rem 2rem;
}

.vcd-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.vcd-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vcd-header-right {
  display: flex;
  gap: 0.5rem;
}

.vcd-meta {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  background: var(--sapGroup_ContentBackground);
  border-radius: 0.25rem;
}

.vcd-filters {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--sapGroup_TitleBackground);
  border-radius: 0.25rem;
}

.vcd-pkg-filter {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  background: var(--sapGroup_TitleBackground);
  border-radius: 0.25rem;
}

.vcd-pkg-filter-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vcd-pkg-filter-list {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  max-height: 6rem;
  overflow-y: auto;
  align-items: center;
}

.vcd-packages {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.vcd-panel {
  margin-bottom: 0;
}

.compare-table {
  font-size: 0.8125rem;
}

.col-artifact {
  max-width: 18rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

/* Version cell: stacks DT + RT rows vertically */
.version-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.version-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.25rem;
  border-radius: 0.1875rem;
  white-space: nowrap;
}

.version-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--sapNeutralTextColor);
  min-width: 1.25rem;
}

.row-match {
  background: var(--sapSuccessBackground);
}

.row-mismatch {
  background: var(--sapErrorBackground);
}

.draft-tag {
  font-size: 0.6rem;
}

.modified-by,
.modified-at {
  font-size: 0.75rem;
  color: var(--sapNeutralTextColor);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rt-status-tag {
  font-size: 0.6rem;
}

.cell-missing {
  color: var(--sapNeutralTextColor);
  font-style: italic;
}

.version-error {
  font-size: 0.7rem;
  color: var(--sapNegativeColor);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 10rem;
  cursor: help;
}

.vcd-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
}
</style>
