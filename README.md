# HeThongLogictic — FE nội bộ VCL (Vite)

Web quản trị / sale cho hệ thống logistics xuyên biên giới Việt Nam.  
Ứng dụng chạy nằm trong thư mục **`AdminVietNamLogictic/`**.

> Khung FE **mới** (Next.js): [`vcl-forntend`](https://github.com/Capstone-project-team-su26/vcl-forntend) — repo này là bản Vite đang dùng / nguồn reference khi migrate.

---

## Stack

| Thành phần | Công nghệ |
|------------|-----------|
| Bundler | Vite 8 |
| UI | React 19, React Router 7 |
| Component | MUI 9, Ant Design 6 |
| HTTP | Axios |
| Deploy | Vercel (`vercel.json` SPA rewrite) |

---

## Chạy local

Tạo file `AdminVietNamLogictic/.env` với ít nhất:

```env
VITE_API_BASE_URL=https://your-api-host
```

Tuỳ chọn: `VITE_UPLOAD_API_BASE_URL`, `VITE_COMPANY_NAME`, `VITE_COMPANY_TAX_CODE`, `VITE_COMPANY_PHONE`.

### Bun — chạy từ **root repo** (khuyến nghị)

App nằm trong `AdminVietNamLogictic/`. Root `package.json` đã proxy script:

```bash
# tại HeThongLogictic/ (root)
bun run install:app
bun run dev
```

| Lệnh (root) | Việc |
|-------------|------|
| `bun run install:app` | `bun install` trong app |
| `bun run dev` | Dev server → http://localhost:5173 |
| `bun run dev:host` | Dev + bind network (`--host`) |
| `bun run build` | Build → `AdminVietNamLogictic/dist/` |
| `bun run preview` | Xem bản build |
| `bun run lint` | ESLint |

**Cursor / VS Code:** `Terminal` → `Run Task…` → chọn `bun: dev` (tasks trong `.vscode/tasks.json`).

### Bun — chạy trong thư mục app

```bash
cd AdminVietNamLogictic
bun install
bun run dev
```

### npm (đồng đội vẫn dùng bình thường)

```bash
cd AdminVietNamLogictic
npm install
npm run dev
```

**Lockfile:** commit cả `bun.lock` và `package-lock.json`. Không xóa `package-lock.json`.

---

## Cấu trúc repo

```
HeThongLogictic/
├── AGENTS.md                 # Hướng dẫn Cursor agent
├── .cursor/
│   ├── rules/                # Rules (Bun, architecture, map migrate…)
│   └── skills/               # Skills (sửa Vite, migrate, module…)
└── AdminVietNamLogictic/    # ← app Vite thật sự
    ├── package.json
    ├── bun.lock
    ├── package-lock.json
    ├── vite.config.js
    ├── vercel.json
    ├── index.html
    ├── public/
    └── src/
```

---

## Cấu trúc `AdminVietNamLogictic/src`

```
src/
├── main.jsx                 # Entry
├── App.jsx                  # Root + AppRoutes
├── api/                     # Axios services theo domain
├── pages/                   # Màn hình theo role
├── components/              # UI dùng lại (Sale, Address, User…)
├── layouts/                 # Header, Sidebar, MainLayout
├── routes/                  # AppRoutes + PrivateRoute (auth/role)
├── utils/                   # authSession, toast/notify, helpers
└── assets/
```

### `src/api/` — gọi backend

| Path | Việc |
|------|------|
| `axiosInstance.js` | Client chung, gắn Bearer token, check hết hạn |
| `apiEndpoints.js` | (nếu dùng) tập trung path |
| `Auth/authService.js` | Đăng nhập |
| `AdminAPI/adminService.js` | Admin users / catalog |
| `SaleAPI/ConsignmentAPI/*` | Ký gửi, báo giá, kho, bảng giá, hàng cấm… |
| `SaleAPI/CusSale/` | Khách hàng (sale) |
| `SaleAPI/PurchaseRequestAPI/` | Yêu cầu mua hộ |
| `SaleAPI/Historyapi/` | Lịch sử thanh toán đơn |
| `SaleAPI/Conversation/` | Chat CS |
| `AddressAPI/` | Địa chỉ VN (API tỉnh/thành ngoài) |
| `Upload/` | Upload ảnh |

UI **gọi service trong `api/`**, không gọi axios rải rác trong page nếu đã có service.

### `src/pages/` — màn theo role

```
pages/
├── LoginPage/
├── AdminPage/          # Dashboard, users, catalog (kho, carrier, pricing…)
└── SalePage/
    ├── ConsignmentsPage/          # DS / chi tiết / tạo báo giá
    ├── CreateRequestPage/         # Tạo đơn ký gửi / mua hộ
    ├── CusTomerPagesale/          # Khách hàng
    ├── PurchasePage/              # Purchase requests
    ├── HistorySalePage/           # Lịch sử đơn, thanh toán, phiếu nhập
    ├── BanItem/                   # Hàng cấm (sale view)
    ├── ServicePricingRule/        # Bảng giá dịch vụ
    └── Chat/                      # Customer service chat
```

### `src/layouts/` & `src/routes/`

- `layouts/mainLayout.jsx` — khung sau login (Header + Sidebar + outlet).
- `routes/PrivateRoute.jsx` — bắt buộc đăng nhập + đúng role.
- `routes/AppRoutes.jsx` — map URL ↔ page.

### `src/components/`

- `SaleComponents/` — form ký gửi / mua hộ / optional services…
- `AddressComponents/` — chọn địa chỉ VN
- `UserComponents/` — profile modal

### `src/utils/`

- `Common/authSession.js` — `sessionStorage`: `accessToken`, `isAuth`, `role`
- Notify / loader dùng chung

---

## Phân quyền & route chính

| Role (normalize) | Home | Prefix |
|------------------|------|--------|
| `admin` | `/admin` | `/admin/*` |
| `sale` | `/sale/consignments` | `/sale/*` |
| `operationsmanager` | `/operations-manager` | `/operations-manager` (shell) |

### Admin (ví dụ)

| Path | Màn |
|------|-----|
| `/admin` | Dashboard |
| `/admin/users` | Users |
| `/admin/warehouses` | Kho |
| `/admin/carriers` | Đơn vị vận chuyển |
| `/admin/shipping-methods` | Phương thức VC |
| `/admin/package-configurations` | Cấu hình kiện |
| `/admin/additional-service-fees` | Phí dịch vụ thêm |
| `/admin/service-pricings` | Bảng giá dịch vụ |
| `/admin/pricing-rules` | Pricing rules |
| `/admin/restricted-items` | Hàng cấm |
| `/admin/warehouse-locations` | Vị trí kho |

### Sale (ví dụ)

| Path | Màn |
|------|-----|
| `/sale/consignments` | Danh sách ký gửi |
| `/sale/consignments/:orderId` | Chi tiết |
| `/sale/consignments/:orderId/create-quotation` | Tạo báo giá |
| `/sale/create-order/consignment` | Tạo đơn ký gửi |
| `/sale/create-order/buy-orders` | Tạo đơn mua hộ |
| `/sale/customers` | Khách hàng |
| `/sale/purchase-requests` | Purchase requests |
| `/sale/history/order` | Lịch sử đơn |
| `/sale/customer-service` | Chat |
| `/sale/restricted-items` | Hàng cấm |
| `/sale/service-pricings` | Bảng giá |

Đăng ký route mới: sửa `src/routes/AppRoutes.jsx` (+ Sidebar nếu cần hiện menu).

---

## Luồng request (tóm tắt)

```
Page / Component
    → src/api/**/**Service.js
        → axiosInstance (VITE_API_BASE_URL + Bearer)
            → Backend API
```

Auth hết hạn → clear session → về `/login`.

---

## Repo liên quan

| Repo | Vai trò |
|------|---------|
| [vcl-forntend](https://github.com/Capstone-project-team-su26/vcl-forntend) | FE nội bộ khung mới (Next.js) |
| [vcl-forntend.vercel.app](https://vcl-forntend.vercel.app/) | Deploy FE mới |
| Backend API | Cấu hình qua `VITE_API_BASE_URL` (không commit secret) |

Map route/code cũ → mới: xem `.cursor/rules/legacy-fe-map.mdc` và `AGENTS.md`.

---

## Agent / Cursor

Rules & skills trong `.cursor/` — clone máy nào cũng dùng được. Xem **`AGENTS.md`**.
