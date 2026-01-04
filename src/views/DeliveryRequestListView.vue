<template>
  <ui5-dialog :open="showModal" @close="showModal = false" header-text="Create Delivery Request" style="width: 30rem;">
    <div class="dialog-content" style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem 0;">
      <div>
        <ui5-label style="font-weight: bold;">Name:</ui5-label>
        <ui5-input v-model="selectedDeliveryRequest.Name" placeholder="Delivery Request Name" style="width: 100%; margin-top: 0.5rem;" />
      </div>
      <div>
        <ui5-label style="font-weight: bold;">JIRA Link:</ui5-label>
        <ui5-input v-model="selectedDeliveryRequest.JiraLink" placeholder="Jira Link" style="width: 100%; margin-top: 0.5rem;" />
      </div>
      <div>
        <ui5-label style="font-weight: bold;">Delivery Rule:</ui5-label>
        <ui5-select
          @change="handleRuleChange"
          style="width: 100%; margin-top: 0.5rem;"
        >
          <ui5-option
            v-for="option in deliveryRuleOptions"
            :id="`delivery-rule-option-${option.value.ID}`"
            :value="option.value.ID"
            :additional-text="`#${option.value.ID}`"
            :selected="selectedDeliveryRequest.DeliveryRule?.ID === option.value.ID"
            :disabled="option.disabled"
          >
            {{ option.label }}
          </ui5-option>
        </ui5-select>
      </div>
      <div>
        <ui5-label style="font-weight: bold;">Included Tenants:</ui5-label>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
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
        <ui5-text v-if="selectedDeliveryRequest.DeliveryRule" style="display: block; margin-top: 0.5rem;">
          {{ selectedDeliveryRequest.DeliveryRule.VersionPattern }}
        </ui5-text>
      </div>
    </div>
    <div slot="footer" style="display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem 0 0 0;">
      <ui5-button design="Positive" @click="onCreate">Create</ui5-button>
    </div>
  </ui5-dialog>
  <data-table
    title="Delivery Requests"
    :columns="deliveryRequestColumns"
    :data="deliveryRequests"
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

import "@ui5/webcomponents/dist/Dialog.js";
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/Input.js";
import "@ui5/webcomponents/dist/Label.js";
import "@ui5/webcomponents/dist/Select.js";
import "@ui5/webcomponents/dist/Tag.js";
import "@ui5/webcomponents/dist/Text.js";
import "@ui5/webcomponents/dist/Option.js";
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
      loading: false as boolean
    }
  },
  methods: {
    handleRuleChange(event: any) {
      const selectedId = event.target.value
      const selectedOption = this.deliveryRuleOptions.find(op => op.value.ID === selectedId)
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
        window.$message?.error?.('Failed to save Delivery Plan')
        // optionally log e
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
        window.$message?.error?.('Failed to delete Delivery Request')
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