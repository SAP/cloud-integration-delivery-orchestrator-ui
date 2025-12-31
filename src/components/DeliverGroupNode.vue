<template>
    <ui5-card :id="props.id" style="height: 100%; width: 100%;">
        <ui5-card-header slot="header" :title-text="props.data.label" interactive>
          <ui5-tag v-if="props.data.isSource" slot="action" design="Set2" color-scheme="4"> Source </ui5-tag>
          <ui5-tag v-else color-scheme="Warning" slot="action" :design="aggrDesign" > {{ groupStateAggr }} </ui5-tag>
        </ui5-card-header>
        <div class="card-content">
          <div class="tags-scroll-container">
            <ui5-tag design="Set2" color-scheme="5" v-for="t in props.data.tenants">{{ t?.Name }}</ui5-tag>
          </div>
          <div v-if="!props.data.isSource" class="compact-button-container">
            <ui5-segmented-button>
              <ui5-segmented-button-item @click="handleDeliver">Deliver</ui5-segmented-button-item>
              <ui5-segmented-button-item @click="handleImportOnly" :disabled="disableImport">Import Only</ui5-segmented-button-item>
              <ui5-segmented-button-item @click="handleDeployOnly" :disabled="disableDeploy">Deploy Only</ui5-segmented-button-item>
            </ui5-segmented-button>
          </div>
        </div>

    </ui5-card>


    <Handle v-if="!props.data.isTail" type="source" :position="Position.Right"/>
    <Handle v-if="!props.data.isSource" type="target" :position="Position.Left"/>

</template>

<script setup lang="ts">
import { DeriveNodeAgg } from '@/service/api';
import type { ArtifactTenantOperation, CpiTenant } from '@/service/model';
import { aggregateStatusToUi5Design, type AggregateStatus } from '@/service/statuses';
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue';
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/Card.js";
import "@ui5/webcomponents/dist/CardHeader.js";
import "@ui5/webcomponents/dist/Icon.js";
import "@ui5/webcomponents/dist/Tag.js";
import "@ui5/webcomponents/dist/SegmentedButton.js";
import "@ui5/webcomponents/dist/SegmentedButtonItem.js";
const props = defineProps<{
    id: string
    data: {
        label: string
        sourceNodeId: number
        tenants: CpiTenant[]
        isSource: boolean,
        isTail: boolean,
        tenantToOps: { [key: number]: { [key: string]: ArtifactTenantOperation }}
    }
}>()

const disableImport = computed(() => {
  return props.data.tenants.every(t => {
    const trToOps = props.data.tenantToOps[t.ID] || {}
    // "NOT_STARTED" | "QUEUED" | "IMPORT_DISABLED" | "IN_PROGRESS" | "FAILED" | "COMPLETE"
    // // only queued(INITIAL) state can be triggered for import
    return Object.values(trToOps).every(op => !(op.ImportState === 'QUEUED' || op.ImportState === 'FAILED'))
  })
})

const disableDeploy = computed(() => {
  return props.data.tenants.every(t => {
    const trToOps = props.data.tenantToOps[t.ID] || {}
    // "NOT_STARTED" | "QUEUED" | "IN_PROGRESS" | "FAILED" | "COMPLETE" | "DEPLOY_DISABLED" | "ROLLBACKING" | "ROLLED_BACK"
    return Object.values(trToOps).every(op => !(op.DeployState === 'QUEUED' || op.DeployState === 'FAILED'))
  })
})

const groupStateAggr = computed(() => {
  const tenantStates = Object.entries(props.data.tenantToOps)
    .filter(([tenantID, _]) => props.data.tenants.find(t => t.ID === Number(tenantID)) )
    .map(([_, trToOps]) => {
      return DeriveNodeAgg(Object.values(trToOps))
    })
    if (tenantStates.length === 0) return 'UNKNOWN'
    const order: AggregateStatus[] = [
      'UNKNOWN',
      'PENDING',
      'WAITING_APPROVAL',
      'AWAITING_IMPORT',
      'IMPORTING',
      'IMPORT_FAILED',
      'IMPORTED',
      'AWAITING_DEPLOY',
      'DEPLOYING',
      'DEPLOY_FAILED',
      'DEPLOYED',
      'ROLLBACKING',
      'ROLLED_BACK',
      'CANCELED',
      'Error',
    ]
    const rank = (s: AggregateStatus) => order.indexOf(s)
    const overall = tenantStates.reduce((acc, cur) => {
      return rank(cur as AggregateStatus) > rank(acc as AggregateStatus)
      ? (cur as AggregateStatus)
      : (acc as AggregateStatus)
    }) as AggregateStatus

    return overall
})

const aggrDesign = computed(() =>{
  return aggregateStatusToUi5Design(groupStateAggr.value)
})

const emit = defineEmits<{
  (e: 'deliver', payload: { tenantIDs: number[] }): void
  (e: 'import-only', payload: { tenantIDs: number[] }): void
  (e: 'deploy-only', payload: { tenantIDs: number[] }): void
}>()

function handleDeliver() {
  emit('deliver', {tenantIDs: props.data.tenants.map(t => t.ID)})
}
function handleImportOnly() {
  emit('import-only', {tenantIDs: props.data.tenants.map(t => t.ID)})
}
function handleDeployOnly() {
  emit('deploy-only',{tenantIDs: props.data.tenants.map(t => t.ID)})
}

</script>

<style scoped>
.card-content {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  overflow: hidden;
}

.tags-scroll-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 16px;
  max-height: 100px;
  overflow-y: auto;
  box-sizing: border-box;
}

.compact-button-container {
  transform: scale(0.75);
}

/* 使用 CSS 变量来控制 UI5 组件内部样式 */
.compact-button-container ui5-segmented-button {
  --sapFontSize: 0.75rem;
}
</style>