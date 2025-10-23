<template>
    <VueFlow
        key="delivery-flow-view"
        :nodes="nodes"
        :edges="edges"
        style="width: 100%; height: 200px;"
        :nodes-draggable="false"
        :pan-on-drag="false"
        :zoom-on-scroll="false" 
        :zoom-on-pinch="false"
        fit-view-on-init
    >
        <template #node-deliver-group="props">
            <DeliverGroupNode v-bind="props" :id="props.id" :data="props.data" @deliver="onDeliver" @import-only="onImportOnly" @deploy-only="onDeployOnly"/>
        </template>
    </VueFlow>

</template>


<script lang="ts">
import { defineComponent } from 'vue';
import { VueFlow, type Edge, type Node } from '@vue-flow/core'
import type { ArtifactTenantOperation, CpiTenant, DeliveryRequest, TransportNode, TransportRoute } from '@/service/model';
import { DeployOps, ImportOps, layoutNodes } from '@/service/api';
import DeliverGroupNode from '@/components/DeliverGroupNode.vue';

export default defineComponent({
    components: { VueFlow, DeliverGroupNode },
    props: {
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
    },
    computed: {
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
        childNodes() { // parentNodeId - childNodeIds[]
            const childNodes: {[key: number]: number[]} = {}
            this.deliveryRequest?.TargetRoutes?.forEach(tRoute => {
                const {targetNodeId, sourceNodeId} = tRoute
                if(!childNodes[sourceNodeId]) childNodes[sourceNodeId] = []
                childNodes[sourceNodeId].push(targetNodeId)
            })
            return childNodes
        },
        toGroupNode(): {[key: number]: Node} { // transport node ID -> (group) node. group many transport nodes into one node, based on parent-child relationship
            const groupNodeMap: {[key: number]: Node} = {} // many NodeId -> Node. 
            Object.keys(this.childNodes).forEach(parentNodeIdStr => {
                const pNodeId = Number(parentNodeIdStr) // parent node ID
                const childNodeIds = this.childNodes[pNodeId] // group this transport nodes into one node
                const groupLabel = this.groupLabel(childNodeIds)
                const childKey = this.groupKey(pNodeId, childNodeIds) // child group node key
                const node: Node = {
                    id: childKey,
                    data: { label: groupLabel, sourceNodeId: pNodeId, tenants: childNodeIds.map(nId => this.nodeToTenant[nId]), isSource: false },
                    position: { x: 0, y: 0 }, // Placeholder position
                    type: 'deliver-group'
                }
                childNodeIds.forEach(id => groupNodeMap[id] = node)
            })
            // add source node
            const sourceTenant = this.deliveryRequest?.SourceTenant
            if (sourceTenant?.TransportNodeID) {
                groupNodeMap[sourceTenant.TransportNodeID] = {
                    id: `n-source-${this.nodeToTenant[sourceTenant.TransportNodeID]?.Name}`,
                    data: { label: sourceTenant.Name, sourceNodeId: sourceTenant.TransportNodeID, tenants: [sourceTenant], isSource: true },
                    position: { x: 0, y: 0 }, // Placeholder position
                    type: 'deliver-group'
                }
            }
            return groupNodeMap
        },
        toEdge() { // key: nodeid
            const edgeMap: {[key: number]: Edge} = []
            Object.keys(this.toGroupNode).forEach(nodeIDStr => {
                const nodeID = Number(nodeIDStr)
                const pNId = this.toParentNode[nodeID]
                if (!pNId) return // skip if no parent
                const parentGroupNode = this.toGroupNode[pNId]
                const childGroupNode = this.toGroupNode[nodeID]
                const edge = {
                    id: `e-(${parentGroupNode.id})-to-(${childGroupNode.id})`,
                    source: parentGroupNode.id,
                    target: childGroupNode.id,
                    animated: true,
                }
                if (!edgeMap[nodeID]) edgeMap[nodeID] = edge
                if (!edgeMap[pNId]) edgeMap[pNId] = edge
            })
            return edgeMap
        },
        // TODO: refine filter out logic
        nodes(): Node[] {
            const nodes = Object.values(this.toGroupNode)

            // filter out duplicate nodes by id
            const nodeMap = new Map<string, Node>()
            nodes.forEach(n => {
                if (n?.id != null && !nodeMap.has(String(n.id))) nodeMap.set(String(n.id), n)
            })
            const uniqueNodes = Array.from(nodeMap.values())

            return layoutNodes(uniqueNodes, Object.values(this.toEdge))
        },
        edges(): Edge[] {
            const allEdges = Object.values(this.toEdge)

            const edgeMap = new Map<string, Edge>()
            allEdges.forEach(e => {
            if (e?.id != null) edgeMap.set(String(e.id), e)
            })

            return Array.from(edgeMap.values())
        }
    },
    methods: {
        groupLabel(childNodeIds: number[]): string {
            if(childNodeIds.length === 1) {
                return this.nodeToTenant[childNodeIds[0]]?.Name || `node-${childNodeIds[0]}`
            }
            const labelIdx = childNodeIds.findIndex(nodeID => this.nodeToTenant[nodeID]?.Group) // find the first group label as label
            return labelIdx >=0 ? this.nodeToTenant[childNodeIds[labelIdx]].Group : `group-${this.nodeToTenant[childNodeIds[0]]?.Name}`
        },
        groupKey(parentNodeID: number, childNodeIds: number[]): string {
            const cTenants = childNodeIds.map(id => this.nodeToTenant[id]?.Name).join(', ')
            return `n-group-${cTenants}-from-${this.nodeToTenant[parentNodeID]?.Name}`
        },
        async onDeliver(payload: { tenantIDs: number[] }) {
            await this.onImportOnly(payload)
            await this.onDeployOnly(payload)
        },
        async onImportOnly(payload: { tenantIDs: number[] }) {
            const tasks: Promise<any>[] = []
            payload.tenantIDs.forEach(tID => {
                const ops = Object.values(this.tenantToOps[tID]).map(op => op.ID)
                tasks.push(ImportOps(ops, tID))
            })
            await Promise.all(tasks)
        },
        async onDeployOnly(payload: { tenantIDs: number[] }) {
            const tasks: Promise<any>[] = []
            payload.tenantIDs.forEach(tID => {
                const ops = Object.values(this.tenantToOps[tID]).map(op => op.ID)
                tasks.push(DeployOps(ops, tID))
            })
            await Promise.all(tasks)
        }
    }

    
})

</script>