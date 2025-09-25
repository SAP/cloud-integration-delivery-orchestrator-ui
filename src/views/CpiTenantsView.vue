<template>
    <n-modal v-model:show="showModal" preset="dialog" title="Dialog">
        <template #header>
            <div>Create Cpi Tenant</div>
        </template>
        Name:
        <n-input v-model:value="selectedCpiTenant.Name" placeholder="Cpi Tenant Name, e.g. cpi-mmt-dev" />
        TMS Node:
        <n-select v-model:value="selectedCpiTenant.TransportNode" filterable placeholder="Choose TMS Transport Nodes"
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
        :key="cpiTenants.length" />

</template>

<script lang="ts">
import { defineComponent } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { cpiTenantColums, type ToolBar } from '@/service/consts'
import { DeleteCpiTenant, GetCPIApiEndpoints, GetCpiTenants, GetTransportNodes, UpsertCpiTenant, type ApiEndpoint, type CpiTenant, type TransportNode } from '@/service/api'
export default defineComponent({
    components: { DataTable },
    data() {
        const toolBars: ToolBar[] = [
            {
                text: 'Delete',
                func: this.handleDelete
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
            CpiEndpointsOptions: [] as {}[]
        }
    },
    methods: {
        async onSave() {
            await UpsertCpiTenant(this.selectedCpiTenant)
            await this.refresh()
        },
        async refresh() {
            this.cpiTenants = await GetCpiTenants()
            this.showModal = false
            this.cpiTenants.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''))
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
    },
    async created() {
        await this.refresh()
        this.transportNodes = await GetTransportNodes()
        this.cpiEndpoints = await GetCPIApiEndpoints()
        this.transportNodesOptions = this.transportNodes.map(node => ({ label: `${node.name}(${node.description})`, value: node }))
        this.CpiEndpointsOptions = this.cpiEndpoints.map(ep => ({ label: `${ep.name}(${ep.url})`, value: ep }))
    }
})

</script>