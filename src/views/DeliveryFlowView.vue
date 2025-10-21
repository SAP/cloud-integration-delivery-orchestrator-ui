<template>
    <VueFlow
        :nodes="nodes"
        :edges="edges"
        style="width: 100%; height: 600px; border: 1px solid #ccc;"
    />

</template>


<script lang="ts">
import { defineComponent } from 'vue';
import { VueFlow, type Edge, type Node } from '@vue-flow/core'
import type { ArtifactTenantOperation, CpiTenant, DeliveryRequest, TransportNode, TransportRoute } from '@/service/model';
import { TenantOps } from '@/service/api';

export default defineComponent({
    name: 'DeliveryFlowView',
    components: { VueFlow },
    props: {
        deliveryRequest: {
            type: Object as () => DeliveryRequest,
            required: true
        },
        cpiTenants: { // all cpi tenants
            type: Array as () => CpiTenant[],
            required: true
        }
    },
    computed: {
        tenantToOps(): {[key: number] : {[key: string]: ArtifactTenantOperation}} { // cpi tenant ID - map[trNumber]ArtifactTenantOperation
            if(!this.deliveryRequest.SourceTenant) return {}
            return TenantOps(this.deliveryRequest.ArtifactTenantOperations) 
        },
        nodeToTenant(): {[key: number]: CpiTenant} { // transport node ID to cpi tenant
            const cache: {[key: number]: CpiTenant} = {}
            this.cpiTenants.forEach(opt => cache[opt.TransportNodeID] = opt)
            return cache
        },
        toParentNode(): {[key: number]: number} { // source node id to parent node id
            const cache: {[key: number]: number} = {}
            this.deliveryRequest.TargetRoutes.forEach(route => cache[route.targetNodeId] = route.sourceNodeId)
            return cache
        },
        toGroupNode(): {[key: number]: Node} { // transport node ID - (group) node
            const childNodes: {[key: number]: number[]} = {} // parentNodeId - childNodeIds[]
            this.deliveryRequest?.TargetRoutes.forEach(tRoute =>{
                const {targetNodeId, sourceNodeId} = tRoute
                if(!childNodes[sourceNodeId]) childNodes[sourceNodeId] = []
                childNodes[sourceNodeId].push(targetNodeId)
            })
            const groupNodeMap: {[key: number]: Node} = {} // many NodeId -> Node. 
            Object.keys(childNodes).forEach(parentNodeIdStr => {
                const pNodeId = Number(parentNodeIdStr) // parent node ID
                const childNodeIds = childNodes[pNodeId] // group this transport nodes into one node
                const groupLabel = this.groupLabel(childNodeIds, this.nodeToTenant)
                const childKey = `n-group-${groupLabel}-from-${pNodeId}` // child group node key
                const node: Node = {
                    id: childKey,
                    data: { label: groupLabel, sourceNodeId: pNodeId, tenants: childNodeIds.map(nId => this.nodeToTenant[nId]) },
                    position: { x: 100, y: 100 }, // Placeholder position
                }
                childNodeIds.forEach(id => groupNodeMap[id] = node)
            })
            const sourceTenant = this.deliveryRequest.SourceTenant
            groupNodeMap[sourceTenant.TransportNodeID] = {
                id: `n-source-${sourceTenant.TransportNodeID}`,
                data: { label: sourceTenant.Name, sourceNodeId: sourceTenant.TransportNodeID, tenants: [sourceTenant] },
                position: { x: 0, y: 0 }, // Placeholder position
            }
            return groupNodeMap
        },
        toEdge() {
            const edgeMap: {[key: number]: Edge} = []
            Object.keys(this.toGroupNode).forEach(nodeIDStr => {
                const nodeID = Number(nodeIDStr)
                const pNId = this.toParentNode[nodeID]
                if (!pNId) return // skip if no parent
                const parentGroupNode = this.toGroupNode[pNId]
                const childGroupNode = this.toGroupNode[nodeID]
                const edge = {
                    id: `e-${parentGroupNode.id}-to-${childGroupNode.id}`,
                    source: parentGroupNode.id,
                    target: childGroupNode.id,
                    animated: true,
                }
                if (!edgeMap[nodeID]) edgeMap[nodeID] = edge
                if (!edgeMap[pNId]) edgeMap[pNId] = edge
            })
            return edgeMap
        },
        nodes(): Node[] {
            return Object.values(this.toGroupNode)
        },
        edges(): Edge[] {
            return Object.values(this.toEdge)
        }
    },
    methods: {
        groupLabel(childNodeIds: number[], nodeToTenant: {[key: number]: CpiTenant}): string {
            const labelIdx = childNodeIds.findIndex(nodeID => nodeToTenant[nodeID]?.Group) // find the first group label as label
            return labelIdx >=0 ? nodeToTenant[childNodeIds[labelIdx]].Group : `group - ${nodeToTenant[childNodeIds[0]]?.Name}`

        }
    }

    
})
</script>