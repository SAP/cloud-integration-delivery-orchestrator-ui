<script lang="ts">
import { defineComponent } from 'vue'
import "@ui5/webcomponents/dist/Dialog.js"
import "@ui5/webcomponents/dist/MessageStrip.js"
import "@ui5/webcomponents/dist/Toolbar.js"
import "@ui5/webcomponents/dist/ToolbarButton.js"

export default defineComponent({
  props: {
    open: { type: Boolean, required: true },
    name: { type: String, default: '' },
  },
  emits: ['confirm', 'close'],
})
</script>

<template>
  <ui5-dialog header-text="Delete Delivery Request" :open="open"
    @close="$emit('close')">
    <div style="padding: 1rem; display: flex; flex-direction: column; gap: 12px;">
      <ui5-message-strip design="Negative" hide-close-button>
        This will permanently delete "{{ name }}".
        This action cannot be undone.
      </ui5-message-strip>
    </div>
    <ui5-toolbar slot="footer">
      <ui5-toolbar-button design="Negative" text="Delete"
        @click="$emit('confirm')" />
      <ui5-toolbar-button class="dialogCloser" design="Transparent" text="Close"
        @click="$emit('close')" />
    </ui5-toolbar>
  </ui5-dialog>
</template>
