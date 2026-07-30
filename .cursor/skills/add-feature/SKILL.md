---
name: add-feature
description: >-
  Scaffold a new staff FE feature on the new vcl-forntend framework (module
  facade + page colocation + routes + mock). Use when adding admin/sales/ops
  screens on the Next.js FE, or when the user asks thêm feature / màn hình mới
  trên khung mới.
---

# Add feature (target: vcl-forntend)

Làm trên clone repo **`vcl-forntend`**, không scaffold Next structure vào `AdminVietNamLogictic/`.

## Checklist

```
Progress:
- [ ] 1. Module api/mock/mappers/index (+ seed)
- [ ] 2. Page + colocated components
- [ ] 3. ROUTES + routeAccess (nếu cần)
- [ ] 4. Mock verify
- [ ] 5. API verify (optional)
```

## Steps

1. `src/modules/<feature>/` — pattern `restricted-items` hoặc skill `wire-module-mock-api`.
2. `src/app/pages/<role>/<slug>/page.jsx` + `components/`.
3. Cập nhật `src/utils/appRoutes.js` (+ `routeAccess.js` / middleware nếu cần).
4. `NEXT_PUBLIC_DATA_SOURCE=mock` → `bun run dev` → smoke.
5. Nối API / sửa mappers.

## Không làm

- Không thêm `*Service.js` domain vào `utils/`.
- Không mang MUI/Ant từ repo này sang.
- Package manager target: **Bun**.
