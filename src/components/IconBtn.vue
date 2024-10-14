<template>
  <n-tooltip trigger="hover">
    {{ tip }}
    <template #trigger>
      <n-button :disabled="disabled" @click="handler" quaternary>
        <template #icon>
          <n-icon color="#0e7a0d" size="20">
            <slot></slot>
          </n-icon>
        </template>
      </n-button>
    </template>
  </n-tooltip>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
  props: {
    tip: { type: String, required: true },
    handler: { type: Function },
    disabled: { type: Boolean }
  }
})
</script>
