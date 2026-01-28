# mmt-ui-app-iflow-transport

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

### deploy to CloudFoundry
```sh
npm run build-only
cf login -a https://api.cf.sap.hana.ondemand.com/ -o MaCo-devops -s DEVOPS
cf push
```


### fallback url for static resources
Since in approuter there is no fallback configuratoin for 404, here leverage "errorPage" to reach the purpose.
When static resource not exist, like /delivery-request (display delivery request list), will fallback to index.html, then vue-router will handover the request.
``` json
"errorPage": [
{"status": [404], "file": "dist/index.html"} 
]
```

### TODO
[ x ] when click import only/deploy only, should return 202 to indicate async process triggered, and refresh.
[ x ] bug: deal with artifact version DRAFT(Active). check before generate tr/import
[ x ] feature: loading status of group tenants
[ ] feature: link to JIRA change request, and automatically update subtask
[ ] feature: websocket
[ ] feature: in 'CPI tenants', add 'copy' for each tenant to copy cookie.
[ x ] feature: enable 'batch generate TRs' in 'New' artifacts: should provice a API in cookie service, so can use one csrf token, and generate TRs in parallel, also controls parallel counts.
[  ] make mta & VCAP_SERVICES more portable: resources should assign exact type; for reading env 'VCAP_SERVICES', don't use withLabel(), not withName().
[ ] When click 'Approve' or 'Skip approval', should have a loading status
[ ] feature: MiniMap Style optimize 