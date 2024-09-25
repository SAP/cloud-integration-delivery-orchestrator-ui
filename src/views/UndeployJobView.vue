<script lang="ts">
import { defineComponent } from 'vue';
import JobsList from '@/components/JobsList.vue';
export default defineComponent({
    components:{ JobsList }
})
</script>
<template>
    <JobsList title="Undeploy Artifacts" type="Undeploy"/>
</template>