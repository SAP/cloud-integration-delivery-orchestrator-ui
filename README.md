# MMT DevOps - CPI Delivery Management UI

Web application for managing SAP Cloud Integration (CPI) artifact deliveries across multiple tenants with automated transport and deployment workflows.

## Overview

This application provides a centralized interface for managing CPI artifact delivery requests, including:

- **Artifact Delivery Management**: Create and track delivery requests for CPI artifacts across multiple tenants
- **Multi-tenant Deployment**: Orchestrate deployments to multiple CPI environments simultaneously
- **Transport Route Visualization**: Visual flow-based interface for transport routes and delivery status
- **Approval Workflow**: Built-in approval process for delivery requests with waiting/approval states
- **Real-time Status Tracking**: Monitor import, deployment, and transport request status across all tenants
- **Delivery Rules**: Configure automated delivery rules for artifact distribution

## Tech Stack

- **Frontend Framework**: Vue 3 (Composition API) with TypeScript
- **Build Tool**: Vite
- **UI Libraries**:
  - Naive UI (primary component library)
  - UI5 Web Components (SAP Fiori elements)
  - Vue Flow (flow-based visualization)
- **Testing**: Vitest with jsdom
- **Routing**: Vue Router
- **Deployment**: SAP BTP CloudFoundry with Approuter

## Prerequisites

- Node.js v20.x or later
- npm
- Access to SAP BTP CloudFoundry space
- Backend service: `com-sap-maco-mmt-srv-devops-cpi-delivery`
- CPI Cookie Service for tenant authentication
- XSUAA service instance for authentication

## Installation

```sh
npm install
```

## Development

### Start Development Server

```sh
npm run dev
# or
npm run start
```

The application will be available at `http://localhost:5173`

### Code Formatting

```sh
npm run format
```

### Linting

```sh
npm run lint
```

## Testing

The project uses Vitest for unit testing.

```sh
# Run tests in watch mode
npm test

# Run tests once (CI mode)
npm run test:run

# Open Vitest UI
npm run test:ui
```

### Test Structure

Tests are located alongside source files with `.test.ts` extension:

- `src/service/api.test.ts` - Core API and state aggregation logic tests

## Building

### Build for Production

```sh
npm run build
```

This command:

1. Runs TypeScript type checking (`vue-tsc`)
2. Builds the application with Vite
3. Outputs to `approuter/dist/` directory

### Build Without Type Checking

```sh
npm run build-only
```

## Deployment

### MTA Deployment (Recommended)

```sh
# Build the application
npm run build-only

# Build MTA archive
mbt build

# Deploy to CloudFoundry
cf deploy mta_archives/mmt.devops.ui.cpi.delivery_1.0.0.mtar
```

### CloudFoundry Direct Deployment

```sh
npm run build-only
cf login -a https://api.cf.sap.hana.ondemand.com/ -o MaCo-devops -s DEVOPS
cf push
```

### Required Services

The application requires the following CloudFoundry services:

- **XSUAA** (`mmt_devops_uaa`) - Authentication and authorization
- **Destinations** configured in `mta.yaml`:
  - `backendservice` - Main API backend
  - `cpi-cookie-service` - CPI tenant authentication service

## Project Structure

```
src/
├── components/           # Reusable Vue components
│   ├── DeliverGroupNode.vue   # Delivery group visualization
│   ├── CpiTransportNode.vue   # Transport node display
│   └── ...
├── views/               # Page-level components
│   ├── DeliveryRequestView.vue
│   ├── DeliveryRequestListView.vue
│   ├── CpiTenantsView.vue
│   └── DeliveryRuleView.vue
├── router/              # Vue Router configuration
│   └── index.ts
├── service/             # API services and business logic
│   ├── api.ts           # Core API functions and state aggregation
│   ├── api.test.ts      # Unit tests for API functions
│   ├── statuses.ts      # Status type definitions
│   ├── model.ts         # TypeScript data models
│   └── http.ts          # Axios HTTP client
├── assets/              # Static assets
└── App.vue              # Root component

approuter/               # SAP Approuter configuration
├── xs-app.json          # Route configuration
├── package.json         # Approuter dependencies
└── dist/                # Build output directory
```

## Configuration

### Approuter Routes (`approuter/xs-app.json`)

The application uses SAP Approuter for authentication and routing:

- `/user-api/*` - User information API
- `/api/v1/*` - Backend service proxy
- `/cpi-cookie-service/*` - CPI authentication service proxy
- All other routes serve the Vue SPA from `dist/`

### Destinations

Destinations are configured in `mta.yaml` and include:

- Backend service URL
- CPI Cookie Service URL
- Forward authentication tokens enabled

### Environment Variables

Environment variables are managed through CloudFoundry service bindings and XSUAA configuration in `mta.yaml`.

## Key Features

### State Aggregation System

The application uses a priority-based state aggregation system to compute aggregate statuses:

- `**DeriveNodeAgg(ops)**` - Aggregates multiple artifact operations for a single tenant
- `**DeriveGroupAgg(tenantStates)**` - Aggregates tenant states into overall group status

Status priority order (highest to lowest):

```
Error → DEPLOY_FAILED → IMPORT_FAILED → CANCELED → PENDING →
WAITING_APPROVAL → AWAITING_IMPORT → AWAITING_DEPLOY →
DEPLOYING → IMPORTING → IMPORTED → DEPLOYED → UNKNOWN
```

This ensures in-progress and error states are always visible in aggregate views.

### Delivery Flow

1. **Create Delivery Request**: Select artifacts and target tenants
2. **Generate Transport Requests**: Create TMS transport requests for selected artifacts
3. **Approval**: Submit for approval or skip approval based on rules
4. **Import**: Import artifacts to target tenants
5. **Deploy**: Deploy artifacts on target tenant runtime
6. **Track Status**: Monitor progress across all tenants in real-time

### Multi-tenant Support

The application supports deploying the same artifacts across multiple CPI tenants simultaneously, with individual status tracking for each tenant-artifact combination.

## Notes

### Fallback URL for Static Resources

The approuter uses the `errorPage` configuration to enable Vue Router's history mode:

```json
"errorPage": [
  {"status": [404], "file": "dist/index.html"}
]
```

When a static resource doesn't exist (e.g., `/delivery-request`), the approuter returns `index.html`, allowing Vue Router to handle the route on the client side.

### WebSocket Support

WebSocket support is enabled in `xs-app.json` for future real-time features.

## TODO / Roadmap

### Completed Features

- Async process handling with 202 status for import/deploy operations
- DRAFT artifact version validation before generate TR/import
- Loading status display for group tenants
- Batch generate TRs in 'New' artifacts with parallel control
- Loading status indicators for 'Approve' and 'Skip approval' actions

### Infrastructure Improvements

- Make MTA and VCAP_SERVICES more portable:
  - Assign exact resource types
  - Avoid using `withLabel()` or `withName()` for reading VCAP_SERVICES

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (disable Vetur if installed)