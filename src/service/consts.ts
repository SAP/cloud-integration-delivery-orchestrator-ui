import type { ApiEndpoint, Artifact, Package, TransportGroup, TransportNode, NodeTransportRequest, CpiTenant, DeliveryRule, DeliveryRequest, TenantLifecycleState, PrerequisiteStatus } from './model'
import { h, type VNode } from 'vue'
import "@ui5/webcomponents/dist/Tag.js";
import "@ui5/webcomponents-icons/dist/chain-link.js";
import "@ui5/webcomponents/dist/Link.js";
import { aggregateStatusToUi5Design } from './statuses';

// Column interface replacing Naive UI's DataTableColumns
export interface Column {
  type?: 'selection'
  multiple?: boolean
  disabled?: (row: any) => boolean
  title?: string
  key?: string
  resizable?: boolean
  sortOrder?: string
  render?: (row: any) => any
  filter?: (value: any, row: any) => boolean
  filterOptionValue?: any
  sorter?: (row1: any, row2: any) => number
}

export const apiEndpointColums: Column[] = [
  {
    type: 'selection',
    multiple: false,
    disabled(row: Object) {
      return false
    }
  },
  {
    title: 'Name',
    key: 'name',
    resizable: true,
    sortOrder: 'descend'
  },
  {
    title: 'Type',
    key: 'type',
    resizable: true
  },
  {
    title: 'Url',
    key: 'url',
    resizable: true
  }
]

export const cpiTenantColums: Column[] = [
  {
    type: 'selection',
    multiple: false,
    disabled(row: Object) {
      return false
    }
  },
  {
    title: 'ID',
    key: 'ID',
    resizable: true
  },
  {
    title: 'Name',
    key: 'Name',
    resizable: true,
    sortOrder: 'descend'
  },
  {
    title: 'Transport Node',
    key: 'TmsNode',
    resizable: true,
    render(row: CpiTenant) {
      return h(
        'div',
        `${row.TransportNodeName}#${row.TransportNodeID}`
      )
    }
  },
  {
    title: 'CPI Destination',
    key: 'PirApiDestinationName',
    render(row: CpiTenant) {
      return h('div', row.PirApiDestinationName || '—')
    },
    resizable: true
  },
  {
    title: 'Group',
    key: 'Group',
    resizable: true
  },
  {
    title: 'Lifecycle',
    key: 'LifecycleState',
    resizable: true,
    render(row: CpiTenant) {
      const designMap: Record<TenantLifecycleState, string> = {
        draft: 'Information',
        configured: 'Set2',
        not_ready: 'Critical',
        readying: 'Information',
        ready: 'Positive',
      }
      const state = row.LifecycleState || 'draft'
      return h('ui5-tag', { design: designMap[state] ?? 'Neutral', style: 'font-size: 0.75rem' }, state)
    }
  },
  {
    title: 'TMS Node',
    key: 'TmsNodeRegistrationStatus',
    resizable: true,
    render(row: CpiTenant) {
      const designMap: Record<PrerequisiteStatus, string> = {
        missing: 'Neutral',
        registering: 'Information',
        ready: 'Positive',
        failed: 'Negative',
      }
      const status = row.TmsNodeRegistrationStatus || 'missing'
      return h('ui5-tag', { design: designMap[status] ?? 'Neutral', style: 'font-size: 0.75rem' }, status)
    }
  }

]
export const transportGroupColums: Column[] = [
  {
    type: 'selection',
    multiple: false,
    disabled(row: Object) {
      return false
    }
  },
  {
    title: 'ID',
    key: 'ID',
    resizable: true
  },
  {
    title: 'Name',
    key: 'Name',
    resizable: true,
  },
  {
    title: 'Description',
    key: 'Description',
    resizable: true,
  },
  {
    title: 'Import Nodes',
    key: 'TransportNodes',
    render(row: TransportGroup) {
      const importNodes = row.TransportNodes.map(node => node.name)
      return h(
        'div',
        importNodes.map(node => h(
          'ui5-tag',
          { style: { marginRight: '8px' }, design: 'Information' },
          node
        ))
      )
    },
    resizable: true
  },
  {
    title: 'Deploy Nodes',
    key: 'DeployEndpoints',
    resizable: true,
    render(row: TransportGroup) {
      const deployNodes = row.DeployEndpoints
      return h(
        'div',
        deployNodes.map(node => h(
          'ui5-tag',
          { style: { marginRight: '8px' }, design: 'Positive' },
          node
        ))
      )
    }
  },
  {
    title: 'Created By',
    key: 'CreatedBy',
    resizable: true
  },
  {
    title: 'Created At',
    key: 'CreatedAt',
    resizable: true
  }
]

export const transportNodesColums: Column[] = [
  {
    type: 'selection',
    multiple: false,
    disabled(row: Object) {
      return false
    }
  },
  {
    title: 'ID',
    key: 'id',
    resizable: true
  },
  {
    title: 'Name',
    key: 'name',
    resizable: true,
    sortOrder: 'descend'
  },
  {
    title: 'Description',
    key: 'description',
    resizable: true
  }
]

export const transportRequestColums: Column[] = [
  {
    type: 'selection',
    disabled(row: Object) {
      return false
    }
  },
  {
    title: 'Transport Request',
    key: 'id',
    resizable: true,
    sortOrder: 'descend'
  },
  {
    title: 'Transport Description',
    key: 'description',
    resizable: true
  },
  // {
  //   title: 'Owner',
  //   key: 'createdBy',
  //   resizable: true
  // },
  {
    title: 'Status',
    key: 'status',
    resizable: true
  },
  {
    title: 'Entry Node',
    key: 'origin',
    resizable: true
  },
  {
    title: 'Timestamp',
    key: 'createdAt',
    resizable: true
  }
]

export const packageColums: Column[] = [
  {
    type: 'selection',
    multiple: false,
    disabled(row: Object) {
      return false
    }
  },
  {
    title: 'ID',
    key: 'Id',
    resizable: true,
    sortOrder: 'descend'
  },
  {
    title: 'Name',
    key: 'Name',
    resizable: true
  },
  {
    title: 'Version',
    key: 'Version',
    resizable: true
  },
  {
    title: 'Mode',
    key: 'Mode',
    resizable: true
  },
  {
    title: 'ModifiedBy',
    key: 'ModifiedBy',
    resizable: true
  },
  {
    title: 'ModifiedAt',
    key: 'ModifiedAt',
    resizable: true
  }
]

// design artifact columns
export const artifactColumns: Column[] = [
  {
    type: 'selection',
    disabled(row: Object) {
      return false
    }
  },
  {
    title: 'ID',
    key: 'Id',
    resizable: true,
    sortOrder: 'descend'
  },
  {
    title: 'Name',
    key: 'Name',
    resizable: true
  },
  {
    title: 'Type',
    key: 'Type',
    resizable: true
  },
  {
    title: 'Version',
    key: 'Version',
    resizable: true
  }
]

export const runtimeArtifactColumns: Column[] = [
  {
    type: 'selection',
    disabled(row: Object) {
      return false
    }
  },
  {
    title: 'ID',
    key: 'Id',
    resizable: true,
    sortOrder: 'descend'
  },
  {
    title: 'Name',
    key: 'Name',
    resizable: true
  },
  {
    title: 'Type',
    key: 'Type',
    resizable: true
  },
  {
    title: 'Version',
    key: 'Version',
    resizable: true
  },
  {
    title: 'DeployedBy',
    key: 'DeployedBy',
    resizable: true
  },
  {
    title: 'DeployedOn',
    key: 'DeployedOn',
    resizable: true
  },
  {
    title: 'Status',
    key: 'Status',
    resizable: true
  }
]

export const deliveryRuleColumns: Column[] = [
  { type: 'selection', multiple: false },
  {
    title: 'ID',
    key: 'ID',
    resizable: true
  },
  {
    title: 'Name',
    key: 'Name',
    resizable: true,
    sortOrder: 'descend'
  },
  {
    title: 'Version Pattern',
    key: 'VersionPattern',
    resizable: true
  },
  {
    title: 'Included Tenants',
    key: 'IncludedTenants',
    resizable: true,
    render(row: DeliveryRule) {
      return h(
        'div',
        row.IncludedTenants?.map(t =>
          h(
            'ui5-tag',
            { style: { marginRight: '4px', marginBottom: '4px' }, design: 'Set2', colorScheme: "5" },
            t.Name
          )
        )
      )
    }
  },
  {
    title: 'Active',
    key: 'Active',
    render(row: DeliveryRule) {
      return h(
        'ui5-tag',
        { design: row.Active ? 'Positive' : 'Negative' },
        { default: () => (row.Active ? 'Yes' : 'No') }
      )
    }
  },
  {
    title: 'Skip Approve',
    key: 'SkipApprove',
    render(row: DeliveryRule) {
      return row.SkipApprove ? 'Yes' : 'No'
    }
  },
  {
    title: 'Require Jira',
    key: 'RequireJira',
    render(row: DeliveryRule) {
      return row.RequireJira ? 'Yes' : 'No'
    }
  },
  {
    title: 'Updated At',
    key: 'UpdatedAt',
    resizable: true,
    render(row: DeliveryRule) {
      return toLocalTime(row.UpdatedAt)
    }
  },
  {
    title: 'Created At',
    key: 'CreatedAt',
    resizable: true,
    render(row: DeliveryRule) {
      return toLocalTime(row.CreatedAt)
    }
  }
]

export const stepTypeOptions: { [key: string]: string } = {
  Import: 'Import Transport Requests',
  Deploy: 'Deploy Artifacts(Iflow, Package, ScriptCollection)',
  Undeploy: 'Undeploy Runtime Artifacts'
}

export interface ToolBar<T = any> {
  text: String
  func(rows: T[]): void | Promise<void>
}

export interface RowAction<T = any> {
  render: () => VNode | string
  func: (row: T) => void | Promise<void>
}

// maps Step status to naive-ui status: wait, process, finish, error
// https://www.naiveui.com/zh-CN/os-theme/components/steps#Steps-Props 
export function toStepCardStatus(status: string) {
  switch (status) {
    case 'Draft':
      return 'wait'
    case 'Running':
      return 'process'
    case 'Success':
      return 'finish'
    case 'Error':
      return 'error'
    default:
      return 'wait'
  }
}

export function toJobStatusTag(status: string) {
  switch (status) { // job statuses: Error, Running, Success, Unknown, Saved, Draft
    case 'Error':
      return 'error'
    case 'Running':
    case 'Saved':
      return 'info'
    case 'Success':
      return 'success'
  }
}

export function toLocalTime(str: string) {
  return new Date(str).toLocaleString('zh-CN')
}

export const deliveryRequestColumns: Column[] = [
  // { type: 'selection', multiple: false },
  {
    title: 'ID',
    key: 'ID',
    resizable: true,
    sortOrder: 'descend'
  },
  {
    title: 'Name',
    key: 'Name',
    resizable: true
  },
  {
    title: 'Jira Link',
    key: 'JiraLink',
    resizable: true,
    render(row: DeliveryRequest) {
      if (!row.JiraLink) return ''
      return h(
        'ui5-link',
        {
          href: row.JiraLink,
          target: '_blank',
          icon: "chain-link"
        },
        row.JiraLink
      )
    }
  },
  {
    title: 'Status',
    key: 'Status',
    resizable: true,
    render(row: DeliveryRequest) {
      const type = aggregateStatusToUi5Design(row.AggregateStatus)
      return h(
        'ui5-tag',
        { design: type },
        { default: () => row.AggregateStatus }
      )
    }
  },
  {
    title: 'Source Tenant',
    key: 'SourceTenant',
    resizable: true,
    render(row: DeliveryRequest) {
      return row.SourceTenant?.Name || ''
    }
  },
  {
    title: 'Delivery Rule',
    key: 'DeliveryRule',
    resizable: true,
    render(row: DeliveryRequest) {
      return h(
        'ui5-tag',
        { design: "Set2", colorScheme: "10" },
        { default: () => row.DeliveryRule?.Name || '' }
      )
    }
  },
  {
    title: 'Updated At',
    key: 'UpdatedAt',
    resizable: true,
    render(row: DeliveryRequest) {
      return toLocalTime(row.UpdatedAt)
    }
  },
  {
    title: 'Created At',
    key: 'CreatedAt',
    resizable: true,
    render(row: DeliveryRequest) {
      return toLocalTime(row.CreatedAt)
    }
  },
  {
    title: 'Created By',
    key: 'CreatedBy',
    resizable: true
  },
  {
    title: 'Updated By',
    key: 'UpdatedBy',
    resizable: true
  }
]