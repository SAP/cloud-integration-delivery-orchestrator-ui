<template>
  <n-card
    style="width: 600px"
    :title="`Edit Cpi Tenant: ${endpoint.description}`"
    :bordered="false"
    size="huge"
    role="dialog"
    aria-modal="true"
  >
    <template #header-extra> {{ endpoint.status }} </template>
    <n-form>
      <n-form-item label="Cpi Tenant Name">
        <n-input v-model:value="endpoint.description" />
      </n-form-item>
      <n-form-item label="Uaa Token Url">
        <n-input
          v-model:value="endpoint.tokenUrl"
          placeholder="eg: https://stage-devops.authentication.sap.hana.ondemand.com/oauth/token"
        />
      </n-form-item>
      <n-form-item label="Credentials">
        <n-input v-model:value="endpoint.credentialId" placeholder="client id" />
        <n-input v-model:value="endpoint.credentialSecret" placeholder="client secret" />
      </n-form-item>
      <n-form-item label="Api Endpoint Url">
        <n-input v-model:value="endpoint.endpointUrl" />
      </n-form-item>
    </n-form>

    <template #footer>
      <n-flex justify="end">
        <n-button @click="handleCheck" :loading="checking" type="warning" ghost
          >Check Connection</n-button
        >
        <n-button @click="handleSave" :loading="saving" type="primary" ghost>Save</n-button>
        <n-button @click="$emit('update:show', false)">Cancel</n-button>
      </n-flex>
    </template>
  </n-card>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { type ApiEndpoint } from '@/service/api'
export default defineComponent({
  props: {
    value: { type: Object as PropType<ApiEndpoint>, require: true }
  },
  data() {
    const endpoint: ApiEndpoint = { ...this.value }
    const checking = false
    const saving = false
    return { endpoint, checking, saving }
  },
  methods: {
    handleSave() {
      this.saving = true
      setTimeout(() => {
        this.saving = false
        this.$emit('update:show', false)
      }, 2000)
    },
    handleCheck() {
      this.checking = true
      setTimeout(() => {
        this.checking = false
      }, 2000)
    }
  },
  emits: ['update:show']
})
</script>
