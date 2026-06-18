import http from '@/service/http'
import type { AppCount } from '@/service/model'
import type { AggregateStatus } from '@/service/statuses'
import { createRouter, createWebHistory } from 'vue-router'

const deliveryRequestCounts = async (): Promise<AppCount> => {
  const counts = (await http.get('/api/v1/deliveryRequest/counts')) as {
    Total: number
    StatusCounts: Record<AggregateStatus, number>
  }
  const failed = (counts.StatusCounts.IMPORT_FAILED ?? 0) + (counts.StatusCounts.DEPLOY_FAILED ?? 0) + (counts.StatusCounts.FAILED ?? 0)
  const inProgress =
    (counts.StatusCounts.IMPORTING ?? 0) +
    (counts.StatusCounts.DEPLOYING ?? 0) +
    (counts.StatusCounts.AWAITING_IMPORT ?? 0) +
    (counts.StatusCounts.AWAITING_DEPLOY ?? 0)
  return {
    Total: counts.Total,
    StatusCounts: {
      'waiting approval': counts.StatusCounts.WAITING_APPROVAL,
      'in progress': inProgress,
      'failed': failed,
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

const versionCompareCounts = async (): Promise<AppCount> => {
  const counts = (await http.get('/api/v1/versionCompare/counts')) as AppCount
  return counts
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'CPI Delivery',
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
              requiredScope: 'DeliveryRequest.Read',
              width: '20rem',
              height: '11rem'
           }
        },
        {
          path: 'version-compare',
          name: 'Version Compare',
          component: () => import('@/views/VersionCompareView.vue'),
          meta: { description: 'Compare Artifact Versions Across Tenants', statusCount: versionCompareCounts,
              requiredScope: 'VersionCompare.Read',
              width: '20rem',
              height: '11rem'
           }
        },
        {
          path: 'operation-history',
          name: 'Operation History',
          component: () => import('@/views/OperationHistoryView.vue'),
          meta: { description: 'Audit Transport and Deploy Operations',
              requiredScope: 'DeliveryRequest.Read',
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
          meta: { description: 'Manage CPI Tenants', statusCount: cpiTenantCounts, requiredScope: 'CpiTenant.Read' }
        },
        {
          path: 'delivery-rule',
          name: 'Delivery Rule',
          component: () => import('@/views/DeliveryRuleView.vue'),
          meta: { description: 'Manage Delivery Rules', statusCount: deliveryRuleCounts, requiredScope: 'DeliveryRule.Read' }
        },
        {
          path: 'system-config',
          name: 'System Configuration',
          component: () => import('@/views/SystemConfigView.vue'),
          meta: { description: 'Integration Registry & Connectivity Check', requiredScope: 'CpiTenant.Manage' }
        }
      ]
    },
    {
      path: '/delivery-request/:planId',
      name: 'Maintain Delivery Request',
      component: () => import('@/views/DeliveryRequestView.vue'),
      props: route => ({ planId: Number(route.params.planId) })
    },
    {
      path: '/jobs/version-compare/:ruleId',
      name: 'Version Compare Detail',
      component: () => import('@/views/VersionCompareDetailView.vue'),
      props: route => ({ ruleId: Number(route.params.ruleId) })
    },
    {
      path: '/jobs/version-compare/adhoc',
      name: 'Adhoc Version Compare',
      component: () => import('@/views/VersionCompareDetailView.vue'),
      props: () => ({ ruleId: 0 })
    }
  ]
})

router.beforeEach((to, from) => {
  return true
})

export default router
