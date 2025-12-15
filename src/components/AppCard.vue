<script lang="ts">
import type { AppCount } from '@/service/model';
import { defineComponent, type PropType } from 'vue'
import "@ui5/webcomponents/dist/Card.js";
import "@ui5/webcomponents/dist/CardHeader.js";
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
  <div>
    <ui5-card @click="jumpTo">
      <ui5-card-header slot="header" :title-text="title" :subtitle-text="subtitle" interactive>
      </ui5-card-header>
      <ui5-text style="color: var(--sapPositiveColor); font-size: 2rem;">{{ count.Total || 0 }}</ui5-text>
      <ui5-text class=""> Total</ui5-text>

      <span v-for="key in Object.keys(count.StatusCounts || {})" :key="key">
        <span v-if="count.StatusCounts?.[key]" style="margin-left: 10px;">
          <ui5-text :style="{ color: 'var(--sapCriticalColor)', fontSize: '1.25rem' }">
            {{ count.StatusCounts?.[key]}}
          </ui5-text>
          {{ key }}
        </span>

      </span>

    </ui5-card>
  </div>

</template>

<style scoped>
ui5-card {
  width: 11rem;
  height: 11rem;
}
</style>
