<template>
    <n-modal v-model:show="showModal" preset="dialog" title="Dialog" style="width: 40%;">
        <template #header>
            <div>Create Cpi Tenant</div>
        </template>
        <n-flex vertical>
            Name
            <n-input v-model:value="selectedCpiTenant.Name" placeholder="Cpi Tenant Name, e.g. cpi-mmt-dev" />
            TMS Node
            <n-select @update:value="onSelectNode" 
                :value="tmsNodeDisplay" 
                filterable 
                placeholder="Choose TMS Transport Nodes"
                :options="transportNodesOptions"/>
            Cpi Api Endpoint
            <n-select @update:value="(e: ApiEndpoint) => selectedCpiTenant.CpiEndpoint=e" 
                :value="cpiEndpointDisplay"
                filterable 
                placeholder="Choose CPI Api Endpoint"
                :options="CpiEndpointsOptions"/>
            Tag
            <n-select v-model:value="selectedCpiTenant.Group" tag filterable placeholder="e.g. Dev, Test, Production"
             :options="tagOptions"/>
        </n-flex>


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
        :row-actions="rowActions"
        :key="cpiTenants.length"
        :loading="loading" />

</template>

<script lang="ts">
import { defineComponent, h } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { cpiTenantColums, type ToolBar, type RowAction } from '@/service/consts'
import { CheckTenantStatus, DeleteCpiTenant, GetCPIApiEndpoints, GetCpiTenants, GetTransportNodes, InitCpiTenant, UpsertCpiTenant } from '@/service/api'
import type { CpiTenant, TransportNode, ApiEndpoint } from '@/service/model'
import "@ui5/webcomponents/dist/TableRowAction.js";
import "@ui5/webcomponents-icons/dist/connected.js";
import "@ui5/webcomponents-icons/dist/initiative.js";
export default defineComponent({
    components: { DataTable },
    data() {
        const toolBars: ToolBar<CpiTenant>[] = [
            {
                text: 'Delete',
                // 这里用箭头函数包装是为了保留外层 this（组件实例）；
                // 如果直接写 func: this.handleDelete ，在 DataTable 调用时 this 会丢失。
                func: (rows: CpiTenant[]) => this.handleDelete(rows)
            },
            {
                text: 'Edit',
                func: (rows: CpiTenant[]) => {this.handleEdit(rows)}
            }
        ]
        const rowActions: RowAction<CpiTenant>[] = [
            {
                render: () => h('ui5-table-row-action', {
                    icon: 'connected',
                    text: 'check connection',
                    interactive: true
                }),
                func: (row: CpiTenant) => this.handleCheckConn(row)
            },
            {
            render: () => h('ui5-table-row-action', {
                    icon: 'initiative',
                    text: 'launch',
                    interactive: true
                }),
                func: (row: CpiTenant) => this.handleLaunch(row)
            }
        ]
        return {
            cpiTenantColums,
            cpiTenants: [] as CpiTenant[],
            showModal: false,
            toolBars,
            rowActions,
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
        handleEdit(rows: CpiTenant[]) {
            if (rows.length === 0) {
                window.$message.warning('Please select one Cpi Tenant')
                return
            }
            this.selectedCpiTenant = { ...rows[0] }
            this.showModal = true
        },
        async handleCheckConn(row: CpiTenant) {
            const baseUrl = new URL(row.CpiEndpoint.url)
            try {
                const {message} = await CheckTenantStatus(`${baseUrl.protocol}//${baseUrl.host}`)
                window.$message.success(message, { duration: 10 * 1000, closable: true })
            } catch (error: any) {
                const resp = error?.response?.data
                window.$message.error(`Failed to check tenant status: ${resp?.message ?? resp?.error ?? ''}`,  { duration: 30 * 1000 })
            }
        },
        async handleLaunch(row: CpiTenant) {
            const baseUrl = new URL(row.CpiEndpoint.url)
            try {
                const {message} = await InitCpiTenant(`${baseUrl.protocol}//${baseUrl.host}`)
                window.$message.success(message, { duration: 10 * 1000, closable: true })
            } catch (error: any) {
                const resp = error?.response?.data
                window.$message.error(`Failed to launch tenant: ${resp?.message ?? resp?.error ?? ''}`, { duration: 30 * 1000 })
            }
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
    },
    computed: {
        tagOptions(): { label: string; value: string }[] {
            const groups = Array.from(new Set(this.cpiTenants.map(t => t.Group).filter(g => g)))
            return groups.map(g => ({ label: g, value: g }))
        },
        tmsNodeDisplay() {
            return this.selectedCpiTenant.TransportNodeName ? `${this.selectedCpiTenant.TransportNodeName}(${this.selectedCpiTenant.TransportNodeDescription})` : null
        },
        cpiEndpointDisplay() {
            return this.selectedCpiTenant.CpiEndpoint ? `${this.selectedCpiTenant.CpiEndpoint.name}(${this.selectedCpiTenant.CpiEndpoint.url})` : null
        }
    }
})

</script>