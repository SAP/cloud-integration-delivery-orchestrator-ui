<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

import { useRouter } from 'vue-router'
import ToastContainer from '@/components/toast/ToastContainer.vue'
import { setToastRef, initGlobalToast } from '@/components/toast/useToast'
import { CurrentUser } from './service/api'
import { useAuth } from './composables/useAuth'
import { wsClient } from './service/ws'
import "@ui5/webcomponents-fiori/dist/ShellBar.js"
import "@ui5/webcomponents-fiori/dist/ShellBarBranding.js"
import "@ui5/webcomponents-fiori/dist/UserMenu.js"
import "@ui5/webcomponents-fiori/dist/UserMenuAccount.js"
import "@ui5/webcomponents-fiori/dist/UserMenuItem.js"
import "@ui5/webcomponents-icons/dist/nav-back.js"
import "@ui5/webcomponents-icons/dist/sys-help.js"
import "@ui5/webcomponents-icons/dist/globe.js"
import "@ui5/webcomponents-icons/dist/role.js"
import "@ui5/webcomponents-icons/dist/key.js"
import "@ui5/webcomponents/dist/Avatar.js"
import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents-fiori/dist/ShellBarItem.js"

// Router
const router = useRouter()

// Auth
const { userScopes, userOrigin, loadScopes } = useAuth()

// Toast
const toastContainer = ref()

const userInfo = ref<{ [key: string]: any }>({})
const openMenu = ref(false)

// Lifecycle
onMounted(async () => {
  setToastRef(toastContainer.value)
  initGlobalToast()
  handleSpaToast()
  userInfo.value = await CurrentUser()
  loadScopes()
  wsClient.connect()
})

onUnmounted(() => {
  wsClient.disconnect()
})

// Browser-facing backend callbacks (e.g. the GitHub App manifest flow) 302 back
// here with a toast directive on the query string: ?toast=<success|error>&msg=<text>
// (RFC 010 doc 12, RP-3). The message is authored by the backend — the single
// source of truth, exactly like the OKMsg/Fail JSON convention — so this handler
// stays generic: show the toast, then strip only toast/msg (preserving any action
// flags such as openGitDialog that the destination view honors).
function handleSpaToast() {
  const query = router.currentRoute.value.query
  const toast = query.toast
  if (!toast) return
  const msg = typeof query.msg === 'string' ? query.msg : ''
  if (toast === 'error') window.$toast?.error(msg || 'Operation failed. Please try again.')
  else window.$toast?.success(msg || 'Done.')
  const rest = { ...query }
  delete rest.toast
  delete rest.msg
  router.replace({ query: rest })
}

function handleLogout(e: CustomEvent) {
  e.preventDefault()
  window.location.href = '/logout'
}

function handleBack() {
  const backTo = router.currentRoute.value.meta.backTo as string | undefined
  if (backTo) {
    router.push(backTo)
  } else {
    router.go(-1)
  }
}

function handleHelp() {
  window.open('https://github.com/SAP/cloud-integration-delivery-orchestrator', '_blank')
}

function handleMenuItemClick() {
  openMenu.value = false
}

// Computed
const canBack = computed(() => router.currentRoute.value.path !== '/')
const avatarInit = computed(
  () => `${userInfo.value.firstname?.charAt(0) || ''}${userInfo.value.lastname?.charAt(0) || ''}`
)
const userEmail = computed(() => userInfo.value.email || '')
const userName = computed(() => `${userInfo.value.firstname || ''} ${userInfo.value.lastname || ''}`)
const userRoles = computed(() =>
  (userInfo.value.groups || []).map((g: any) => g.display || g.value)
)
</script>

<template>
  <ui5-shellbar>
    <ui5-shellbar-branding @click="() => router.push('/')" slot="branding">
      Delivery Orchestrator
      <img slot="logo" src="/sap-logo.svg" />
    </ui5-shellbar-branding>
    <ui5-button v-if="canBack" @click="handleBack" icon="nav-back" slot="startButton"></ui5-button>
    <ui5-shellbar-item @click="handleHelp" icon="sys-help" text="Help"></ui5-shellbar-item>
    <ui5-avatar
      @click="() => { openMenu = !openMenu }"
      id="user-menu-opener"
      slot="profile"
      :initials="avatarInit"></ui5-avatar>
  </ui5-shellbar>

  <ui5-user-menu
    opener="user-menu-opener"
    :open="openMenu"
    @item-click="handleMenuItemClick"
    @sign-out-click="handleLogout"
    @close="() => { openMenu = false }"
  >
    <ui5-user-menu-account slot="accounts"
      :title-text="userName"
      :subtitle-text="userEmail"
      :avatar-initials="avatarInit"
    ></ui5-user-menu-account>

    <ui5-user-menu-item text="Identity Provider" icon="globe">
      <ui5-user-menu-item :text="userOrigin"></ui5-user-menu-item>
    </ui5-user-menu-item>

    <ui5-user-menu-item v-if="userRoles.length" text="Roles" icon="role">
      <ui5-user-menu-item
        v-for="role in userRoles"
        :key="role"
        :text="role"
      ></ui5-user-menu-item>
    </ui5-user-menu-item>

    <ui5-user-menu-item v-if="userScopes.length" text="Scopes" icon="key">
      <ui5-user-menu-item
        v-for="scope in userScopes"
        :key="scope"
        :text="scope"
      ></ui5-user-menu-item>
    </ui5-user-menu-item>
  </ui5-user-menu>

  <div class="body-class">
    <ToastContainer ref="toastContainer" />
    <router-view />
  </div>
</template>

<style scoped>
.body-class {
  margin-top: 10px;
}
</style>
