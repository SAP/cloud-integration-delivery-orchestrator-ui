<template>
  <ui5-card :id="props.id" class="deliver-group-card" :loading="loading" :loading-delay="0">
    <ui5-card-header slot="header" :title-text="props.data.label" interactive>
      <ui5-tag v-if="props.data.isSource" slot="action" design="Set2" color-scheme="4">
        Source
      </ui5-tag>
      <ui5-tag v-else color-scheme="Warning" slot="action" :design="aggrDesign">
        {{ groupStateAggr }}
      </ui5-tag>
    </ui5-card-header>
    <div class="card-content">
      <div class="tags-scroll-container">
        <ui5-tag design="Set2" color-scheme="5" v-for="t in props.data.tenants">{{
          t?.Name
        }}</ui5-tag>
      </div>
      <div class="card-footer">
        <ui5-tag v-if="skippedDeployCount > 0" design="Set2" color-scheme="2"
          :title="`${skippedDeployCount} artifact(s) with deploy skipped`">
          {{ skippedDeployCount }} skipped
        </ui5-tag>
        <div v-if="!props.data.isSource" class="compact-button-container">
          <ui5-segmented-button>
            <ui5-segmented-button-item @click="handleImportOnly" :disabled="disableImport"
              >Import Only</ui5-segmented-button-item
            >
            <ui5-segmented-button-item @click="handleDeployOnly" :disabled="disableDeploy"
              >Deploy Only</ui5-segmented-button-item
            >
          </ui5-segmented-button>
        </div>
      </div>
    </div>
  </ui5-card>

  <Handle v-if="!props.data.isTail" type="source" :position="Position.Right" />
  <Handle v-if="!props.data.isSource" type="target" :position="Position.Left" />
</template>

<script setup lang="ts">
import { DeriveNodeAgg, DeriveGroupAgg } from '@/service/api'
import type { ArtifactTenantOperation, CpiTenant } from '@/service/model'
import { aggregateStatusToUi5Design, type AggregateStatus } from '@/service/statuses'
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue'
import '@ui5/webcomponents/dist/Button.js'
import '@ui5/webcomponents/dist/Card.js'
import '@ui5/webcomponents/dist/CardHeader.js'
import '@ui5/webcomponents/dist/Icon.js'
import '@ui5/webcomponents/dist/Tag.js'
import '@ui5/webcomponents/dist/SegmentedButton.js'
import '@ui5/webcomponents/dist/SegmentedButtonItem.js'
const props = defineProps<{
  id: string
  data: {
    label: string
    sourceNodeId: number
    tenants: CpiTenant[]
    isSource: boolean
    isTail: boolean
    tenantToOps: { [key: number]: { [key: string]: ArtifactTenantOperation } }
  }
  loading?: boolean
}>()

const loading = computed(() => props.loading ?? false)

const disableImport = computed(() => {
  return props.data.tenants.every((t) => {
    const trToOps = props.data.tenantToOps[t.ID] || {}
    // "NOT_STARTED" | "QUEUED" | "IMPORT_DISABLED" | "IN_PROGRESS" | "FAILED" | "COMPLETE"
    // // only queued(INITIAL) state can be triggered for import
    return Object.values(trToOps).every(
      (op) => !(op.ImportState === 'QUEUED' || op.ImportState === 'FAILED')
    )
  })
})

const disableDeploy = computed(() => {
  return props.data.tenants.every((t) => {
    const trToOps = props.data.tenantToOps[t.ID] || {}
    // "NOT_STARTED" | "QUEUED" | "IN_PROGRESS" | "FAILED" | "COMPLETE" | "DEPLOY_DISABLED" | "ROLLBACKING" | "ROLLED_BACK"
    return Object.values(trToOps).every(
      (op) => !(op.DeployState === 'QUEUED' || op.DeployState === 'FAILED')
    )
  })
})

const skippedDeployCount = computed(() => {
  let count = 0
  for (const t of props.data.tenants) {
    const trToOps = props.data.tenantToOps[t.ID] || {}
    for (const op of Object.values(trToOps)) {
      if (op.DeployState === 'DEPLOY_DISABLED') count++
    }
  }
  return count
})

const groupStateAggr = computed(() => {
  const tenantStates = Object.entries(props.data.tenantToOps)
    .filter(([tenantID, _]) => props.data.tenants.find((t) => t.ID === Number(tenantID)))
    .map(([_, trToOps]) => {
      return DeriveNodeAgg(Object.values(trToOps))
    })

  return DeriveGroupAgg(tenantStates)
})

const aggrDesign = computed(() => {
  return aggregateStatusToUi5Design(groupStateAggr.value)
})

const emit = defineEmits<{
  (e: 'deliver', payload: { tenantIDs: number[] }): void
  (e: 'import-only', payload: { tenantIDs: number[] }): void
  (e: 'deploy-only', payload: { tenantIDs: number[] }): void
}>()

function handleImportOnly() {
  emit('import-only', { tenantIDs: props.data.tenants.map((t) => t.ID) })
}
function handleDeployOnly() {
  emit('deploy-only', { tenantIDs: props.data.tenants.map((t) => t.ID) })
}
</script>

<style scoped>
/* 让 ui5-card 的内容区域使用相对定位作为参考点 */
.deliver-group-card {
  position: relative;
  height: 200px !important;
}

.card-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  padding-top: 50px; /* 为 header 留出空间 */
}

.tags-scroll-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 16px 8px 16px;
  flex: 1;
  overflow-y: auto;
  box-sizing: border-box;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 4px 16px;
  min-height: 36px;
  flex-shrink: 0;
}

.compact-button-container {
  margin-left: auto;
  transform: scale(0.75);
  transform-origin: right center;
}

/* 使用 CSS 变量来控制 UI5 组件内部样式 */
.compact-button-container ui5-segmented-button {
  --sapFontSize: 0.75rem;
}
</style>
