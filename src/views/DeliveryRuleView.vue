<!-- filepath: /Users/I589335/repos/mmt-devops-ui-cpi-delivery/src/views/DeliveryRuleView.vue -->
<template>
    <n-modal v-model:show="showModal" preset="dialog" :title="selDeliveryRule.ID ? 'Edit Delivery Rule' : 'Create Delivery Rule'">
        <template #header>
            <div>{{ selDeliveryRule.ID ? 'Edit Delivery Rule' : 'Create Delivery Rule' }}</div>
        </template>
        <n-flex vertical>
            <n-text strong depth="3">Name:</n-text>
            <n-input v-model:value="selDeliveryRule.Name" placeholder="Rule Name" />

            <n-text strong depth="3" style="margin-top: 10px;">Version Pattern (regex):</n-text>
            <n-input v-model:value="selDeliveryRule.VersionPattern" placeholder="e.g. 5.2.*, 6,2,*" />
            
            <n-text strong depth="3" style="margin-top: 10px;">Included Tenants:</n-text>
            <n-select
                    filterable
                    multiple
                    clearable
                    placeholder="Select Included Tenants"
                    :options="tenantOptions"
                    @update:value="(v: CpiTenant[]) => selDeliveryRule.IncludedTenants = v"
                />

            <n-flex>
                <n-tag type="info" v-for="tenant in selDeliveryRule.IncludedTenants" :key="tenant.ID">{{ tenant.Name }}</n-tag>
            </n-flex>

            <n-text strong depth="3" style="margin-top: 10px;">
                Active: <n-switch v-model:value="selDeliveryRule.Active" />
            </n-text>

            <n-text strong depth="3">
                Skip Approve:
                <n-switch v-model:value="selDeliveryRule.SkipApprove" />
            </n-text>

        </n-flex>
        <template #action>
            <n-button type="info" @click="onSave">Save</n-button>
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
            })).filter(op => !op.disabled)
        }
    },
    async created() {
        await this.refresh()
        this.cpiTenants = await GetCpiTenants() || []
        this.transportRoutes = await GetTransportRoutes()
    }
})
</script>