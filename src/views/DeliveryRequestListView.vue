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
      <ui5-toolbar-button class="dialogCloser" design="Emphasized" text="Create" @click="onCreate"></ui5-toolbar-button>
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
  </div>
  <data-table
    title="Delivery Requests"
    :columns="deliveryRequestColumns"
    :data="filteredDeliveryRequests"
    :custom-tool-bars="toolBars"
    :handle-add="() => { showModal = true; selectedDeliveryRequest = {} as DeliveryRequest }"
    :row-key="(row: DeliveryRequest) => row.ID"
    :row-click="handleRowClick"
    :loading="loading"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { deliveryRequestColumns, type ToolBar } from '@/service/consts'
import { DeleteDeliveryRequest, GetDeliveryRequests, CreateDeliveryRequest, GetDeliveryRules, UaaUserInfo, } from '@/service/api';
import type { DeliveryRequest, DeliveryRule, UserInfo } from '@/service/model';
import { STATUS_FILTER_GROUPS, type StatusFilterKey } from '@/service/statuses';

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
  components: { DataTable },
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
      uaaUsers: {} as { [key: string]: Promise<UserInfo> }, // userId - userEmail
      loading: false as boolean,
      activeFilter: 'All' as StatusFilterKey,
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
          ? this.deliveryRequests.length
          : this.deliveryRequests.filter(dr => group.has(dr.AggregateStatus)).length
      }
      return counts
    },
    filteredDeliveryRequests(): DeliveryRequest[] {
      const group = STATUS_FILTER_GROUPS[this.activeFilter]
      if (group === null) return this.deliveryRequests
      return this.deliveryRequests.filter(dr => group.has(dr.AggregateStatus))
    },
  },
  methods: {
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
      const deliveryRequests = await GetDeliveryRequests()
      await Promise.all(
        deliveryRequests.map(async (dr) => {
          dr.CreatedBy = (await this.uaaUserInfo(dr.CreatedBy)).email
          dr.UpdatedBy = (await this.uaaUserInfo(dr.UpdatedBy)).email
        })
      )
      deliveryRequests.sort((a, b) => new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime())
      this.deliveryRequests = deliveryRequests
      this.loading = false
    },
    async onCreate() {
      try {
        await CreateDeliveryRequest(this.selectedDeliveryRequest)
        this.showModal = false
        await this.loadDeliveryRequests()
        window.$message?.success?.('Saved')
      } catch (e) {
        // Error displayed by http interceptor
      }
    },
    async handleDelete(rows: DeliveryRequest[]) {
      if (rows.length === 0) {
        window.$message.warning('Please select at least one transport plan')
        return
      }
      try {
        await DeleteDeliveryRequest(rows[0].ID)
        await this.loadDeliveryRequests()
        window.$message?.success?.('Deleted')
      } catch (e) {
        // Error displayed by http interceptor
      }
    },
    async uaaUserInfo(userId: string) {
      if(!this.uaaUsers[userId]) {
        this.uaaUsers[userId] = UaaUserInfo(userId)
      }
      return this.uaaUsers[userId]
    },
  },
  async created() {
    await this.loadDeliveryRequests()
    const options = await GetDeliveryRules()
    this.deliveryRuleOptions = options.map(op => ({ label: op.Name, value: op, disabled: !op.Active }))
  },
})
</script>
<style scoped>
</style>