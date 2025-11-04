<template>
    <VueFlow
        key="delivery-flow-view"
        :nodes="graph.nodes"
        :edges="graph.edges"
        style="width: 100%; height: 300px;"
        :nodes-draggable="true"
        :pan-on-drag="true"
        :zoom-on-scroll="true" 
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
        childNodes() { // parentNodeId - childNodeIds[]
            const childNodes: {[key: number]: number[]} = {}
            this.deliveryRequest?.DeliveryRule.TargetRoutes?.forEach(tRoute => {
                const {targetNodeId, sourceNodeId} = tRoute
                if(!childNodes[sourceNodeId]) childNodes[sourceNodeId] = []
                childNodes[sourceNodeId].push(targetNodeId)
            })
            return childNodes
        },
        toGroupNode(): {[key: number]: Node} { // transport node ID -> (group) node. group many transport nodes into one node, based on parent-child relationship
            const tenantGroups: {[key: string]: CpiTenant[]} = {} // group label -> tenants[]
            this.deliveryRequest?.DeliveryRule?.TargetNodes?.forEach(n => {
                const t = this.nodeToTenant[n.id]
                if(!t) return
                const groupLabel = t.Group || t.Name
                if(!tenantGroups[groupLabel]) tenantGroups[groupLabel] = []
                tenantGroups[groupLabel].push(t)
            })
            const groupNodeMap: {[key: number]: Node} = {} // many NodeId -> Node. 
            Object.entries(tenantGroups).forEach(([groupLabel, tenants]) => {
                const isSource = tenants.some(t => this.deliveryRequest?.SourceTenant && t.ID === this.deliveryRequest.SourceTenant.ID)
                const isTail = tenants.map(t => !this.childNodes[t.TransportNodeID] || this.childNodes[t.TransportNodeID].length === 0).every(v => v)
                const groupNode: Node = {
                    id: `n-group-${groupLabel}`,
                    data: { label: groupLabel, sourceNodeId: 0, tenants: tenants, isSource: isSource, isTail },
                    position: { x: 0, y: 0 }, // Placeholder position
                    type: 'deliver-group'
                }
                tenants.forEach(t => {groupNodeMap[t.TransportNodeID] = groupNode})
            })
            return groupNodeMap
        },
        toEdge() { // key: group node id: `e-(${pGroupNode.id})-to-(${cGrouNpde.id})`. value: Edge
            const edgeMap: {[key: string]: Edge} = {}
            Object.keys(this.toGroupNode).forEach(nodeIDStr => {
                const pNodeID = Number(nodeIDStr)
                const childNodeIDs = this.childNodes[pNodeID] || []
                const pGroupNode = this.toGroupNode[pNodeID]
                childNodeIDs.forEach(childNodeID => {
                    const cGrouNpde = this.toGroupNode[childNodeID]
                    const id = `e-(${pGroupNode.id})-to-(${cGrouNpde.id})`
                    if (edgeMap[id]) return // skip if edge already exists
                    edgeMap[id] = {
                        id: id,
                        source: pGroupNode.id,
                        target: cGrouNpde.id,
                        animated: true,
                    }
                })
            })
            return edgeMap
        },
        graph() {
            const uniqueNodes: {[key: string]: Node} = {}
            Object.values(this.toGroupNode).forEach(n => {
                if (!(n.id in uniqueNodes)) uniqueNodes[n.id] = n
            })
            const nodes = Object.values(uniqueNodes)

            const uniqueEdges: {[key: string]: Edge} = {}
            Object.values(this.toEdge).forEach(e => {
                if (!(e.id in uniqueEdges)) uniqueEdges[e.id] = e
            })
            const edges = Object.values(uniqueEdges)
            return layoutNodes(nodes, edges)

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