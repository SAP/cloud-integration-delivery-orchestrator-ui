<template>
    <n-card :title="props.data.label" size="small" style="height: 100%; width: 100%;">
        <template #header-extra>
          <n-tag v-if="props.data.isSource" type="info" size="small" :bordered="false">Source</n-tag>
          <n-tag v-else :type="'warning'" size="small" :bordered="false">{{ groupStateAggr }}</n-tag>
        </template>
        <n-tag v-for="t in props.data.tenants">{{ t?.Name }}</n-tag>
        <n-flex v-if="!props.data.isSource" style="margin-top: 10px;" :size="[2, 0]">
          <n-button strong quaternary type="info" @click="handleDeliver">Deliver</n-button>
          <n-button quaternary type="info" @click="handleImportOnly"> Import Only</n-button>
          <n-button quaternary type="info" @click="handleDeployOnly"> Deploy Only</n-button>
        </n-flex>
    </n-card>


    <Handle v-if="!props.data.isTail" type="source" :position="Position.Right"/>
    <Handle v-if="!props.data.isSource" type="target" :position="Position.Left"/>

</template>

<script setup lang="ts">
import { DeriveNodeAgg } from '@/service/api';
import type { ArtifactTenantOperation, CpiTenant } from '@/service/model';
import type { AggregateStatus } from '@/service/statuses';
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue';
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