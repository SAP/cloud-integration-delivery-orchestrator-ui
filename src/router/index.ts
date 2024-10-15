import { useUserInfoStore } from '@/service'
import { callbackUrl, clientId } from '@/service/consts'
import { createRouter, createWebHistory } from 'vue-router'

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
      component: () => import('@/views/LoginCallback.vue'),
    }
  ]
})

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
