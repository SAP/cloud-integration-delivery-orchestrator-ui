<template>
  <n-tabs type="segment" animated>
    <n-tab-pane name="Config" tab="Config">
      <data-table
        title="Transport Nodes"
        :data="transportNodes"
        :columns="transportNodesColums"
        :row-key="(row: TransportNode) => row.id"
        @update:check-rows="handleTransportNodes"
        :default-checked-row-keys="[step.TransportNodeId]"
        :loading="!transportNodes || transportNodes.length === 0"
      />
      <data-table
        :title="'Transport Requests of ' + step.TransportNodeName"
        :data="transportRequests"
        :columns="transportRequestColums"
        :row-key="(row: TransportRequest) => row.id"
        @update:check-rows="handleTransportRequests"
        :default-checked-row-keys="step.TransportRequests"
        :loading="!transportRequests || transportRequests.length === 0"
        :key="step.TransportNodeId"
      />
    </n-tab-pane>
    <n-tab-pane name="Log" tab="Log"> Hey Jude </n-tab-pane>
  </n-tabs>
</template>

<script lang="ts">
import DataTable from '@/components/DataTable.vue'
import { GetTransportNodes, GetTransportRequests, type ApiEndpoint, type ImportStep, type Step, type TransportNode, type TransportRequest } from '@/service'
import {
  apiEndpointColums,
  transportNodesColums,
  transportRequestColums
} from '@/service/consts'
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
    if (!this.step.TransportNodeId) return
    GetTransportRequests(this.step.TransportNodeId).then(trs=>this.transportRequests=trs)
  },
  computed: {
    apiEndpointTitle() {
      return `Choose ${this.step?.Type} Node`
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
      apiEndpointColums,
      transportNodesColums,
      transportRequestColums
    }
  },
  methods: {
    handleTransportNodes(rows: TransportNode[]) {
      const transportNode = rows[0]
      this.step.TransportNodeName = transportNode.name
      this.step.TransportNodeId = transportNode.id
      // get transport requests
      this.step.TransportRequests = []
      this.transportRequests = []
      this.step.Status = 'Draft'
      GetTransportRequests(this.step.TransportNodeId).then(trs=>this.transportRequests=trs)
    },
    handleTransportRequests(rows: TransportRequest[]) {
      this.step.TransportRequests = rows.map((v,i) => v.id)
      this.step.Status = 'Draft'
    },
  }
})
</script>
