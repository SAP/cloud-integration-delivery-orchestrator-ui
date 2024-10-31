import { useUserInfoStore } from '@/service/api'
import { authUrl } from '@/service/consts'
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
      name: 'Jobs of Cloud Integration and Transport',
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
    window.location.href = authUrl
    return false
  }
  return true
})

export default router
