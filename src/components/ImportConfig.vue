<template>
    <data-table
      :title="apiEndpointTitle as string"
      :data="tmsList"
      :columns="apiEndpointSelectColums"
      @update:check-rows="handleApiEndpoint"
    />
</template>
  
<script lang="ts">
  import DataTable from '@/components/DataTable.vue';
  import type { ApiEndpoint, Step } from '@/store'
  import { apiEndpointSelectColums } from '@/store/const-data'
  import axios from 'axios';
  import type { DataTableColumns } from 'naive-ui';
  import { defineComponent, type PropType } from 'vue'
  
  export default defineComponent({
    props: {
      step: {required: true, type: Object as PropType<Step>}
    },
    components: {
      DataTable
    },
    methods: {
      handleApiEndpoint(rows: DataTableColumns) {
        const endpoint = rows[0] as unknown as ApiEndpoint
        this.curStep!.tenant = endpoint
      },
      getApiEndpoints() {
        const endpointType = this.curStep.type == 'Import' ? 'TMS' : 'CPI'
  
        axios.get('/api/v1/apiEndpoints', {
          params: {type: endpointType}
        })
        .then(response => {
          console.log('apiEndpoints:')
          console.log(response.data.data)
          this.tmsList = response.data.data
        })
  
      }
    },
    computed: {
      apiEndpointTitle() {
        return `Choose ${this.step?.type} Node`
      }
    },
    data() {
      const curStep: Step = this.step as Step
      const tmsList: ApiEndpoint[] = []
      return {
        curStep,
        tmsList,
        apiEndpointSelectColums
      }
    },
    watch: {
      step(val, oldVal) {
        console.log('step changed')
        console.log(val)
        this.curStep = val
        this.getApiEndpoints()
      }
    }
  
    
  })
</script>
  