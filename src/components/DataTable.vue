<template>
  <ui5-bar design="Header">
    <ui5-text slot="startContent" class="table-header">{{ title }} ({{ counts }}{{ total != null ? ' / ' + total : '' }})</ui5-text>
    <ui5-segmented-button id="sizeBtn" accessible-name="Switch Table Size">
      <ui5-segmented-button-item @click="tableWidth = '25%'">25%</ui5-segmented-button-item>
      <ui5-segmented-button-item @click="tableWidth = '50%'">50%</ui5-segmented-button-item>
      <ui5-segmented-button-item @click="tableWidth = '75%'">75%</ui5-segmented-button-item>
      <ui5-segmented-button-item selected @click="tableWidth = '100%'">100%</ui5-segmented-button-item>
    </ui5-segmented-button>
    <div slot="endContent">
      <ui5-button @click="handleAdd(data)" v-if="handleAdd" design="Transparent">Create</ui5-button>
      <ui5-button v-for="(tool, i) in customToolBars" :key="i"
        @click="tool.func(checkedRows)" design="Transparent">
        {{ tool.text }}
      </ui5-button>


      <ui5-segmented-button id="showHideDetailsBtn" accessible-name="Show/Hide Details" style="margin-left: 20px;">
        <ui5-segmented-button-item @click="handlePopinToggle(false)" tooltip="Show Details" icon="detail-more" />
        <ui5-segmented-button-item @click="handlePopinToggle(true)" tooltip="Hide Details" icon="detail-less"
          selected />
      </ui5-segmented-button>

    </div>
  </ui5-bar>
  <ui5-table overflow-mode="Popin" :class="{ 'table-growing': growing }" :style="{ width: tableWidth }" @row-click="handleRowClick"
    :loading="loading" loading-delay="0"
    :row-action-count="rowActionCount">
    <ui5-table-selection-single v-if="selectable" id="selection" slot="features" @change="handleCheck"></ui5-table-selection-single>
    <ui5-table-growing v-if="growing" slot="features" mode="Scroll" :style="{ display: hasMore ? '' : 'none' }" @load-more="handleLoadMore"></ui5-table-growing>
    <ui5-illustrated-message slot="noData" name="NoData"></ui5-illustrated-message>
    <ui5-table-header-row slot="headerRow">
      <ui5-table-header-cell min-width="150px" v-for="(header, i) in displayColumns" :key="`header-key-${i}`"
        :id="headerId(header, i)" popin-hidden>
        <span>{{ headerText(header) }}</span>
      </ui5-table-header-cell>
    </ui5-table-header-row>
    <ui5-table-row v-for="(row, rKey) in data" :key="`rKey-${rKey}`" :row-key="rKey" interactive>
      <ui5-table-cell v-for="(col, colKey) in rowData(row)" :key="`colKey-${colKey}`">
        <VNodeRenderer v-if="isVNodeVal(col)" :vnode="col" />
        <span v-else>{{ col }}</span>
      </ui5-table-cell>
      <ui5-table-row-action-navigation v-if="rowClick" slot="actions" interactive></ui5-table-row-action-navigation>
      <template v-for="(action, aIndex) in rowActions" :key="`action-${rKey}-${aIndex}`">
        <component
          :is="action.render()"
          slot="actions"
          @click="handleRowAction(action, row)">
        </component>
      </template>
    </ui5-table-row>
  </ui5-table>
</template>

<script lang="ts">
import { defineComponent, reactive, isVNode, type HTMLAttributes, type PropType } from 'vue'
// Helper component to render VNodes returned from column.render
const VNodeRenderer = defineComponent({
  name: 'VNodeRenderer',
  props: {
    vnode: { type: Object, required: true }
  },
  render() {
    return this.$props.vnode
  }
})
import { type ToolBar, type RowAction, type Column } from '@/service/consts'
import "@ui5/webcomponents/dist/Table.js";
import "@ui5/webcomponents/dist/TableRow.js";
import "@ui5/webcomponents/dist/TableCell.js";
import "@ui5/webcomponents/dist/TableHeaderRow.js";
import "@ui5/webcomponents/dist/TableHeaderCell.js";
import "@ui5/webcomponents/dist/Label.js";
import "@ui5/webcomponents/dist/SegmentedButton.js";
import "@ui5/webcomponents-icons/dist/detail-more.js";
import "@ui5/webcomponents-icons/dist/detail-less.js";
import "@ui5/webcomponents/dist/Bar.js";
import "@ui5/webcomponents/dist/Input.js";
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/TableSelectionSingle.js";
import "@ui5/webcomponents/dist/TableGrowing.js";
import "@ui5/webcomponents-fiori/dist/IllustratedMessage.js";
import "@ui5/webcomponents-fiori/dist/illustrations/NoData.js";
import "@ui5/webcomponents/dist/TableRowAction.js";
import "@ui5/webcomponents/dist/TableRowActionNavigation.js";

export default defineComponent({
  components: { VNodeRenderer },
  props: {
    title: { type: String, required: true },
    columns: { type: Array as PropType<Column[]>, required: true },
    data: { type: Array, required: true },
    rowKey: { required: true },
    defaultCheckedRowKeys: { type: Array<string | number> },
    customToolBars: { type: Array<ToolBar> },
    handleAdd: { type: Function },
    loading: { type: Boolean },
    enableSearch: { type: Boolean, default: true },
    rowClick: { type: Function as PropType<(row: any) => void> },
    rowActions: { type: Array as PropType<RowAction[]> },
    selectable: { type: Boolean, default: true },
    growing: { type: Boolean, default: false },
    // Total number of rows available on the server (not just the loaded page).
    // When provided, the header shows "loaded / total" and, once all rows are
    // loaded (data.length >= total), the growing element is visually hidden via
    // CSS (display:none) so the fallback "More" button disappears. The element
    // itself is NEVER unmounted while growing is enabled: ui5-table only
    // activates features (onTableActivate) once, in the table's onEnterDOM, so a
    // later-mounted growing feature would never get its scroll IntersectionObserver
    // attached. When omitted, growing behaves as before (always shown).
    total: { type: Number, default: undefined }
  },
  data() {
    const rowProps = (row: any) => {
      return {
        style: 'cursor: pointer;',
        onClick: () => {
          this.rowClick && this.rowClick(row)
        }
      } as HTMLAttributes
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
    const checkedRowKeysRef: any[] = []
    const checkedRows: any[] = []
    const disableButton = true
    const tableWidth = '100%'
    return {
      rowProps,
      disableButton,
      checkedRowKeysRef,
      checkedRows,
      paginationReactive,
      tableWidth
    }
  },
  methods: {
    isVNodeVal(v: any) {
      return isVNode(v)
    },
    headerId(header: any, i: number) {
      const h = header as any
      return `header-id-${h?.key ?? i}`
    },
    headerText(header: any) {
      const h = header as any
      return h?.title ?? h?.key ?? ''
    },
    handleRowClick(event: any) {
      const rkey = event.detail.row.rowKey
      this.data[rkey] && this.rowClick && this.rowClick(this.data[rkey])
    },
    handleLoadMore() {
      this.$emit('loadMore')
    },
    handleRowAction(action: RowAction, row: any) {
      action.func(row)
    },
    handlePopinToggle(hidden: boolean) {
      const headerIds = (this.displayColumns as any[]).map((header: any, i: number) => `header-id-${header?.key ?? i}`)
      headerIds.forEach((id) => {
        const headerEl = document.getElementById(id) as any
        if (headerEl) headerEl.popinHidden = hidden
      })
    },
    rowData(row: any) {
      // Map visible (non-selection) columns to rendered VNode or text value
      return (this.displayColumns as any[]).map((column: any) => {
        if (typeof column?.render === 'function') {
          try {
            return column.render(row)
          } catch (e) {
            return ''
          }
        }
        const key = column?.key
        if (!key) return ''
        const val = (row as any)[key]
        if (val === undefined || val === null) return ''
        return this.isPrimitive(val) ? String(val) : JSON.stringify(val)
      })
    },
    handleCheck(event: any) {
      const selectionFeature = document.getElementById("selection") as any;
      const row = selectionFeature?.getSelectedRow?.();
      if (!row) return;
      const rowKey = row.rowKey;
      const rowData = this.data[rowKey];

      this.checkedRowKeysRef = [rowKey];
      this.checkedRows = [rowData];
      this.$emit('update:checkRows', this.checkedRows);
    },
    handleInputSearch(v: string) {
      this.doFilter(v.split(/[\s,]+/).filter((v) => v != ''))
    },
    handleClearSearch(v: string) { },
    doFilter(v: string[]) {
      ; (this.columns as any[]).forEach((column: any) => {
        column.filter = (_value: any, row: any) => {
          const vat = Object.values(row)
            .filter((v) => this.isPrimitive(v))
            .join()
          for (const value of v) {
            if (vat.toLowerCase().includes(value.toLowerCase())) {
              return true
            }
          }
          return false
        }
        column.filterOptionValue = v as any
      })
    },
    isPrimitive(value: any) {
      const type = typeof value
      return value === null || (type !== 'object' && type !== 'function')
    },
    doSorter() {
      const st = new Set(this.defaultCheckedRowKeys as any)
        ; (this.columns as any[]).forEach((column: any) => {
          if (!column.sortOrder) return
          column.sorter = (row1: any, row2: any) => {
            const keyFn = this.rowKey as any
            const a = st.has(keyFn(row1)) ? 1 : 0
            const b = st.has(keyFn(row2)) ? 1 : 0
            return a - b
          }
          column.sortOrder = 'descend'
        })
    }
  },
  emits: ['update:checkRows', 'update:edit', 'loadMore'],
  computed: {
    counts() {
      return this.data.length
    },
    hasMore(): boolean {
      // No server total supplied → preserve legacy behavior (always allow growing).
      if (this.total == null) return true
      return this.data.length < this.total
    },
    displayColumns(): any[] {
      return (this.columns as any[]).filter((c: any) => c?.type !== 'selection')
    },
    rowActionCount(): number {
      let count = this.rowClick ? 1 : 0
      if (this.rowActions) {
        count += this.rowActions.length
      }
      return count
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
.table-header {
  font-family: var(--sapFontBoldFamily);
  font-size: var(--sapFontLargeSize);
}
.table-growing {
  max-height: 70vh;
  overflow: auto;
}
</style>
