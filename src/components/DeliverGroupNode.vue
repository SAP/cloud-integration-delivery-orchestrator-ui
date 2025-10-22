<template>
    <div> {{ props.id }}</div>

    <Handle :id="props.id" type="source" :position="Position.Left"/>

</template>

<script setup lang="ts">
import type { CpiTenant } from '@/service/model';
import { Handle, Position } from '@vue-flow/core'
const props = defineProps<{
    id: string
    data: {
        label: string
        sourceNodeId: number
        tenants: CpiTenant[]
    }
}>()

</script>