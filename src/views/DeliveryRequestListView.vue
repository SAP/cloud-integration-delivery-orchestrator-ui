<template>
  <n-modal v-model:show="showModal" preset="dialog" title="Dialog">
    <template #header>
      <div>Create Delivery Request</div>
    </template>
    Name:
    <n-input v-model:value="selectedDeliveryRequest.Name" placeholder="Delivery Plan Name" />
    JIRA Link:
    <n-input v-model:value="selectedDeliveryRequest.JiraLink" placeholder="Jira Link" />
    Delivery Rule:
    <n-select
      v-model:value="selectedDeliveryRequest.DeliveryRule"
      :options="deliveryRuleOptions"
      placeholder="Select Delivery Rule"
      clearable
    />
    <div v-for="v in selectedDeliveryRequest.DeliveryRule?.IncludedTenants" :key="v.ID">
      {{ v.Name }}
    </div>
    <template #action>
      <n-button type="primary" @click="onCreate">Create</n-button>
    </template>
  </n-modal>
  <data-table
    title="Delivery Request"
    :columns="deliveryRequestColumns"
    :data="deliveryRequests"
    :custom-tool-bars="toolBars"
    :handle-add="() => { showModal = true }"
    :row-key="(row: DeliveryRequest) => row.ID"
    :row-click="handleRowClick"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { deliveryRequestColumns, type ToolBar } from '@/service/consts'
import { DeleteDeliveryRequest, GetDeliveryRequests, CreateDeliveryRequest, GetDeliveryRules, } from '@/service/api';
import type { DeliveryRequest, DeliveryRule } from '@/service/model';
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
      deliveryRuleOptions: [] as {label: string, value: DeliveryRule}[],
    }
  },
  methods: {
    handleRowClick(row: DeliveryRequest) {
      this.$router.push({ path: `/delivery-request/${row.ID}` })
    },
    async loadDeliveryRequests() {
      const deliveryRequests = await GetDeliveryRequests()
      deliveryRequests.sort((a, b) => new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime())
      this.deliveryRequests = deliveryRequests
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
    }
  },
  async created() {
    await this.loadDeliveryRequests()
    const options = await GetDeliveryRules()
    this.deliveryRuleOptions = options.map(op => ({ label: op.Name, value: op }))
  },
})
</script>
<style scoped>
.n-flex {
  margin: 0px 50px;
}
</style>