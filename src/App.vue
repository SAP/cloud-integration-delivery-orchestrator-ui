<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

import { useRouter } from 'vue-router'
import MessageItem from '@/components/MessageComp.vue'
import { CurrentUser } from './service/api'
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

const userInfo = ref<{ [key: string]: string }>({})
const openProfile = ref(false)

// Lifecycle: load current user
onMounted(async () => {
  userInfo.value = await CurrentUser()
})

function handleLogout() {
  window.location.href = '/logout'
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
    <ui5-shellbar-item icon="sys-help" text="Help"></ui5-shellbar-item>
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
    <n-message-provider placement="bottom-left">
      <MessageItem />
      <router-view />
    </n-message-provider>
  </div>
</template>

<style scoped>
.body-class {
  margin-top: 10px;
}
</style>
