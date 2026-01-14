<!-- filepath: /Users/I589335/repos/mmt-devops-ui-cpi-delivery/src/views/DeliveryRuleView.vue -->
<template>
    <ui5-dialog
        :header-text="selDeliveryRule.ID ? 'Edit Delivery Rule' : 'Create Delivery Rule'"
        :open="showModal"
        @close="showModal = false"
        style="width: 30%;"
    >
        <div class="flex-vertical">
            <ui5-text style="font-weight: bold;">Name:</ui5-text>
            <ui5-input
                :value="selDeliveryRule.Name || ''"
                @change="selDeliveryRule.Name = $event.target.value"
                placeholder="Rule Name"
                style="width: 100%;"
            />

            <ui5-text style="font-weight: bold;">Version Pattern (regex):</ui5-text>
            <ui5-input
                :value="selDeliveryRule.VersionPattern || ''"
                @change="selDeliveryRule.VersionPattern = $event.target.value"
                placeholder="e.g. 5.2.*, 6,2,*"
                style="width: 100%;"
            />

            <ui5-text style="font-weight: bold;">Included Tenants:</ui5-text>
            <ui5-multi-combobox
                show-clear-icon
                show-select-all
                @selection-change="handleTenantSelectionChange"
                style="width: 80%;">
                <ui5-mcb-item
                    v-for="option in tenantOptions"
                    :id="String(option.value.ID)"
                    :text="option.label"
                    :additional-text="String(option.value.ID)"
                    :selected="selDeliveryRule.IncludedTenants?.some(t => t.ID === option.value.ID)"
                    :style="option.disabled ? 'pointer-events: none; opacity: 0.5;' : ''"
                />
            </ui5-multi-combobox>

            <div class="flex-row">
                <ui5-tag
                    v-for="tenant in selDeliveryRule.IncludedTenants"
                    :key="tenant.ID"
                    design="Set2"
                    color-scheme="5"
                >
                    {{ tenant.Name }}
                </ui5-tag>
            </div>

            <div class="switch-row">
                <div class="switch-item">
                    <ui5-text style="margin-right: 0.5rem; font-weight: bold;">Active:</ui5-text>
                    <ui5-switch
                        :checked="selDeliveryRule.Active"
                        @change="selDeliveryRule.Active = $event.target.checked"
                    />
                </div>
                <div class="switch-item">
                    <ui5-text style="margin-right: 0.5rem; font-weight: bold;">Skip Approve:</ui5-text>
                    <ui5-switch
                        :checked="selDeliveryRule.SkipApprove"
                        @change="selDeliveryRule.SkipApprove = $event.target.checked"
                    />
                </div>
                <div class="switch-item">
                    <ui5-text style="margin-right: 0.5rem; font-weight: bold;">Require Jira:</ui5-text>
                    <ui5-switch
                        :checked="selDeliveryRule.RequireJira"
                        @change="selDeliveryRule.RequireJira = $event.target.checked"
                    />
                </div>
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
import "@ui5/webcomponents/dist/Input.js";
import "@ui5/webcomponents/dist/Switch.js";
import "@ui5/webcomponents/dist/MultiComboBox.js";
import "@ui5/webcomponents/dist/MultiComboBoxItem.js";
import "@ui5/webcomponents/dist/Tag.js";
import "@ui5/webcomponents/dist/Text.js";

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
        },
        handleTenantSelectionChange(event: any) {
            const selectedItems = event.detail.items
            const selectedTenants = selectedItems.map((item: any) => {
                return this.cpiTenants.find(t => t.ID === Number(item.id))
            }).filter((t: any) => t)
            this.selDeliveryRule.IncludedTenants = selectedTenants
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
    gap: 8px;
}

.flex-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.switch-row {
    display: flex;
    gap: 2rem;
}

.switch-item {
    display: flex;
    align-items: center;
}
</style>
