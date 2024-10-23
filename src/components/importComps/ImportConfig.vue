<template>
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
</template>

<script lang="ts">
import DataTable from '@/components/DataTable.vue'
import {
  GetTransportNodes,
  GetTransportRequests,
  validate,
  type ApiEndpoint,
  type ImportStep,
  type Step,
  type TransportNode,
  type TransportRequest
} from '@/service/api'
import { transportNodesColums, transportRequestColums } from '@/service/consts'
import { defineComponent, type PropType } from 'vue'

export default defineComponent({
  props: {
    step: { required: true, type: Object as PropType<ImportStep> }
  },
  components: {
    DataTable
  },
  created() {
    GetTransportNodes().then((nodes) => {this.transportNodes = nodes})
    if (!this.step.TransportNodeId) return
    GetTransportRequests(this.step.TransportNodeId).then((trs) => {this.transportRequests = trs})
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
      transportNodesColums,
      transportRequestColums
    }
  },
  methods: {
    handleTransportNodes(rows: TransportNode[]) {
      if(!validate(this.step)) return
      const transportNode = rows[0]
      this.step.TransportNodeName = transportNode.name
      this.step.TransportNodeId = transportNode.id
      // get transport requests
      this.step.TransportRequests = []
      this.transportRequests = []
      this.step.Status = 'Draft'
      GetTransportRequests(this.step.TransportNodeId).then((trs) => (this.transportRequests = trs))
    },
    handleTransportRequests(rows: TransportRequest[]) {
      if(!validate(this.step)) return
      this.step.TransportRequests = rows.map((v, i) => v.id)
      this.step.Status = 'Draft'
    }
  }
})
</script>
