<script lang="ts">
import { defineComponent } from 'vue'
import { IosArrowBack } from '@vicons/ionicons4'
import MessageItem from '@/components/MessageComp.vue'
import { useUserInfoStore, type UserInfo } from './service/api'
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
    }
  },
  data() {
    return {
      route: this.$router
    }
  },
  computed: {
    canBack() {
      return this.$router.currentRoute.value.path !== '/'
    },
    avartarSrc() {
      const userInfo = useUserInfoStore().user as UserInfo
      if (userInfo) {
        // doug.liu@sap.com => DL
        const emailParts = userInfo.email.split('.')
        if (emailParts.length >= 2) {
          return (emailParts[0][0] + emailParts[1][0]).toUpperCase()
        }
      }
      return '?'
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
      <n-avatar style="margin-right: 10px" round size="medium">{{ avartarSrc }}</n-avatar>
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
