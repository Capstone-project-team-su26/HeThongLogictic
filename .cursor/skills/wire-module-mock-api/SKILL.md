---
name: wire-module-mock-api
description: >-
  Create or extend a vcl-forntend domain module (api.js, mock.js, mappers.js,
  index.js + isMockMode). Use when wiring mock/API on the new FE, scaffold
  module, or refactor axios *Service from AdminVietNamLogictic into modules.
---

# Wire module (mock + API) — vcl-forntend

Chạy trên repo target **`vcl-forntend`**.

## Layout

```
src/modules/<feature>/
  index.js
  api.js
  mock.js
  mappers.js
  seed.js          # optional
```

Tham chiếu: `src/modules/restricted-items/`.

## Facade

```js
import { isMockMode } from "@/utils/mocks/dataSource";
import { listFeatureApi, createFeatureApi } from "./api";
import { listFeatureMock, createFeatureMock } from "./mock";

export { normalizeFeatureFromApi, toApiFeaturePayload } from "./mappers";

export async function listFeature(params = {}) {
  if (isMockMode()) return listFeatureMock(params);
  return listFeatureApi(params);
}
```

## Rules

- `api.js`: `apiRequest` từ `@/utils/apiClient`, path `/api/...`, normalize qua mappers.
- `mock.js`: cùng shape với API; seed → `mockStore` nếu cần persist.
- Từ legacy `*Service.js`: đọc contract axios cũ trong `AdminVietNamLogictic/src/api/**`, viết lại mapper — không copy axiosInstance.

## Done khi

- UI chỉ import `@/modules/<feature>`.
- Đổi mock/api không đổi call-site UI.
