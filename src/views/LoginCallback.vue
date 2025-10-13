<template>
  <div />
</template>

<script lang="ts">
import { Login, useUserInfoStore } from '@/service/api'
import { callbackUrl } from '@/service/consts';
import type { UserInfo } from '@/service/model';
import { defineComponent } from 'vue'
export default defineComponent({
  created() {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    if (code === null || state === null) {
      window.$message.error('Oauth login failed: Invalid callback params, code or state not found.')
      return
    }
    Login(code, state, callbackUrl)
      .then((user: UserInfo) => {
        useUserInfoStore().setUser(user)
        window.$message.info('Login success')
        this.$router.push('/')
    })
  }
})
</script>
