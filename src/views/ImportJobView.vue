<template>
  <data-table title="Import Jobs" :columns="columns" :data="data" :handle-add="handleAdd" />
</template>

<script lang="ts">
import { defineComponent, h, ref } from 'vue'
import { type Job } from '@/store/index'
import { mockJobList } from '@/store/mocks'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import DataTable from '@/components/DataTable.vue'
import { createImportJobColums } from '@/store/const-data'

export default defineComponent({
  components: { DataTable },
  data() {
    const columns: DataTableColumns<Job> = createImportJobColums(this.$router)
    const data = mockJobList
    const currentRow = ref(data[0])

    const handleAdd: Function = (data: Job[]) => {
      this.$router.push('/flow')
    }
    return { columns, data, handleAdd, currentRow }
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
