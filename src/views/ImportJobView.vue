<template>
  <JobsList title="Import Transport Request Jobs" type="Import" />
</template>

<script lang="ts">
import JobsList from '@/components/JobsList.vue'
import { defineComponent } from 'vue'
export default defineComponent({
  components: { JobsList }
})
</script>
