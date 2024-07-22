import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/jobs',
      name: 'Jobs',
      children: [
        {
          path: 'import',
          name: 'Import Jobs',
          component: () => import('@/views/ImportJobView.vue')
        },
        {
          path: 'deploy',
          name: 'Deploy Jobs',
          component: import('@/views/DeployJobView.vue')
        },
        {
          path: 'undeploy',
          name: 'Undeploy Jobs',
          component: import('@/views/UndeployJobView.vue')
        }
      ]
    },
    {
      path: '/flow',
      name: 'flow',
      component: () => import('@/views/FlowView.vue')
    },
    {
      path: '/config',
      name: 'Configuration',
      children: [
        {
          path: 'tms-endpoints',
          name: 'Configure TMS Endpoints',
          component: () => import('@/views/TmsConfigView.vue')
        },
        {
          path: 'cpi-tenants',
          name: 'Configure CPI Tenants',
          component: () => import('@/views/CpiConfigView.vue')
        }
      ]
    }
  ]
})

export default router
