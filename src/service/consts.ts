import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import type { ApiEndpoint, Artifact, Job, Package, TransportNode, TransportRequest } from './api'
import { h } from 'vue'
import type { Router } from 'vue-router'
import { IosArrowForward } from '@vicons/ionicons4'

// uase maco.account400 Cloud Identity Service: https://maco.accounts400.ondemand.com/admin/#/applications/668667c6474e930344d2f375
// document: https://help.sap.com/docs/cloud-identity-services/cloud-identity-services/configure-client-to-call-identity-authentication-token-endpoint-for-authorization-code-flow

export const clientId = '74653741-4458-4cc6-902a-4681533d1509'
export const clientSecret = "REDACTED"

// local maco.account400
export const callbackUrl = 'http://localhost:5173/callback'
export const beUrl = 'http://localhost:8080'
export const port = 5173

// remote
// export const callbackUrl = 'https://mmt-ui-app-iflow-deploy.cfapps.sap.hana.ondemand.com/callback'
// export const beUrl = 'https://stage-devops-srv-iflow-deploy.cfapps.sap.hana.ondemand.com'
// export const port = 8080

export const authUrl = `https://maco.accounts400.ondemand.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${callbackUrl}&response_type=code&state=123&scope=email`

export const targetUrl = 'https://maco.accounts400.ondemand.com'

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

export function createJobColums(router: Router): DataTableColumns<Job> {
  const colums: DataTableColumns<Job> =  [
    {
      type: 'selection',
      disabled(row: Job) {
        return row.Status === 'Error'
      }
    },
    {
      title: 'ID',
      key: 'ID',
      resizable: true
    },
    {
      title: 'Job Name',
      key: 'Name',
      resizable: true
    },
    {
      title: 'Description',
      key: 'Description',
      resizable: true
    },
    {
      title: 'Status',
      key: 'Status',
      resizable: true
    },
    {
      title: 'Created by',
      key: 'CreatedBy',
      resizable: true
    },
    {
      title: 'Created At',
      key: 'CreatedAt',
      resizable: true
    },
    {
      title: 'Modified by',
      key: 'UpdatedBy',
      resizable: true
    },
    {
      title: 'Modified at',
      key: 'UpdatedAt',
      resizable: true
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
  colums.forEach((col) => {
    if (col.type === 'selection' || col.key === 'arrow') {
      return
    }
    col.render = (row: Job) => {
      return h(
        'div',
        {
          onClick: () => {
            console.log(row)
            router.push({
              path: `/flow/${row.ID}`
            })
          }
        },
        row[col.key]
      )
    }
  })
  return colums
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

export const transportRequestColums: DataTableColumns<TransportRequest> = [
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

export const stepTypeOptions = {
  Import: 'Import Transport Requests',
  Deploy: 'Deploy Artifacts(iflow, package, scriptCollection)',
  Undeploy: 'UnDeploy Artifacts(iflow, package, scriptCollection)'
}

export interface ToolBar {
  text: String
  func(rows: DataTableColumns): void
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

export function toLocalTime(str: string) {
  return new Date(str).toLocaleString('zh-CN')
}