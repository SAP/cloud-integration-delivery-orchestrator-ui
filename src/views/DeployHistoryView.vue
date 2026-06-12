<script setup lang="ts">
import { ref, watch, onMounted, computed, h } from 'vue'
import { GetOperationsHistory, GetOperationsHistoryFilters, GetOperationConditions } from '@/service/api'
import { toLocalTime } from '@/service/consts'
import { useHistoryFilter } from '@/composables/useHistoryFilter'
import { useUserCache } from '@/composables/useUserCache'
import type { OperationsHistoryItem, OperationsHistoryFilters, OperationCondition } from '@/service/model'
import type { Column } from '@/service/consts'
import DataTable from '@/components/DataTable.vue'

import "@ui5/webcomponents/dist/Tag.js"
import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents/dist/BusyIndicator.js"
import "@ui5/webcomponents/dist/Input.js"
import "@ui5/webcomponents/dist/Select.js"
import "@ui5/webcomponents/dist/Option.js"
import "@ui5/webcomponents/dist/MultiComboBox.js"
import "@ui5/webcomponents/dist/MultiComboBoxItem.js"
import "@ui5/webcomponents/dist/DateRangePicker.js"
import "@ui5/webcomponents/dist/Dialog.js"
import "@ui5/webcomponents/dist/Text.js"
import "@ui5/webcomponents/dist/Label.js"

const { filter, apiParams, clearAll, resetPage } = useHistoryFilter()
const { getUserEmail } = useUserCache()

const items = ref<OperationsHistoryItem[]>([])
const total = ref(0)
const loading = ref(false)
const filterOptions = ref<OperationsHistoryFilters>({ tenants: [], artifactTypes: [], deliveryRules: [], operators: [] })

const hasMore = computed(() => items.value.length < total.value)

async function fetchData() {
  loading.value = true
  filter.page = 1
  try {
    const resp = await GetOperationsHistory(apiParams.value)
    items.value = resp.data ?? []
    total.value = resp.total
  } finally {
    loading.value = false
  }
}

const loadingMore = ref(false)

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  try {
    filter.page++
    const resp = await GetOperationsHistory(apiParams.value)
    items.value.push(...(resp.data ?? []))
    total.value = resp.total
  } finally {
    loadingMore.value = false
  }
}

async function loadFilterOptions() {
  filterOptions.value = await GetOperationsHistoryFilters()
}

onMounted(() => {
  loadFilterOptions()
  fetchData()
})

// Re-fetch when filters change
let debounceTimer: ReturnType<typeof setTimeout>
watch(() => [
  filter.tenantIds, filter.artifactName, filter.artifactTypes,
  filter.packageId, filter.requestStates, filter.importStates,
  filter.deployStates, filter.deliveryRuleId, filter.deliveryRequestName, filter.createdBy,
  filter.dateFrom, filter.dateTo, filter.hasError,
  filter.sortBy, filter.sortDir,
], () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fetchData, 300)
}, { deep: true })

function onFilterChange() {
  resetPage()
}

function stateDesign(state: string): string {
  if (state.includes('COMPLETE') || state === 'READY') return 'Positive'
  if (state.includes('FAILED')) return 'Negative'
  if (state.includes('IN_PROGRESS') || state === 'REQUESTING' || state === 'TR_GENERATING') return 'Information'
  if (state.includes('QUEUED')) return 'Set2'
  if (state.includes('DISABLED')) return 'Set2'
  return 'None'
}

// Row click → open conditions dialog
const dialogOpen = ref(false)
const selectedOp = ref<OperationsHistoryItem | null>(null)
const conditions = ref<OperationCondition[]>([])
const conditionsLoading = ref(false)

function handleRowClick(row: any) {
  if (!row || !row.id) return
  selectedOp.value = row
  dialogOpen.value = true
  conditionsLoading.value = true
  GetOperationConditions(row.id)
    .then(data => { conditions.value = data ?? [] })
    .catch(() => { conditions.value = [] })
    .finally(() => { conditionsLoading.value = false })
}

function closeDialog() {
  dialogOpen.value = false
  selectedOp.value = null
  conditions.value = []
}

function conditionDesign(state: string): string {
  if (state === 'Error') return 'Negative'
  if (state === 'Warn') return 'Critical'
  return 'Positive'
}

const columns: Column[] = [
  {
    title: 'Artifact',
    key: 'artifactName',
    render: (row: OperationsHistoryItem) => row.artifactName || row.artifactTechID
  },
  {
    title: 'Version',
    key: 'artifactVersion'
  },
  {
    title: 'Tenant',
    key: 'tenantName'
  },
  {
    title: 'DR',
    key: 'deliveryRequestName',
    render: (row: OperationsHistoryItem) =>
      h('a', { href: `/delivery-request/${row.deliveryRequestID}`, style: 'color: var(--sapLinkColor, #0064d9); text-decoration: none; font-size: 0.85rem;' },
        `#${row.deliveryRequestID} - ${row.deliveryRequestName}`)
  },
  {
    title: 'TR',
    key: 'transportRequestNumber',
    render: (row: OperationsHistoryItem) => row.transportRequestNumber || '—'
  },
  {
    title: 'Request',
    key: 'requestState',
    render: (row: OperationsHistoryItem) =>
      h('ui5-tag', { design: stateDesign(row.requestState), style: 'font-size: 0.65rem' }, row.requestState)
  },
  {
    title: 'Import',
    key: 'importState',
    render: (row: OperationsHistoryItem) =>
      h('ui5-tag', { design: stateDesign(row.importState), style: 'font-size: 0.65rem' }, row.importState)
  },
  {
    title: 'Deploy',
    key: 'deployState',
    render: (row: OperationsHistoryItem) =>
      row.skipDeploy
        ? h('ui5-tag', { design: 'Set2', style: 'font-size: 0.65rem' }, 'SKIPPED')
        : h('ui5-tag', { design: stateDesign(row.deployState), style: 'font-size: 0.65rem' }, row.deployState)
  },
  {
    title: 'Last Operator',
    key: 'updatedBy',
    render: (row: OperationsHistoryItem) => getUserEmail(row.updatedBy || row.createdBy)
  },
  {
    title: 'Updated',
    key: 'updatedAt',
    render: (row: OperationsHistoryItem) => toLocalTime(row.updatedAt)
  }
]
</script>

<template>
  <div class="deploy-history-page">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="filter-field">
        <ui5-label>Date Range:</ui5-label>
        <ui5-daterange-picker
          class="filter-date"
          format-pattern="yyyy-MM-dd"
          :value="filter.dateFrom && filter.dateTo ? `${filter.dateFrom.slice(0,10)} - ${filter.dateTo.slice(0,10)}` : ''"
          @change="($event: any) => {
            const val = $event.target.value
            if (!val) { filter.dateFrom = ''; filter.dateTo = ''; onFilterChange(); return }
            const parts = val.split(' - ')
            if (parts.length === 2) {
              filter.dateFrom = new Date(parts[0]).toISOString()
              filter.dateTo = new Date(parts[1] + 'T23:59:59').toISOString()
              onFilterChange()
            }
          }"
        ></ui5-daterange-picker>
      </div>

      <div class="filter-field">
        <ui5-label>Tenant:</ui5-label>
        <ui5-multi-combobox
          class="filter-tenant"
          @selection-change="($event: any) => {
            filter.tenantIds = Array.from($event.target.items)
              .filter((i: any) => i.selected)
              .map((i: any) => Number(i.getAttribute('data-id')))
            onFilterChange()
          }"
        >
          <ui5-mcb-item
            v-for="t in filterOptions.tenants"
            :key="t.id"
            :text="t.name"
            :data-id="t.id"
            :selected="filter.tenantIds.includes(t.id)"
          ></ui5-mcb-item>
        </ui5-multi-combobox>
      </div>

      <div class="filter-field">
        <ui5-label>Has Error:</ui5-label>
        <ui5-select
          class="filter-error"
          @change="($event: any) => {
            const val = $event.detail.selectedOption.getAttribute('data-value')
            filter.hasError = val === 'true'
            onFilterChange()
          }"
        >
          <ui5-option data-value="" :selected="!filter.hasError">No</ui5-option>
          <ui5-option data-value="true" :selected="filter.hasError">Yes</ui5-option>
        </ui5-select>
      </div>

      <div class="filter-field">
        <ui5-label>Artifact Name:</ui5-label>
        <ui5-input
          class="filter-artifact"
          :value="filter.artifactName"
          @input="($event: any) => { filter.artifactName = $event.target.value; onFilterChange() }"
        ></ui5-input>
      </div>

      <div class="filter-field">
        <ui5-label>Delivery Rule:</ui5-label>
        <ui5-select
          class="filter-rule"
          @change="($event: any) => {
            const val = $event.detail.selectedOption.getAttribute('data-value')
            filter.deliveryRuleId = val ? Number(val) : null
            onFilterChange()
          }"
        >
          <ui5-option data-value="" :selected="!filter.deliveryRuleId">All</ui5-option>
          <ui5-option v-for="r in filterOptions.deliveryRules" :key="r.id"
            :data-value="r.id"
            :selected="filter.deliveryRuleId === r.id"
          >{{ r.name }}</ui5-option>
        </ui5-select>
      </div>

      <div class="filter-field">
        <ui5-label>Delivery Request:</ui5-label>
        <ui5-input
          class="filter-dr"
          :value="filter.deliveryRequestName"
          @input="($event: any) => { filter.deliveryRequestName = $event.target.value; onFilterChange() }"
        ></ui5-input>
      </div>

      <ui5-button v-if="filter.tenantIds.length || filter.artifactName || filter.dateFrom || filter.hasError || filter.createdBy || filter.deliveryRuleId || filter.deliveryRequestName"
        design="Transparent" @click="clearAll()" style="align-self: flex-end;">Clear All</ui5-button>
    </div>

    <!-- Table -->
    <DataTable
      title="Deploy History"
      :columns="columns"
      :data="items"
      :row-key="(row: any) => row.id"
      :loading="loading"
      :selectable="false"
      :row-click="handleRowClick"
    />

    <!-- Conditions Dialog -->
    <ui5-dialog :open="dialogOpen" @close="closeDialog"
      :header-text="`Logs - ${selectedOp?.artifactName || selectedOp?.artifactTechID}: ${selectedOp?.artifactVersion}`"
      style="min-width: 36rem;">
      <div class="conditions-dialog-content">
        <ui5-busy-indicator v-if="conditionsLoading" :delay="0" active size="S" class="conditions-loading"></ui5-busy-indicator>
        <ui5-text v-else-if="conditions.length === 0">No logs recorded for this operation.</ui5-text>
        <div v-else class="conditions-timeline">
          <div v-for="c in conditions" :key="c.ID" class="condition-item">
            <div class="condition-header">
              <ui5-tag :design="conditionDesign(c.State)" style="font-size: 0.65rem;">{{ c.State }}</ui5-tag>
              <ui5-text style="color: var(--sapContent_LabelColor);">{{ toLocalTime(c.CreatedAt) }}</ui5-text>
            </div>
            <ui5-text class="condition-message">{{ c.Message }}</ui5-text>
          </div>
        </div>
      </div>
    </ui5-dialog>

    <!-- Load More -->
    <div v-if="hasMore" class="load-more">
      <ui5-busy-indicator v-if="loadingMore" :delay="0" active size="S"></ui5-busy-indicator>
      <ui5-button v-else design="Transparent" @click="loadMore()">More ({{ items.length }} / {{ total }})</ui5-button>
    </div>
  </div>
</template>

<style scoped>
.deploy-history-page {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-bar {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-date { width: 14rem; }
.filter-tenant { width: 12rem; }
.filter-error { width: 6rem; }
.filter-artifact { width: 12rem; }
.filter-rule { width: 10rem; }
.filter-dr { width: 12rem; }

.load-more {
  display: flex;
  justify-content: center;
}

.conditions-dialog-content {
  padding: 1rem;
}

.conditions-loading {
  display: flex;
  justify-content: center;
}

.conditions-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.condition-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--sapGroup_ContentBorderColor, #e5e5e5);
}

.condition-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.condition-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.condition-message {
  padding-left: 0.25rem;
}
</style>
