<script setup lang="ts">
import type { DeliveryRequest, TransportNode, Artifact, CpiTenant } from '@/service/api'
import { computed } from 'vue'

// Props: passed from VueFlow slot
const props = defineProps({
  id: { type: String, required: true },
  data: {
    // isSource indicates the source (origin) transport node (no import/deploy actions)
    type: Object as () => { curNode: TransportNode; deliveryRequest: DeliveryRequest; isSource?: boolean },
    required: true
  }
})

const emit = defineEmits<{
  (e: 'import-artifact', payload: { node: TransportNode; artifact: Artifact }): void
  (e: 'deploy-artifact', payload: { node: TransportNode; artifact: Artifact }): void
  (e: 'import-all', payload: { node: TransportNode; artifacts: Artifact[] }): void
  (e: 'deploy-all', payload: { node: TransportNode; artifacts: Artifact[] }): void
}>()

// Helper: list of delivered tenant node ids
const deliveredNodeIds = computed<number[]>(() => {
  const dr = props.data.deliveryRequest
  if (!dr?.DeliveredTo) return []
  return dr.DeliveredTo.filter(t => !!t?.TransportNode).map(t => t.TransportNode.id)
})

// Whether this node has already received delivery (all artifacts considered delivered)
const nodeDelivered = computed(() => deliveredNodeIds.value.includes(props.data.curNode.id))

// Artifacts to display: only if already transported to (delivered) OR if source node
const visibleArtifacts = computed<Artifact[]>(() => {
  if (props.data.isSource) return props.data.deliveryRequest.Artifacts || []
  if (nodeDelivered.value) return props.data.deliveryRequest.Artifacts || []
  return []
})

function handleImport(a: Artifact) {
  emit('import-artifact', { node: props.data.curNode, artifact: a })
}
function handleDeploy(a: Artifact) {
  emit('deploy-artifact', { node: props.data.curNode, artifact: a })
}
function handleImportAll() {
  emit('import-all', { node: props.data.curNode, artifacts: visibleArtifacts.value })
}
function handleDeployAll() {
  emit('deploy-all', { node: props.data.curNode, artifacts: visibleArtifacts.value })
}
</script>

<template>
  <div class="cpi-node">
    <div class="node-header" :class="{ source: data.isSource }">
      <span class="node-title">{{ data.curNode.name }}</span>
      <n-tag v-if="data.isSource" type="info" size="small" :bordered="false">Source</n-tag>
      <n-tag v-else :type="nodeDelivered ? 'success' : 'warning'" size="small" :bordered="false">
        {{ nodeDelivered ? 'Delivered' : 'Pending' }}
      </n-tag>
    </div>
    <div v-if="!data.isSource" class="batch-actions" v-show="visibleArtifacts.length">
      <n-button size="tiny" tertiary @click="handleImportAll" :disabled="nodeDelivered">Import All</n-button>
      <n-button size="tiny" tertiary type="primary" @click="handleDeployAll" :disabled="!nodeDelivered">Deploy All</n-button>
    </div>
    <div v-if="!visibleArtifacts.length" class="empty-artifacts">
      <n-text depth="3" style="font-size:11px">No artifacts {{ data.isSource ? '' : 'delivered here yet' }}</n-text>
    </div>
    <n-scrollbar v-else style="max-height:200px; margin-top:4px;">
      <div v-for="a in visibleArtifacts" :key="a.Id + '@' + a.Version" class="artifact-row">
        <div class="artifact-meta">
          <span class="artifact-name" :title="a.Name">{{ a.Name }}</span>
          <span class="artifact-version">@{{ a.Version }}</span>
        </div>
        <div v-if="!data.isSource" class="artifact-actions">
          <n-button size="tiny" quaternary @click="handleImport(a)" :disabled="nodeDelivered">Import</n-button>
          <n-button size="tiny" quaternary type="primary" @click="handleDeploy(a)" :disabled="!nodeDelivered">Deploy</n-button>
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