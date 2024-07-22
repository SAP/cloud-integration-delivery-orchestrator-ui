<script lang="ts">
import { defineComponent, h, ref, render } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { mockCpiEndpoints } from '@/store/mocks'
import { type ApiEndpoint } from '@/store/index'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import { NButton, useMessage } from 'naive-ui'
import EditEndpointCard from '@/components/EditEndpointCard.vue'
import { apiEndpointColums } from '@/store/const-data'
export default defineComponent({
  components: {
    DataTable,
    EditEndpointCard
  },
  data() {
    const showModal = ref(false)
    const data = mockCpiEndpoints
    const currentRow = ref()

    const columns = apiEndpointColums

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
    const handleAdd = (data: ApiEndpoint[]) => {
      const newRecord: ApiEndpoint = {
        uuid: 0,
        type: 'CPI',
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
      currentRow.value = newRecord
      showModal.value = true
    }

    return { columns, data, showModal, currentRow, customToolBars, handleAdd }
  },
  methods: {}
})
</script>
<template>
  <data-table
    title="Configure Cpi Endpoints"
    :columns="columns"
    :data="data"
    :customToolBars="customToolBars"
    :handleAdd="handleAdd"
  />
  <n-modal v-model:show="showModal">
    <EditEndpointCard :value="currentRow" v-model:show="showModal" />
  </n-modal>
</template>
