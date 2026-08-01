---
name: migrate-legacy-page
description: >-
  Port a screen from AdminVietNamLogictic in this repo into vcl-forntend.
  Use when the user mentions migrate, port, chuyển màn, copy từ FE cũ, Vite,
  AdminVietNamLogictic, or HeThongLogictic legacy pages.
---

# Migrate legacy page → vcl-forntend

## Nguồn / đích

- **Nguồn:** `AdminVietNamLogictic/` trong **repo này** (Vite, axios `*Service`, MUI/Ant).
- **Đích:** clone [`vcl-forntend`](https://github.com/Capstone-project-team-su26/vcl-forntend).

Đọc rule `legacy-fe-map` trước.

## Workflow

```
Progress:
- [ ] 1. Inventory legacy (page + services + routes)
- [ ] 2. Map endpoints & status enums
- [ ] 3. Module trên vcl-forntend (reuse nếu có)
- [ ] 4. Rebuild UI (không paste MUI/Ant)
- [ ] 5. Wire ROUTES + guards
- [ ] 6. Mock parity rồi API
```

### 1. Inventory (repo này)

- Pages: `AdminVietNamLogictic/src/pages/SalePage|AdminPage/...`
- Services: `AdminVietNamLogictic/src/api/**`
- Routes: `AdminVietNamLogictic/src/routes/AppRoutes.jsx`

### 2–6. Trên vcl-forntend

Reuse `src/modules/` nếu đã có. Thiếu → `wire-module-mock-api`.  
UI Tailwind theo pattern sẵn có. Giữ validation/copy tiếng Việt hữu ích.

## Anti-patterns

- Paste JSX/CSS cũ vào Next app.
- Giữ `sessionStorage` auth kiểu Vite trên target.
- Thêm lại `*Service.js` trong `utils/` target.
- Scaffold App Router vào đúng repo Vite này trừ khi team bảo.
