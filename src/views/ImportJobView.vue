<template>
  <data-table title="Import Jobs" :columns="columns" :data="jobs" :handle-add="handleAdd" :row-key="(row: Job) => row.id" :custom-tool-bars="customToolBars"/>
</template>

<script lang="ts">
import { defineComponent, h, ref } from 'vue'
import { type Job, type ToolBar } from '@/store/index'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import DataTable from '@/components/DataTable.vue'
import { createImportJobColums } from '@/store/const-data'
import axios from 'axios'

export default defineComponent({
  components: { DataTable },
  data() {
    const columns: DataTableColumns<Job> = createImportJobColums(this.$router)
    const jobs: Job[] = []

    const handleAdd: Function = (data: Job[]) => {
      const job: Job = {
        name: '',
        description: '',
        status: 'DRAFT',
        steps: [],
        id: -1
      }
      axios.post('/api/v1/job', job)
        .then(resp => {
          return resp.data.result as Job
        })
        .then((job:Job) => {
          this.$router.push({
            name: 'flow', params: { jobId: job.id}
          })
        })
      
    }
    const customToolBars: ToolBar[] = [
      {
        text: 'Delete', 
        func: (rows: DataTableColumns) => {
          // TODO batch or promise.all() ?
          axios.delete(`/api/v1/job/${rows[0].id}`)
            .then(resp => {
              this.getJobs()
            })
      }},
      {text: 'refresh', func: () => {this.getJobs()}}
    ]
    return { columns, jobs, handleAdd, customToolBars }
  },
  methods: {
    getJobs() {
      axios.get('/api/v1/job')
        .then(resp => {
          this.jobs = resp.data.result
        })
    }
  },
  created() {
    this.getJobs()
  }
})
</script>

<style scoped>
.arrow-class {
  height: 10px;
  width: 10px;
}
h2 {
  padding-bottom: 15px;
}
.n-flex {
  margin: 0px 50px;
}
</style>
