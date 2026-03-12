<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { GetVersionCompareSummary, TriggerVersionCompare, GetIncludedPackages, UpdateIncludedPackages } from '@/service/api'
import type { VersionCompareSummaryItem, SnapshotStatus, VersionCompareIncludedPackage } from '@/service/model'
import { toLocalTime } from '@/service/consts'

import "@ui5/webcomponents/dist/Card.js"
import "@ui5/webcomponents/dist/CardHeader.js"
import "@ui5/webcomponents/dist/Tag.js"
import "@ui5/webcomponents/dist/Text.js"
import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents/dist/BusyIndicator.js"
import "@ui5/webcomponents/dist/Dialog.js"
import "@ui5/webcomponents/dist/Input.js"
import "@ui5/webcomponents/dist/Label.js"
import "@ui5/webcomponents/dist/Toolbar.js"
import "@ui5/webcomponents/dist/ToolbarButton.js"

const router = useRouter()
const summaries = ref<VersionCompareSummaryItem[]>([])
const loading = ref(false)
const triggeringRules = ref<Set<number>>(new Set())

// --- Included Packages Dialog State ---
const showIncludedDialog = ref(false)
const includedPackages = ref<{ packageID: string; description: string }[]>([])
const savingIncluded = ref(false)
const newPackageID = ref('')
const newPackageDesc = ref('')

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
      window.$message?.success?.('Scan triggered')
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

const openIncludedDialog = async () => {
  try {
    const data = await GetIncludedPackages()
    includedPackages.value = (data.packages ?? []).map(p => ({
      packageID: p.PackageID,
      description: p.Description,
    }))
  } catch {
    includedPackages.value = []
  }
  newPackageID.value = ''
  newPackageDesc.value = ''
  showIncludedDialog.value = true
}

const addPackage = () => {
  const id = newPackageID.value.trim()
  if (!id) return
  // Prevent duplicates
  if (includedPackages.value.some(p => p.packageID === id)) {
    window.$message?.warning?.(`Package "${id}" already in the list`)
    return
  }
  includedPackages.value.push({ packageID: id, description: newPackageDesc.value.trim() })
  newPackageID.value = ''
  newPackageDesc.value = ''
}

const removePackage = (index: number) => {
  includedPackages.value.splice(index, 1)
}

const saveIncludedPackages = async () => {
  savingIncluded.value = true
  try {
    await UpdateIncludedPackages(includedPackages.value)
    window.$message?.success?.('Included packages updated')
    showIncludedDialog.value = false
  } catch {
    // error displayed by http interceptor
  } finally {
    savingIncluded.value = false
  }
}

onMounted(loadSummaries)
</script>

<template>
  <div class="vc-container">
    <div class="vc-header">
      <ui5-text style="font-size: 1.25rem; font-weight: bold;">Version Compare</ui5-text>
      <div class="vc-header-actions">
        <ui5-button design="Transparent" icon="action-settings" @click="openIncludedDialog">Manage Included Packages</ui5-button>
        <ui5-button design="Emphasized" @click="loadSummaries" :disabled="loading">Refresh</ui5-button>
      </div>
    </div>

    <!-- Included Packages Dialog -->
    <ui5-dialog :open="showIncludedDialog" @close="showIncludedDialog = false" header-text="Manage Included Packages" style="width: 36rem;">
      <div class="ipd-content">
        <ui5-text style="font-size: 0.8rem; color: var(--sapNeutralTextColor); margin-bottom: 0.75rem; display: block;">
          When the list is empty, all packages are compared. When non-empty, only listed packages are included in version compare.
        </ui5-text>

        <!-- Add new package -->
        <div class="ipd-add-row">
          <ui5-input
            placeholder="Package ID"
            :value="newPackageID"
            @input="newPackageID = ($event as any).target.value"
            style="flex: 1;"
          />
          <ui5-input
            placeholder="Description (optional)"
            :value="newPackageDesc"
            @input="newPackageDesc = ($event as any).target.value"
            style="flex: 1;"
          />
          <ui5-button design="Transparent" icon="add" @click="addPackage" :disabled="!newPackageID.trim()">Add</ui5-button>
        </div>

        <!-- Current list -->
        <div class="ipd-list" v-if="includedPackages.length > 0">
          <div class="ipd-item" v-for="(pkg, index) in includedPackages" :key="index">
            <div class="ipd-item-info">
              <ui5-text style="font-weight: 600;">{{ pkg.packageID }}</ui5-text>
              <ui5-text v-if="pkg.description" style="font-size: 0.75rem; color: var(--sapNeutralTextColor);">{{ pkg.description }}</ui5-text>
            </div>
            <ui5-button design="Transparent" icon="delete" @click="removePackage(index)" />
          </div>
        </div>
        <div v-else class="ipd-empty">
          <ui5-text style="font-size: 0.8rem; color: var(--sapNeutralTextColor); font-style: italic;">
            No packages configured. All packages will be compared.
          </ui5-text>
        </div>
      </div>
      <ui5-toolbar slot="footer">
        <ui5-toolbar-button design="Emphasized" text="Save" @click="saveIncludedPackages" :disabled="savingIncluded" />
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

.ipd-add-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.ipd-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 20rem;
  overflow-y: auto;
}

.ipd-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0.5rem;
  background: var(--sapGroup_ContentBackground);
  border-radius: 0.25rem;
  border: 1px solid var(--sapGroup_ContentBorderColor);
}

.ipd-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.ipd-empty {
  padding: 1.5rem;
  text-align: center;
}
</style>
