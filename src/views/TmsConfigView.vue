<template>
  <data-table
    title="Configure TMS Endpoints"
    :columns="columns"
    :data="data"
    :customToolBars="customToolBars"
    :handleAdd="handleAdd"
  />
  <n-modal v-model:show="showModal">
    <EditEndpointCard :value="currentRow" v-model:show="showModal" />
  </n-modal>
</template>

<script lang="ts">
import { mockTMSList } from '@/store/mocks'
import { defineComponent, ref } from 'vue'
import DataTable from '@/components/DataTable.vue'
import EditEndpointCard from '@/components/EditEndpointCard.vue'
import { apiEndpointColums } from '@/store/const-data'
import type { DataTableColumns } from 'naive-ui'
import type { ApiEndpoint } from '@/store'
export default defineComponent({
  data() {
    const data = mockTMSList
    const columns = apiEndpointColums
    const showModal = ref(false)
    const currentRow = ref()

    const customToolBars = [
      {
        text: 'Edit',
        func: (rows: DataTableColumns) => {
          showModal.value = true
          currentRow.value = rows[0]
        }
      },
      {
        text: 'Check Connection',
        func: (rows: DataTableColumns) => {}
      }
    ]

    return { data, columns, customToolBars, showModal, currentRow }
  },
  methods: {
    handleAdd(data: ApiEndpoint[]) {
      const newRecord: ApiEndpoint = {
        uuid: 0,
        type: 'TMS',
        status: 'draft',
        description: '',
        tokenUrl: '???',
        credentialId: '',
        credentialSecret: '',
        endpointUrl: '',
        createdBy: 'doug.liu@sap.com',
        createdAt: '',
        modifiedBy: '',
        modifiedAt: ''
      }
      data.push(newRecord)
      this.currentRow = newRecord
      this.showModal = true
    }
  },
  components: { DataTable, EditEndpointCard }
})
</script>
