<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Diff2HtmlUI } from 'diff2html/lib-esm/ui/js/diff2html-ui-base'
import 'diff2html/bundles/css/diff2html.min.css'
import '@ui5/webcomponents/dist/Card.js'
import '@ui5/webcomponents/dist/CardHeader.js'
import '@ui5/webcomponents/dist/Button.js'

import type { CompareFileItem } from '@/service/codeCompareFiles'

const props = defineProps<{
  file: CompareFileItem
  outputFormat: 'side-by-side' | 'line-by-line'
  diffMatchStyle: 'word' | 'char'
}>()

const emit = defineEmits<{
  (event: 'open-visual', file: CompareFileItem): void
}>()

const expanded = ref(false)
const diffContainer = ref<HTMLElement | null>(null)
const panelId = `${useId()}-text-diff`

async function renderTextDiff() {
  if (!expanded.value) return

  await nextTick()

  const container = diffContainer.value
  if (!expanded.value || !container) return

  container.replaceChildren()
  new Diff2HtmlUI(container, props.file.patch, {
    outputFormat: props.outputFormat,
    drawFileList: false,
    matching: props.diffMatchStyle === 'word' ? 'words' : 'none',
    diffStyle: props.diffMatchStyle,
    synchronisedScroll: true,
    fileContentToggle: false,
    stickyFileHeaders: true,
    highlight: false,
  }).draw()
}

function toggleTextDiff() {
  expanded.value = !expanded.value

  if (!expanded.value) {
    diffContainer.value?.replaceChildren()
  }
}

watch(
  [
    expanded,
    () => props.outputFormat,
    () => props.diffMatchStyle,
    () => props.file.patch,
  ],
  ([isExpanded]) => {
    if (isExpanded) void renderTextDiff()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  diffContainer.value?.replaceChildren()
})
</script>

<template>
  <ui5-card class="iflow-card">
    <ui5-card-header
      slot="header"
      :title-text="file.path"
      :subtitle-text="file.status.toUpperCase()"
      interactive
      @click="emit('open-visual', file)"
    >
      <ui5-button
        slot="action"
        design="Transparent"
        data-testid="show-text-diff"
        @click.stop="toggleTextDiff"
      >
        {{ expanded ? 'Hide text diff' : 'Show text diff' }}
      </ui5-button>
      <ui5-button
        slot="action"
        design="Emphasized"
        data-testid="open-visual-diff"
        @click.stop="emit('open-visual', file)"
      >
        Open Visual Diff
      </ui5-button>
    </ui5-card-header>

    <div v-if="!expanded" class="collapsed-hint">
      <span class="hint-marker" aria-hidden="true">XML</span>
      <span>Large XML diff hidden — click header or "Open Visual Diff"</span>
    </div>

    <div
      v-if="expanded"
      :id="panelId"
      ref="diffContainer"
      class="text-diff"
      data-testid="text-diff"
      role="region"
      :aria-label="`Text diff for ${file.path}`"
    />
  </ui5-card>
</template>

<style scoped>

.collapsed-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  color: var(--sapContent_LabelColor, #556b82);
  font-size: var(--sapFontSmallSize, 0.75rem);
  line-height: 1.25rem;
}

.hint-marker {
  flex: 0 0 auto;
  padding: 0.125rem 0.375rem;
  color: var(--sapContent_LabelColor, #556b82);
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1rem;
  letter-spacing: 0.04em;
  background: var(--sapList_AlternatingBackground, #f5f6f7);
  border: 1px solid var(--sapList_BorderColor, #d9d9d9);
  border-radius: 0.125rem;
}

.text-diff {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.75rem;
}
</style>
