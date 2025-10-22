<template>


</template>

<script setup lang="ts">
import type { CpiTenant } from '@/service/model';
import { Handle, Position, useVueFlow } from '@vue-flow/core'
const props = defineProps<{
    id: string
    data: {
        label: string
        sourceNodeId: number
        tenants: CpiTenant[]
    }
}>()

</script>