<template>
  <data-table
    title="Transport Nodes"
    :data="transportNodeOptions"
    :columns="transportNodesColums"
    :row-key="(row: TransportNode) => row.id"
    @update:check-rows="handleTransportNodes"
    :default-checked-row-keys="[step.TransportNodeId]"
    :loading="!transportNodeOptions || !transportNodeOptions.length"
  />
  <data-table
    :title="'Transport Requests of ' + step.TransportNodeName"
    :data="transportRequestOptions"
    :columns="transportRequestColums"
    :row-key="(row: NodeTransportRequest) => row.id"
    @update:check-rows="handleTransportRequests"
    :default-checked-row-keys="step.TransportRequests_V2.map((tr) => tr.ID)"
    :loading="!transportRequestOptions || !transportRequestOptions.length"
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
  type NodeTransportRequest
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
    if (!this.step.TransportRequests_V2) this.step.TransportRequests_V2 = []
    GetTransportNodes().then((nodes) => {this.transportNodeOptions = nodes})
    if (!this.step.TransportNodeId) return
    GetTransportRequests(this.step.TransportNodeId).then((trs) => {this.transportRequestOptions = trs})
  },
  computed: {
    apiEndpointTitle() {
      return `Choose ${this.step?.Type} Node`
    }
  },
  data() {
    return {
      transportNodeOptions: [] as TransportNode[],
      transportRequestOptions: [] as NodeTransportRequest[],
      transportNodesColums,
      transportRequestColums
    }
  },
  methods: {
    handleTransportNodes(rows: TransportNode[]) {
      if(!validate(this.step)) return
      this.step.Status = 'Draft'

      const transportNode = rows[0]
      this.step.TransportNodeName = transportNode.name
      this.step.TransportNodeId = transportNode.id
      // get transport requests
      this.step.TransportRequests_V2 = []
      this.transportRequestOptions = []
      GetTransportRequests(this.step.TransportNodeId).then((trs) => (this.transportRequestOptions = trs))
    },
    handleTransportRequests(rows: NodeTransportRequest[]) {
      if(!validate(this.step)) return
      this.step.TransportRequests_V2 = rows.map((nodeTr) => ({ ID: nodeTr.id, Description: nodeTr.description, Status: nodeTr.status }))
      this.step.Status = 'Draft'
    }
  }
})
</script>
