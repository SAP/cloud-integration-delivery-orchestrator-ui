import http from '@/service/http'
import type { AppCount } from '@/service/model'
import type { AggregateStatus } from '@/service/statuses'
import { createRouter, createWebHistory } from 'vue-router'

const deliveryRequestCounts = async (): Promise<AppCount> => {
  const counts = (await http.get('/api/v1/deliveryRequest/counts')) as {
    Total: number
    StatusCounts: Record<AggregateStatus, number>
  }
  return {
    Total: counts.Total,
    StatusCounts: {
      'pending': counts.StatusCounts.PENDING,
      'waiting approval': counts.StatusCounts.WAITING_APPROVAL,
    }
  }
}

const cpiTenantCounts = async (): Promise<AppCount> => {
  const counts = (await http.get('/api/v1/cpiTenant/counts')) as AppCount
  return counts
}

const deliveryRuleCounts = async (): Promise<AppCount> => {
  const counts = (await http.get('/api/v1/deliveryRule/counts')) as AppCount
  return counts
}

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
          meta: { description: 'Transport, Deploy Artifacts to CPI Tenants', statusCount: deliveryRequestCounts,
              width: '20rem',
              height: '11rem'
           }
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
          meta: { description: 'Manage CPI Tenants', statusCount: cpiTenantCounts }
        },
        {
          path: 'delivery-rule',
          name: 'Delivery Rule',
          component: () => import('@/views/DeliveryRuleView.vue'),
          meta: { description: 'Manage Delivery Rules', statusCount: deliveryRuleCounts }
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
