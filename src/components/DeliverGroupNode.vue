<template>
    <div> {{ props.data.label }}</div>
    
    <n-text v-for="t in props.data.tenants">{{ t.Name }}</n-text>



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


const handlerType = computed(() => {
    return props.data.isSource ? 'source' : 'target'
})

const handlerPosition = computed(() => {
    return props.data.isSource ? Position.Right : Position.Left
})

</script>