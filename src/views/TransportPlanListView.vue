<template>
  <n-modal v-model:show="showModal" preset="dialog" title="Dialog">
    <template #header>
      <div>Create Transport Plan</div>
    </template>
    Name:
    <n-input v-model:value="selectedTransportPlan.Name" placeholder="Transport&Delivery Plan Name" />
    Description:
    <n-input v-model:value="selectedTransportPlan.Description" placeholder="Description" />
    <template #action>
      <n-button type="primary" @click="onSave">Save</n-button>
    </template>
  </n-modal>
  <data-table
    title="Transport&Delivery Plans"
    :columns="transportPlanColumns($router)"
    :data="transportPlans"
    :custom-tool-bars="toolBars"
    :handle-add="() => { showModal = true }"
    :row-key="(row: TransportPlan) => row.ID"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { transportPlanColumns, type ToolBar } from '@/service/consts'
import { DeleteTransportPlan, GetTransportPlans, SaveTransportPlan, type TransportPlan } from '@/service/api';
export default defineComponent({
  components: { DataTable },
  data(){
    const toolBars: ToolBar[] = [
      {
        text: 'Delete',
        func: this.handleDelete
      }
    ]
    return {
      transportPlanColumns,
      transportPlans: [] as TransportPlan[],
      toolBars,
      showModal: false,
      selectedTransportPlan: {} as TransportPlan,
    }
  },
  methods: {
    onSave() {
      SaveTransportPlan(this.selectedTransportPlan).then(() => {
        this.showModal = false
        GetTransportPlans().then((res) => {
          this.transportPlans = res
        })
      })
    },
    handleDelete(rows: TransportPlan[]) {
      if (rows.length === 0) {
        window.$message.warning('Please select at least one transport plan')
        return
      }
      DeleteTransportPlan(rows[0].ID).then(() => {
        GetTransportPlans().then((res) => {
          this.transportPlans = res
        })
      })
    }
  },
  created() {
    GetTransportPlans().then((res) => {
      this.transportPlans = res
    })
  },
})
</script>
<style scoped>
.n-flex {
  margin: 0px 50px;
}
</style>