<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { IosArrowBack } from '@vicons/ionicons4'
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

type UserInfo = {
  firstname?: string
  lastname?: string
  email?: string
  [key: string]: any
}

// Router
const router = useRouter()
// Expose as `route` to keep existing template usage (route.currentRoute.name)
const route = router

// State
const userInfo = ref<UserInfo>({})
const pop = ref<any | null>(null)

// Lifecycle: load current user
onMounted(async () => {
  userInfo.value = await CurrentUser()
})

// Methods
function handleBack() {
  router.go(-1)
}

function handleHome() {
  router.push('/')
}

function handleLogout() {
  window.location.href = '/logout'
}

function openPop(e: Event) {
  pop.value?.showAt((e.target as HTMLElement) || undefined)
}

// Computed
const canBack = computed(() => router.currentRoute.value.path !== '/')
const avartarSrc = computed(
  () => `${userInfo.value.firstname?.charAt(0) || ''}${userInfo.value.lastname?.charAt(0) || ''}`
)
const userEmail = computed(() => userInfo.value.email)
</script>

<template>
  <ui5-shellbar>
    <ui5-shellbar-branding slot="branding">
      MMT DevOps
      <img slot="logo" src="https://ui5.github.io/webcomponents/images/sap-logo-svg.svg" />
    </ui5-shellbar-branding>
    <ui5-button v-if="canBack" @click="handleBack" icon="nav-back" slot="startButton"></ui5-button>
    <ui5-shellbar-item icon="sys-help" text="Help"></ui5-shellbar-item>
    <ui5-avatar @click="openPop" slot="profile" :initials="avartarSrc"></ui5-avatar>
  </ui5-shellbar>

  <ui5-popover ref="pop" header-text="Newsletter subscription" placement="Bottom">

      <!-- <div class="popover-content">
          <ui5-label for="emailInput" required show-colon>Email</ui5-label>
          <ui5-input id="emailInput" style="min-width: 150px;" placeholder="Enter Email"></ui5-input>
          <ui5-label>Note: If you open the page in mobile, a dialog would be displayed.</ui5-label>
      </div> -->

      <div slot="footer" class="popover-footer">
          <ui5-button id="closePopoverButton" design="Emphasized">Subscribe</ui5-button>
      </div>

  </ui5-popover>



  <div class="header-class">
    <n-flex justify="space-between">
      <n-flex>
        <n-icon size="30px">
          <IosArrowBack @click="handleBack" v-if="canBack" />
        </n-icon>
        <n-image width="70" src="/SAP_BIG.png" preview-disabled @click="handleHome" />
  <h2>{{ router.currentRoute.value.name }}</h2>
      </n-flex>
      <n-popover trigger="hover">
        <template #trigger>
          <n-avatar style="margin-right: 10px" round size="medium">{{ avartarSrc }}</n-avatar>
        </template>
        {{ userEmail }}
        <div style="text-align:center; padding:8px;">
          <a href="/logout" style="cursor:pointer; color:#007bff; display:inline-block;">
            Log Out
          </a>
        </div>
      </n-popover>
    </n-flex>
  </div>

  <div class="body-class">
    <n-message-provider placement="bottom-left">
      <MessageItem />
      <router-view />
    </n-message-provider>
  </div>
</template>

<style scoped>
.header-class {
  width: 100%;
  z-index: 999;
  background-color: white;
  box-shadow: 0 3px 5px gray;
  position: sticky;
  top: 0;
}

.n-flex {
  align-items: center;
}

.body-class {
  margin-top: 10px;
}
</style>
