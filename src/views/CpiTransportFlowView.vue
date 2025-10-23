<template>
    <VueFlow :nodes="graph.nodes" :edges="graph.edges" fit-view-on-init>
        <template #node-cpi-transport="props" >
          <CpiTransportNode
            v-bind="props"
            @import-artifact="onImportArtifact"
            @deploy-artifact="onDeployArtifact"
            @import-all="onImportAll"
            @deploy-all="onDeployAll"
          />
        </template>
    </VueFlow>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { VueFlow, type Edge, type Node } from '@vue-flow/core'
import { DeployOps, ImportOps, layoutNodes } from '@/service/api';
import type { ArtifactTenantOperation, CpiTenant, DeliveryRequest, TransportNode, TransportRoute } from '@/service/model';
import CpiTransportNode from '@/components/CpiTransportNode.vue';

const props = defineProps({
    deliveryRequest: {
        type: Object as () => DeliveryRequest,
        required: true
    },
    cpiTenants: { // all cpi tenants
        type: Array as () => CpiTenant[],
        required: true
    },
    tenantToOps: { // map[tenantID]map[trNumber]ArtifactTenantOperation
        type: Object as () => {[key: number] : {[key: string]: ArtifactTenantOperation}},
        required: true
    }
})

const nodes = computed<Node[]>(() => {
    if(!props.deliveryRequest.SourceTenant) return []
    const targetNodes: Node[] = []
    props.deliveryRequest.TargetNodes.forEach((tn: TransportNode) => {
    const tenant = nodeToTenant.value[tn.id]
    const trToOp = props.tenantToOps[tenant?.ID] || {} //trNumber - ArtifactTenantOperation
    targetNodes.push({
        id: String(tn.id), // transport node ID
        data: {
        NodeID: tn.id,
        TenantID: tenant?.ID,
        TrToOp: trToOp,
        IsSource: tenant?.ID === props.deliveryRequest.SourceTenant.ID,
        Tenant: tenant
        },
        position: { x: 0, y: 0 },
        type: 'cpi-transport'
    })
    })
    const sourceNodeID = props.deliveryRequest.SourceTenant.TransportNodeID
    const sourceTenantID = props.deliveryRequest.SourceTenant.ID
    const sourceNode = {
    id: String(sourceNodeID),
    data: {
        NodeID: sourceNodeID,
        TenantID: sourceTenantID,
        TrToOp: props.tenantToOps[sourceTenantID] || {},
        IsSource: true,
        Tenant: props.deliveryRequest.SourceTenant
    },
    position: { x: 0, y: 0 },
    type: 'cpi-transport'
    }
    const all = [sourceNode, ...targetNodes]
    return all 
})

const edges = computed<Edge[]>(() => {
    if (!props.deliveryRequest.SourceTenant) return []
    const routes = props.deliveryRequest?.TargetRoutes || []
    return routes.map((route: TransportRoute) => ({
    id: route.description || `e-${route.sourceNodeId}-to-${route.targetNodeId}`,
    source: String(route.sourceNodeId),
    target: String(route.targetNodeId),
    animated: true,
    label: route.description || ''
    }))
})

const graph = computed(() => {
    // Layout nodes and edges
    return layoutNodes(nodes.value, edges.value, 'TB')
})

const nodeToTenant = computed<{[key: number]: CpiTenant}>(() => {
    const cache: {[key: number]: CpiTenant} = {}
    props.cpiTenants.forEach(opt => cache[opt.TransportNodeID] = opt)
    return cache
})

async function onImportArtifact(payload: { tenant: CpiTenant; artifactOp: ArtifactTenantOperation }) {
    const {tenant, artifactOp} = payload
    await ImportOps([artifactOp.ID], tenant.ID)
}
async function onDeployArtifact(payload: { tenant: CpiTenant; artifactOp: ArtifactTenantOperation }) {
    const {tenant, artifactOp} = payload
    await DeployOps([artifactOp.ID], tenant.ID)
}
async function onImportAll(payload: { tenant: CpiTenant; artifactOps: ArtifactTenantOperation[] }) {
    const {tenant, artifactOps} = payload
    await ImportOps(artifactOps.map(op => op.ID), tenant.ID)
}
async function onDeployAll(payload: { tenant: CpiTenant; artifactOps: ArtifactTenantOperation[] }) {
    const {tenant, artifactOps} = payload
    await DeployOps(artifactOps.map(op => op.ID), tenant.ID)
}
</script>