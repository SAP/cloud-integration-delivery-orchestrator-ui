<template>
  <n-flex vertical align="start">
    <n-flex justify="space-between" class="header-class">
      <h3>{{ title }} ({{ counts }})</h3>
      <n-flex style="margin: auto 0">
        <!-- custom toolbars -->
        <n-button
          quaternary
          type="info"
          v-for="(tool, index) in customToolBars"
          :key="index"
          @click="tool.func(checkedRows)"
        >
          {{ tool.text }}
        </n-button>

        <!-- add toolbar -->
        <n-button
          quaternary
          type="info"
          class="icon-class"
          @click="handleAdd(data)"
          v-if="handleAdd"
        >
          <n-icon><IosAdd /> </n-icon>
        </n-button>
      </n-flex>
    </n-flex>
    <n-input
      @input="handleInputSearch"
      @clear="handleClearSearch"
      placeholder="Search. Split with ',' or space"
      clearable
      size="large"
      v-if="enableSearch"
    />

    <n-data-table
      ref="tableRef"
      :columns="columns"
      :data="data"
      :row-props="rowProps"
      size="small"
      :row-key="rowKey"
      @update:checked-row-keys="handleCheck"
      :default-checked-row-keys="defaultCheckedRowKeys"
      striped
      :loading="loading"
      :pagination="paginationReactive"
    />
  </n-flex>
</template>

<script lang="ts">
import { defineComponent, h, reactive, type PropType } from 'vue'
import { type ToolBar } from '@/service/consts'
import type {
  DataTableBaseColumn,
  DataTableColumns,
  DataTableFilterState,
  DataTableRowKey
} from 'naive-ui'
import { IosAdd, IosSettings } from '@vicons/ionicons4'
import type { TableBaseColumn, TableColumn } from 'naive-ui/es/data-table/src/interface'

export default defineComponent({
  props: {
    title: { type: String, required: true },
    columns: { type: Object as PropType<DataTableColumns>, required: true },
    data: { type: Array, required: true },
    rowKey: { required: true },
    defaultCheckedRowKeys: { type: Array<string | number> },
    customToolBars: { type: Array<ToolBar> },
    handleAdd: { type: Function },
    loading: { type: Boolean },
    enableSearch: { type: Boolean, default: true }
  },
  data() {
    const rowProps = (row: Object) => {
      return {
        style: 'cursor: pointer;',
        onClick: () => {
          // console.log(row)
        }
      }
    }
    const paginationReactive = reactive({
      page: 1,
      pageSize: 10,
      showSizePicker: true,
      pageSizes: [3, 5, 7, 10],
      onChange: (page: number) => {
        paginationReactive.page = page
      },
      onUpdatePageSize: (pageSize: number) => {
        paginationReactive.pageSize = pageSize
        paginationReactive.page = 1
      }
    })

    const checkedRowKeysRef: DataTableRowKey[] = []
    const checkedRows: DataTableColumns = []
    const disableButton = true
    return {
      rowProps,
      disableButton,
      checkedRowKeysRef,
      checkedRows,
      paginationReactive
    }
  },
  methods: {
    handleCheck(rowKeys: DataTableRowKey[], rows: DataTableColumns) {
      this.checkedRowKeysRef = rowKeys
      this.checkedRows = rows
      this.disableButton = !rows.length
      this.$emit('update:checkRows', rows)
    },
    handleInputSearch(v: string) {
      this.doFilter(v.split(/[\s,]+/).filter((v) => v != ''))
    },
    handleClearSearch(v: string) {},
    doFilter(v: string[]) {
      this.columns.forEach((column: DataTableBaseColumn) => {
        column.filter = (value, row) => {
          const vat = Object.values(row)
            .filter((v) => this.isPrimitive(v))
            .join()
          for (value of v) {
            if (vat.toLowerCase().includes(value.toLowerCase())) {
              return true
            }
          }
          return false
        }
        column.filterOptionValue = v
      })
    },
    isPrimitive(value) {
      const type = typeof value
      return value === null || (type !== 'object' && type !== 'function')
    },
    doSorter() {
      const st = new Set(this.defaultCheckedRowKeys)
      this.columns.forEach((column: DataTableBaseColumn) => {
        if (!column.sortOrder) return
        column.sorter = (row1, row2) => {
          const key = this.rowKey
          const a = st.has(key(row1)) ? 1 : 0
          const b = st.has(key(row2)) ? 1 : 0
          return a - b
        }
        column.sortOrder = 'descend'
      })
    }
  },
  emits: ['update:checkRows', 'update:edit'],
  components: {
    IosAdd
  },
  computed: {
    counts() {
      return this.data.length
    }
  },
  mounted() {
    this.doSorter()
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
.icon-class {
  font-size: 25px;
}
.header-class {
  width: 100%;
  margin: 0;
}
</style>
