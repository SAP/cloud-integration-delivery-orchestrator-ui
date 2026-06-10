<script setup lang="ts">
import { ref, watch, onMounted, computed, reactive, h } from 'vue'
import { GetOperationsHistory, GetOperationsHistoryFilters, UaaUserInfo } from '@/service/api'
import { toLocalTime } from '@/service/consts'
import { useHistoryFilter } from '@/composables/useHistoryFilter'
import type { OperationsHistoryItem, OperationsHistoryFilters, UserInfo } from '@/service/model'
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

const { filter, apiParams, clearAll, resetPage } = useHistoryFilter()

const items = ref<OperationsHistoryItem[]>([])
const total = ref(0)
const loading = ref(false)
const filterOptions = ref<OperationsHistoryFilters>({ tenants: [], artifactTypes: [], deliveryRules: [], operators: [] })

// UAA user cache
const uaaUsers = reactive<Record<string, UserInfo>>({})
function resolveUserEmail(userId: string): string {
  if (!userId) return '—'
  if (uaaUsers[userId]) return uaaUsers[userId].email
  UaaUserInfo(userId).then(info => { uaaUsers[userId] = info }).catch(() => {})
  return userId
}

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
  filter.deployStates, filter.deliveryRuleId, filter.createdBy,
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
      h('router-link', { to: `/delivery-request/${row.deliveryRequestID}` },
        () => row.deliveryRequestName || `DR #${row.deliveryRequestID}`)
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
    title: 'Operator',
    key: 'createdBy',
    render: (row: OperationsHistoryItem) => resolveUserEmail(row.createdBy)
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
      <ui5-daterange-picker
        class="filter-date"
        placeholder="Date Range"
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

      <ui5-multi-combobox
        class="filter-tenant"
        placeholder="Tenant"
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

      <ui5-select
        class="filter-error"
        @change="($event: any) => {
          const val = $event.detail.selectedOption.getAttribute('data-value')
          filter.hasError = val === 'true'
          onFilterChange()
        }"
      >
        <ui5-option data-value="" :selected="!filter.hasError">All Status</ui5-option>
        <ui5-option data-value="true" :selected="filter.hasError">Has Error</ui5-option>
      </ui5-select>

      <ui5-input
        class="filter-artifact"
        placeholder="Search artifact name..."
        :value="filter.artifactName"
        @input="($event: any) => { filter.artifactName = $event.target.value; onFilterChange() }"
      ></ui5-input>

      <ui5-button v-if="filter.tenantIds.length || filter.artifactName || filter.dateFrom || filter.hasError || filter.createdBy"
        design="Transparent" @click="clearAll()">Clear All</ui5-button>
    </div>

    <!-- Table -->
    <DataTable
      title="Deploy History"
      :columns="columns"
      :data="items"
      :row-key="(row: any) => row.id"
      :loading="loading"
      :selectable="false"
    />

    <!-- Load More -->
    <div v-if="hasMore" class="load-more">
      <ui5-busy-indicator v-if="loadingMore" delay="0" active size="S"></ui5-busy-indicator>
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
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-date { width: 14rem; }
.filter-tenant { width: 12rem; }
.filter-error { width: 8rem; }
.filter-artifact { width: 14rem; }

.load-more {
  display: flex;
  justify-content: center;
}
</style>
