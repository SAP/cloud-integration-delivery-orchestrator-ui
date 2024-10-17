<template>
  <div />
</template>

<script lang="ts">
import { Login, useUserInfoStore, type UserInfo } from '@/service/api'
import { callbackUrl } from '@/service/consts';
import { defineComponent } from 'vue'
export default defineComponent({
  created() {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    if (code === null || state === null) {
      window.$message.error('Invalid callback params, code or state not found.')
      return
    }
    Login(code, state, callbackUrl).then((res) => {
      const userInfo = res as unknown as UserInfo
      window.localStorage.setItem('userInfo', JSON.stringify(userInfo))
      useUserInfoStore().userInfo = userInfo
      this.$router.push('/')
    })
  }
})
</script>
