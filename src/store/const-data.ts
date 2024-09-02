import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import type { ApiEndpoint, Job, TransportNode, TransportRequest } from '.'
import { h } from 'vue'
import type { Router } from 'vue-router'
import { IosArrowForward } from '@vicons/ionicons4'

// for flow view config detail
export const apiEndpointSelectColums: DataTableColumns<ApiEndpoint> = [
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
    resizable: true
  },
  {
    title: "Description",
    key: 'description',
    resizable: true
  },
  {
    title: 'API Endpoint',
    key: 'apiUrl',
    resizable: true
  },
  {
    title: 'Status',
    key: 'status',
    resizable: true
  }
]

export const apiEndpointColums: DataTableColumns<ApiEndpoint> = [
  {
    type: 'selection',
    disabled(row: Object) {
      return false
    }
  },
  {
    title: 'ID',
    key: 'uuid',
    resizable: true
  },
  {
    title: 'Name',
    key: 'description',
    resizable: true
  },
  {
    title: 'UAA Token URL',
    key: 'tokenUrl',
    resizable: true
  },
  {
    title: 'API Endpoint',
    key: 'endpointUrl',
    resizable: true
  },
  {
    title: 'Credential ID',
    key: 'credentialId',
    resizable: true
  },
  {
    title: 'Credential Secret',
    key: 'credentialSecret',
    resizable: true
  },
  {
    title: 'Created by',
    key: 'createdBy',
    resizable: true
  },
  {
    title: 'Created At',
    key: 'createdAt',
    resizable: true
  },
  {
    title: 'Changed By',
    key: 'changedBy',
    resizable: true
  },
  {
    title: 'Changed At',
    key: 'changedAt',
    resizable: true
  },
  {
    title: 'Status',
    key: 'status',
    resizable: true
  }
]

export function createImportJobColums(router: Router): DataTableColumns<Job> {
  return [
    {
      type: 'selection',
      disabled(row: Job) {
        return row.status === 'FATAL'
      }
    },
    {
      title: 'ID',
      key: 'id',
      resizable: true
    },
    {
      title: 'Job Name',
      key: 'name',
      resizable: true
    },
    {
      title: 'Description',
      key: 'description',
      resizable: true
    },
    {
      title: 'Status',
      key: 'status',
      resizable: true
    },
    {
      title: 'Created by',
      key: 'createdBy',
      resizable: true
    },
    {
      title: 'Created At',
      key: 'createdAt',
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
                name: 'flow',
                params: { jobId: row.id }
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
    resizable: true
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
    resizable: true
  },
  {
    title: 'Transport Description',
    key: 'description',
    resizable: true
  },
  {
    title: 'Owner',
    key: 'createdBy',
    resizable: true
  },
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

export const stepTypeOptions = [
  {
    label: 'Import TRs',
    value: 'Import'
  },
  {
    label: 'Deploy Artifacts(iflow, package, scriptCollection)',
    value: 'Deploy'
  },
  {
    label: 'Undeploy Artifacts',
    value: 'Undeploy'
  }
]
