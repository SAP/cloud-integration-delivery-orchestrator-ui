import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import type { ApiEndpoint, Artifact, Job, Package, TransportNode, TransportRequest } from './api'
import { h } from 'vue'
import type { Router } from 'vue-router'
import { IosArrowForward } from '@vicons/ionicons4'


// local. use test oauth app: https://github.wdf.sap.corp/settings/applications/3443
// export const clientId = 'e642e8c0547789a31ce3'
// export const cliendSecret = 'REDACTED'
// export const callbackUrl = 'http://localhost:5173/callback'
// export const beUrl = 'http://localhost:8080'
// export const port = 5173

// remote. use oauth app: https://github.wdf.sap.corp/settings/applications/3431
export const clientId = 'e413f654a5f193da8bed'
export const callbackUrl = 'https://mmt-ui-app-iflow-deploy.cfapps.sap.hana.ondemand.com/callback'
export const beUrl = 'https://stage-devops-srv-iflow-deploy.cfapps.sap.hana.ondemand.com'
export const port = 8080

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
  return [
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
              console.log(row)
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
