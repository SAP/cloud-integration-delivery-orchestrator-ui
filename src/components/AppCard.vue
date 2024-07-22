<script>
import { defineComponent } from 'vue'
export default defineComponent({
  props: {
    title: String,
    path: String
  },
  methods: {
    jumpTo() {
      this.$router.push(this.path)
    }
  }
})
</script>

<template>
  <n-card hoverable size="huge" :title="title" header-class="headerCla" @click="jumpTo">
    10
  </n-card>
</template>

<style>
.n-card {
  display: grid;
  place-items: center;
  border-radius: 0.25rem;
  width: 176px;
  height: 176px;
}
.headerCla {
}
</style>
