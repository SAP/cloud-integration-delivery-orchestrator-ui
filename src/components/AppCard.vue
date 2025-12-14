<script lang="ts">
import type { AppCount } from '@/service/model';
import { defineComponent, type PropType } from 'vue'
export default defineComponent({
  props: {
    title: String,
    subtitle: String,
    path: String,
    count: {
      type: Object as PropType<AppCount>,
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
    <n-text style="font-size: 14px; font-weight: bolder;">{{ title }}</n-text>
    <div/>

    <n-text depth="3" style="font-size: 14px;" strong>{{ subtitle }}</n-text>

    <div class="">
      {{ count.Total }}
    </div>
    

    <!-- <n-span v-for="(k, i) in Object.entries(count.StatusCounts)" :key="i">
      {{ k[0] }}: <n-text strong>{{ k[1] }}</n-text>
    </n-span> -->

  </n-card>
</template>

<style scoped>
.n-card {
  /* display: grid; */
  /* place-items: center; */
  border-radius: 0.75rem;
  border: .125rem solid #fff;
  width: 11rem;
  height: 11rem;
  font-size: 16px;
  box-shadow: rgba(34, 53, 72, 0.2) 0px 0px 2px 0px;
  outline-color: rgb(19, 30, 41);
}
.header-content {
  height: 3.625rem;
  padding-top: 1rem;
  padding-left: 1rem;
  padding-right: 1rem;
}
.count-content {
  text-align: right; 
  font-size: 36px; 
  padding: 0 16px;
}
.one-by-one {
    width: 11rem;
    height: 11rem;
}
</style>
