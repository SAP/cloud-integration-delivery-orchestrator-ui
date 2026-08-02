<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Diff2HtmlUI } from 'diff2html/lib-esm/ui/js/diff2html-ui-base'
import 'diff2html/bundles/css/diff2html.min.css'
import '@ui5/webcomponents/dist/Panel.js'
import '@ui5/webcomponents/dist/Button.js'
import '@ui5/webcomponents/dist/Label.js'

import type { CompareFileItem } from '@/service/codeCompareFiles'

const props = defineProps<{
  file: CompareFileItem
  outputFormat: 'side-by-side' | 'line-by-line'
  diffMatchStyle: 'word' | 'char'
}>()

const emit = defineEmits<{
  (event: 'open-visual', file: CompareFileItem): void
}>()

const loaded = ref(false)
const diffContainer = ref<HTMLElement | null>(null)
const panelId = `${useId()}-text-diff`

async function renderTextDiff() {
  await nextTick()

  const container = diffContainer.value
  if (!container) return

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

function loadDiff() {
  loaded.value = true
}

watch(
  [
    () => props.outputFormat,
    () => props.diffMatchStyle,
    () => props.file.patch,
  ],
  () => {
    if (loaded.value) void renderTextDiff()
  },
  { flush: 'post' },
)

watch(loaded, (val) => {
  if (val) void renderTextDiff()
}, { flush: 'post' })

onBeforeUnmount(() => {
  diffContainer.value?.replaceChildren()
})
</script>

<template>
  <ui5-panel
    :collapsed="false"
  >
    <div slot="header" class="panel-header">
      <div class="panel-header__info">
        <ui5-label class="panel-header__path">{{ file.path }}</ui5-label>
        <ui5-label class="panel-header__status">
          {{ file.status.toUpperCase() }}
        </ui5-label>
      </div>
      <ui5-button
        design="Emphasized"
        @click.stop="emit('open-visual', file)"
      >
        Open Visual Diff
      </ui5-button>
    </div>

    <div v-if="!loaded" class="load-diff-placeholder">
      <ui5-button design="Transparent" class="load-diff-btn" @click="loadDiff">
        Load Diff
      </ui5-button>
      <span class="load-diff-hint">Large diffs are not rendered by default.</span>
    </div>

    <div
      v-else
      :id="panelId"
      ref="diffContainer"
      class="text-diff"
      role="region"
      :aria-label="`Text diff for ${file.path}`"
    />
  </ui5-panel>
</template>

<style scoped>
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 1rem;
}

.panel-header__info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.panel-header__path {
  font-weight: 700;
}

.panel-header__status {
  font-size: var(--sapFontSmallSize, 0.75rem);
  color: var(--sapContent_LabelColor, #556b82);
}

.load-diff-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
}

.load-diff-btn {
  font-weight: 700;
  font-size: var(--sapFontLargeSize, 1rem);
}

.load-diff-hint {
  color: var(--sapContent_LabelColor, #556b82);
  font-size: var(--sapFontSize, 0.875rem);
}

.text-diff {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.75rem;
}
</style>
