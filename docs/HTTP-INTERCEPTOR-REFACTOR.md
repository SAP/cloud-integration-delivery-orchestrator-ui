# HTTP Interceptor 重构：结构化 Error + Silent Error Opt-Out

> **状态**: Draft（待讨论）
> **范围**: Frontend（`mmt-devops-ui-cpi-delivery`）
> **触发原因**: `CreateDRFromMismatch` API 返回错误时，前端 dialog 无任何反馈，用户无法得知失败原因。

---

## 1. 问题描述

### 1.1 直接问题

当 `HandleCreateDRFromMismatch`（backend `handler/version_compare.go:171`）返回 HTTP error（400/404/409/500）时，前端 `VersionCompareDetailView.vue` 中的 dialog 不会展示错误信息。dialog 仅退出 loading 状态并回到 preview 步骤，没有任何失败提示。

根本原因在 Axios response interceptor（`src/service/http.ts`）。它拦截所有非 2xx 响应，弹出全局 toast，然后 reject promise——但 dialog 的 `catch` block 是空的，完全依赖 toast 来展示错误。而 toast 弹出时位于打开的 dialog 后面，很容易被忽略。

### 1.2 Interceptor 设计缺陷（重构前）

原有 interceptor 存在三个结构性问题：

| # | 缺陷 | 详细说明 |
|---|------|----------|
| **1** | **结构化响应数据丢失** | interceptor 仅提取 error message 字符串，调用 `Promise.reject(content)` 其中 `content` 是纯 `string`。完整的 response body——包括 `result` 字段中的结构化数据（如 `CreateDRFromMismatchSummary` 中的 skip errors）——被永久丢弃。`catch(err)` 中的调用方只能获取到一个字符串。 |
| **2** | **全局 toast 无法关闭** | 所有非 2xx 响应都会触发 `window.$message.error()`。如果调用方希望在 dialog 内部或页面内联展示错误，没有任何手段抑制这个 toast。结果只有两个选择：接受 toast 作为唯一的错误反馈，或者额外显示第二条错误信息导致重复。 |
| **3** | **Double-toast bug** | `DeliveryRequestListView.vue` 中已经出现了缺陷 #2 的后果：`onCreate`（line 132）和 `handleDelete`（line 146）各自调用了 `window.$message.error(...)`，与 interceptor 的 toast 叠加，导致每次失败时用户看到两条重叠的错误通知。 |

### 1.3 重构前的 Interceptor 代码

```typescript
// src/service/http.ts（重构前）
service.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.msg) window.$message.info(res.msg)
    return res.result              // <-- 自动解包 response.data.result
  },
  (error) => {
    if (checkSessionExpired(error)) {
      return Promise.reject(error)
    }
    const content = error.response?.data?.msg ?? error.response?.data?.error ?? error.message
    window.$message.error(         // <-- 始终弹出 toast，无法 opt-out
      content,
      { closable: true, duration: 1000*30 }
    )
    return Promise.reject(content) // <-- reject 纯 string，丢失 response body
  }
)
```

---

## 2. 方案设计

### 2.1 概述

对 interceptor 做三项改动，完全向后兼容：

1. **`HttpError` interface** — 用结构化对象替代纯 string reject，保留完整的 response body。
2. **`silentError` config flag** — 允许单个 API 调用抑制全局 toast，由调用方自行处理错误展示。
3. **统一 reject 类型** — 所有经过 interceptor 的调用均以 `HttpError` reject。

### 2.2 `HttpError` Interface

```typescript
export interface HttpError {
  /** 人类可读的错误信息（取自 backend 的 `error` 或 `msg` 字段，或 Axios 默认信息） */
  message: string
  /** backend 返回的完整 response body（保留 `result` 等结构化数据） */
  data?: any
  /** HTTP status code */
  status?: number
}
```

**为什么 `data` 使用 `any` 而非泛型？**

backend 不同 endpoint 返回的 `result` 结构不同（可能是 `CreateDRFromMismatchSummary`、`DeliveryRequest`、或完全缺失）。如果将 `data` 设为泛型，则每个 API 函数都需要参数化 error 类型，增加复杂度但收益有限。调用方通过 optional chaining（`err.data?.result?.errors`）访问结构化数据，在 error path 中足够安全。

### 2.3 `silentError` Config Flag

通过 TypeScript declaration merging 扩展 Axios request config：

```typescript
declare module 'axios' {
  export interface AxiosRequestConfig {
    silentError?: boolean
  }
}
```

在 API 函数中使用：

```typescript
// 全局 toast 正常弹出（默认行为，现有调用方无需改动）
http.post('/api/v1/deliveryRequest', req)

// 全局 toast 被抑制，调用方自行处理错误展示
http.post('/api/v1/.../createDR', req, { silentError: true })
```

interceptor 中的判断逻辑：

```typescript
if (!error.config?.silentError) {
  window.$message.error(message, { closable: true, duration: 1000*30 })
}
return Promise.reject(httpError) // 无论是否 silent，始终以 HttpError reject
```

关键行为：
- `silentError` 仅控制 **toast**。promise 仍然以 `HttpError` reject。
- `silentError` 不影响 401 session 过期检查——该检查始终执行。
- 默认值为 `false`（缺省），所有现有 API 调用行为不变。

### 2.4 重构后的 Interceptor 代码

```typescript
// src/service/http.ts（重构后）
service.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.msg) window.$message.info(res.msg)
    return res.result
  },
  (error) => {
    if (checkSessionExpired(error)) {
      return Promise.reject(error)
    }

    const message = error.response?.data?.msg ?? error.response?.data?.error ?? error.message
    const httpError: HttpError = {
      message,
      data: error.response?.data,
      status: error.response?.status,
    }

    // 仅在未设置 silentError 时弹出全局 toast
    if (!error.config?.silentError) {
      window.$message.error(
        message,
        { closable: true, duration: 1000*30 }
      )
    }

    return Promise.reject(httpError)
  }
)
```

---

## 3. Backend Error Response 格式约定

作为参考，backend（`handler/version_compare.go`）返回错误时使用以下 envelope 格式：

```json
{
  "status": "fail",
  "code": 400,
  "error": "no artifacts passed validation",
  "result": { "requested": 5, "created": 0, "errors": [...] }
}
```

interceptor 将其映射为 `HttpError`：

```
HttpError.message  = response.data.error   → "no artifacts passed validation"
HttpError.data     = response.data          → { status, code, error, result: {...} }
HttpError.status   = response.status        → 400
```

调用方通过 `httpError.data.result` 访问结构化数据。以 `CreateDRFromMismatch` 为例，可获取包含 skip errors 的 `CreateDRFromMismatchSummary`：

```typescript
catch (err: any) {
  const httpErr = err as HttpError
  // httpErr.message → "no artifacts passed validation"
  // httpErr.data?.result?.errors → [{artifactID, packageID, reason}, ...]
  // httpErr.status → 400
}
```

### 3.1 `CreateDRFromMismatch` 的 Backend Error 场景

| 场景 | HTTP Status | `error` 字段 | `result` 字段 |
|------|-------------|--------------|---------------|
| Rule 或 snapshot 未找到 | 404 | `"snapshot N not found or not completed for rule M"` | 无 |
| Snapshot 过期（preview 后数据已变化） | 409 | `"snapshot data has changed since preview (completedAt mismatch): ..."` | 无 |
| artifact keys 为空 | 400 | `"artifactKeys must not be empty"` | 无 |
| 要求 JIRA 但未填写 | 400 | `"jira link is required for delivery rule \"...\""` | 无 |
| 所有 artifact 均未通过校验 | 400 | `"no artifacts passed validation"` | `CreateDRFromMismatchSummary`（`.errors[]` 列出每个 artifact 被跳过的原因） |
| DB / 内部错误 | 500 | `"failed to create delivery request: ..."` | 无 |

---

## 4. 变更文件

### 4.1 `src/service/http.ts` — Interceptor 重构

**变更内容：**
1. 新增 `export interface HttpError { message, data?, status? }`
2. 新增 `declare module 'axios'`，扩展 `AxiosRequestConfig` 添加 `silentError?: boolean`
3. error interceptor：构造 `HttpError` 对象，根据 `error.config?.silentError` 决定是否弹出 toast，最终以 `HttpError` reject

### 4.2 `src/service/api.ts` — `CreateDRFromMismatch` Opt-In

**重构前：**
```typescript
export const CreateDRFromMismatch = (ruleId: number, req: CreateDRFromMismatchRequest) => {
  return http.post(`/api/v1/deliveryRule/${ruleId}/versionCompare/createDR`, req) as Promise<CreateDRFromMismatchResponse>
}
```

**重构后：**
```typescript
export const CreateDRFromMismatch = (ruleId: number, req: CreateDRFromMismatchRequest) => {
  return http.post(`/api/v1/deliveryRule/${ruleId}/versionCompare/createDR`, req, { silentError: true }) as Promise<CreateDRFromMismatchResponse>
}
```

当前仅 `CreateDRFromMismatch` 使用 `silentError: true`，其他 API 函数保持默认行为。

### 4.3 `src/views/VersionCompareDetailView.vue` — 内联错误处理

**Script 变更：**
- 从 `@/service/http` 导入 `HttpError` 类型
- 新增 `createError` ref：`ref<HttpError | null>(null)`
- `handleOpenDRDialog`：重置 `createError.value = null`
- `handleCreateDR`：请求前重置 `createError.value = null`；`catch` block 将 `err as HttpError` 存入 `createError`

**Template 变更** — 在 `<template v-else-if="previewData">` block 内、Meta 部分之前，新增两个元素：

1. **Error banner**：红色背景条，显示 `createError.message`
2. **Validation errors panel**：可折叠面板，列出 `createError.data.result.errors[]` 中的 artifact ID、package ID 和失败原因（仅在 backend 返回 skip errors 时渲染）

```html
<!-- 创建失败后显示的错误横幅 -->
<div v-if="createError" class="dr-error-banner">
  <ui5-tag design="Negative">Error</ui5-tag>
  <ui5-text style="color: var(--sapNegativeColor);">{{ createError.message }}</ui5-text>
</div>

<!-- 创建失败时 backend 返回的校验错误详情 -->
<ui5-panel
  v-if="createError?.data?.result?.errors?.length"
  :header-text="`Validation Errors (${createError.data.result.errors.length})`"
  class="dr-category-panel dr-category-warn"
>
  <div class="dr-artifact-list">
    <div v-for="e in createError.data.result.errors" :key="..." class="dr-artifact-row dr-row-disabled">
      <span class="dr-col-id">{{ e.artifactID }}</span>
      <span class="dr-col-pkg">{{ e.packageID }}</span>
      <ui5-tag design="Negative" style="font-size: 0.65rem;">{{ e.reason }}</ui5-tag>
    </div>
  </div>
</ui5-panel>
```

**错误发生后的 UX 流程：**
- dialog 停留在 preview 步骤（不关闭、不跳转）
- error banner 出现在 dialog 内容顶部
- 如有 skip errors，在 banner 下方以列表展示
- 用户可调整 artifact 选择、修改表单字段，然后重新点击 "Create"
- 重试时 `createError` 被重置为 `null`

**新增 CSS：**
```css
.dr-error-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--sapErrorBackground);
  border-radius: 0.25rem;
}
```

### 4.4 `src/views/DeliveryRequestListView.vue` — 修复 Double-Toast

**重构前：**
```typescript
// onCreate
} catch (e) {
  window.$message?.error?.('Failed to save Delivery Plan')  // <-- 手动 toast
}

// handleDelete
} catch (e) {
  window.$message?.error?.('Failed to delete Delivery Request')  // <-- 手动 toast
}
```

**重构后：**
```typescript
// onCreate
} catch (e) {
  // Error displayed by http interceptor
}

// handleDelete
} catch (e) {
  // Error displayed by http interceptor
}
```

interceptor 的 toast 已经展示了 server 返回的具体错误信息（如 `"delivery rule check failed: ..."`），比被移除的通用字符串更具信息量。

---

## 5. 向后兼容性

### 5.1 Rejection 类型变更

interceptor 的 rejection value 从 `string` 变更为 `HttpError`。对所有使用 interceptor `http` 实例的 `catch` block 进行了逐一审计：

| 文件 | catch 数量 | 是否使用 error 值？ | 影响 |
|------|-----------|-------------------|------|
| `VersionCompareDetailView.vue` | 4 | 否（空 body / `() => {}`） | 无 |
| `VersionCompareView.vue` | 4 | 否（空 body 或返回 fallback 值） | 无 |
| `DeliveryRequestView.vue` | 3 | 1 个通过 `catch (_)` 回退状态，2 个使用原生 `axios`（未经 interceptor） | 无 |
| `DeliveryRequestListView.vue` | 2 | 本次修改已处理 | 无 |
| `CpiTenantsView.vue` | 2 | 使用原生 `axios`（未经 interceptor） | 无 |
| `DataTable.vue` | 1 | 非 API 相关（render 防御性 guard） | 无 |

**结论**：没有任何现有代码将 interceptor `http` 实例的 rejection value 作为 string 使用。本次变更完全向后兼容。

### 5.2 两个 Axios 实例

代码库中使用了两个独立的 Axios 实例：

1. **`service`（来自 `http.ts`）** — 经过 interceptor 处理。`api.ts` 中大部分 API 函数使用此实例。受本次重构影响。
2. **原生 `axios`** — 未经 interceptor 处理。被 `CurrentUser`、`CheckTenantStatus`、`InitCpiTenant`、`GenTransportRequest`、`GetArtifactVersionHistory` 使用。这些调用方已自行处理错误（手动提取 `error.response.data`）。**不受**本次重构影响。

---

## 6. 使用指南

### 6.1 默认模式：全局 Toast（无需改动）

对于大多数 API 调用，interceptor 自动处理错误展示：

```typescript
// api.ts
export const GetDeliveryRules = () => {
  return http.get('/api/v1/deliveryRule') as Promise<DeliveryRule[]>
}

// 组件中
try {
  const rules = await GetDeliveryRules()
} catch {
  // interceptor 已弹出包含 server 错误信息的 toast。
  // 此处仅需处理 UI 清理（loading flag 等）。
}
```

### 6.2 内联错误处理：使用 `silentError`

当需要在 dialog 内部或页面内联展示错误时：

```typescript
// api.ts — opt in
export const CreateDRFromMismatch = (ruleId: number, req: CreateDRFromMismatchRequest) => {
  return http.post(url, req, { silentError: true }) as Promise<CreateDRFromMismatchResponse>
}

// 组件中
import type { HttpError } from '@/service/http'

const error = ref<HttpError | null>(null)

async function handleCreate() {
  error.value = null
  try {
    const result = await CreateDRFromMismatch(ruleId, req)
    // 成功路径
  } catch (err: any) {
    error.value = err as HttpError
    // 访问结构化数据：
    // err.message → "no artifacts passed validation"
    // err.data?.result?.errors → [{artifactID, packageID, reason}, ...]
    // err.status → 400
  }
}
```

```html
<!-- template -->
<div v-if="error" class="error-banner">
  {{ error.message }}
</div>
```

### 6.3 何时使用 `silentError`

| 场景 | 是否使用 `silentError`？ |
|------|-------------------------|
| 简单 CRUD 页面（列表/新建/删除） | 否——全局 toast 即可满足需求 |
| 多步骤 dialog 需要内联反馈 | **是**——用户需要 dialog 内的上下文相关错误信息 |
| API 调用的 error response body 中包含结构化数据 | **是**——以便通过 `err.data.result` 访问详细信息 |
| 后台/fire-and-forget 调用 | 否——toast 是唯一的反馈机制 |

---

## 7. 待讨论项

以下问题留待后续讨论：

1. **`PreviewDRFromMismatch` 是否也应使用 `silentError`？** 当前使用默认行为（toast 弹出），dialog 显示通用的 "Failed to load preview data" fallback。可改为在 dialog 内联展示具体错误信息。

2. **Request interceptor 的 error path**：request interceptor（line 47-62）仍然以原始 error 对象 reject（非 `HttpError`）。该路径仅在请求层面失败（如请求发出前的网络错误）时触发，较为少见。是否需要统一？

3. **`HttpError` 改为 class 而非 interface**：可支持 `instanceof` 检查。当前调用方使用 `err as HttpError` type assertion。改为 class 后可使用 `if (err instanceof HttpError)` 进行更安全的类型收窄，但会增加 runtime 依赖。

4. **集中式错误处理工具函数**：某些调用方可能需要一种折中方案——抑制默认 toast，但弹出带有额外上下文的自定义 toast（如 `"创建 DR 失败: <server message>"`）。可提供 helper 函数如 `showHttpError(err: HttpError, prefix?: string)` 来标准化此模式。

5. **Success interceptor 的 `res.msg` toast**：success path（line 66-69）在 backend 返回 `msg` 字段时自动弹出 `window.$message.info(res.msg)`，同样没有 opt-out 机制。是否应由 `silentError`（或单独的 `silentMsg`）来控制？
