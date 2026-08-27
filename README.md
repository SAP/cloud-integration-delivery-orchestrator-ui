[![REUSE status](https://api.reuse.software/badge/github.com/SAP/cloud-integration-delivery-orchestrator-ui)](https://api.reuse.software/info/github.com/SAP/cloud-integration-delivery-orchestrator-ui)

# cloud-integration-delivery-orchestrator-ui

## About this project

Vue 3 frontend for SAP Cloud Integration multi-tenant delivery orchestration. Its production build is embedded into the backend Docker image, so it ships as part of a single deployable service.

This is one of the source repositories behind the [Cloud Integration Delivery Orchestrator](https://github.com/SAP/cloud-integration-delivery-orchestrator) (deployment & docs). The backend it talks to lives in [cloud-integration-delivery-orchestrator-srv](https://github.com/SAP/cloud-integration-delivery-orchestrator-srv), which also embeds this UI's build output at release time.

## Architecture

A single-page application built with Vue 3 + TypeScript, bundled by Vite.

- **UI toolkit**: [UI5 Web Components](https://sap.github.io/ui5-webcomponents/) (+ Fiori), registered as custom elements (`ui5-*`) in the Vite config.
- **Routing / data**: `vue-router` for navigation, `axios` for the backend REST API.
- **Specialized views**: BPMN artifact comparison via `bpmn-js` + `bpmn-js-differ` + `bpmn-moddle`; graph/diagram rendering via `@vue-flow/core` + `@dagrejs/dagre`; textual diffs via `diff` + `diff2html`.
- **`src/` layout**: `views` (routed pages) · `components` (reusable UI) · `composables` (shared reactive logic) · `service` (API client) · `router` · `bpmn` (compare helpers) · `types` · `assets`.

At runtime the app calls the backend under `/api`, `/user-api`, `/auth`, and `/logout`.

## Local Development

Requirements: Node.js 20+. The frontend needs the backend running on `http://localhost:8080` (see the [backend repo](https://github.com/SAP/cloud-integration-delivery-orchestrator-srv) for how to start it locally).

```bash
npm ci        # install dependencies
npm run dev   # start the Vite dev server on http://localhost:5173
```

The dev server proxies `/api`, `/user-api`, `/auth`, and `/logout` to the backend on `:8080` (configured in `vite.config.ts`), so open `http://localhost:5173` and log in through the backend's XSUAA flow. Alternatively, open `http://localhost:8080` directly — the backend reverse-proxies to this Vite server when `VITE_DEV_URL` is set, preserving hot-module reload.

Other scripts: `npm run build` (type-check + production build), `npm run lint`, `npm run format`, `npm run test`.

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/SAP/cloud-integration-delivery-orchestrator-ui/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Security / Disclosure
If you find any bug that may be a security problem, please follow our instructions at [in our security policy](https://github.com/SAP/cloud-integration-delivery-orchestrator-ui/security/policy) on how to report it. Please do not create GitHub issues for security-related doubts or problems.

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/SAP/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2026 SAP SE or an SAP affiliate company and cloud-integration-delivery-orchestrator-ui contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/SAP/cloud-integration-delivery-orchestrator-ui).
