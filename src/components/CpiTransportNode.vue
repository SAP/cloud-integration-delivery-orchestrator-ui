<script setup lang="ts">
import { DeriveNodeAgg } from '@/service/api';
import type { ArtifactTenantOperation, CpiTenant, CpiTenantNodeData } from '@/service/model'
import { aggregateStatusToUi5Design, type AggregateStatus } from '@/service/statuses';
import { computed, reactive } from 'vue'
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/Card.js";
import "@ui5/webcomponents/dist/CardHeader.js";
import "@ui5/webcomponents/dist/Icon.js";
import "@ui5/webcomponents/dist/Tag.js";
import "@ui5/webcomponents/dist/Label.js";

import "@ui5/webcomponents/dist/Table.js";
import "@ui5/webcomponents/dist/TableRow.js";
import "@ui5/webcomponents/dist/TableCell.js";
import "@ui5/webcomponents/dist/TableHeaderRow.js";
import "@ui5/webcomponents/dist/TableHeaderCell.js";
import "@ui5/webcomponents-fiori/dist/IllustratedMessage.js";
import "@ui5/webcomponents-fiori/dist/illustrations/NoData.js";

// Props: passed from VueFlow slot
const props = defineProps({
  id: { type: String, required: true },
  data: {
    // isSource indicates the source (origin) transport node (no import/deploy actions)
    type: Object as () => CpiTenantNodeData,
    required: true
  }
})

const emit = defineEmits<{
  (e: 'import-artifact', payload: { tenant: CpiTenant; artifactOp: ArtifactTenantOperation }): void
  (e: 'deploy-artifact', payload: { tenant: CpiTenant; artifactOp: ArtifactTenantOperation }): void
  (e: 'import-all', payload: { tenant: CpiTenant; artifactOps: ArtifactTenantOperation[] }): void
  (e: 'deploy-all', payload: { tenant: CpiTenant; artifactOps: ArtifactTenantOperation[] }): void
}>()

const ops = computed(() => props.data.TrToOp)

const nodeImportDisabled = computed(() => {
  return nodeAggState.value !== 'AWAITING_IMPORT' && nodeAggState.value !== 'IMPORT_FAILED'
})

const nodeDeployDsiabled = computed(() => {
  return nodeAggState.value !== 'AWAITING_DEPLOY' && nodeAggState.value !== 'DEPLOY_FAILED'
})

const nodeAggState = computed((): AggregateStatus => {
  return DeriveNodeAgg(Object.values(props.data.TrToOp || {}))
})

const nodeAggDesign = computed(() => {
  return aggregateStatusToUi5Design(nodeAggState.value)
})

function handleImport(op: ArtifactTenantOperation) {
  emit('import-artifact', { tenant: props.data.Tenant, artifactOp: op })
}
function handleDeploy(op: ArtifactTenantOperation) {
  emit('deploy-artifact', { tenant: props.data.Tenant, artifactOp: op })
}
function handleImportAll() {
  emit('import-all', { tenant: props.data.Tenant, artifactOps: Object.values(props.data.TrToOp) })
}
function handleDeployAll() {
  emit('deploy-all', { tenant: props.data.Tenant, artifactOps: Object.values(props.data.TrToOp) })
}

function disableImport(op: ArtifactTenantOperation) {
  return op.ImportState === 'COMPLETE' || op.ImportState === 'IN_PROGRESS'
}

function disableDeploy(op: ArtifactTenantOperation) {
  return !(op.DeployState === 'QUEUED' || op.DeployState === 'FAILED')
}
</script>

<template>
  <ui5-card style="height: 100%; width: 100%;" :title-text="data.Tenant.Name">
    <ui5-card-header slot="header" :title-text="data.Tenant.Name">
      <div slot="action" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div>
          <ui5-tag v-if="data.IsSource" design="Set2" color-scheme="4">Source</ui5-tag>
          <ui5-tag v-else :design="nodeAggDesign">
            {{ nodeAggState }}
          </ui5-tag>
        </div>
        <div>
          <ui5-button v-if="data.IsSource" @click="handleDeployAll" :disabled="nodeDeployDsiabled">Deploy All</ui5-button>
          <ui5-button v-if="!data.IsSource" @click="handleDeployAll" :disabled="nodeDeployDsiabled" style="margin: 0 10px;">Deploy All</ui5-button>
          <ui5-button v-if="!data.IsSource" @click="handleImportAll" :disabled="nodeImportDisabled">Import All</ui5-button>
        </div>
      </div>
    </ui5-card-header>

    <div v-if="!Object.keys(ops).length" style="margin-top:6px">
      <ui5-illustrated-message name="NoData" design="Dot"
        :subtitle-text="data.IsSource ? 'No artifacts available for deploy' : 'No artifacts available for import / deploy'"
        :title-text="`No artifacts ${data.IsSource ? 'in source tenant' : 'delivered here yet'}`" />
    </div>

    <ui5-table v-else overflow-mode="Scroll" style="max-height: 300px; overflow-y: auto;">
      <ui5-table-header-row slot="headerRow">
        <ui5-table-header-cell>Artifact</ui5-table-header-cell>
        <ui5-table-header-cell width="90px">Version</ui5-table-header-cell>
        <ui5-table-header-cell v-if="data.IsSource" width="140px">TR</ui5-table-header-cell>
        <ui5-table-header-cell v-if="!data.IsSource" width="120px">Import State</ui5-table-header-cell>
        <ui5-table-header-cell v-if="!data.IsSource" width="120px">Deploy State</ui5-table-header-cell>
        <ui5-table-header-cell width="150px">Actions</ui5-table-header-cell>
      </ui5-table-header-row>
      <ui5-table-row v-for="op in ops" :key="`${op.ArtifactTechID}@${op.ArtifactVersion}`">
          <ui5-table-cell>
            <ui5-label>{{ op.ArtifactTechID }}</ui5-label>
          </ui5-table-cell>
          <ui5-table-cell>
            <ui5-label>{{ op.ArtifactVersion }}</ui5-label>
          </ui5-table-cell>
          <ui5-table-cell v-if="data.IsSource">
            <ui5-label>{{ op.TransportRequestNumber || '-' }}</ui5-label>
          </ui5-table-cell>
          <ui5-table-cell v-if="!data.IsSource">
            <ui5-label>{{ op.ImportState }}</ui5-label>
          </ui5-table-cell>
          <ui5-table-cell v-if="!data.IsSource">
            <ui5-label>{{ op.DeployState }}</ui5-label>
          </ui5-table-cell>
          <ui5-table-cell style="display: flex; flex-direction: row;">
            <ui5-button v-if="!data.IsSource" @click="handleImport(op)" :disabled="disableImport(op)">Import</ui5-button>
            <ui5-button @click="handleDeploy(op)" :disabled="disableDeploy(op)">Deploy</ui5-button>
          </ui5-table-cell>
      </ui5-table-row>
    </ui5-table>
  </ui5-card>
</template>