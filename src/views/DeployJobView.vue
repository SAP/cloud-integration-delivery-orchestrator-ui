<template>
  <JobsList title="Deploy Artifact Jobs" type="Deploy" />
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import JobsList from '@/components/JobsList.vue'
export default defineComponent({
  components: { JobsList }
})
</script>
