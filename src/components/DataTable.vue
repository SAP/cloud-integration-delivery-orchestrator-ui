<template>
  <n-flex vertical align="start">
    <n-flex justify="space-between" class="header-class">
      <h3>{{ title }} ({{ count }})</h3>
      <n-flex justify="">
        <n-button
          quaternary
          type="info"
          v-for="(tool, index) in customToolBars"
          :key="index"
          @click="tool.func(checkedRows)"
        >
          {{ tool.text }}
        </n-button>

        <n-button quaternary type="info" class="icon-class" @click="handleAdd(data)">
          <n-icon><IosAdd /> </n-icon>
        </n-button>
        <n-button quaternary type="info" class="icon-class">
          <n-icon><IosSettings /> </n-icon>
        </n-button>
      </n-flex>
    </n-flex>

    <n-data-table
      :columns="columnsCopy"
      :data="data"
      :row-props="rowProps"
      size="medium"
      :row-key="rowKey"
      @update:checked-row-keys="handleCheck"
      striped
    />
  </n-flex>
</template>

<script lang="ts">
import { defineComponent, h, type PropType } from 'vue'
import { type ApiEndpoint, type Job } from '@/store'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import { IosAdd, IosSettings } from '@vicons/ionicons4'

interface ToolBar {
  text: String
  func: Function
}
export default defineComponent({
  props: {
    title: { type: String, required: true },
    columns: { type: Array, required: true },
    data: { type: Array, required: true },
    customToolBars: { type: Array<ToolBar> },
    handleAdd: { type: Function, required: true }
  },
  data() {
    const router = this.$router
    const rowProps = (row: Object) => {
      return {
        style: 'cursor: pointer;',
        onClick: () => {
          // console.log(row)
        }
      }
    }
    const columnsCopy = this.columns

    const rowKey = (row: Job) => row.uuid
    const checkedRowKeysRef: DataTableRowKey[] = []
    const checkedRows: DataTableColumns = []
    const count = this.data.length
    const disableButton = true
    return { rowProps, count, rowKey, disableButton, checkedRowKeysRef, columnsCopy, checkedRows }
  },
  methods: {
    handleCheck(rowKeys: DataTableRowKey[], rows: DataTableColumns) {
      console.log(rowKeys)
      console.log(rows)
      this.checkedRowKeysRef = rowKeys
      this.checkedRows = rows
      this.disableButton = !rows.length
    }
  },
  emits: ['update:checkRows', 'update:edit'],
  components: {
    IosAdd,
    IosSettings
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
.icon-class {
  font-size: 25px;
}
.header-class {
  width: 100%;
  margin: 0;
}
</style>
