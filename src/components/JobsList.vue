<template>
  <n-modal v-model:show="showModal" preset="dialog" title="Dialog" >
    <template #header>
      <div>Create {{ type }} job</div>
    </template>
    Job Name:
    <n-input v-model:value="jobName" placeholder="Job Name" />
    Transport Reason:
    <n-input v-model:value="jobDesc" placeholder="JIRA task. Transport/Deploy reason" />
    <template #action>
      <n-button type="primary" @click="handleAdd">Create</n-button>
    </template>
  </n-modal>
  <data-table :title="title" :columns="columns" :data="jobList"
    :handle-add="() => { showModal = true }"
    :row-key="(row: Job) => row.ID"
    :custom-tool-bars="customToolBars"
    :enable-search="false"
    :key="jobList.length"
  />
</template>

<script lang="ts">
import { defineComponent, h, ref } from 'vue'
import { CopyJob, DeleteJob, GetJobs, NewJob, useUserInfoStore } from '@/service/api'
import { type ToolBar } from '@/service/consts'
import { NTag, type DataTableColumns, type DataTableRowKey } from 'naive-ui'
import DataTable from '@/components/DataTable.vue'
import { createJobColums } from '@/service/consts'
import type { Job } from '@/service/model'

export default defineComponent({
  props: {
    title: { required: true, type: String },
    type: { required: true, type: String }
  },
  components: { DataTable, NTag },
  methods: {
    handleAdd(data: Job[]) {
      if (!this.jobName || !this.jobDesc) {
        window.$message.warning('Please input job name and description')
        return
      }
      const job = {
        Name: this.jobName,
        Description: this.jobDesc,
        Status: 'Draft',
        Type: this.type,
        ID: 0,
      } as Job
      NewJob(job).then((job) => {
        this.$router.push({
          name: 'Job Flow',
          params: { jobId: job.ID }
        })
      })
    },
    handleDelete(rows: DataTableColumns) {
      if (rows.length === 0) {
        window.$message.warning('Please select at least one job')
        return
      }
      rows.forEach((row) => {
        DeleteJob(row as unknown as Job)
          .then((resp) => GetJobs(this.type))
          .then((resp) => {
            window.$message.success(`job(${rows.map((row) => row.ID+',')}) deleted`)
            this.jobList = resp
          })
      })
    },
    handleRefresh() {
      GetJobs(this.type).then((resp) => {
        this.jobList = resp
      })
    },
    handleCopy(rows: DataTableColumns) {
      if (rows.length === 0 || rows.length > 1) {
        window.$message.warning('Please select only one job')
        return
      }
      const job = rows[0] as unknown as Job
      
      CopyJob(job).then((job) => {
        this.$router.push({
          name: 'Job Flow',
          params: { jobId: job.ID }
        })
      })
    }
  },
  data() {
    const columns: DataTableColumns<Job> = createJobColums(this.$router, NTag)
    var jobList: Job[] = []
    const userInfo = useUserInfoStore().user
    const customToolBars: ToolBar[] = [
      {
        text: 'Delete',
        func: this.handleDelete
      },
      {
        text: 'refresh',
        func: this.handleRefresh
      },
      {
        text: 'copy',
        func: this.handleCopy
      }
    ]
    return { columns, jobList: jobList, customToolBars, showModal: false, jobName: '', jobDesc: '' }
  },
  created() {
    GetJobs(this.type).then((jobList) => {
      jobList.sort((a, b) => new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime())
      this.jobList = jobList
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
