<template>
    <VueFlow
        key="delivery-flow-view"
        :nodes="graph.nodes"
        :edges="graph.edges"
        style="width: 100%; min-height: 300px;"
        :nodes-draggable="false"
        :pan-on-drag="true"
        :zoom-on-scroll="false" 
        :zoom-on-pinch="false"
        fit-view-on-init
    >
        <template #node-deliver-group="props">
            <DeliverGroupNode v-bind="props" :loading="isLoadingGroup(props.data)" @import-only="onImportOnly" @deploy-only="onDeployOnly"/>
        </template>
    </VueFlow>

</template>


<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { VueFlow, type Edge, type Node } from '@vue-flow/core'
import type { ArtifactTenantOperation, CpiTenant, DeliveryRequest } from '@/service/model'
import { DeployOps, ImportOps, layoutNodes } from '@/service/api'
import DeliverGroupNode from '@/components/DeliverGroupNode.vue'

// Props
const props = defineProps<{
    deliveryRequest: DeliveryRequest
    cpiTenants: CpiTenant[]
    tenantToOps: { [key: number]: { [key: string]: ArtifactTenantOperation } }
}>()

// transport node ID to cpi tenant
const nodeToTenant = computed<{ [key: number]: CpiTenant }>(() => {
    const cache: { [key: number]: CpiTenant } = {}
    props.cpiTenants.forEach(opt => { cache[opt.TransportNodeID] = opt })
    return cache
})

// parentNodeId - childNodeIds[]
const childNodes = computed<{ [key: number]: number[] }>(() => {
    const child: { [key: number]: number[] } = {}
    props.deliveryRequest?.DeliveryRule.TargetRoutes?.forEach(tRoute => {
        const { targetNodeId, sourceNodeId } = tRoute
        if (!child[sourceNodeId]) child[sourceNodeId] = []
        child[sourceNodeId].push(targetNodeId)
    })
    return child
})

// transport TMS node ID -> (group) node
const toGroupNode = computed<{ [key: number]: Node }>(() => {
    const tenantGroups: { [key: string]: CpiTenant[] } = {}
    props.deliveryRequest?.DeliveryRule?.TargetNodes?.forEach(n => {
        const t = nodeToTenant.value[n.id]
        if (!t) return
        const groupLabel = t.Group || t.Name
        if (!tenantGroups[groupLabel]) tenantGroups[groupLabel] = []
        tenantGroups[groupLabel].push(t)
    })
    const groupNodeMap: { [key: number]: Node } = {}
    Object.entries(tenantGroups).forEach(([groupLabel, tenants]) => {
        const isSource = tenants.some(t => props.deliveryRequest?.SourceTenant && t.ID === props.deliveryRequest.SourceTenant.ID)
        const isTail = tenants.map(t => !childNodes.value[t.TransportNodeID] || childNodes.value[t.TransportNodeID].length === 0).every(v => v)
        const groupNode: Node = {
            id: `n-group-${groupLabel}`,
            data: {
                label: groupLabel,
                sourceNodeId: 0,
                tenants: tenants,
                isSource: isSource,
                isTail: isTail,
                tenantToOps: props.tenantToOps
            },
            position: { x: 0, y: 0 },
            type: 'deliver-group',
            width: 300,
            height: 200,
        }
        tenants.forEach(t => { groupNodeMap[t.TransportNodeID] = groupNode })
    })
    return groupNodeMap
})

// key: group node id -> Edge
const toEdge = computed<{ [key: string]: Edge }>(() => {
    const edgeMap: { [key: string]: Edge } = {}
    Object.keys(toGroupNode.value).forEach(nodeIDStr => {
        const pNodeID = Number(nodeIDStr)
        const childNodeIDs = childNodes.value[pNodeID] || []
        const pGroupNode = toGroupNode.value[pNodeID]
        childNodeIDs.forEach(childNodeID => {
            const cGrouNpde = toGroupNode.value[childNodeID]
            const id = `e-(${pGroupNode.id})-to-(${cGrouNpde.id})`
            if (edgeMap[id]) return
            edgeMap[id] = {
                id,
                source: pGroupNode.id,
                target: cGrouNpde.id,
                animated: true,
                style: { strokeWidth: 3 }
            }
        })
    })
    return edgeMap
})

const graph = computed(() => {
    const uniqueNodes: { [key: string]: Node } = {}
    Object.values(toGroupNode.value).forEach(n => {
        if (!(n.id in uniqueNodes)) uniqueNodes[n.id] = n
    })
    const nodes = Object.values(uniqueNodes)

    const uniqueEdges: { [key: string]: Edge } = {}
    Object.values(toEdge.value).forEach(e => {
        if (!(e.id in uniqueEdges)) uniqueEdges[e.id] = e
    })
    const edges = Object.values(uniqueEdges)
    return layoutNodes(nodes, edges)
})

watch(toGroupNode, async(newVal) => {
    await nextTick()
    Object.entries(newVal).forEach(([id, node]) => {
        const el = document.getElementById(node.id)
        const {width, height} = el?.getBoundingClientRect() ?? {}
        console.log(`DeliverGroup ${node.id} real size`, width, height)
        node.height = height
        node.width = width
    })
}, {deep: true}
)

function groupLabel(childNodeIds: number[]): string {
    if (childNodeIds.length === 1) {
        return nodeToTenant.value[childNodeIds[0]]?.Name || `node-${childNodeIds[0]}`
    }
    const labelIdx = childNodeIds.findIndex(nodeID => nodeToTenant.value[nodeID]?.Group)
    return labelIdx >= 0 ? nodeToTenant.value[childNodeIds[labelIdx]].Group : `group-${nodeToTenant.value[childNodeIds[0]]?.Name}`
}

function groupKey(parentNodeID: number, childNodeIds: number[]): string {
    const cTenants = childNodeIds.map(id => nodeToTenant.value[id]?.Name).join(', ')
    return `n-group-${cTenants}-from-${nodeToTenant.value[parentNodeID]?.Name}`
}

// Loading state management
const loadingGroups = ref<Set<string>>(new Set())

function isLoadingGroup(data: any): boolean {
    return loadingGroups.value.has(data.label)
}

function getGroupLabel(tenantIDs: number[]): string {
    const groupTenants = tenantIDs.map(
        id => props.cpiTenants.find(t => t.ID === id)
    ).filter(Boolean)
    return groupTenants.length > 0
        ? (groupTenants[0]?.Group || groupTenants[0]?.Name || '')
        : ''
}

async function onImportOnly(payload: { tenantIDs: number[] }) {
    const groupLabel = getGroupLabel(payload.tenantIDs)
    // Set loading state
    loadingGroups.value.add(groupLabel)
    try {
        const tasks: Promise<any>[] = []
        payload.tenantIDs.forEach(tID => {
            const ops = Object.values(props.tenantToOps[tID]).map(op => op.ID)
            tasks.push(ImportOps(ops, tID, props.deliveryRequest.ID))
        })
        await Promise.all(tasks)
    } finally {
        // Clear loading state
        loadingGroups.value.delete(groupLabel)
    }
}

async function onDeployOnly(payload: { tenantIDs: number[] }) {
    const groupLabel = getGroupLabel(payload.tenantIDs)

    // Set loading state
    loadingGroups.value.add(groupLabel)

    try {
        const tasks: Promise<any>[] = []
        payload.tenantIDs.forEach(tID => {
            const ops = Object.values(props.tenantToOps[tID]).map(op => op.ID)
            tasks.push(DeployOps(ops, tID, props.deliveryRequest.ID))
        })
        await Promise.all(tasks)
    } finally {
        // Clear loading state
        loadingGroups.value.delete(groupLabel)
    }
}

</script>