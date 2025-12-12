import { c } from 'naive-ui'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'MMT Devops',
      component: () => import('@/views/HomeView.vue'),
      meta: { description: 'Home' }
    },
    {
      path: '/jobs',
      name: 'Cloud Integration Delployment and Transport',
      meta: { description: 'Jobs Root' },
      children: [
        {
          path: 'delivery-request-list',
          name: 'Delivery Requests',
          component: () => import('@/views/DeliveryRequestListView.vue'),
          meta: { description: 'Transport, Deploy Artifacts to CPI Tenants', countPath: '/api/v1/deliveryRequest/counts' }
        },
      ]
    },
    {
      path: '/config',
      name: 'Delivery Configurations',
      meta: { description: 'Configurations Root' },
      children: [
        {
          path: 'cpi-tenants',
          name: 'CPI Tenants',
          component: () => import('@/views/CpiTenantsView.vue'),
          meta: { description: 'Manage CPI Tenants', countPath: '/api/v1/deliveryRequest/counts' }
        },
        {
          path: 'delivery-rule',
          name: 'Delivery Rule',
          component: () => import('@/views/DeliveryRuleView.vue'),
          meta: { description: 'Configure Delivery Rules', countPath: '/api/v1/deliveryRequest/counts' }
        }
      ]
    },
    {
      path: '/delivery-request/:planId',
      name: 'Maintain Delivery Request',
      component: () => import('@/views/DeliveryRequestView.vue'),
      props: route => ({ planId: Number(route.params.planId) })
    }
  ]
})

router.beforeEach((to, from) => {
  return true
})

export default router
