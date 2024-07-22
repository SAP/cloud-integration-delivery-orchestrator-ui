<template>
  <data-table title="Import Jobs" :columns="columns" :data="data" />
</template>

<script lang="ts">
import { defineComponent, h } from 'vue'
import { type Job } from '@/store/index'
import { mockJobList } from '@/store/mocks'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import DataTable from '@/components/DataTable.vue'
import { IosArrowForward } from '@vicons/ionicons4'

export default defineComponent({
  components: { DataTable },
  data() {
    const router = this.$router
    const rowProps = (row: Object) => {
      return {
        style: 'cursor: pointer;',
        onClick: () => {
          // console.log(row)
          // this.$router.push('/flow')
        }
      }
    }
    const columns: DataTableColumns<Job> = [
      {
        type: 'selection',
        disabled(row: Job) {
          return row.status === 'FATAL'
        }
      },
      {
        title: 'ID',
        key: 'uuid',
        resizable: true
      },
      {
        title: 'Job Name',
        key: 'description',
        resizable: true
      },
      {
        title: 'Status',
        key: 'status',
        resizable: true
      },
      {
        title: 'Created by',
        key: 'createdBy',
        resizable: true
      },
      {
        title: 'Created At',
        key: 'createdAt',
        resizable: true
      },
      {
        title: '',
        key: 'arrow',
        render(row: Job) {
          return h(
            'div',
            {
              style: { width: '18px', height: '18px' },
              onClick: () => {
                console.log(row)
                router.push('/flow')
              }
            },
            [h(IosArrowForward)]
          )
        }
      }
    ]
    const data = mockJobList
    return { columns, data }
  },
  methods: {}
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
