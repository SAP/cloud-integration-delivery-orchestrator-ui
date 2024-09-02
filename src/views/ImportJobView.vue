<template>
  <data-table title="Import Jobs" :columns="columns" :data="data" :handle-add="handleAdd" :row-key="(row: Job) => row.id" />
</template>

<script lang="ts">
import { defineComponent, h, ref } from 'vue'
import { type Job } from '@/store/index'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import DataTable from '@/components/DataTable.vue'
import { createImportJobColums } from '@/store/const-data'
import axios from 'axios'

export default defineComponent({
  components: { DataTable },
  data() {
    const columns: DataTableColumns<Job> = createImportJobColums(this.$router)
    const data: Job[] = []
    const currentRow = ref(data[0])

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
    return { columns, data, handleAdd, currentRow }
  },
  methods: {
    getJobs() {
      axios.get('/api/v1/job')
        .then(resp => {
          this.data = resp.data.result
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
