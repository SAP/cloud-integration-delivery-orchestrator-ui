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
  return DeriveNodeAgg(Object.values(props.data.TrToOp || {}))
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
  <n-card style="height: 100%; width: 100%;">
    <template #header>
      <n-flex>
        <n-text>{{ data.Tenant.Name }}</n-text>
        <span v-if="!data.IsSource">
          <n-button size="tiny" tertiary type="primary" @click="handleDeployAll" :disabled="nodeDeployDsiabled" style="margin: 0 10px;">Deploy All</n-button>
          <n-button size="tiny" tertiary @click="handleImportAll" :disabled="nodeImportDisabled">Import All</n-button>
        </span>
      </n-flex>
    </template>
    <template #header-extra>
      <n-tag v-if="data.IsSource" type="info" size="small" :bordered="false">Source</n-tag>
      <n-tag v-else :type="'warning'" size="small" :bordered="false">
        {{ nodeAggState }}
      </n-tag>
    </template>

    <n-text v-if="!Object.keys(ops).length" depth="3" style="font-size:11px">No artifacts {{ data.IsSource ? '' : 'delivered here yet' }}</n-text>
    <n-scrollbar v-else>
      <n-table size="small" :bordered="false" :single-line="true">
        <thead>
          <tr>
            <th>Artifact</th>
            <th>Import State</th>
            <th>Deploy State</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="op in ops" :key="op.ArtifactTechID + '@' + op.ArtifactVersion">
            <td>{{ op.ArtifactTechID }}@{{ op.ArtifactVersion }}</td>
            <td>{{ op.ImportState }}</td>
            <td>{{ op.DeployState }}</td>
            <td>
              <n-button size="tiny" quaternary type="info" @click="handleImport(op)" :disabled="disableImport(op)">Import</n-button>
              <n-button size="tiny" quaternary type="info" @click="handleDeploy(op)" :disabled="disableDeploy(op)">Deploy</n-button>
            </td>
          </tr>
        </tbody>
      </n-table>
    </n-scrollbar>
  </n-card>
</template>