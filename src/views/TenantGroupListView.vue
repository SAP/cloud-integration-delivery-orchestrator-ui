<template>
	<n-modal v-model:show="showModal" preset="dialog" title="Tenant Group">
		<template #header>
			<div>{{ selectedGroup.ID ? 'Edit' : 'Create' }} Tenant Group</div>
		</template>
		<div class="form-row">
			<span class="lbl">Name:</span>
			<n-input v-model:value="selectedGroup.Name" placeholder="Group Name" />
		</div>
		<div class="form-row">
			<span class="lbl">Description:</span>
			<n-input v-model:value="selectedGroup.Description" placeholder="Description" />
		</div>
		<div class="form-row">
			<span class="lbl">Tenants:</span>
			<n-select
				v-model:value="selectedTenantIDs"
				:options="tenantOptions"
				filterable
				multiple
				placeholder="Select CPI Tenants"
				@update:value="onTenantSelection"
			/>
		</div>
		<template #action>
			<n-button @click="onCancel">Cancel</n-button>
			<n-button type="primary" @click="onSave">Save</n-button>
		</template>
	</n-modal>

	<data-table
		title="Tenant Groups"
		:data="groups"
		:columns="columns"
		:custom-tool-bars="toolBars"
		:handle-add="handleAdd"
		:row-key="(row: TenantGroup) => row.ID"
		:key="groups.length"
	/>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import DataTable from '@/components/DataTable.vue'
import { type ToolBar } from '@/service/consts'
import { GetTenantGroups, CreateTenantGroup, UpdateTenantGroup, DeleteTenantGroup, GetCpiTenants } from '@/service/api'
import type { TenantGroup, CpiTenant } from '@/service/model'
export default defineComponent({
	components: { DataTable },
	data() {
		const columns = [
			{ title: 'ID', key: 'ID', width: 70 },
			{ title: 'Name', key: 'Name' },
			{ title: 'Tenants', key: 'TenantNames', render: (row: TenantGroup) => (row.Tenants && row.Tenants.length ? row.Tenants.map(t => t.Name).join(', ') : '-') },
			{ title: 'Description', key: 'Description' },
			{ title: 'UpdatedAt', key: 'UpdatedAt' },
		]
		const toolBars: ToolBar<TenantGroup>[] = [
			{ text: 'Delete', func: (rows: TenantGroup[]) => this.handleDelete(rows) },
			{ text: 'Edit', func: (rows: TenantGroup[]) => this.handleEdit(rows) }
		]
		return {
			columns,
			toolBars,
			groups: [] as TenantGroup[],
			showModal: false,
			selectedGroup: {} as TenantGroup,
			tenants: [] as CpiTenant[],
			tenantOptions: [] as { label: string; value: number }[],
			selectedTenantIDs: [] as number[]
		}
	},
	methods: {
		async refresh() {
			this.groups = await GetTenantGroups()
			this.groups.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''))
		},
		async loadTenants() {
			this.tenants = await GetCpiTenants()
			this.tenantOptions = this.tenants.map(t => ({ label: t.Name, value: t.ID }))
		},
		handleAdd() {
			this.selectedGroup = { ID: 0 } as TenantGroup
			this.selectedTenantIDs = []
			this.showModal = true
		},
		handleEdit(rows: TenantGroup[]) {
			if (!rows.length) { window.$message.warning('Select one group to edit'); return }
			const g = rows[0]
			this.selectedGroup = { ...g }
			this.selectedTenantIDs = (g.Tenants || []).map(t => t.ID)
			this.showModal = true
		},
		async handleDelete(rows: TenantGroup[]) {
			if (!rows.length) { window.$message.warning('Select at least one group'); return }
			await DeleteTenantGroup(rows[0].ID)
			await this.refresh()
			window.$message.success('Deleted tenant group')
		},
		onTenantSelection(ids: number[]) {
			this.selectedTenantIDs = ids
			// Attach tenant objects to selectedGroup for submission convenience
			this.selectedGroup.Tenants = this.tenants.filter(t => ids.includes(t.ID))
		},
		onCancel() { this.showModal = false },
		async onSave() {
			// Ensure Tenants set
			this.selectedGroup.Tenants = this.tenants.filter(t => this.selectedTenantIDs.includes(t.ID))
			if (!this.selectedGroup.Name) { window.$message.warning('Name required'); return }
			if (this.selectedGroup.ID === 0) {
				await CreateTenantGroup(this.selectedGroup as any)
				window.$message.success('Created tenant group')
			} else {
				await UpdateTenantGroup(this.selectedGroup as any)
				window.$message.success('Updated tenant group')
			}
			await this.refresh()
			this.showModal = false
		}
	},
	async created() {
		await this.refresh()
		await this.loadTenants()
	}
})
</script>

<style scoped>
.form-row { display: flex; align-items: center; margin-bottom: 12px; }
.form-row .lbl { width: 110px; font-size: 12px; color: #555; }
</style>