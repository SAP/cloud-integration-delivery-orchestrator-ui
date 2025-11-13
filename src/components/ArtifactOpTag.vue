<template>
    <n-tag :key="'sel-' + i + '-' + artOp.ArtifactTechID + '@' + artOp.ArtifactVersion" :type="stageType" size="medium"
        :bordered="false" strong>

        {{ artOp.ArtifactTechID }}@{{ artOp.ArtifactVersion }}
        <n-divider vertical />

        TR: {{ artOp.TransportRequestNumber }}

        <n-popover trigger="hover" placement="top">
            <template #trigger>
                <n-icon size="18" @click.stop="openArtifactDetails(artOp)">
                    <Info16Regular :size="30" />
                </n-icon>
            </template>
            Show Details
        </n-popover>
    </n-tag>
</template>
<script setup lang="ts">
import type { ArtifactTenantOperation, Artifact } from '@/service/model';
import { Info16Regular } from '@vicons/fluent'
import { computed, ref } from 'vue';
const props = defineProps<{
    artOp: ArtifactTenantOperation
    i: number
    stageType: string
}>()

const emit = defineEmits<{
    (e: 'open-artifact-details',artifact: Artifact, op: ArtifactTenantOperation): void
}>()

function openArtifactDetails(op: ArtifactTenantOperation) {
    emit('open-artifact-details', op.Artifact, op)
}

</script>