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
          name: 'Import',
          component: () => import('@/views/ImportJobView.vue')
        },
        {
          path: 'deploy',
          name: 'Delivery',
          component: () => import('@/views/DeployJobView.vue')
        }
      ]
    },
    {
      path: '/tools',
      name: 'Delivery Configurations',
      children: [
        {
          path: 'parse',
          name: 'Transport Plan',
          component: () => import('@/views/TransportPlanListView.vue')
        },
        {
          path: 'transportGroup',
          name: 'Transport Group',
          component: () => import('@/views/TransportGroupListView.vue')
        },
        {
          path: 'cpiTenants',
          name: 'CPI Tenants',
          component: () => import('@/views/CpiTenantsView.vue')
        },
        {
          path: 'deliveryRule',
          name: 'Delivery Rule',
          component: () => import('@/views/DeliveryRuleView.vue')
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
    },
    {
      path: '/transportplan/:planId',
      name: 'Transport&Delivery Plan',
      component: () => import('@/views/TransportPlanView.vue'),
      props: true
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
