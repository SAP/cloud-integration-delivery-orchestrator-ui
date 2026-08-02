<script setup lang="ts">
import type { ArtifactTenantOperation, CpiTenant } from '@/service/model'

import '@ui5/webcomponents/dist/Icon.js'
import '@ui5/webcomponents/dist/Input.js'
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
      <div
        class="compare-selection-field compare-selection-field--source"
        data-testid="compare-field-source"
      >
        <ui5-label for="code-compare-source">Source tenant</ui5-label>
        <ui5-input
          id="code-compare-source"
          data-testid="source-tenant"
          accessible-name="Source tenant"
          readonly
          :value="sourceTenantName || ''"
          placeholder="—"
        />
      </div>

      <div
        class="compare-selection-field compare-selection-field--artifact"
        data-testid="compare-field-artifact"
      >
        <ui5-label for="code-compare-artifact">Artifact</ui5-label>
        <ui5-select
          id="code-compare-artifact"
          accessible-name="Artifact"
          @change="onArtifactChange"
        >
          <ui5-option
            v-for="(artifact, index) in artifacts"
            :key="artifact.ID"
            :value="artifact.ArtifactTechID"
            :selected="
              artifact.ArtifactTechID === selectedArtifactId
                || (!selectedArtifactId && index === 0)
            "
          >
            {{ artifact.ArtifactName || artifact.ArtifactTechID }}
            (v{{ artifact.ArtifactVersion }})
          </ui5-option>
        </ui5-select>
      </div>

      <ui5-icon
        class="compare-selection-direction"
        data-testid="compare-direction"
        name="arrow-right"
        accessible-name="delivers to"
      />

      <div
        class="compare-selection-field compare-selection-field--target"
        data-testid="compare-field-target"
      >
        <ui5-label for="code-compare-target">Target tenant</ui5-label>
        <ui5-select
          id="code-compare-target"
          accessible-name="Target tenant"
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
  display: grid;
  grid-template-columns:
    minmax(8rem, max-content)
    minmax(16rem, 1fr)
    1.5rem
    minmax(10rem, 14rem);
  gap: 0.75rem;
  align-items: end;
  min-width: 42rem;
  padding: 0.75rem 1rem;
}

.compare-selection-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
}

.compare-selection-field ui5-input,
.compare-selection-field ui5-select {
  width: 100%;
}

.compare-selection-direction {
  align-self: end;
  justify-self: center;
  margin-bottom: 0.625rem;
  color: var(--sapContent_IconColor, #0a6ed1);
  font-size: 1rem;
}
</style>
