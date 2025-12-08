<template>
  <n-modal v-model:show="showModal" preset="dialog">
    <template #header>
      <div>Create Delivery Request</div>
    </template>
    <n-flex vertical>
      <n-text strong depth="3">Name:</n-text>
      <n-input v-model:value="selectedDeliveryRequest.Name" placeholder="Delivery Plan Name" />
      <n-text strong depth="3">JIRA Link:</n-text>
      <n-input v-model:value="selectedDeliveryRequest.JiraLink" placeholder="Jira Link" />
      <n-text strong depth="3">Delivery Rule:</n-text>
      <n-select
        v-model:value="selectedDeliveryRequest.DeliveryRule"
        :options="deliveryRuleOptions"
        placeholder="Select Delivery Rule"
        clearable
      />
      <n-text strong depth="3">Included Tenants:</n-text>
      <n-flex>
        <n-tag type="info" v-for="v in selectedDeliveryRequest.DeliveryRule?.IncludedTenants" :key="v.ID">
          {{ v.Name }}
        </n-tag>
      </n-flex>
      <n-text strong depth="3">Allowed Version Pattern:</n-text>
      <n-text depth="3" v-if="selectedDeliveryRequest.DeliveryRule">
        {{ selectedDeliveryRequest.DeliveryRule.VersionPattern }}
      </n-text>

    </n-flex>
    <template #action>
      <n-button type="info" @click="onCreate">Create</n-button>
    </template>
  </n-modal>
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
      uaaUsers: {} as { [key: string]: UserInfo }, // userId - userEmail
      loading: false as boolean
    }
  },
  methods: {
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
      if (this.uaaUsers[userId]) return this.uaaUsers[userId]
      return this.uaaUsers[userId] = await UaaUserInfo(userId)
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