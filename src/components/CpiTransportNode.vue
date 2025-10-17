<script setup lang="ts">
import { DeriveNodeAgg } from '@/service/api';
import type { ArtifactTenantOperation, CpiTenant, CpiTenantNodeData } from '@/service/model'
import type { AggregateStatus } from '@/service/statuses';
import { computed, reactive } from 'vue'

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

const ops = reactive(props.data.TrToOp)

const nodeImportDisabled = computed(() => {
  return nodeAggState.value !== 'AWAITING_IMPORT' && nodeAggState.value !== 'IMPORT_FAILED'
})

const nodeDeployDsiabled = computed(() => {
  return nodeAggState.value !== 'AWAITING_DEPLOY' && nodeAggState.value !== 'DEPLOY_FAILED'
})

const nodeAggState = computed((): AggregateStatus => {
  return DeriveNodeAgg(props.data)
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

function opImportDisabled(op: ArtifactTenantOperation) {
  return op.ImportState === 'COMPLETE' || op.ImportState === 'IN_PROGRESS'
}

function opDeployDisabled(op: ArtifactTenantOperation) {
  return op.DeployState === 'COMPLETE' || op.DeployState === 'IN_PROGRESS'
}
</script>

<template>
  <div class="cpi-node">
    <div class="node-header" :class="{ source: data.IsSource }">
      <span class="node-title">{{ data.Tenant.Name }}</span>
      <n-tag v-if="data.IsSource" type="info" size="small" :bordered="false">Source</n-tag>
      <n-tag v-else :type="'warning'" size="small" :bordered="false">
        {{ nodeAggState }}
      </n-tag>
      
    </div>
    <div v-if="!data.IsSource" class="batch-actions">
      <n-button size="tiny" tertiary @click="handleImportAll" :disabled="nodeImportDisabled">Import All</n-button>
      <n-button size="tiny" tertiary type="primary" @click="handleDeployAll" :disabled="nodeDeployDsiabled">Deploy All</n-button>
    </div>
    <div v-if="!Object.keys(ops).length" class="empty-artifacts">
      <n-text depth="3" style="font-size:11px">No artifacts {{ data.IsSource ? '' : 'delivered here yet' }}</n-text>
    </div>
    <n-scrollbar v-else style="max-height:200px; margin-top:4px;">
      <div v-for="op in ops" :key="op.ArtifactTechID + '@' + op.ArtifactVersion" class="artifact-row">
        <div class="artifact-meta">
          <span class="artifact-name" :title="op.ArtifactTechID">{{ op.ArtifactTechID }}</span>
          <span class="artifact-version">@{{ op.ArtifactVersion }}</span>
        </div>
        <div v-if="!data.IsSource" class="artifact-actions">
          <n-button size="tiny" quaternary @click="handleImport(op)" :disabled="opImportDisabled(op)">Import</n-button>
          <n-button size="tiny" quaternary type="primary" @click="handleDeploy(op)" :disabled="opDeployDisabled(op)">Deploy</n-button>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<style scoped>
.cpi-node {
  background: #fff;
  border: 1px solid var(--n-border-color, #dcdfe6);
  border-radius: 6px;
  padding: 8px 10px 10px;
  min-width: 200px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  font-size: 12px;
}
.node-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  margin-bottom: 4px;
}
.node-header.source {
  color: #2563eb;
}
.node-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.empty-artifacts { margin-top: 4px; }
.artifact-row { display:flex; align-items:center; justify-content:space-between; padding:2px 0; border-bottom:1px dashed rgba(0,0,0,0.06); }
.artifact-row:last-child { border-bottom:none; }
.artifact-meta { display:flex; gap:4px; align-items:center; overflow:hidden; }
.artifact-name { max-width:110px; overflow:hidden; text-overflow:ellipsis; }
.artifact-version { color:#555; font-size:11px; }
.artifact-actions { display:flex; gap:4px; }
.batch-actions { display:flex; gap:4px; margin-bottom:4px; }
</style>