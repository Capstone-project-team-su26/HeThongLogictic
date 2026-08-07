---
name: vcl-feature-module
description: >
  Khi được yêu cầu tạo tính năng mới (màn hình, module, hook, API) cho project vcl-mobile / VCL-WAREHOUSE-Staff,
  skill này hướng dẫn cách tổ chức folder đúng chuẩn, đặt tên file nhất quán, viết API service,
  store (hook), UI helpers, và component đúng pattern của project.
  Trigger khi: tạo màn hình mới, tạo API mới, tạo hook/store, tạo module tính năng, refactor cấu trúc folder.
---

# VCL Feature Module Skill

Đọc tài liệu tham chiếu sau **trước khi viết code**:
- [folder-structure.md](references/folder-structure.md) — Quy tắc đặt tên và cấu trúc folder
- [api-pattern.md](references/api-pattern.md) — Pattern viết API service
- [store-pattern.md](references/store-pattern.md) — Pattern viết Store / Hook
- [ui-pattern.md](references/ui-pattern.md) — Pattern viết UI helpers và component

## Quy trình tạo một Feature Module mới

### Bước 1 — Xác định tên module

Dùng tên module dạng **PascalCase** cho folder screen, **camelCase** cho tên file hook/store/api.

Ví dụ: Feature `Inbound` → `InboundScreen`, `inboundApiService.js`, `inboundStore.js`, `inboundUi.js`

### Bước 2 — Tạo đúng cấu trúc folder

Tham chiếu [folder-structure.md](references/folder-structure.md).

Mỗi feature phải có 4 lớp tương ứng:
1. `src/config/api/<FeatureName>/` — API service
2. `src/hook/<sharedFolder>/<featureName>/` — Store + UI helpers + Components
3. `src/screen/<Warehouse>/<FeatureName>/<ScreenName>/` — Screen JSX

### Bước 3 — Viết API trước

Tham chiếu [api-pattern.md](references/api-pattern.md).

### Bước 4 — Viết Store / Hook

Tham chiếu [store-pattern.md](references/store-pattern.md).

### Bước 5 — Viết UI helpers + Component

Tham chiếu [ui-pattern.md](references/ui-pattern.md).

### Bước 6 — Tạo Screen

Tham chiếu ví dụ trong examples/.
