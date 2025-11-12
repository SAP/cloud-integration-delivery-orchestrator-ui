<script lang="ts">
import { defineComponent } from 'vue'
import { IosArrowBack } from '@vicons/ionicons4'
import MessageItem from '@/components/MessageComp.vue'
import { UserInfo } from './service/api';
export default defineComponent({
  components: {
    IosArrowBack,
    MessageItem
  },
  methods: {
    handleBack() {
      this.$router.go(-1)
    },
    handleHome() {
      this.$router.push('/')
    },
    handleLogout() {
      window.location.href = '/logout'
    }
  },
  data() {
    return {
      userInfo: {} as {[key: string]: string},
      route: this.$router
    }
  },
  async created() {
    // {"firstname":"Doug","lastname":"Liu","email":"doug.liu@sap.com","name":"doug.liu@sap.com","displayName":"Doug Liu (doug.liu@sap.com)"
    // "scopes":["Devops!t14446.AppTestAutoCfgFValORules","Devops!t14446.TO_Write","Devops!t14446.SendEDIFACT","Devops!t14446.AppEDIEditorAHBVarGenEF"]}
    this.userInfo = await UserInfo()
  },
  computed: {
    canBack() {
      return this.$router.currentRoute.value.path !== '/'
    },
    avartarSrc() {
      return `${this.userInfo.firstname?.charAt(0) || ''}${this.userInfo.lastname?.charAt(0) || ''}`
    },
    userEmail() {
      return this.userInfo.email
    }
  }
})
</script>

<template>
  <div class="header-class">
    <n-flex justify="space-between">
      <n-flex>
        <n-icon size="30px">
          <IosArrowBack @click="handleBack" v-if="canBack" />
        </n-icon>
        <n-image width="70" src="/SAP_BIG.png" preview-disabled @click="handleHome" />
        <h2>{{ route.currentRoute.name }}</h2>
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
