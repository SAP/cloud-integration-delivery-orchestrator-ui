<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

import { useRouter } from 'vue-router'
import ToastContainer from '@/components/toast/ToastContainer.vue'
import { setToastRef, initGlobalToast } from '@/components/toast/useToast'
import { CurrentUser } from './service/api'
import { sseClient } from './service/sse'
import "@ui5/webcomponents-fiori/dist/ShellBar.js"
import "@ui5/webcomponents-fiori/dist/ShellBarBranding.js"
import "@ui5/webcomponents-icons/dist/nav-back.js"
import "@ui5/webcomponents-icons/dist/sys-help.js"
import "@ui5/webcomponents/dist/Avatar.js"
import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents-fiori/dist/ShellBarItem.js"
import "@ui5/webcomponents/dist/Popover.js"
import "@ui5/webcomponents/dist/Icon.js";
import "@ui5/webcomponents-icons/dist/log.js";
import "@ui5/webcomponents/dist/List.js";
import "@ui5/webcomponents/dist/ListItemStandard.js";
// Router
const router = useRouter()

// Toast
const toastContainer = ref()

const userInfo = ref<{ [key: string]: string }>({})
const openProfile = ref(false)

// Lifecycle
onMounted(async () => {
  setToastRef(toastContainer.value)
  initGlobalToast()
  userInfo.value = await CurrentUser()
  sseClient.connect('/api/v1/events')
})

onUnmounted(() => {
  sseClient.disconnect()
})

function handleLogout() {
  window.location.href = '/logout'
}

function handleHelp() {
  window.open('https://wiki.one.int.sap/wiki/x/ZUH3WQE', '_blank')
}

// Computed
const canBack = computed(() => router.currentRoute.value.path !== '/')
const avatarInit = computed(
  () => `${userInfo.value.firstname?.charAt(0) || ''}${userInfo.value.lastname?.charAt(0) || ''}`
)
const userEmail = computed(() => userInfo.value.email)
const userName = computed(() => `${userInfo.value.firstname || ''} ${userInfo.value.lastname || ''}`)
</script>

<template>
  <ui5-shellbar>
    <ui5-shellbar-branding @click="() => router.push('/')" slot="branding">
      MMT DevOps
      <img slot="logo" src="https://ui5.github.io/webcomponents/images/sap-logo-svg.svg" />
    </ui5-shellbar-branding>
    <ui5-button v-if="canBack" @click="() => router.go(-1)" icon="nav-back" slot="startButton"></ui5-button>
    <ui5-shellbar-item @click="handleHelp" icon="sys-help" text="Help"></ui5-shellbar-item>
    <ui5-avatar 
      @click="() => { openProfile = !openProfile }" 
      id="pop-user-profile" 
      slot="profile"
      :initials="avatarInit"></ui5-avatar>
  </ui5-shellbar>

  <ui5-popover opener="pop-user-profile" :open="openProfile" :header-text="userName" placement="Bottom">
    <div class="popover-content">
      <ui5-label>{{ userEmail }}</ui5-label>

      <ui5-list separators="None" style="margin-block-end: 0.75rem;">
        <ui5-li additional-text="Sign Out" icon="log" @click="handleLogout">
        </ui5-li>
      </ui5-list>
      
    </div>
  </ui5-popover>

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
