<template>
    <n-card :title="props.data.label" size="small" style="margin-bottom: 4px;">
        <n-tag v-for="t in props.data.tenants">{{ t?.Name }}</n-tag>

        <n-click @click="handleDeliver">deliver</n-click>
        <n-click @click="handleImportOnly"> import only</n-click>
        <n-click @click="handleDeployOnly"> deploy only</n-click>
    </n-card>

    <Handle type="source" :position="Position.Right"/>
    <Handle v-if="!props.data.isSource" type="target" :position="Position.Left"/>

</template>

<script setup lang="ts">
import type { CpiTenant } from '@/service/model';
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue';
const props = defineProps<{
    id: string
    data: {
        label: string
        sourceNodeId: number
        tenants: CpiTenant[]
        isSource: boolean
    }
}>()

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