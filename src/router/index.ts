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
          component: () => import('@/views/DeployJobView.vue')
        },
        {
          path: 'undeploy',
          name: 'Undeploy Jobs',
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
  ]
})

export default router
