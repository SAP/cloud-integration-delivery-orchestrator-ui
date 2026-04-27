<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { QueryVersionCompare, TriggerVersionCompare, GetDeliveryRule, PreviewDRFromMismatch, CreateDRFromMismatch } from '@/service/api'
import type {
  VersionCompareResponse,
  VersionCompareTenantInfo,
  VersionComparePackage,
  VersionCompareArtifact,
  VersionCompareArtifactTenantInfo,
  PreviewDRResponse,
  PreviewDRArtifact,
  CreateDRFromMismatchResponse,
} from '@/service/model'
import { toLocalTime } from '@/service/consts'
import type { HttpError } from '@/service/http'
import { useAuth } from '@/composables/useAuth'

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
import "@ui5/webcomponents/dist/Dialog.js"
import "@ui5/webcomponents/dist/Input.js"
import "@ui5/webcomponents/dist/Label.js"
import "@ui5/webcomponents/dist/Toolbar.js"
import "@ui5/webcomponents/dist/ToolbarButton.js"
import "@ui5/webcomponents/dist/Icon.js"
import "@ui5/webcomponents-icons/dist/shipping-status.js"
import "@ui5/webcomponents/dist/MessageStrip.js"

const props = defineProps<{ ruleId: number }>()
const router = useRouter()
const { hasScope } = useAuth()

const isAdhoc = computed(() => props.ruleId === 0)
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
// In adhoc mode, also apply mismatchOnly filter locally (server returns full data)
const filteredPackages = computed<VersionComparePackage[]>(() => {
  let pkgs = data.value?.packages ?? []
  if (pkgFilterInitialized.value) {
    pkgs = pkgs.filter(p => selectedPackages.value[p.packageID] === true)
  }

  // Adhoc mode: apply mismatchOnly locally using match fields from response
  if (isAdhoc.value && mismatchOnly.value) {
    pkgs = pkgs.map(pkg => ({
      ...pkg,
      artifacts: (pkg.artifacts ?? []).filter(art => {
        return Object.values(art.versions ?? {}).some(v => {
          if (showDesignTime.value && v.designTimeMatch === false) return true
          if (showRunTime.value && v.runtimeMatch === false) return true
          return false
        })
      })
    })).filter(pkg => (pkg.artifacts?.length ?? 0) > 0)
  }

  return pkgs
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
      window.$toast?.success?.('Scan triggered')
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

const unselectAllPackages = () => {
  selectedPackages.value = {}
}

watch([showDesignTime, showRunTime, mismatchOnly], () => {
  if (isAdhoc.value) return  // adhoc data is local, no reload needed
  if (data.value?.status === 'completed') {
    loadData()
  }
})

// --- Create DR from Mismatch Dialog ---

// Dialog state
const showDRDialog = ref(false)
const drDialogStep = ref<'preview' | 'result'>('preview')
const previewLoading = ref(false)
const createLoading = ref(false)
const previewData = ref<PreviewDRResponse | null>(null)
const createResult = ref<CreateDRFromMismatchResponse | null>(null)
const createError = ref<HttpError | null>(null)

// User selections in the dialog
const drName = ref('')
const drJiraLink = ref('')
// Track which artifacts are checked (key: `${artifactID}::${packageID}`)
const checkedArtifacts = ref<Record<string, boolean>>({})
// Track which artifacts have skip deploy enabled (key: `${artifactID}::${packageID}`)
const skipDeployArtifacts = ref<Record<string, boolean>>({})

// Artifact search filter
const artifactSearch = ref('')

// Categorized artifacts from preview
const includableArtifacts = computed(() =>
  (previewData.value?.artifacts ?? []).filter(a => a.category === 'includable')
)
const duplicateArtifacts = computed(() =>
  (previewData.value?.artifacts ?? []).filter(a => a.category === 'duplicate')
)
const draftArtifacts = computed(() =>
  (previewData.value?.artifacts ?? []).filter(a => a.category === 'draft')
)
const versionPatternArtifacts = computed(() =>
  (previewData.value?.artifacts ?? []).filter(a => a.category === 'versionPattern')
)

// Filtered artifacts based on search
const filterBySearch = (arts: PreviewDRArtifact[]) => {
  if (!artifactSearch.value.trim()) return arts
  const q = artifactSearch.value.toLowerCase()
  return arts.filter(a =>
    a.artifactID.toLowerCase().includes(q) ||
    a.artifactName.toLowerCase().includes(q) ||
    a.packageID.toLowerCase().includes(q)
  )
}

const filteredIncludable = computed(() => filterBySearch(includableArtifacts.value))
const filteredDuplicate = computed(() => filterBySearch(duplicateArtifacts.value))
const filteredDraft = computed(() => filterBySearch(draftArtifacts.value))
const filteredVersionPattern = computed(() => filterBySearch(versionPatternArtifacts.value))

const artifactKey = (a: PreviewDRArtifact) => `${a.artifactID}::${a.packageID}`

const selectedCount = computed(() => {
  return Object.values(checkedArtifacts.value).filter(v => v).length
})

const typeLabel = (type: string): string => {
  switch (type) {
    case 'Integration Flow': return 'IF'
    case 'Script Collection': return 'SC'
    case 'OData Service': return 'OD'
    case 'Integration Adapter': return 'IA'
    default: return type
  }
}

const handleOpenDRDialog = async () => {
  // Reset state
  drDialogStep.value = 'preview'
  previewData.value = null
  createResult.value = null
  createError.value = null
  drName.value = ''
  drJiraLink.value = ''
  checkedArtifacts.value = {}
  skipDeployArtifacts.value = {}
  artifactSearch.value = ''
  showDRDialog.value = true

  // Load preview
  previewLoading.value = true
  try {
    previewData.value = await PreviewDRFromMismatch(props.ruleId)
    // Default: check all includable, uncheck duplicates
    const checked: Record<string, boolean> = {}
    for (const a of previewData.value.artifacts) {
      if (a.category === 'includable') {
        checked[artifactKey(a)] = true
      }
      // duplicates: unchecked by default (not in map = false)
    }
    checkedArtifacts.value = checked
    // Pre-fill name from rule
    drName.value = `Auto DR - ${previewData.value.ruleName} - VC ${previewData.value.snapshotCompletedAt ? toLocalTime(previewData.value.snapshotCompletedAt) : ''}`
  } catch {
    // Error displayed by http interceptor; close dialog if no data
  } finally {
    previewLoading.value = false
  }
}

const handleCreateDR = async () => {
  if (!previewData.value) return

  // Validate JIRA if required
  if (previewData.value.requireJira && !drJiraLink.value.trim()) {
    window.$toast?.warning?.('JIRA link is required for this delivery rule')
    return
  }

  if (selectedCount.value === 0) {
    window.$toast?.warning?.('Please select at least one artifact')
    return
  }

  // Collect selected artifact keys with skipDeploy config
  const artifactKeys = (previewData.value.artifacts ?? [])
    .filter(a => (a.category === 'includable' || a.category === 'duplicate') && checkedArtifacts.value[artifactKey(a)])
    .map(a => ({ artifactID: a.artifactID, packageID: a.packageID, skipDeploy: skipDeployArtifacts.value[artifactKey(a)] === true }))

  createLoading.value = true
  createError.value = null
  try {
    createResult.value = await CreateDRFromMismatch(props.ruleId, {
      name: drName.value.trim(),
      jiraLink: drJiraLink.value.trim(),
      snapshotID: previewData.value.snapshotID,
      snapshotCompletedAt: previewData.value.snapshotCompletedAt,
      artifactKeys,
    })
    drDialogStep.value = 'result'
    window.$toast?.success?.('Delivery Request created successfully')
  } catch (err: any) {
    createError.value = err as HttpError
  } finally {
    createLoading.value = false
  }
}

const handleCloseDRDialog = () => {
  showDRDialog.value = false
}

const handleGoToDR = () => {
  if (createResult.value?.deliveryRequest?.ID) {
    showDRDialog.value = false
    router.push(`/delivery-request/${createResult.value.deliveryRequest.ID}`)
  }
}

const toggleArtifact = (a: PreviewDRArtifact, checked: boolean) => {
  checkedArtifacts.value[artifactKey(a)] = checked
}

onMounted(async () => {
  if (isAdhoc.value) {
    // Adhoc mode: load data from router state
    const raw = history.state?.adhocData
    if (raw) {
      try {
        data.value = JSON.parse(raw) as VersionCompareResponse
        ruleName.value = 'Adhoc Compare'
        // Initialize package filter
        if (allPackageIDs.value.length > 0) {
          const map: Record<string, boolean> = {}
          for (const id of allPackageIDs.value) map[id] = true
          selectedPackages.value = map
          pkgFilterInitialized.value = true
        }
      } catch {
        data.value = null
      }
    } else {
      router.push('/jobs/version-compare')
    }
    return
  }

  // Rule-based mode: fetch rule name in parallel with snapshot data
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
          v-if="!isAdhoc && hasScope('VersionCompare.Trigger')"
          design="Attention"
          icon="shipping-status"
          :disabled="data?.status !== 'completed'"
          @click="handleOpenDRDialog"
        >
          Create Delivery Request
        </ui5-button>
        <ui5-button
          v-if="!isAdhoc && hasScope('VersionCompare.Trigger')"
          design="Emphasized"
          icon="synchronize"
          :disabled="data?.status === 'running' || triggering"
          @click="handleTrigger"
        >
          {{ data?.status === 'running' ? 'Scanning...' : 'Trigger Scan' }}
        </ui5-button>
        <ui5-button v-if="!isAdhoc" design="Transparent" icon="refresh" @click="loadData" :disabled="loading">Refresh</ui5-button>
      </div>
    </div>

    <!-- Adhoc mode: info banner -->
    <ui5-message-strip v-if="isAdhoc && data?.status === 'completed'" design="Critical" hide-close-button style="margin-bottom: 0.75rem;">
      Temporary version compare, results are not persisted.
      Comparing: {{ tenants.map(t => t.isSource ? `${t.name} (baseline)` : t.name).join(', ') }}
    </ui5-message-strip>

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
        <ui5-button design="Transparent" @click="unselectAllPackages" style="font-size: 0.75rem;">Unselect All</ui5-button>
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
              <ui5-table-header-cell>Artifact</ui5-table-header-cell>
              <ui5-table-header-cell width="auto">Type</ui5-table-header-cell>
              <ui5-table-header-cell v-if="sourceTenant" width="auto">{{ sourceTenant.name }}</ui5-table-header-cell>
              <ui5-table-header-cell v-for="tenant in targetTenants" :key="tenant.id" width="auto">
                {{ tenant.name }}
              </ui5-table-header-cell>
              <ui5-table-header-cell v-if="sourceTenant" width="auto">Modified By</ui5-table-header-cell>
              <ui5-table-header-cell v-if="sourceTenant" width="auto">Modified At</ui5-table-header-cell>
            </ui5-table-header-row>

            <ui5-table-row v-for="art in (pkg.artifacts ?? [])" :key="art.id">
              <ui5-table-cell>
                <span class="col-artifact">{{ art.id }}</span>
              </ui5-table-cell>
              <ui5-table-cell>
                <ui5-tag design="Set2" color-scheme="6" style="font-size: 0.7rem;">
                  {{ typeLabel(art.type) }}
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
        <ui5-button v-if="!isAdhoc" design="Emphasized" @click="handleTrigger" style="margin-top: 1rem;">Retry</ui5-button>
      </div>
    </ui5-busy-indicator>

    <!-- Create DR Dialog -->
    <ui5-dialog
      :open="showDRDialog"
      header-text="Create Delivery Request from Mismatches"
      style="width: 50%; height: 70%;"
      @before-close="handleCloseDRDialog"
    >
      <!-- Step 1: Preview -->
      <div v-if="drDialogStep === 'preview'" class="dr-dialog-content">
        <!-- Loading preview data -->
        <div v-if="previewLoading" class="dr-dialog-loading">
          <ui5-busy-indicator active size="M" />
        </div>

        <!-- Creating DR in progress -->
        <div v-else-if="createLoading" class="dr-dialog-loading">
          <ui5-busy-indicator active size="M" />
          <ui5-text style="margin-top: 0.75rem; color: var(--sapNeutralTextColor);">Creating Delivery Request...</ui5-text>
        </div>

        <!-- Loaded content — all elements are direct children of the flex column container -->
        <template v-else-if="previewData">
          <!-- Error banner (shown after failed create attempt) -->
          <div v-if="createError" class="dr-error-banner">
            <ui5-tag design="Negative">Error</ui5-tag>
            <ui5-text style="color: var(--sapNegativeColor);">{{ createError.message }}</ui5-text>
          </div>

          <!-- Skip errors from failed create (if backend returned validation details) -->
          <ui5-panel
            v-if="createError?.data?.errors?.length"
            :header-text="`Validation Errors (${createError.data.errors.length})`"
            class="dr-category-panel dr-category-warn"
          >
            <ui5-table class="dr-artifact-table" no-data-text="">
              <ui5-table-header-row slot="headerRow">
                <ui5-table-header-cell>Artifact</ui5-table-header-cell>
                <ui5-table-header-cell>Package</ui5-table-header-cell>
                <ui5-table-header-cell>Reason</ui5-table-header-cell>
              </ui5-table-header-row>
              <ui5-table-row v-for="e in createError.data.errors" :key="`err-${e.artifactID}::${e.packageID}`">
                <ui5-table-cell><span class="dr-cell-ellipsis">{{ e.artifactID }}</span></ui5-table-cell>
                <ui5-table-cell><span class="dr-cell-secondary">{{ e.packageID }}</span></ui5-table-cell>
                <ui5-table-cell><ui5-tag design="Negative" style="font-size: 0.65rem;">{{ e.reason }}</ui5-tag></ui5-table-cell>
              </ui5-table-row>
            </ui5-table>
          </ui5-panel>

          <!-- Meta -->
          <div class="dr-dialog-meta">
            <ui5-text style="font-size: 0.85rem;">
              Rule: <strong>{{ previewData.ruleName }}</strong>
            </ui5-text>
            <ui5-text style="font-size: 0.85rem;">
              Snapshot: {{ previewData.snapshotCompletedAt ? toLocalTime(previewData.snapshotCompletedAt) : '-' }}
            </ui5-text>
            <ui5-text style="font-size: 0.85rem;">
              Total mismatches: <strong>{{ previewData.summary.totalMismatch }}</strong>
            </ui5-text>
          </div>

          <!-- Artifacts section -->
          <div class="dr-section-divider">
            <span class="dr-section-label">Artifacts</span>
          </div>

          <!-- Search -->
          <ui5-input
            placeholder="Search artifacts..."
            :value="artifactSearch"
            @input="artifactSearch = ($event as any).target.value"
            show-clear-icon
            style="width: 100%;"
          />

          <!-- Includable -->
          <ui5-panel
            v-if="filteredIncludable.length > 0"
            :header-text="`Includable (${includableArtifacts.length})`"
            class="dr-category-panel"
          >
            <ui5-table class="dr-artifact-table" no-data-text="">
              <ui5-table-header-row slot="headerRow">
                <ui5-table-header-cell width="65px"></ui5-table-header-cell>
                <ui5-table-header-cell>Artifact</ui5-table-header-cell>
                <ui5-table-header-cell>Package</ui5-table-header-cell>
                <ui5-table-header-cell>Type</ui5-table-header-cell>
                <ui5-table-header-cell>Version</ui5-table-header-cell>
                <ui5-table-header-cell width="100px" title="Skip deploy phase — artifact only requires import">Skip Deploy</ui5-table-header-cell>
              </ui5-table-header-row>
              <ui5-table-row v-for="a in filteredIncludable" :key="artifactKey(a)">
                <ui5-table-cell>
                  <ui5-checkbox
                    :checked="checkedArtifacts[artifactKey(a)] === true"
                    @change="toggleArtifact(a, ($event as any).target.checked)"
                  />
                </ui5-table-cell>
                <ui5-table-cell><span :title="a.artifactName" class="dr-cell-ellipsis">{{ a.artifactID }}</span></ui5-table-cell>
                <ui5-table-cell><span class="dr-cell-secondary">{{ a.packageID }}</span></ui5-table-cell>
                <ui5-table-cell><ui5-tag design="Set2" color-scheme="6" style="font-size: 0.65rem;">{{ typeLabel(a.type) }}</ui5-tag></ui5-table-cell>
                <ui5-table-cell><span class="dr-cell-version">{{ a.sourceVersion }}</span></ui5-table-cell>
                <ui5-table-cell>
                  <ui5-checkbox
                    :checked="skipDeployArtifacts[artifactKey(a)] === true"
                    @change="skipDeployArtifacts[artifactKey(a)] = ($event as any).target.checked"
                  />
                </ui5-table-cell>
              </ui5-table-row>
            </ui5-table>
          </ui5-panel>

          <!-- Duplicate -->
          <ui5-panel
            v-if="filteredDuplicate.length > 0"
            :header-text="`Already in Active DR (${duplicateArtifacts.length}) - check to include`"
            class="dr-category-panel dr-category-warn"
          >
            <ui5-table class="dr-artifact-table" no-data-text="">
              <ui5-table-header-row slot="headerRow">
                <ui5-table-header-cell width="65px"></ui5-table-header-cell>
                <ui5-table-header-cell>Artifact</ui5-table-header-cell>
                <ui5-table-header-cell>Package</ui5-table-header-cell>
                <ui5-table-header-cell>Type</ui5-table-header-cell>
                <ui5-table-header-cell>Version</ui5-table-header-cell>
                <ui5-table-header-cell>Existing DR</ui5-table-header-cell>
                <ui5-table-header-cell width="100px" title="Skip deploy phase — artifact only requires import">Skip Deploy</ui5-table-header-cell>
              </ui5-table-header-row>
              <ui5-table-row v-for="a in filteredDuplicate" :key="artifactKey(a)">
                <ui5-table-cell>
                  <ui5-checkbox
                    :checked="checkedArtifacts[artifactKey(a)] === true"
                    @change="toggleArtifact(a, ($event as any).target.checked)"
                  />
                </ui5-table-cell>
                <ui5-table-cell><span :title="a.artifactName" class="dr-cell-ellipsis">{{ a.artifactID }}</span></ui5-table-cell>
                <ui5-table-cell><span class="dr-cell-secondary">{{ a.packageID }}</span></ui5-table-cell>
                <ui5-table-cell><ui5-tag design="Set2" color-scheme="6" style="font-size: 0.65rem;">{{ typeLabel(a.type) }}</ui5-tag></ui5-table-cell>
                <ui5-table-cell><span class="dr-cell-version">{{ a.sourceVersion }}</span></ui5-table-cell>
                <ui5-table-cell>
                  <ui5-tag v-if="a.existingDR" design="Critical" style="font-size: 0.65rem;">
                    DR #{{ a.existingDR.id }} {{ a.existingDR.name }}
                  </ui5-tag>
                </ui5-table-cell>
                <ui5-table-cell>
                  <ui5-checkbox
                    :checked="skipDeployArtifacts[artifactKey(a)] === true"
                    @change="skipDeployArtifacts[artifactKey(a)] = ($event as any).target.checked"
                  />
                </ui5-table-cell>
              </ui5-table-row>
            </ui5-table>
          </ui5-panel>

          <!-- Draft (disabled) -->
          <ui5-panel
            v-if="filteredDraft.length > 0"
            :header-text="`Excluded (${draftArtifacts.length}) - DRAFT`"
            class="dr-category-panel dr-category-disabled"
            collapsed
          >
            <ui5-table class="dr-artifact-table" no-data-text="">
              <ui5-table-header-row slot="headerRow">
                <ui5-table-header-cell>Artifact</ui5-table-header-cell>
                <ui5-table-header-cell>Package</ui5-table-header-cell>
                <ui5-table-header-cell>Type</ui5-table-header-cell>
                <ui5-table-header-cell>Status</ui5-table-header-cell>
              </ui5-table-header-row>
              <ui5-table-row v-for="a in filteredDraft" :key="artifactKey(a)">
                <ui5-table-cell><span class="dr-cell-ellipsis">{{ a.artifactID }}</span></ui5-table-cell>
                <ui5-table-cell><span class="dr-cell-secondary">{{ a.packageID }}</span></ui5-table-cell>
                <ui5-table-cell><ui5-tag design="Set2" color-scheme="6" style="font-size: 0.65rem;">{{ typeLabel(a.type) }}</ui5-tag></ui5-table-cell>
                <ui5-table-cell><ui5-tag design="Critical" style="font-size: 0.65rem;">DRAFT</ui5-tag></ui5-table-cell>
              </ui5-table-row>
            </ui5-table>
          </ui5-panel>

          <!-- Version Pattern (disabled) -->
          <ui5-panel
            v-if="filteredVersionPattern.length > 0"
            :header-text="`Excluded (${versionPatternArtifacts.length}) - Version Pattern`"
            class="dr-category-panel dr-category-disabled"
            collapsed
          >
            <ui5-table class="dr-artifact-table" no-data-text="">
              <ui5-table-header-row slot="headerRow">
                <ui5-table-header-cell>Artifact</ui5-table-header-cell>
                <ui5-table-header-cell>Package</ui5-table-header-cell>
                <ui5-table-header-cell>Type</ui5-table-header-cell>
                <ui5-table-header-cell>Version</ui5-table-header-cell>
                <ui5-table-header-cell>Reason</ui5-table-header-cell>
              </ui5-table-header-row>
              <ui5-table-row v-for="a in filteredVersionPattern" :key="artifactKey(a)">
                <ui5-table-cell><span class="dr-cell-ellipsis">{{ a.artifactID }}</span></ui5-table-cell>
                <ui5-table-cell><span class="dr-cell-secondary">{{ a.packageID }}</span></ui5-table-cell>
                <ui5-table-cell><ui5-tag design="Set2" color-scheme="6" style="font-size: 0.65rem;">{{ typeLabel(a.type) }}</ui5-tag></ui5-table-cell>
                <ui5-table-cell><span class="dr-cell-version">{{ a.sourceVersion }}</span></ui5-table-cell>
                <ui5-table-cell>
                  <ui5-tag v-if="a.reason" design="Negative" :title="a.reason" style="font-size: 0.65rem;">{{ a.reason }}</ui5-tag>
                </ui5-table-cell>
              </ui5-table-row>
            </ui5-table>
          </ui5-panel>

          <!-- No selectable artifacts -->
          <div v-if="previewData.summary.includable === 0 && previewData.summary.duplicate === 0" class="dr-dialog-empty">
            <ui5-text>No selectable artifacts found. All mismatches are excluded (DRAFT or Version Pattern).</ui5-text>
          </div>

          <!-- DR Details section -->
          <div class="dr-section-divider" v-if="previewData.summary.includable > 0 || previewData.summary.duplicate > 0">
            <span class="dr-section-label">DR Details</span>
          </div>

          <div class="dr-dialog-form" v-if="previewData.summary.includable > 0 || previewData.summary.duplicate > 0">
            <div class="dr-form-field">
              <ui5-label style="font-weight: bold;">Name:</ui5-label>
              <ui5-input
                :value="drName"
                @input="drName = ($event as any).target.value"
                placeholder="Delivery Request Name"
                style="width: 100%;"
              />
            </div>
            <div class="dr-form-field">
              <ui5-label style="font-weight: bold;" :required="previewData.requireJira">JIRA Link:</ui5-label>
              <ui5-input
                :value="drJiraLink"
                @input="drJiraLink = ($event as any).target.value"
                placeholder="e.g. https://jira.example.com/browse/PROJ-123"
                style="width: 100%;"
              />
            </div>
          </div>
        </template>

        <!-- Preview load failed / no data -->
        <div v-else class="dr-dialog-empty">
          <ui5-text>Failed to load preview data. Please close and try again.</ui5-text>
        </div>
      </div>

      <!-- Step 2: Result -->
      <div v-else-if="drDialogStep === 'result' && createResult" class="dr-dialog-content">
        <div class="dr-result-header">
          <ui5-tag design="Positive">Created</ui5-tag>
          <ui5-text style="font-weight: bold; font-size: 1rem;">
            DR #{{ createResult.deliveryRequest.ID }} "{{ createResult.deliveryRequest.Name }}"
          </ui5-text>
        </div>

        <div class="dr-result-summary">
          <ui5-text>Created: {{ createResult.summary.created }} artifact operations</ui5-text>
          <ui5-text v-if="createResult.summary.errors?.length">
            Skipped: {{ createResult.summary.errors.length }} artifacts
          </ui5-text>
        </div>

        <!-- Errors list -->
        <ui5-panel
          v-if="createResult.summary.errors?.length"
          :header-text="`Skipped Artifacts (${createResult.summary.errors.length})`"
          class="dr-category-panel dr-category-warn"
        >
          <div class="dr-artifact-list">
            <div v-for="e in createResult.summary.errors" :key="`${e.artifactID}::${e.packageID}`" class="dr-artifact-row dr-row-disabled">
              <span class="dr-art-id">{{ e.artifactID }}</span>
              <span class="dr-art-pkg">{{ e.packageID }}</span>
              <ui5-tag design="Negative">{{ e.reason }}</ui5-tag>
            </div>
          </div>
        </ui5-panel>

        <div class="dr-result-next">
          <ui5-text style="font-size: 0.85rem; color: var(--sapNeutralTextColor);">
            Next: Go to the Delivery Request detail page to generate Transport Requests.
          </ui5-text>
        </div>
      </div>

      <!-- Footer -->
      <ui5-toolbar slot="footer">
        <!-- Preview step footer -->
        <template v-if="drDialogStep === 'preview'">
          <ui5-toolbar-button
            design="Emphasized"
            :text="`Create (${selectedCount} artifacts)`"
            :disabled="selectedCount === 0 || createLoading || previewLoading"
            @click="handleCreateDR"
          />
          <ui5-toolbar-button design="Transparent" text="Cancel" @click="handleCloseDRDialog" />
        </template>
        <!-- Result step footer -->
        <template v-else>
          <ui5-toolbar-button design="Emphasized" text="Go to Delivery Request" @click="handleGoToDR" />
          <ui5-toolbar-button design="Transparent" text="Close" @click="handleCloseDRDialog" />
        </template>
      </ui5-toolbar>
    </ui5-dialog>
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
  word-break: break-all;
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

/* --- Create DR Dialog --- */

.dr-error-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--sapErrorBackground);
  border-radius: 0.25rem;
}

.dr-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem 0;
  min-height: 12rem;
}

.dr-dialog-loading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 3rem 0;
}

.dr-dialog-meta {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: var(--sapGroup_ContentBackground);
  border-radius: 0.25rem;
  margin-bottom: 0.25rem;
}

.dr-section-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.25rem 0;
}

.dr-section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--sapGroup_ContentBorderColor);
}

.dr-section-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--sapNeutralTextColor);
  white-space: nowrap;
}

.dr-category-panel {
  margin-bottom: 0.25rem;
}

.dr-category-warn {
  --_ui5_panel_header_background_color: var(--sapWarningBackground);
}

.dr-category-disabled {
  opacity: 0.7;
}

/* Dialog artifact tables */
.dr-artifact-table {
  width: 100%;
  max-height: 15rem;
  overflow-y: auto;
  font-size: 0.8125rem;
}

.dr-cell-ellipsis {
  font-weight: 500;
  word-break: break-all;
}

.dr-cell-secondary {
  font-size: 0.8rem;
  color: var(--sapNeutralTextColor);
  word-break: break-all;
}

.dr-cell-version {
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

/* Result step error list */
.dr-artifact-list {
  display: flex;
  flex-direction: column;
  max-height: 15rem;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.dr-artifact-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  font-size: 0.8125rem;
  border-bottom: 1px solid var(--sapGroup_ContentBorderColor);
}

.dr-artifact-row:last-child {
  border-bottom: none;
}

.dr-row-disabled {
  opacity: 0.6;
}

.dr-art-id {
  width: 14rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  flex-shrink: 0;
}

.dr-art-pkg {
  width: 10rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
  color: var(--sapNeutralTextColor);
  flex-shrink: 0;
}

.dr-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dr-form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dr-dialog-empty {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

/* Result step */
.dr-result-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--sapSuccessBackground);
  border-radius: 0.25rem;
}

.dr-result-summary {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0;
}

.dr-result-next {
  padding: 0.75rem;
  background: var(--sapInformationBackground);
  border-radius: 0.25rem;
  margin-top: 0.5rem;
}
</style>
