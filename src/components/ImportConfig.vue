<template>
  <n-tabs type="segment" animated>
    <n-tab-pane name="Config" tab="Config">
      <data-table
        title="Transport Nodes"
        :data="transportNodes"
        :columns="transportNodesColums"
        :row-key="(row: TransportNode) => row.id"
        @update:check-rows="handleTransportNodes"
        :default-checked-row-keys="[step.transport_node_id]"
        :loading="!transportNodes || transportNodes.length === 0"
      />
      <data-table
        :title="'Transport Requests of ' + step.transport_node_name"
        :data="transportRequests"
        :columns="transportRequestColums"
        :row-key="(row: TransportRequest) => row.id"
        @update:check-rows="handleTransportRequests"
        :default-checked-row-keys="step.transport_requests"
        :loading="!transportRequests || transportRequests.length === 0"
        :key="step.transport_node_id"
      />
    </n-tab-pane>
    <n-tab-pane name="Log" tab="Log"> Hey Jude </n-tab-pane>
  </n-tabs>
</template>

<script lang="ts">
import DataTable from '@/components/DataTable.vue'
import { GetTransportNodes, GetTransportRequests, type ApiEndpoint, type ImportStep, type Step, type TransportNode, type TransportRequest } from '@/store'
import {
  apiEndpointSelectColums,
  transportNodesColums,
  transportRequestColums
} from '@/store/const-data'
import { defineComponent, type PropType } from 'vue'

export default defineComponent({
  props: {
    step: { required: true, type: Object as PropType<ImportStep> }
  },
  components: {
    DataTable
  },
  created() {
    GetTransportNodes().then(nodes => this.transportNodes = nodes)
    if (!this.step.transport_node_id) return
    GetTransportRequests(this.step.transport_node_id).then(trs=>this.transportRequests=trs)
  },
  computed: {
    apiEndpointTitle() {
      return `Choose ${this.step?.type} Node`
    }
  },
  data() {
    const tmsList: ApiEndpoint[] = []
    const transportNodes: TransportNode[] = []
    const transportRequests: TransportRequest[] = []
    return {
      tmsList,
      transportNodes,
      transportRequests,
      apiEndpointSelectColums,
      transportNodesColums,
      transportRequestColums
    }
  },
  methods: {
    handleTransportNodes(rows: TransportNode[]) {
      const transportNode = rows[0]
      this.step.transport_node_name = transportNode.name
      this.step.transport_node_id = transportNode.id
      // get transport requests
      this.step.transport_requests = []
      this.transportRequests = []
      GetTransportRequests(this.step.transport_node_id).then(trs=>this.transportRequests=trs)
    },
    handleTransportRequests(rows: TransportRequest[]) {
      this.step.transport_requests = []
      for (const row of rows) {
        this.step.transport_requests.push(row.id)
      }
    },
  }
})
</script>
