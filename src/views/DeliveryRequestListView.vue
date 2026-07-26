<template>
  <ui5-dialog :open="showModal" @close="showModal = false" header-text="Create Delivery Request" style="width: 30rem;">
    <div class="dialog-content" style="display: flex; flex-direction: column; gap: 1rem;">
      <div>
        <ui5-label style="font-weight: bold;" required>Name:</ui5-label>
        <ui5-input v-model="selectedDeliveryRequest.Name" placeholder="Delivery Request Name" style="width: 100%;" />
      </div>
      <div>
        <ui5-label style="font-weight: bold;" :required="selectedDeliveryRequest.DeliveryRule?.RequireJira">JIRA Link:</ui5-label>
        <ui5-input v-model="selectedDeliveryRequest.JiraLink" placeholder="Jira Link" style="width: 100%;" />
      </div>
      <div>
        <ui5-label style="font-weight: bold;" required>Delivery Rule:</ui5-label>
        <ui5-combobox
          :value="String(selectedDeliveryRequest.DeliveryRule?.Name || '')"
          @change="handleRuleChange"
          placeholder="Choose Delivery Rule"
          filter="Contains"
          style="width: 100%;">
          <ui5-cb-item
            v-for="option in deliveryRuleOptions"
            :id="`delivery-rule-option-${option.value.ID}`"
            :additional-text="`#${option.value.ID}`"
            :text="option.label"
            :disabled="option.disabled"
          />
        </ui5-combobox>
      </div>
      <div>
        <ui5-label style="font-weight: bold;">Included Tenants:</ui5-label>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          <ui5-tag
            v-for="v in selectedDeliveryRequest.DeliveryRule?.IncludedTenants"
            :key="v.ID"
            design="Set2"
            color-scheme="5"
          >
            {{ v.Name }}
          </ui5-tag>
        </div>
      </div>
      <div>
        <ui5-label style="font-weight: bold;">Allowed Version Pattern:</ui5-label>
        <ui5-text v-if="selectedDeliveryRequest.DeliveryRule" style="display: block;">
          {{ selectedDeliveryRequest.DeliveryRule.VersionPattern }}
        </ui5-text>
      </div>
    </div>
    <ui5-toolbar slot="footer">
      <ui5-toolbar-button v-if="hasScope('DeliveryRequest.Write')" class="dialogCloser" design="Emphasized" text="Create" @click="onCreate"></ui5-toolbar-button>
      <ui5-toolbar-button class="dialogCloser" design="Transparent" text="Cancel" @click="showModal = false"></ui5-toolbar-button>
    </ui5-toolbar>
  </ui5-dialog>
  <div style="display: flex; align-items: center; gap: 8px; padding: 8px 0;">
    <ui5-segmented-button>
      <ui5-segmented-button-item
        v-for="key in filterKeys" :key="key"
        :pressed="activeFilter === key"
        @click="activeFilter = key">
        {{ key }} ({{ filterCounts[key] }})
      </ui5-segmented-button-item>
    </ui5-segmented-button>
    <ui5-input
      :value="searchKeyword"
      @input="handleSearchInput"
      placeholder="Search by ID, name, status, Jira, tenant, rule, user..."
      style="width: 28rem;"
    />
  </div>
  <ConfirmDeleteDialog
    :open="showDeleteDialog"
    :name="pendingDeleteRows[0]?.Name ?? ''"
    @confirm="confirmDelete"
    @close="showDeleteDialog = false"
  />
  <data-table
    title="Delivery Requests"
    :columns="deliveryRequestColumns"
    :data="filteredDeliveryRequests"
    :custom-tool-bars="toolBars"
    :handle-add="() => { showModal = true; selectedDeliveryRequest = {} as DeliveryRequest }"
    :row-key="(row: DeliveryRequest) => row.ID"
    :row-click="handleRowClick"
    :loading="loading"
    :growing="true"
    @load-more="loadMoreDeliveryRequests"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import DataTable from '@/components/DataTable.vue'
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog.vue'
import { deliveryRequestColumns, type ToolBar } from '@/service/consts'
import { DeleteDeliveryRequest, GetDeliveryRequests, CreateDeliveryRequest, GetDeliveryRules, CurrentUser } from '@/service/api';
import type { DeliveryRequest, DeliveryRule, UserInfo } from '@/service/model';
import { STATUS_FILTER_GROUPS, type StatusFilterKey } from '@/service/statuses';
import { sortByOwnerAndDate } from '@/service/sort';
import { useAuth } from '@/composables/useAuth'
import { useUserCache } from '@/composables/useUserCache'

import "@ui5/webcomponents/dist/Dialog.js";
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/Input.js";
import "@ui5/webcomponents/dist/Label.js";
import "@ui5/webcomponents/dist/ComboBox.js";
import "@ui5/webcomponents/dist/ComboBoxItem.js";
import "@ui5/webcomponents/dist/Tag.js";
import "@ui5/webcomponents/dist/Text.js";
import "@ui5/webcomponents/dist/Toolbar.js"
import "@ui5/webcomponents/dist/ToolbarButton.js"
import "@ui5/webcomponents/dist/SegmentedButton.js"
import "@ui5/webcomponents/dist/SegmentedButtonItem.js"
export default defineComponent({
  components: { DataTable, ConfirmDeleteDialog },
  setup() {
    const { hasScope } = useAuth()
    const { fetchUserInfo } = useUserCache()
    return { hasScope, fetchUserInfo }
  },
  data(){
    const toolBars: ToolBar[] = [
      {
        text: 'Delete',
        func: (row:DeliveryRequest[]) => (this.handleDelete(row))
      }
    ]
    return {
      deliveryRequestColumns,
      deliveryRequests: [] as DeliveryRequest[],
      toolBars,
      showModal: false,
      selectedDeliveryRequest: {} as DeliveryRequest,
      deliveryRuleOptions: [] as {label: string, value: DeliveryRule, disabled: boolean}[],
      loading: false as boolean,
      showDeleteDialog: false,
      pendingDeleteRows: [] as DeliveryRequest[],
      activeFilter: 'In Progress' as StatusFilterKey,
      searchKeyword: '',
      currentPage: 1,
      pageSize: 20,
      total: 0,
      currentUserEmail: '',
    }
  },
  computed: {
    filterKeys(): StatusFilterKey[] {
      return Object.keys(STATUS_FILTER_GROUPS) as StatusFilterKey[]
    },
    filterCounts(): Record<StatusFilterKey, number> {
      const counts = {} as Record<StatusFilterKey, number>
      for (const key of this.filterKeys) {
        const group = STATUS_FILTER_GROUPS[key]
        counts[key] = group === null
          ? this.searchedDeliveryRequests.length
          : this.searchedDeliveryRequests.filter(dr => group.has(dr.AggregateStatus)).length
      }
      return counts
    },
    searchedDeliveryRequests(): DeliveryRequest[] {
      const kw = this.searchKeyword.trim().toLowerCase()
      if (!kw) return this.deliveryRequests
      return this.deliveryRequests.filter(dr => this.matchesKeyword(dr, kw))
    },
    filteredDeliveryRequests(): DeliveryRequest[] {
      const group = STATUS_FILTER_GROUPS[this.activeFilter]
      const filtered = group === null ? this.searchedDeliveryRequests : this.searchedDeliveryRequests.filter(dr => group.has(dr.AggregateStatus))
      return sortByOwnerAndDate(filtered, this.currentUserEmail)
    },
  },
  methods: {
    handleSearchInput(event: any) {
      this.searchKeyword = event?.target?.value || ''
    },
    matchesKeyword(dr: DeliveryRequest, kw: string): boolean {
      return [
        String(dr.ID || ''),
        dr.Name || '',
        dr.AggregateStatus || '',
        dr.JiraLink || '',
        dr.SourceTenant?.Name || '',
        dr.DeliveryRule?.Name || '',
        dr.CreatedBy || '',
        dr.UpdatedBy || '',
      ].some(v => v.toLowerCase().includes(kw))
    },
    handleRuleChange(event: any) {
      const selectedId = event.target.value
      const selectedOption = this.deliveryRuleOptions.find(op => op.label === selectedId)
      if (selectedOption) {
        this.selectedDeliveryRequest.DeliveryRule = selectedOption.value
      }
    },
    handleRowClick(row: DeliveryRequest) {
      this.$router.push({ path: `/delivery-request/${row.ID}` })
    },
    async loadDeliveryRequests() {
      this.loading = true
      this.currentPage = 1
      const resp = await GetDeliveryRequests(this.currentPage, this.pageSize)
      await Promise.all(
        resp.items.map(async (dr) => {
          dr.CreatedBy = (await this.fetchUserInfo(dr.CreatedBy)).email
          dr.UpdatedBy = (await this.fetchUserInfo(dr.UpdatedBy)).email
        })
      )
      this.deliveryRequests = resp.items
      this.total = resp.total
      this.loading = false
    },
    async loadMoreDeliveryRequests() {
      if (this.deliveryRequests.length >= this.total) return
      this.loading = true
      this.currentPage++
      const resp = await GetDeliveryRequests(this.currentPage, this.pageSize)
      await Promise.all(
        resp.items.map(async (dr) => {
          dr.CreatedBy = (await this.fetchUserInfo(dr.CreatedBy)).email
          dr.UpdatedBy = (await this.fetchUserInfo(dr.UpdatedBy)).email
        })
      )
      this.deliveryRequests.push(...resp.items)
      this.total = resp.total
      this.loading = false
    },
    async onCreate() {
      try {
        await CreateDeliveryRequest(this.selectedDeliveryRequest)
        this.showModal = false
        await this.loadDeliveryRequests()
        window.$toast?.success?.('Saved')
      } catch (e) {
        // Error displayed by http interceptor
      }
    },
    handleDelete(rows: DeliveryRequest[]) {
      if (rows.length === 0) {
        window.$toast.warning('Please select at least one delivery request')
        return
      }
      this.pendingDeleteRows = rows
      this.showDeleteDialog = true
    },
    async confirmDelete() {
      try {
        await DeleteDeliveryRequest(this.pendingDeleteRows[0].ID)
        this.showDeleteDialog = false
        this.pendingDeleteRows = []
        await this.loadDeliveryRequests()
        window.$toast?.success?.('Deleted')
      } catch (e) {
        // Error displayed by http interceptor
      }
    },
  },
  async created() {
    const user = await CurrentUser()
    this.currentUserEmail = user?.email || ''
    await this.loadDeliveryRequests()
    const options = await GetDeliveryRules()
    this.deliveryRuleOptions = options.map(op => ({ label: op.Name, value: op, disabled: !op.Active }))
  },
  mounted() {
    // No real-time WS subscription — ListView uses pure HTTP (route enter / user action triggers reload)
  },
  beforeUnmount() {
    // nothing to clean up
  },
})
</script>
<style scoped>
</style>