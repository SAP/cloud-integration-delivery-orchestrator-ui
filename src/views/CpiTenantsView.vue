<template>
    <n-modal v-model:show="showModal" preset="dialog" title="Dialog">
        <template #header>
            <div>Create Cpi Tenant</div>
        </template>
        Name:
        <n-input v-model:value="selectedCpiTenant.Name" placeholder="Cpi Tenant Name, e.g. cpi-mmt-dev" />
        TMS Node:
        <n-select @update:value="onSelectNode" filterable placeholder="Choose TMS Transport Nodes"
            :options="transportNodesOptions" />

        Cpi Api Endpoint:
        <n-select v-model:value="selectedCpiTenant.CpiEndpoint" filterable placeholder="Choose CPI Api Endpoint"
            :options="CpiEndpointsOptions" />

        <template #action>
            <n-button type="primary" @click="onSave">Save</n-button>
        </template>
    </n-modal>
    <data-table 
        title="Cpi Tenants" 
        :columns="cpiTenantColums" 
        :data="cpiTenants" 
        :custom-tool-bars="toolBars"
        :handle-add="handleAdd" 
        :row-key="(row: CpiTenant) => row.ID"
        :key="cpiTenants.length"
        :loading="loading" />

</template>

<script lang="ts">
import { defineComponent } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { cpiTenantColums, type ToolBar } from '@/service/consts'
import { DeleteCpiTenant, GetCPIApiEndpoints, GetCpiTenants, GetTransportNodes, UpsertCpiTenant } from '@/service/api'
import type { CpiTenant, TransportNode, ApiEndpoint } from '@/service/model'
export default defineComponent({
    components: { DataTable },
    data() {
        const toolBars: ToolBar<CpiTenant>[] = [
            {
            text: 'Delete',
            // 这里用箭头函数包装是为了保留外层 this（组件实例）；
            // 如果直接写 func: this.handleDelete ，在 DataTable 调用时 this 会丢失。
            func: (rows: CpiTenant[]) => this.handleDelete(rows)
            }
        ]
        return {
            cpiTenantColums,
            cpiTenants: [] as CpiTenant[],
            showModal: false,
            toolBars,
            selectedCpiTenant: {} as CpiTenant,
            transportNodes: [] as TransportNode[],
            cpiEndpoints: [] as ApiEndpoint[],
            transportNodesOptions: [] as {}[],
            CpiEndpointsOptions: [] as {}[],
            loading: false
        }
    },
    methods: {
        async onSave() {
            await UpsertCpiTenant(this.selectedCpiTenant)
            await this.refresh()
        },
        async refresh() {
            this.loading = true
            this.cpiTenants = await GetCpiTenants() || []
            this.showModal = false
            this.cpiTenants.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''))
            this.loading = false
        },
        async handleDelete(rows: CpiTenant[]) {
            if (rows.length === 0) {
                window.$message.warning('Please select at least one Cpi Tenant')
                return
            }
            await DeleteCpiTenant(rows[0].ID)
            await this.refresh()
        },
        handleAdd() {
            this.selectedCpiTenant = {} as CpiTenant
            this.showModal = true
        },
        onSelectNode(node: TransportNode) {
            this.selectedCpiTenant.TransportNodeID = node.id
            this.selectedCpiTenant.TransportNodeName = node.name
            this.selectedCpiTenant.TransportNodeDescription = node.description
        }
    },
    async created() {
        await this.refresh()
        this.transportNodes = await GetTransportNodes() || []
        this.cpiEndpoints = await GetCPIApiEndpoints() || []
        this.transportNodesOptions = this.transportNodes.map(node => ({ label: `${node.name}(${node.description})`, value: node }))
        this.CpiEndpointsOptions = this.cpiEndpoints.map(ep => ({ label: `${ep.name}(${ep.url})`, value: ep }))
    }
})

</script>