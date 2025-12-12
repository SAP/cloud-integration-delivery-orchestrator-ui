<script lang="ts">
import { defineComponent, type PropType } from 'vue'
export default defineComponent({
  props: {
    title: String,
    subtitle: String,
    path: String,
    count: {
      type: Object as PropType<{ [key: string]: number }>,
      required: false,
      default: () => ({})
    }
  },
  methods: {
    jumpTo() {
      this.$router.push(this.path as string)
    }
  }
})
</script>

<template>
  <n-card hoverable size="huge" content-style="padding:16px 16px 0px 16px" footer-style="padding: auto" @click="jumpTo">
    <!-- <template #header>
      <n-text></n-text>
    </template> -->
    <n-text style="font-size: 15px;font-weight: bolder;">{{ title }}</n-text>
    <div/>
    <n-text depth="3" strong>{{ subtitle }}</n-text>
    <template #footer>
      <n-space vertical size="4">
        <n-text
          v-for="(value, key) in count"
          :key="key"
          depth="3"
          strong
        >{{ key }}: {{ value }}</n-text>
      </n-space>
    </template>
  </n-card>
</template>

<style scoped>
.n-card {
  /* display: grid; */
  /* place-items: center; */
  border-radius: 0.75rem;
  border: .125rem solid #fff;
  width: 176px;
  height: 176px;
  box-shadow: 0 0 0.125rem 0 rgba(85,107,130,0.16),0 0.125rem 0.25rem 0 rgba(85,107,130,0.16)
}
</style>
