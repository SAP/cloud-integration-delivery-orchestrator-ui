<!-- filepath: /Users/I589335/repos/mmt-devops-ui-cpi-delivery/src/views/DeliveryRuleView.vue -->
<template>
    <n-modal v-model:show="showModal" preset="dialog" :title="selectedDeliveryRule.ID ? 'Edit Delivery Rule' : 'Create Delivery Rule'">
        <template #header>
            <div>{{ selectedDeliveryRule.ID ? 'Edit Delivery Rule' : 'Create Delivery Rule' }}</div>
        </template>
        <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
                Name:
                <n-input v-model:value="selectedDeliveryRule.Name" placeholder="Rule Name" />
            </div>
            <div>
                Version Pattern (regex):
                <n-input v-model:value="selectedDeliveryRule.VersionPattern" placeholder="e.g. ^\\d+\\.\\d+\\.\\d+$" />
            </div>
            <div>
                Included Tenants:
                <n-select
                    multiple
                        v-model:value="selectedDeliveryRule.IncludedTenants"
                        filterable
                        placeholder="Select Included Tenants"
                        :options="tenantOptions"
                        @update:value="onTenantListChange"
                />
            </div>
            <div>
                Excluded Tenants:
                <n-select
                    multiple
                        v-model:value="selectedDeliveryRule.ExcludedTenants"
                        filterable
                        placeholder="Select Excluded Tenants"
                        :options="tenantOptions"
                        @update:value="onTenantListChange"
                />
            </div>
            <div>
                Active:
                <n-switch v-model:value="selectedDeliveryRule.Active" />
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
    type DeliveryRule,
    type CpiTenant
} from '@/service/api'
import type { DataTableColumns } from 'naive-ui'
import {deliveryRuleColumns} from '@/service/consts'

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
            selectedDeliveryRule: {} as DeliveryRule,
            tenants: [] as CpiTenant[],
            tenantOptions: [] as { label: string; value: CpiTenant }[]
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
            if (!this.selectedDeliveryRule.IncludedTenants) this.selectedDeliveryRule.IncludedTenants = []
            if (!this.selectedDeliveryRule.ExcludedTenants) this.selectedDeliveryRule.ExcludedTenants = []
            await UpsertDeliveryRule(this.selectedDeliveryRule)
            await this.refresh()
        },
        handleAdd() {
            this.selectedDeliveryRule = {} as DeliveryRule
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
            // deep clone to avoid immediate mutation
            const clone = JSON.parse(JSON.stringify(rows[0])) as DeliveryRule
            // rebind tenant references to existing tenant objects for select component
            clone.IncludedTenants = clone.IncludedTenants?.map(t => this.findTenantRef(t.ID)) || []
            clone.ExcludedTenants = clone.ExcludedTenants?.map(t => this.findTenantRef(t.ID)) || []
            this.selectedDeliveryRule = clone
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
        findTenantRef(id: number) {
            return this.tenants.find(t => t.ID === id) as CpiTenant
        },
        onTenantListChange() {
            // remove overlaps: if tenant appears in both, keep only in IncludedTenants
            const includedIds = new Set((this.selectedDeliveryRule.IncludedTenants || []).map(t => t.ID))
            this.selectedDeliveryRule.ExcludedTenants = (this.selectedDeliveryRule.ExcludedTenants || []).filter(t => !includedIds.has(t.ID))
        }
    },
    async created() {
        await this.refresh()
        this.tenants = await GetCpiTenants()
        this.tenantOptions = this.tenants.map(t => ({ label: t.Name, value: t }))
    }
})
</script>