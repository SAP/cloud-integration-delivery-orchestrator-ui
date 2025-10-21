import { NTag, type DataTableColumns } from 'naive-ui'
import type { ApiEndpoint, Artifact, Job, Package, TransportGroup, TransportNode, TransportPlan, NodeTransportRequest, CpiTenant, DeliveryRule, DeliveryRequest } from './model'
import { h } from 'vue'
import type { Router } from 'vue-router'
import { IosArrowForward } from '@vicons/ionicons4'

// uase maco.account400 Cloud Identity Service: https://maco.accounts400.ondemand.com/admin/#/applications/668667c6474e930344d2f375
// document: https://help.sap.com/docs/cloud-identity-services/cloud-identity-services/configure-client-to-call-identity-authentication-token-endpoint-for-authorization-code-flow

export const clientId = '74653741-4458-4cc6-902a-4681533d1509'
export const clientSecret = "REDACTED"

export const callbackUrl = import.meta.env.VITE_CALLBACK_URL

export const authUrl = `https://maco.accounts400.ondemand.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${callbackUrl}&response_type=code&state=123&scope=email`
export const tokenEndpoint = '/user/oauth2/token'
export const userInfoEndpoint = '/user/oauth2/userinfo'


export const apiEndpointColums: DataTableColumns<ApiEndpoint> = [
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

// statusTag is a naive-ui component NTag. It can't be imported directly in this file, or vite error will raise.
export function createJobColums(router: Router, statusTag: any): DataTableColumns<Job> {
  const handleRouter = (row: Job) => {
    router.push({
      path: `/flow/${row.ID}`
    })
  }
  const colums: DataTableColumns<Job> = [
    {
      type: 'selection',
      // disabled(row: Job) {
      //   return row.Status === 'Error'
      // }
    },
    {
      title: 'ID',
      key: 'ID',
      resizable: true,
      render(row: Job) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) },
            style: { fontWeight: 'bold' }
          },
          row.ID
        )
      }
    },
    {
      title: 'Job Name',
      key: 'Name',
      resizable: true,
      render(row: Job) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) }
          },
          row.Name
        )
      }
    },
    {
      title: 'Description',
      key: 'Description',
      resizable: true,
      render(row: Job) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) }
          },
          row.Description
        )
      }
    },
    {
      title: 'Status',
      key: 'Status',
      resizable: true,
      render(row: Job) {
        return h(
          NTag,
          {
            type: toJobStatusTag(row.Status),
            onClick: () => { handleRouter(row) }
          },
          row.Status
        )
      }
    },
    {
      title: 'Created by',
      key: 'CreatedBy',
      resizable: true,
      render(row: Job) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) }
          },
          row.CreatedBy
        )
      }
    },
    {
      title: 'Created At',
      key: 'CreatedAt',
      resizable: true,
      render(row: Job) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) }
          },
          toLocalTime(row.CreatedAt)
        )
      }
    },
    {
      title: 'Modified by',
      key: 'UpdatedBy',
      resizable: true,
      render(row: Job) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) }
          },
          row.UpdatedBy
        )
      }
    },
    {
      title: 'Modified at',
      key: 'UpdatedAt',
      resizable: true,
      render(row: Job) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) }
          },
          toLocalTime(row.UpdatedAt)
        )
      },
      sorter(a: Job, b: Job) {
        return new Date(a.UpdatedAt).getTime() - new Date(b.UpdatedAt).getTime()
      },
    },
    {
      title: '',
      key: 'arrow',
      render(row: Job) {
        return h(
          'div',
          {
            style: { width: '18px', height: '18px' },
            onClick: () => {
              router.push({
                path: `/flow/${row.ID}`
              })
            }
          },
          [h(IosArrowForward)]
        )
      }
    }
  ]
  return colums
}
export const cpiTenantColums: DataTableColumns<CpiTenant> = [
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
    title: 'CPI Api Endpoint',
    key: 'CpiEndpoint',
    render(row: CpiTenant) {
      return h(
        'div',
        `${row.CpiEndpoint.name}(${row.CpiEndpoint.url})`
      )
    },
    resizable: true
  }

]
export const transportGroupColums: DataTableColumns<TransportGroup> = [
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
          NTag,
          { style: { marginRight: '8px' }, type: 'info' },
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
          NTag,
          { style: { marginRight: '8px' }, type: 'success' },
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

export const transportPlanColumns = (router: Router) => {
  const handleRouter = (row: TransportPlan) => {
    router.push({ path: `/transportplan/${row.ID}` })
  }
  return [
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
      resizable: true,
      render(row: TransportPlan) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) },
            style: { fontWeight: 'bold' }
          },
          row.ID
        )
      }
    },
    {
      title: 'Name',
      key: 'Name',
      render(row: TransportPlan) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) },
          },
          row.Name
        )
      }
    },
    {
      title: 'Description',
      key: 'Description',
      resizable: true,
      render(row: TransportPlan) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) },
          },
          row.Description
        )
      }
    },
    {
      title: 'Transport Group',
      key: 'TransportGroup',
      render(row: TransportPlan) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) },
          },
          `#${row.TransportGroupID} - ${row.TransportGroupName}`
        )
      },
      resizable: true
    },
    {
      title: 'Created At',
      key: 'CreatedAt',
      resizable: true,
      render(row: TransportPlan) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) },
          },
          toLocalTime(row.CreatedAt)
        )
      }
    },
    {
      title: 'Updated At',
      key: 'UpdatedAt',
      resizable: true,
      render(row: TransportPlan) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) },
          },
          toLocalTime(row.UpdatedAt)
        )
      }
    },
    {
      title: 'Created By',
      key: 'CreatedBy',
      resizable: true,
      render(row: TransportPlan) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) },
          },
          row.CreatedBy
        )
      }
    },
    {
      title: 'Updated By',
      key: 'UpdatedBy',
      resizable: true,
      render(row: TransportPlan) {
        return h(
          'div',
          {
            onClick: () => { handleRouter(row) },
          },
          row.UpdatedBy
        )
      }
    },
    {
      title: '',
      key: 'arrow',
      render(row: TransportPlan) {
        return h(
          'div',
          {
            style: { width: '18px', height: '18px' },
            onClick: () => {
              router.push({
                path: `/transportplan/${row.ID}`
              })
            }
          },
          [h(IosArrowForward)]
        )
      }
    }

  ] as DataTableColumns<TransportPlan>
}

export const transportNodesColums: DataTableColumns<TransportNode> = [
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

export const transportRequestColums: DataTableColumns<NodeTransportRequest> = [
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

export const packageColums: DataTableColumns<Package> = [
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
export const artifactColumns: DataTableColumns<Artifact> = [
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

export const runtimeArtifactColumns: DataTableColumns<Artifact> = [
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

export const deliveryRuleColumns: DataTableColumns<DeliveryRule> = [
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
            NTag,
            { style: { marginRight: '4px', marginBottom: '4px' }, type: 'info' },
            { default: () => t.Name }
          )
        )
      )
    }
  },
  {
    title: 'Excluded Tenants',
    key: 'ExcludedTenants',
    resizable: true,
    render(row: DeliveryRule) {
      return h(
        'div',
        row.ExcludedTenants?.map(t =>
          h(
            NTag,
            { style: { marginRight: '4px', marginBottom: '4px' }, type: 'warning' },
            { default: () => t.Name }
          )
        )
      )
    }
  },
  {
    title: 'Active',
    key: 'Active',
    render(row: DeliveryRule) {
      return row.Active ? 'Yes' : 'No'
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

export const deliveryRequestColumns: DataTableColumns<DeliveryRequest> = [
  { type: 'selection', multiple: false },
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
        'a',
        {
          href: row.JiraLink,
          target: '_blank',
          style: 'color: var(--primary-color)'
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
      const type =
        row.AggregateStatus === 'Error'
          ? 'error'
          : row.AggregateStatus === 'DEPLOYED'
            ? 'success'
            : row.AggregateStatus === 'PENDING'
              ? 'default'
              : 'info'
      return h(
        NTag,
        { type },
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
      return row.DeliveryRule?.Name || ''
    }
  },
  {
    title: 'Artifacts',
    key: 'Artifacts',
    resizable: true,
    render(row: DeliveryRequest) {
      if (!row.ArtifactTenantOperations?.length) return ''
      return h(
        'div',
        row.ArtifactTenantOperations.map(a =>
          h(
            NTag,
            {
              size: 'small',
              style: { marginRight: '4px', marginBottom: '4px' },
              type: 'info'
            },
            { default: () => `${a.ArtifactTechID}@${a.ArtifactVersion}` }
          )
        )
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