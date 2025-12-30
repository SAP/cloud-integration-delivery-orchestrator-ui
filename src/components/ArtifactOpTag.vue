<template>
    <ui5-tag 
        :id="`sel-${i}-${artOp.ArtifactTechID}@${artOp.ArtifactVersion}`" 
        :key="`sel-${i}-${artOp.ArtifactTechID}@${artOp.ArtifactVersion}`"
        design="Set2"
        :color-scheme="stageType"
        @click.stop="openArtifactDetails(artOp)"
        interactive>

        {{ artOp.ArtifactTechID }}@{{ artOp.ArtifactVersion }}
        -
        TR: {{ artOp.TransportRequestNumber }}
    </ui5-tag>
</template>
<script setup lang="ts">
import type { ArtifactTenantOperation, Artifact } from '@/service/model';
import "@ui5/webcomponents/dist/Tag.js";

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