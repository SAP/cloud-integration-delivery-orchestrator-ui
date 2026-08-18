<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Diff2HtmlUI } from 'diff2html/lib-esm/ui/js/diff2html-ui-base'
import 'diff2html/bundles/css/diff2html.min.css'
import '@ui5/webcomponents/dist/Panel.js'
import '@ui5/webcomponents/dist/Button.js'
import '@ui5/webcomponents/dist/Label.js'
import '@ui5/webcomponents-icons/dist/ai.js'

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
    </div>

    <div v-if="!loaded" class="load-diff-placeholder">
      <div class="load-diff-actions">
        <ui5-button design="Transparent" class="load-diff-btn" @click="loadDiff">
          Text Diff
        </ui5-button>
        <div class="load-diff-divider" />
        <ui5-button class="load-diff-btn" design="Transparent" icon="ai" @click.stop="emit('open-visual', file)">
          Visual Diff
        </ui5-button>
      </div>

      <ui5-label>IFlow comparisons load on demand - Choose Text Diff or Visual Diff.</ui5-label>
    </div>

    <div v-else 
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

.load-diff-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.load-diff-divider {
  width: 1px;
  height: 1.25rem;
  background: var(--sapGroup_ContentBorderColor, #d5dadd);
}

.load-diff-btn {
  font-weight: 700;
  font-size: var(--sapFontLargeSize, 1rem);
}


.text-diff {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.75rem;
}
</style>
