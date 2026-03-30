<template>
    <ui5-dialog 
        :header-text="selectedCpiTenant.ID ? 'Edit Cpi Tenant' : 'Create Cpi Tenant'" 
        :open="showModal" 
        @close="showModal = false" 
        style="width: 30%;">
        <div class="flex-vertical">
            <ui5-text style="font-weight: bold;">Name</ui5-text>
            <ui5-input :value="selectedCpiTenant.Name || ''" @change="selectedCpiTenant.Name = $event.target.value"
                placeholder="Cpi Tenant Name, e.g. cpi-mmt-dev" style="width: 100%;" />

            <ui5-text style="font-weight: bold;">TMS Node</ui5-text>
            <ui5-combobox :value="selectedCpiTenant.TransportNodeName || ''" @change="onSelectNodeChange"
                placeholder="Choose TMS Transport Nodes" style="width: 100%; margin-top: 0.5rem;">
                <ui5-cb-item v-for="node in transportNodes" :id="node.id" :value="node.id"
                    :additional-text="node.description" :text="node.name" />
            </ui5-combobox>

            <ui5-text style="font-weight: bold;">Cpi Api Endpoint</ui5-text>
            <ui5-combobox :value="selectedCpiTenant.CpiEndpoint?.name || ''" @change="onSelectEndpointChange"
                placeholder="Choose CPI Api Endpoint" style="width: 100%; margin-top: 0.5rem;">
                <ui5-cb-item v-for="ep in cpiEndpoints" :id="ep.name" :value="ep.name" :additional-text="ep.url"
                    :text="ep.name" />
            </ui5-combobox>

            <ui5-text style="font-weight: bold;">Tag</ui5-text>
            <ui5-input :value="selectedCpiTenant.Group || ''" @change="onSelectTag"
                placeholder="e.g. Dev, Test, Production" showSuggestions style="width: 100%; margin-top: 0.5rem;">
                <ui5-suggestion-item v-for="tag in tagOptions" :key="tag.value" :text="tag.value">
                    {{ tag.label }}
                </ui5-suggestion-item>
            </ui5-input>
        </div>

        <ui5-toolbar slot="footer">
            <ui5-toolbar-button design="Emphasized" text="Save" @click="onSave"></ui5-toolbar-button>
            <ui5-toolbar-button design="Transparent" text="Cancel" @click="showModal = false"></ui5-toolbar-button>
        </ui5-toolbar>
    </ui5-dialog>
    <data-table title="Cpi Tenants" :columns="cpiTenantColums" :data="cpiTenants" :custom-tool-bars="toolBars"
        :handle-add="handleAdd" :row-key="(row: CpiTenant) => row.ID" :row-actions="rowActions" :key="cpiTenants.length"
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
import "@ui5/webcomponents/dist/Dialog.js";
import "@ui5/webcomponents/dist/Toolbar.js";
import "@ui5/webcomponents/dist/ToolbarButton.js";
import "@ui5/webcomponents/dist/ComboBox.js";
import "@ui5/webcomponents/dist/ComboBoxItem.js";
import "@ui5/webcomponents/dist/Input.js";
import "@ui5/webcomponents/dist/SuggestionItem.js";
import "@ui5/webcomponents/dist/Text.js";

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
                func: (rows: CpiTenant[]) => { this.handleEdit(rows) }
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
                window.$toast.warning('Please select at least one Cpi Tenant')
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
                window.$toast.warning('Please select one Cpi Tenant')
                return
            }
            this.selectedCpiTenant = { ...rows[0] }
            this.showModal = true
        },
        async handleCheckConn(row: CpiTenant) {
            const baseUrl = new URL(row.CpiEndpoint.url)
            try {
                const { message } = await CheckTenantStatus(`${baseUrl.protocol}//${baseUrl.host}`)
                window.$toast.success(message, { duration: 10 * 1000, closable: true })
            } catch (error: any) {
                const resp = error?.response?.data
                window.$toast.error(`Failed to check tenant status: ${resp?.message ?? ''}`, { duration: 30 * 1000, closable: true })
            }
        },
        async handleLaunch(row: CpiTenant) {
            const baseUrl = new URL(row.CpiEndpoint.url)
            try {
                const { message } = await InitCpiTenant(`${baseUrl.protocol}//${baseUrl.host}`)
                window.$toast.success(message, { duration: 10 * 1000, closable: true })
            } catch (error: any) {
                const resp = error?.response?.data
                window.$toast.error(`Failed to launch tenant: ${resp?.message ?? ''}`, { duration: 30 * 1000, closable: true })
            }
        },
        onSelectNodeChange(event: any) {
            const selectedId = event.target.value
            const node = this.transportNodes.find(n => String(n.name) === String(selectedId)) as TransportNode
            this.selectedCpiTenant.TransportNodeID = node.id
            this.selectedCpiTenant.TransportNodeName = node.name
            this.selectedCpiTenant.TransportNodeDescription = node.description
        },
        onSelectEndpointChange(event: any) {
            const selectedName = event.target.value
            const endpoint = this.cpiEndpoints.find(ep => ep.name === selectedName)
            if (endpoint) this.selectedCpiTenant.CpiEndpoint = endpoint
        },
        onSelectTag(event: any) {
            this.selectedCpiTenant.Group = event.target.value
        }
    },
    async created() {
        await this.refresh()
        this.transportNodes = await GetTransportNodes() || []
        this.cpiEndpoints = await GetCPIApiEndpoints() || []
    },
    computed: {
        tagOptions(): { label: string; value: string }[] {
            const groups = Array.from(new Set(this.cpiTenants.map(t => t.Group).filter(g => g)))
            return groups.map(g => ({ label: g, value: g }))
        }
    }
})

</script>

<style scoped>
.flex-vertical {
    display: flex;
    flex-direction: column;
}
</style>
