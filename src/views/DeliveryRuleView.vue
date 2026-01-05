<!-- filepath: /Users/I589335/repos/mmt-devops-ui-cpi-delivery/src/views/DeliveryRuleView.vue -->
<template>
    <ui5-dialog
        :header-text="selDeliveryRule.ID ? 'Edit Delivery Rule' : 'Create Delivery Rule'"
        :open="showModal"
        @close="showModal = false"
    >
        <div class="flex-vertical">
            <div style="font-weight: bold;">Name:</div>
            <n-input v-model:value="selDeliveryRule.Name" placeholder="Rule Name" />

            <div style="font-weight: bold; margin-top: 10px;">Version Pattern (regex):</div>
            <n-input v-model:value="selDeliveryRule.VersionPattern" placeholder="e.g. 5.2.*, 6,2,*" />

            <div style="font-weight: bold; margin-top: 10px;">Included Tenants:</div>
            <n-select
                filterable
                multiple
                clearable
                :options="tenantOptions"
                @update:value="(v: CpiTenant[]) => selDeliveryRule.IncludedTenants = v"
            />

            <div class="flex-row">
                <n-tag type="info" v-for="tenant in selDeliveryRule.IncludedTenants" :key="tenant.ID">{{ tenant.Name }}</n-tag>
            </div>

            <div style="font-weight: bold; margin-top: 10px;">
                Active: <n-switch v-model:value="selDeliveryRule.Active" />
            </div>

            <div style="font-weight: bold;">
                Skip Approve:
                <n-switch v-model:value="selDeliveryRule.SkipApprove" />
            </div>
        </div>
        <ui5-toolbar slot="footer">
            <ui5-toolbar-button design="Emphasized" text="Save" @click="onSave"></ui5-toolbar-button>
            <ui5-toolbar-button design="Transparent" text="Cancel" @click="showModal = false"></ui5-toolbar-button>
        </ui5-toolbar>
    </ui5-dialog>

    <data-table
        title="Delivery Rules"
        :columns="deliveryRuleColumns"
        :data="rules"
        :custom-tool-bars="toolBars"
        :handle-add="handleAdd"
        :row-key="(row: DeliveryRule) => row.ID"
        :key="rules.length"
        :loading="loading"
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
import "@ui5/webcomponents/dist/Dialog.js";
import "@ui5/webcomponents/dist/Toolbar.js";
import "@ui5/webcomponents/dist/ToolbarButton.js";

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
            loading: false,
        }
    },
    methods: {
        async refresh() {
            this.loading = true
            this.rules = await GetDeliveryRules() || []
            this.rules.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''))
            this.showModal = false
            this.loading = false
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
            if (include.length === 0) {
                return this.cpiTenants.map(t => ({
                    label: t.Name,
                    value: t,
                    disabled: false
                }))
            }
            const includeRoutes = this.transportRoutes.filter(
                route => include.some(t => t.TransportNodeID === route.sourceNodeId)
            )
            return this.cpiTenants.map(t => ({
                label: t.Name,
                value: t, 
                disabled: !includeRoutes.some(route => route.targetNodeId === t.TransportNodeID) 
            }))
        }
    },
    async created() {
        await this.refresh()
        this.cpiTenants = await GetCpiTenants() || []
        this.transportRoutes = await GetTransportRoutes()
    }
})
</script>

<style scoped>
.flex-vertical {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.flex-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
</style>
