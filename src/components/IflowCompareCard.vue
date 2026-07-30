<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Diff2HtmlUI } from 'diff2html/lib-esm/ui/js/diff2html-ui-base'
import 'diff2html/bundles/css/diff2html.min.css'
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
  <section
    class="iflow-compare-card"
    :aria-label="`${file.path} comparison`"
  >
    <header class="card-header">
      <div class="file-heading">
        <span class="file-kind" aria-hidden="true">IFLW</span>
        <h3 class="file-path">{{ file.path }}</h3>
        <span
          class="status-badge"
          :class="`status-badge--${file.status}`"
        >
          {{ file.status }}
        </span>
      </div>

      <div class="card-actions">
        <ui5-button
          design="Transparent"
          data-testid="show-text-diff"
          :accessibility-attributes.camel="{ expanded, controls: panelId }"
          @click="toggleTextDiff"
        >
          {{ expanded ? 'Hide text diff' : 'Show text diff' }}
        </ui5-button>
        <ui5-button
          design="Emphasized"
          data-testid="open-visual-diff"
          @click="emit('open-visual', file)"
        >
          Open Visual Diff
        </ui5-button>
      </div>
    </header>

    <p v-if="!expanded" class="collapsed-hint">
      <span class="hint-marker" aria-hidden="true">XML</span>
      <span>Large XML diff hidden</span>
    </p>

    <div
      v-if="expanded"
      :id="panelId"
      ref="diffContainer"
      class="text-diff"
      data-testid="text-diff"
      role="region"
      :aria-label="`Text diff for ${file.path}`"
    />
  </section>
</template>

<style scoped>
.iflow-compare-card {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  color: var(--sapTextColor, #1d2d3e);
  background: var(--sapGroup_ContentBackground, #fff);
  border: 1px solid var(--sapGroup_ContentBorderColor, #d9d9d9);
  border-radius: var(--sapElement_BorderCornerRadius, 0.25rem);
}

.iflow-compare-card:focus-within {
  border-color: var(--sapContent_FocusColor, #0064d9);
  box-shadow: inset 0 0 0 1px var(--sapContent_FocusColor, #0064d9);
}

.card-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  padding: 0.75rem 1rem;
}

.file-heading {
  display: flex;
  flex: 1 1 24rem;
  align-items: center;
  min-width: 0;
  gap: 0.625rem;
}

.file-kind,
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

.file-path {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--sapFontSize, 0.875rem);
  font-weight: 600;
  line-height: 1.25rem;
}

.status-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  min-height: 1.25rem;
  padding: 0 0.4375rem;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
  border: 1px solid currentColor;
  border-radius: 0.125rem;
}

.status-badge--added {
  color: var(--sapPositiveColor, #188918);
  background: var(--sapPositiveBackground, #f5fae5);
}

.status-badge--deleted {
  color: var(--sapNegativeColor, #aa0808);
  background: var(--sapNegativeBackground, #ffeaf4);
}

.status-badge--modified {
  color: var(--sapCriticalColor, #b95100);
  background: var(--sapCriticalBackground, #fef7f1);
}

.card-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-left: auto;
}

.collapsed-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.625rem 1rem;
  color: var(--sapContent_LabelColor, #556b82);
  font-size: var(--sapFontSmallSize, 0.75rem);
  line-height: 1.25rem;
  background: var(--sapList_AlternatingBackground, #f7f8f9);
  border-top: 1px solid var(--sapList_BorderColor, #e5e5e5);
}

.text-diff {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.75rem;
  border-top: 1px solid var(--sapList_BorderColor, #e5e5e5);
}

@media (max-width: 44rem) {
  .card-header {
    align-items: stretch;
  }

  .file-heading,
  .card-actions {
    flex-basis: 100%;
  }

  .card-actions {
    justify-content: flex-start;
    margin-left: 0;
  }
}
</style>
