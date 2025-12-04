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
                    clearable
                    placeholder="Select Included Tenants"
                    :options="tenantOptions.filter(op => !op.disabled)"
                    @update:value="handleSelect"
                    :value="tenantOptions.filter(op => selDeliveryRule.IncludedTenants?.some(t => t.ID === op.value.ID))"
                />
            </div>
            <div v-for="tenant in selDeliveryRule.IncludedTenants">{{ tenant.Name }}</div>
            <div>
                Active:
                <n-switch v-model:value="selDeliveryRule.Active" />
            </div>
            <div>
                Skip Approve:
                <n-switch v-model:value="selDeliveryRule.SkipApprove" />
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
import { defineComponent } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { type ToolBar } from '@/service/consts'
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
            cpiTenants: [] as CpiTenant[],
            transportRoutes: [] as TransportRoute[],
        }
    },
    methods: {
        async refresh() {
            this.rules = await GetDeliveryRules() || []
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
        async handleToggleActive(rows: DeliveryRule[]) {
            if (rows.length === 0) {
                window.$message.warning('Please select a delivery rule')
                return
            }
            const rule = { ...rows[0], Active: !rows[0].Active }
            await UpsertDeliveryRule(rule)
            await this.refresh()
        },
        async handleDelete(rows: DeliveryRule[]) {
            if (rows.length === 0) {
                window.$message.warning('Please select a delivery rule')
                return
            }
            await DeleteDeliveryRule(rows[0].ID)
            await this.refresh()
        },
        handleAdd() {
            this.selDeliveryRule = {} as DeliveryRule
            this.showModal = true
        },
        handleEdit(rows: DeliveryRule[]) {
            if (rows.length === 0) {
                window.$message.warning('Please select a delivery rule')
                return
            }
            this.selDeliveryRule = { ...rows[0] }
            this.showModal = true
        },
        handleSelect(value: CpiTenant[]) {
            this.selDeliveryRule.IncludedTenants = value
        }
    },
    computed: {
        tenantOptions(): { label: string; value: CpiTenant, disabled: boolean }[] {
            const include = this.selDeliveryRule.IncludedTenants || []
            let includeRoutes = this.transportRoutes.filter(
                route => include.some(t => t.TransportNodeID === route.sourceNodeId)
            )
            includeRoutes = includeRoutes.length ? includeRoutes : this.transportRoutes

            return this.cpiTenants.map(t => ({
                label: t.Name,
                value: t, 
                disabled: !includeRoutes.some(route => route.targetNodeId === t.TransportNodeID) 
            }) )
        }
    },
    async created() {
        await this.refresh()
        this.cpiTenants = await GetCpiTenants() || []
        this.transportRoutes = await GetTransportRoutes()
    }
})
</script>