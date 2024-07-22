export const apiEndpointColums = [
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
