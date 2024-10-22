<template>
  <data-table
    :title="title"
    :columns="columns"
    :data="jobList"
    :handle-add="handleAdd"
    :row-key="(row: Job) => row.ID"
    :custom-tool-bars="customToolBars"
    :enable-search="false"
  />
</template>

<script lang="ts">
import { defineComponent, h, ref } from 'vue'
import { DeleteJob, GetJobs, NewJob, useUserInfoStore, type Job } from '@/service/api'
import { type ToolBar } from '@/service/consts'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import DataTable from '@/components/DataTable.vue'
import { createJobColums } from '@/service/consts'

export default defineComponent({
  props: {
    title: { required: true, type: String },
    type: { required: true, type: String }
  },
  components: { DataTable },
  data() {
    const columns: DataTableColumns<Job> = createJobColums(this.$router)
    var jobList: Job[] = []
    const userInfo = useUserInfoStore().user

    const handleAdd: Function = (data: Job[]) => {
      NewJob(this.type).then((job) => {
        this.$router.push({
          name: 'Job Flow',
          params: { jobId: job.ID }
        })
      })
    }
    const customToolBars: ToolBar[] = [
      {
        text: 'Delete',
        func: (rows: DataTableColumns) => {
          // TODO batch or promise.all() ?
          DeleteJob(rows[0] as unknown as Job)
            .then((resp) => GetJobs(this.type))
            .then((resp) => (jobList = resp))
        }
      },
      {
        text: 'refresh',
        func: () => {
          GetJobs(this.type).then((resp) => {
            jobList = resp
          })
        }
      }
    ]
    return { columns, jobList: jobList, handleAdd, customToolBars }
  },
  created() {
    GetJobs(this.type).then((resp) => {
      this.jobList = resp
    })
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
