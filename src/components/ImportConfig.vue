<template>
    <data-table
      :title="apiEndpointTitle as string"
      :data="tmsList"
      :columns="apiEndpointSelectColums"
      :row-key="(row: ApiEndpoint) => row.id"
      @update:check-rows="handleApiEndpoint"
      :default-checked-row-keys="[step.endpoint_id]"
    />
    <data-table 
      title="Transport Nodes" 
      :data="transportNodes" 
      :columns="transportNodesColums" 
      :row-key="(row: TransportNode) => row.id" 
      @update:check-rows="handleTransportNodes"
      :default-checked-row-keys="[step.transport_node_id]"
      :loading="false"
    />
    <data-table
      title="Transport Requests"
      :data="transportRequests"
      :columns="transportRequestColums"
      :row-key="(row: TransportRequest) => row.id"
      @update:check-rows="handleTransportRequests"
      :default-checked-row-keys="step.transport_requests"
    />
</template>
  
<script lang="ts">
  import DataTable from '@/components/DataTable.vue';
  import type { ApiEndpoint, ImportStep, Step, TransportNode, TransportRequest } from '@/store'
  import  { apiEndpointSelectColums, transportNodesColums, transportRequestColums } from '@/store/const-data'
  import axios from 'axios';
  import type { DataTableColumns } from 'naive-ui';
import loading from 'naive-ui/es/_internal/loading';
  import { defineComponent, type PropType } from 'vue'
  
  export default defineComponent({
    props: {
      step: {required: true, type: Object as PropType<ImportStep>}
    },
    components: {
      DataTable
    },
    created() {
      this.getApiEndpoints()
      if (this.step.endpoint_id < 0) return
      this.getTransportNodes()
      if (!this.step.transport_node_id) return
      this.getTransportRequests()
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
      handleApiEndpoint(rows: DataTableColumns) {
        const endpoint = rows[0] as unknown as ApiEndpoint
        this.step.endpoint_id = endpoint.id
        // get transport nodes
        this.getTransportNodes()
      },
      handleTransportNodes(rows: DataTableColumns) {
        const transportNode = rows[0] as unknown as TransportNode
        this.step.transport_node_name = transportNode.name
        this.step.transport_node_id = transportNode.id
        // get transport requests
        this.getTransportRequests()
      },
      handleTransportRequests(rows: DataTableColumns) {
        this.step.transport_requests = []
        for(const row of rows) {
          this.step.transport_requests.push((row as unknown as TransportRequest).id)
        }
      },
      //
      getApiEndpoints() {
        axios.get('/api/v1/apiEndpoints', {
          params: {type: "TMS"}
        }).then(resp => {
          this.tmsList = resp.data.data
        })
      },
      getTransportNodes() {
        axios.get('/api/v1/tms/nodes')
          .then(response => {
            this.transportNodes = response.data.result
        })
      },
      getTransportRequests() {
        axios.get('/api/v1/tms/trs', {
          params: {transportNode: this.step.transport_node_id}
        }).then(response => {
          this.transportRequests = response.data.result
        })
      }
    },
    
  })
</script>
  