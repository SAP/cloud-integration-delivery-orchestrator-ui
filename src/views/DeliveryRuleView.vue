<!-- filepath: /Users/I589335/repos/mmt-devops-ui-cpi-delivery/src/views/DeliveryRuleView.vue -->
<template>
    <n-modal v-model:show="showModal" preset="dialog" :title="selDeliveryRule.ID ? 'Edit Delivery Rule' : 'Create Delivery Rule'">
        <template #header>
            <div>{{ selDeliveryRule.ID ? 'Edit Delivery Rule' : 'Create Delivery Rule' }}</div>
        </template>
        <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
                Name:
                <n-input v-model:value="selDeliveryRule.Name" placeholder="Rule Name" />
            </div>
            <div>
                Version Pattern (regex):
                <n-input v-model:value="selDeliveryRule.VersionPattern" placeholder="e.g. ^\\d+\\.\\d+\\.\\d+$" />
            </div>
            <div>
                Included Tenants:
                <n-select
                    filterable
                    multiple
                    v-model:value="selDeliveryRule.IncludedTenants"
                    placeholder="Select Included Tenants"
                    :options="tenantOptions"
                />
            </div>
            <div v-for="tenant in selDeliveryRule.IncludedTenants">{{ tenant.Name }}</div>
            <div>
                Active:
                <n-switch v-model:value="selDeliveryRule.Active" />
            </div>
        </div>
        <template #action>
            <n-button type="primary" @click="onSave">Save</n-button>
        </template>
    </n-modal>

    <data-table
        title="Delivery Rules"
        :columns="deliveryRuleColumns"
        :data="rules"
        :custom-tool-bars="toolBars"
        :handle-add="handleAdd"
        :row-key="(row: DeliveryRule) => row.ID"
        :key="rules.length"
    />
</template>

<script lang="ts">
import { defineComponent, h } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { NTag } from 'naive-ui'
import { toLocalTime, type ToolBar } from '@/service/consts'
import {
    GetDeliveryRules,
    UpsertDeliveryRule,
    DeleteDeliveryRule,
    GetCpiTenants,
    GetTransportRoutes,
} from '@/service/api'
import {deliveryRuleColumns} from '@/service/consts'
import type { DeliveryRule, CpiTenant, TransportRoute } from '@/service/model'

export default defineComponent({
    components: { DataTable },
    data() {
        
        const toolBars: ToolBar<DeliveryRule>[] = [
            { text: 'Edit', func: (rows: DeliveryRule[]) => this.handleEdit(rows) },
            { text: 'Delete', func: (rows: DeliveryRule[]) => this.handleDelete(rows) },
            { text: 'Toggle Active', func: (rows: DeliveryRule[]) => this.handleToggleActive(rows) }
        ]
        return {
            deliveryRuleColumns,
            rules: [] as DeliveryRule[],
            showModal: false,
            toolBars,
            selDeliveryRule: {} as DeliveryRule,
            CpiTenants: [] as CpiTenant[],
            transportRoutes: [] as TransportRoute[],
        }
    },
    methods: {
        async refresh() {
            this.rules = await GetDeliveryRules()
            this.rules.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''))
            this.showModal = false
        },
        async onSave() {
            // ensure arrays exist
            if (!this.selDeliveryRule.IncludedTenants) this.selDeliveryRule.IncludedTenants = []
            if (!this.selDeliveryRule.ExcludedTenants) this.selDeliveryRule.ExcludedTenants = []
            await UpsertDeliveryRule(this.selDeliveryRule)
            await this.refresh()
        },
        handleAdd() {
            this.selDeliveryRule = {} as DeliveryRule
            this.showModal = true
        },
        async handleDelete(rows: DeliveryRule[]) {
            if (rows.length === 0) {
                window.$message.warning('Please select a delivery rule')
                return
            }
            await DeleteDeliveryRule(rows[0].ID)
            await this.refresh()
        },
        handleEdit(rows: DeliveryRule[]) {
            if (rows.length === 0) {
                window.$message.warning('Please select a delivery rule')
                return
            }
            this.selDeliveryRule = { ...rows[0] }
            this.showModal = true
        },
        async handleToggleActive(rows: DeliveryRule[]) {
            if (rows.length === 0) {
                window.$message.warning('Please select a delivery rule')
                return
            }
            const rule = { ...rows[0], Active: !rows[0].Active }
            await UpsertDeliveryRule(rule)
            await this.refresh()
        },
    },
    computed: {
        tenantOptions(): { label: string; value: CpiTenant }[] {
            const options: { label: string; value: CpiTenant }[] = []
            this.transportRoutes.forEach(tr => {
                const {sourceNodeId, targetNodeId} = tr
                if(this.selDeliveryRule.IncludedTenants.find(t => t.TransportNodeID === sourceNodeId)) {
                    const targetTenant = this.CpiTenants.find(t => t.TransportNodeID === targetNodeId)
                    if (!this.selDeliveryRule.IncludedTenants.find(t => t.ID === targetTenant!.ID)) 
                        options.push({label: targetTenant!.Name, value: targetTenant as CpiTenant})
                }
            })
            return options
        },
        selectedTenants(): { label: string; value: CpiTenant }[] {
            return this.selDeliveryRule.IncludedTenants.map(t => ({ label: t.Name, value: t }))
        }
    },
    async created() {
        await this.refresh()
        this.CpiTenants = await GetCpiTenants()
        this.transportRoutes = await GetTransportRoutes()
    }
})
</script>