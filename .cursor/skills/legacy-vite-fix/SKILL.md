---
name: legacy-vite-fix
description: >-
  Fix or extend the current Vite FE in AdminVietNamLogictic (routes, axios
  services, Sale/Admin pages). Use when editing legacy FE, AppRoutes,
  PrivateRoute, axiosInstance, or files under AdminVietNamLogictic.
---

# Sửa FE Vite legacy (`AdminVietNamLogictic`)

## Trước khi sửa

1. Đọc rule `legacy-vite-fe`.
2. Trace: page → service → `axiosInstance` → response shape.
3. Giữ pattern UI/CSS khu vực đang đụng.

## Checklist thường gặp

```
Progress:
- [ ] 1. Xác định role + route (AppRoutes / PrivateRoute)
- [ ] 2. Sửa hoặc thêm *Service.js đúng thư mục api/
- [ ] 3. Cập nhật page/component
- [ ] 4. Sidebar/nav nếu thêm màn
- [ ] 5. Smoke login đúng role
```

## Commands

Agent / Bun (mặc định):

```bash
cd AdminVietNamLogictic
bun install
bun run dev
```

Đồng đội npm vẫn OK — **không** xóa `package-lock.json`:

```bash
cd AdminVietNamLogictic
npm install
npm run dev
```
## Khi nào migrate thay vì patch

Nếu team đang chuyển màn sang `vcl-forntend` và màn này sắp port → ưu tiên skill `migrate-legacy-page` thay vì đầu tư lớn vào UI Vite.
