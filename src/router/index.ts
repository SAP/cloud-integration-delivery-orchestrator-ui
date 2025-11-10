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
      name: 'Cloud Integration Delployment and Transport',
      children: [
        {
          path: 'delivery-request-list',
          name: 'Delivery Requests',
          component: () => import('@/views/DeliveryRequestListView.vue')
        },
      ]
    },
    {
      path: '/config',
      name: 'Delivery Configurations',
      children: [
        {
          path: 'cpi-tenants',
          name: 'CPI Tenants',
          component: () => import('@/views/CpiTenantsView.vue')
        },
        {
          path: 'delivery-rule',
          name: 'Delivery Rule',
          component: () => import('@/views/DeliveryRuleView.vue')
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
