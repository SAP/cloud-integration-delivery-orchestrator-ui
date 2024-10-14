import { Login, useUserInfoStore, type UserInfo } from '@/service'
import { createRouter, createWebHistory } from 'vue-router'

const LoginCallback = {
  mounted() {
    
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
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'MMT Devops',
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/jobs',
      name: 'CPI Jobs',
      children: [
        {
          path: 'import',
          name: 'Import Transport Requests',
          component: () => import('@/views/ImportJobView.vue')
        },
        {
          path: 'deploy',
          name: 'Deploy Design Time Artifacts',
          component: () => import('@/views/DeployJobView.vue')
        },
        {
          path: 'undeploy',
          name: 'Undeploy Design Time Artifacts',
          component: () => import('@/views/UndeployJobView.vue')
        }
      ]
    },
    {
      path: '/flow/:jobId',
      name: 'Job Flow',
      component: () => import('@/views/FlowView.vue'),
      props: true
    },
    {
      path: '/callback',
      name: 'Oauth',
      component: LoginCallback
    }
  ]
})

const callbackUrl = 'https://mmt-ui-app-iflow-deploy.cfapps.sap.hana.ondemand.com/callback'
const clientId = 'e413f654a5f193da8bed'

router.beforeEach((to, from) => {
  const isLogged = useUserInfoStore().isLogged()
  if (!isLogged && to.path !== '/callback') {
    window.$message.info('Redirect to login')
    window.location.href =
      `https://github.wdf.sap.corp/login/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${callbackUrl}&state=123`
    return false
  }
  return true
})

export default router
