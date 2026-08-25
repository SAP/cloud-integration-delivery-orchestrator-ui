<script setup lang="ts">
import type { ArtifactTenantOperation, CpiTenant } from '@/service/model'

import '@ui5/webcomponents/dist/Icon.js'
import '@ui5/webcomponents/dist/Label.js'
import '@ui5/webcomponents/dist/Option.js'
import '@ui5/webcomponents/dist/Select.js'
import '@ui5/webcomponents-icons/dist/arrow-right.js'

type CompareArtifact = Pick<
  ArtifactTenantOperation,
  'ID' | 'ArtifactTechID' | 'ArtifactName' | 'ArtifactVersion'
>
type CompareTenant = Pick<CpiTenant, 'ID' | 'Name'>

defineProps<{
  sourceTenantName: string
  artifacts: CompareArtifact[]
  targetTenants: CompareTenant[]
  selectedArtifactId: string
  selectedTargetTenantId: number
}>()

const emit = defineEmits<{
  (event: 'artifact-change', artifactId: string): void
  (event: 'target-change', tenantId: number): void
}>()

function selectedValue(event: Event): string {
  const customEvent = event as CustomEvent<{
    selectedOption?: { value?: string }
  }>
  return customEvent.detail?.selectedOption?.value ?? ''
}

function onArtifactChange(event: Event) {
  emit('artifact-change', selectedValue(event))
}

function onTargetChange(event: Event) {
  emit('target-change', Number(selectedValue(event)) || 0)
}
</script>

<template>
  <div
    class="compare-selection-scroll"
    role="group"
    aria-label="Code compare selection"
  >
    <div class="compare-selection-bar">
      <div class="compare-source">
        <ui5-label class="compare-label-bold">Source</ui5-label>
        <span class="compare-source-value">{{ sourceTenantName || '—' }}</span>
      </div>

      <div class="compare-selects">
        <div class="compare-field">
          <ui5-label for="code-compare-artifact">Artifact</ui5-label>
          <ui5-select id="code-compare-artifact" accessible-name="Artifact" @change="onArtifactChange">
            <ui5-option
              v-for="(artifact, index) in artifacts"
              :key="artifact.ID"
              :value="artifact.ArtifactTechID"
              :selected="
                artifact.ArtifactTechID === selectedArtifactId
                  || (!selectedArtifactId && index === 0)
              "
            >
              {{ artifact.ArtifactTechID }} - {{ artifact.ArtifactVersion }}
            </ui5-option>
          </ui5-select>
        </div>

        <ui5-icon
          class="compare-arrow"
          name="arrow-right"
          accessible-name="delivers to"
        />

        <div class="compare-field compare-field--target">
          <ui5-label class="compare-label-bold" for="code-compare-target">Target</ui5-label>
          <ui5-select
            id="code-compare-target"
            accessible-name="Target CPI Tenant"
            @change="onTargetChange"
          >
            <ui5-option
              v-for="(tenant, index) in targetTenants"
              :key="tenant.ID"
              :value="String(tenant.ID)"
              :selected="
                tenant.ID === selectedTargetTenantId
                  || (!selectedTargetTenantId && index === 0)
              "
            >
              {{ tenant.Name }}
            </ui5-option>
          </ui5-select>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.compare-selection-scroll {
  overflow-x: auto;
  margin-bottom: 0.75rem;
  border: 1px solid var(--sapGroup_ContentBorderColor, #d5dadd);
  border-radius: 0.5rem;
  background: var(--sapGroup_ContentBackground, #fff);
}

.compare-selection-bar {
  display: flex;
  align-items: center;
  gap: 2rem;
  /* max-width: 36rem; */
  width: 60%;
  padding: 0.75rem 1rem;
}

.compare-source {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.compare-source-value {
  font-size: var(--sapFontSize, 0.875rem);
  color: var(--sapTextColor, #32363a);
}

.compare-selects {
  flex: 1;
  display: grid;
  grid-template-columns: 2fr auto 1fr;
  gap: 0.75rem;
  align-items: end;
}

.compare-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.compare-field ui5-select {
  width: 100%;
}

.compare-label-bold {
  font-weight: 700;
}

.compare-arrow {
  align-self: center;
  justify-self: center;
  width: 1rem;
  height: 1rem;
  color: var(--sapContent_IconColor, #0a6ed1);
}
</style>
