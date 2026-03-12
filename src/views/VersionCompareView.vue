<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { GetVersionCompareSummary, TriggerVersionCompare } from '@/service/api'
import type { VersionCompareSummaryItem, SnapshotStatus } from '@/service/model'
import { toLocalTime } from '@/service/consts'

import "@ui5/webcomponents/dist/Card.js"
import "@ui5/webcomponents/dist/CardHeader.js"
import "@ui5/webcomponents/dist/Tag.js"
import "@ui5/webcomponents/dist/Text.js"
import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents/dist/BusyIndicator.js"

const router = useRouter()
const summaries = ref<VersionCompareSummaryItem[]>([])
const loading = ref(false)
const triggeringRules = ref<Set<number>>(new Set())

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

onMounted(loadSummaries)
</script>

<template>
  <div class="vc-container">
    <div class="vc-header">
      <ui5-text style="font-size: 1.25rem; font-weight: bold;">Version Compare</ui5-text>
      <ui5-button design="Emphasized" @click="loadSummaries" :disabled="loading">Refresh</ui5-button>
    </div>

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
</style>
