import { reactive, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

export interface HistoryFilterState {
  tenantIds: number[]
  artifactName: string
  artifactTypes: string[]
  packageId: string
  requestStates: string[]
  importStates: string[]
  deployStates: string[]
  deliveryRuleId: number | null
  createdBy: string
  dateFrom: string
  dateTo: string
  hasError: boolean
  sortBy: string
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

export function useHistoryFilter() {
  const router = useRouter()
  const route = useRoute()

  const parseArray = (val: unknown): string[] => {
    if (Array.isArray(val)) return val as string[]
    if (typeof val === 'string' && val) return [val]
    return []
  }

  const parseNumArray = (val: unknown): number[] => {
    return parseArray(val).map(Number).filter(n => !isNaN(n))
  }

  const filter = reactive<HistoryFilterState>({
    tenantIds: parseNumArray(route.query.tenantId),
    artifactName: (route.query.artifactName as string) || '',
    artifactTypes: parseArray(route.query.artifactType),
    packageId: (route.query.packageId as string) || '',
    requestStates: parseArray(route.query.requestState),
    importStates: parseArray(route.query.importState),
    deployStates: parseArray(route.query.deployState),
    deliveryRuleId: route.query.deliveryRuleId ? Number(route.query.deliveryRuleId) : null,
    createdBy: (route.query.createdBy as string) || '',
    dateFrom: (route.query.dateFrom as string) || '',
    dateTo: (route.query.dateTo as string) || '',
    hasError: route.query.hasError === 'true',
    sortBy: (route.query.sortBy as string) || 'updated_at',
    sortDir: (route.query.sortDir as 'asc' | 'desc') || 'desc',
    page: Number(route.query.page) || 1,
    pageSize: Number(route.query.pageSize) || 20,
  })

  // Build query params for API call
  const apiParams = computed(() => {
    const params: Record<string, any> = {}
    if (filter.tenantIds.length) params.tenantId = filter.tenantIds
    if (filter.artifactName) params.artifactName = filter.artifactName
    if (filter.artifactTypes.length) params.artifactType = filter.artifactTypes
    if (filter.packageId) params.packageId = filter.packageId
    if (filter.requestStates.length) params.requestState = filter.requestStates
    if (filter.importStates.length) params.importState = filter.importStates
    if (filter.deployStates.length) params.deployState = filter.deployStates
    if (filter.deliveryRuleId) params.deliveryRuleId = filter.deliveryRuleId
    if (filter.createdBy) params.createdBy = filter.createdBy
    if (filter.dateFrom) params.dateFrom = filter.dateFrom
    if (filter.dateTo) params.dateTo = filter.dateTo
    if (filter.hasError) params.hasError = true
    params.sortBy = filter.sortBy
    params.sortDir = filter.sortDir
    params.page = filter.page
    params.pageSize = filter.pageSize
    return params
  })

  // Sync filter to URL
  const urlParams = computed(() => {
    const params: Record<string, any> = {}
    if (filter.tenantIds.length) params.tenantId = filter.tenantIds.map(String)
    if (filter.artifactName) params.artifactName = filter.artifactName
    if (filter.artifactTypes.length) params.artifactType = filter.artifactTypes
    if (filter.packageId) params.packageId = filter.packageId
    if (filter.requestStates.length) params.requestState = filter.requestStates
    if (filter.importStates.length) params.importState = filter.importStates
    if (filter.deployStates.length) params.deployState = filter.deployStates
    if (filter.deliveryRuleId) params.deliveryRuleId = String(filter.deliveryRuleId)
    if (filter.createdBy) params.createdBy = filter.createdBy
    if (filter.dateFrom) params.dateFrom = filter.dateFrom
    if (filter.dateTo) params.dateTo = filter.dateTo
    if (filter.hasError) params.hasError = 'true'
    if (filter.sortBy !== 'updated_at') params.sortBy = filter.sortBy
    if (filter.sortDir !== 'desc') params.sortDir = filter.sortDir
    if (filter.page > 1) params.page = String(filter.page)
    if (filter.pageSize !== 20) params.pageSize = String(filter.pageSize)
    return params
  })

  watch(urlParams, (params) => {
    router.replace({ query: params })
  })

  function clearAll() {
    filter.tenantIds = []
    filter.artifactName = ''
    filter.artifactTypes = []
    filter.packageId = ''
    filter.requestStates = []
    filter.importStates = []
    filter.deployStates = []
    filter.deliveryRuleId = null
    filter.createdBy = ''
    filter.dateFrom = ''
    filter.dateTo = ''
    filter.hasError = false
    filter.page = 1
  }

  function resetPage() {
    filter.page = 1
  }

  return { filter, apiParams, clearAll, resetPage }
}
