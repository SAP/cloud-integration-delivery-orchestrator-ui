<template>
  <n-modal v-model:show="showModal" preset="dialog" title="Dialog">
    <template #header>
      <div>Create Transport Group</div>
    </template>
    Name:
    <n-input v-model:value="selectedTransportGroup.Name" placeholder="Group Name" />
    Description:
    <n-input v-model:value="selectedTransportGroup.Description" placeholder="Description" />
    Import Nodes:
    <n-select
      v-model:value="selectedTransportGroup.TransportNodes"
      filterable
      multiple
      placeholder="Choose TMS Transport Nodes"
      :options="importOptions"
    />
    Deploy Nodes:
    <n-select
      v-model:value="selectedTransportGroup.DeployEndpoints"
      filterable
      multiple
      placeholder="Choose TMS Transport Nodes"
      :options="deployOptions"
    />
    <template #action>
      <n-button type="primary" @click="onSave">Save</n-button>
    </template>
  </n-modal>

  <data-table
    title="Transport Groups"
    :data="transportGroups"
    :columns="transportGroupColums"
    :custom-tool-bars="toolBars"
    :handle-add="handleAdd"
    :row-key="(row: TransportGroup) => row.ID"
    :key="transportGroups.length"
  />
</template>

<script lang="ts">
import { defineComponent, handleError } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { transportGroupColums, type ToolBar } from '@/service/consts'
import {
  CreateTransportGroup,
  DeleteTransportGroup,
  GetCPIApiEndpoints,
  GetTransportGroups,
  GetTransportNodes,
  type TransportGroup,
  type TransportNode
} from '@/service/api'
export default defineComponent({
  components: { DataTable },
  data() {
    const toolBars: ToolBar[] = [
      {
        text: 'Delete',
        func: this.handleDelete
      },
      {
        text: 'Copy',
        func: this.handleCopy
      }
    ]
    return {
      toolBars,
      transportGroupColums,
      transportGroups: [] as TransportGroup[], // transport group list
      showModal: false,

      selectedTransportGroup: {} as TransportGroup,

      importOptions: [] as {}[],
      deployOptions: [] as {}[]
    }
  },
  methods: {
    onSave() {
      CreateTransportGroup(this.selectedTransportGroup)
        .then(() => GetTransportGroups())
        .then((res) => {
          this.transportGroups = res
          this.showModal = false
          window.$message.success('Create transport group successfully')
        })
    },
    handleAdd() {
      this.showModal = true
      this.selectedTransportGroup = {
        ID: 0,
        Name: '',
        Description: '',
        DeployEndpoints: [],
        TransportNodes: [],
        CreatedBy: '',
      }
    },
    handleDelete(rows: TransportGroup[]) {
      if (rows.length === 0) {
        window.$message.warning('Please select at least one transport group')
        return
      }
      // delete transport group
      DeleteTransportGroup(rows[0].ID)
        .then(() => GetTransportGroups())
        .then((res) => {
          this.transportGroups = res
        })
    },
    handleCopy() {
      // copy transport group
    }
  },
  created() {
    // fetch data
    GetTransportGroups().then((res) => {this.transportGroups = res})
    GetTransportNodes().then((res) => {
      this.importOptions = res.map((item) => {
        return {
          label: item.name,
          value: item
        }
      })
    })
    GetCPIApiEndpoints().then((res) => {
      this.deployOptions = res.map((item) => {
        return {
          label: item.name,
          value: item.name
        }
      })
    })
  },
  computed: {
  }
})
</script>
<style scoped>
.n-flex {
  margin: 0px 50px;
}
</style>