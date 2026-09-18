# vcl-admin-ui — Hệ thống Quản lý Chuỗi Cung ứng Việt Nam Logistic

Đây là **front-end nội bộ** của Việt Nam Logistic: ba khu vực làm việc cho **Admin**,
**Sale (kinh doanh)** và **Operations Manager (vận hành)**. Không phải trang cho khách hàng
cuối — mọi màn hình ở đây là công cụ nghiệp vụ của nhân sự trong công ty.

**Repo đang ở trạng thái NỬA THẬT NỬA MẪU.** Luồng **báo giá ký gửi** của Sale/Admin đã nối
backend thật (`axios` + `src/shared/api/httpClient.js`); mọi màn còn lại vẫn là **mock**, đọc
dữ liệu mẫu từ `src/mocks/`. Chi tiết ở **mục 1bis — Trạng thái nối API**. Hệ quả thực tế:

- `npm run dev` vẫn chạy được ngay, **không cần `.env`** (base URL mặc định là production).
- Màn ngoài luồng ký gửi bấm nút vẫn thấy đúng phản hồi (loading, toast, phân trang, lỗi
  400/404…) vì mock giả lập đúng hình dạng dữ liệu và hình dạng lỗi của tầng axios.
- **Dữ liệu mẫu sống trong bộ nhớ trình duyệt**: tải lại trang là mọi thay đổi ở màn mock
  mất hết. Màn đã nối thật thì ghi thẳng vào backend — **cẩn thận khi thao tác trên đơn
  production**.

Stack: React 19 + Vite, **JavaScript thuần** (không TypeScript, không type annotation),
Ant Design + MUI, React Router v7.

---

## 1. Bắt đầu nhanh

```bash
npm install
npm run dev
```

Mở URL Vite in ra (mặc định `http://localhost:5173`) rồi đăng nhập.

**Đăng nhập nay đi qua backend thật** (`POST /api/Auth/login`), nên ba tài khoản mẫu bên
dưới **không còn đăng nhập được**. Dùng tài khoản demo trên production — danh sách ở
`vcl-BE/huong-dan-ghep-api/README.md` mục 4 (`demo.sale@…`, `demo.admin@…`; mật khẩu xin
chủ dự án). Tài khoản `Customer` bị chặn với câu *"Tài khoản khách hàng không dùng được cho
trang quản trị."*

### Ba tài khoản demo (chỉ còn là dữ liệu của các màn mock)

| Vai trò | Email | Mật khẩu | Vào thẳng |
|---|---|---|---|
| Quản trị (admin) | `admin@vietnamlogistics.vn` | `Admin@123` | `/admin` |
| Kinh doanh (sale) | `sale@vietnamlogistics.vn` | `Sale@123` | `/sale/consignments` |
| Vận hành (operationsmanager) | `operations@vietnamlogistics.vn` | `Operations@123` | `/operations-manager` |

Ba tài khoản này định nghĩa tại `src/mocks/data/people.js` (hằng `demoAccounts`) và vẫn là
ba bản ghi đầu trong danh sách người dùng `users` của màn quản trị nhân sự — nhưng chúng
**không còn dùng để đăng nhập** kể từ khi `authService` gọi backend thật.

Phiên đăng nhập lưu vào `sessionStorage`, nên **đóng tab là đăng xuất**. `httpClient` gắn
`Authorization: Bearer <accessToken>` từ đó; gặp 401 có body rỗng thì gọi
`expireAuthSession()` (dọn phiên + về `/login`), còn 401/403 có `{ message }` thì chỉ ném lỗi
để màn hình hiện nguyên câu tiếng Việt của server.

### Các lệnh có sẵn

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy dev server |
| `npm run dev:host` | Như trên, mở ra LAN (`vite --host`) |
| `npm run build` | Build production vào `dist/` |
| `npm run preview` | Xem thử bản build |
| `npm run lint` | ESLint toàn dự án (bỏ qua `dist` và `tools`) |
| `npm run verify:mocks` | Kiểm tra tầng mock còn giữ đúng hợp đồng API — xem mục 6 |
| `npm run verify:barrels` | Kiểm tra barrel của 18 feature: không tên nào bị `undefined`, và liệt kê các tên trùng giữa feature |
| `npm run verify:api` | 41 kịch bản OFFLINE cho tầng đã nối backend (adapter axios giả, chặn mọi truy cập mạng) — xem mục 1bis |

---

## 1bis. Trạng thái nối API

Repo **không còn là bản chỉ-giao-diện thuần**. Đợt vừa rồi đã nối **luồng BÁO GIÁ KÝ GỬI
của Sale/Admin** vào backend thật; mọi màn khác vẫn chạy dữ liệu mẫu.

### 1bis.1 Đã nối backend thật

| Module `api/` | API |
|---|---|
| `shared/api/httpClient.js` | axios instance dùng chung: baseURL, Bearer, xử lý 401 |
| `shared/api/apiEnvelope.js` | bóc vỏ response (`{data}` / `{items}` / object trần) |
| `auth/api/authService.js` | `POST /api/Auth/login`, `GET|PUT /api/User/profile` |
| `consignment/api/consignmentService.js` | `GET /api/orders/consignments`, `GET .../{id}`, `PUT .../{id}/status`, `POST /api/orders/{id}/quotation/send` |
| `consignment/api/quotationService.js` | `GET /api/orders/{id}/quotation`, `GET /api/quotations/{id}`, `PUT /api/quotations/{id}/price-approval` |
| `consignment/api/consignmentMasterService.js` | `/api/product-types`, `/api/orders/consignments/routes`, `.../shipping-options` |
| `warehouse/api/warehouseService.js` | `/api/warehouses`, `/api/warehouses/active` |
| `pricing/api/servicePricingService.js` | `/api/service-pricings` |
| `pricing/api/pricingRuleService.js` | `/api/pricing-rules?orderType=CONSIGNMENT` |
| `pricing/api/packageConfigurationService.js` | `/api/package-configurations`, `.../suggest` |

Màn hình đi kèm: `/sale/consignments`, `/sale/consignments/:orderId`,
`/sale/consignments/:orderId/create-quotation`, `/sale/history/order`,
`/admin/consignments*` (chỉ xem) và màn **mới** `/admin/price-approvals`.

### 1bis.1b Đợt ghép luồng xuất kho quốc tế + hàng về Việt Nam (18/09/2026)

| Module `api/` | API |
|---|---|
| `shared/api/fileDownload.js` | tải PDF / file đính kèm dạng Blob **có Authorization** (không mở link trần) |
| `attachments/api/attachmentService.js` | `POST/GET /api/attachments`, `GET /api/attachments/{id}/download` |
| `operations/api/warehouseReleaseService.js` | `/api/warehouse-release-requests` (list, detail, `decide`, `release-note`, `picking-sheet`) |
| `shipment/api/internationalShipmentService.js` | `/api/international-shipments` (list, detail, `tracking-queue`, `timeline`, `status`, `manifest`) |
| `incident/api/parcelIncidentService.js` | `/api/parcel-incidents` (list, detail, `resolve`, `compensation-paid`) |
| `operations/api/destinationApprovalService.js` | `/api/warehouse-inbound-requests`, `/api/delivery-requests` (duyệt, `proof`) |
| `operations/api/parcelInspectionService.js` | `GET /api/parcel-inspections` |
| `operations/api/inventoryService.js` | `GET /api/inventories` |
| `settlement/api/settlementService.js` | `awaiting-settlement`, `settlement-preview`, `payments/final`, `payments`, `POST /api/delivery-requests`, `notify-warehouse` |
| `tracking/api/orderTrackingService.js` | `/api/orders/consignments/tracking`, `/{id}/tracking`, `/{id}/export-hold`, `/{id}/complete` |
| `warehouse/api/warehouseZoneService.js` | `/api/warehouses/{id}/zones`, `PUT /api/warehouse-zones/{id}`, `/misplaced-parcels` |
| `catalog/api/transportCatalogService.js` | `/api/carriers`, `/api/shipping-routes` |
| `payment/api/orderPaymentService.js` | `GET /api/orders/{id}/payments/history` |

Đã xoá (mock, nghiệp vụ cũ): quy trình gom lô `consolidationWorkflowService` + mọi modal WRO/master box,
`SaleWroPage` (`/sale/wro*`), đơn GoShip mock (`/sale/goship-orders`), hàng hoàn cũ
(`/operations-manager/parcel-returns`, `parcelReturnService`), `operationsDashboardService`,
`operationsMappers`, fixture `operations.js`, `payments.js`, `goshipOrders.js`, `finance.js`,
`receivingNotes.js`. URL cũ chuyển hướng sang màn mới.

### 1bis.2 Ba thay đổi nghiệp vụ của backend mà giao diện đã bám theo

1. **Không còn bước "Duyệt đơn".** `PUT /api/orders/consignments/{id}/status` chỉ nhận
   `REJECTED` hoặc `NEED_MORE_INFO`, **bắt buộc** `rejectionReason`; gửi `APPROVED` bị 400.
   Màn chi tiết đã bỏ nút *Duyệt đơn* và thêm nút **Yêu cầu bổ sung**.
2. **Dịch vụ đi theo từng KIỆN.** Khách chọn thùng gỗ (`items[].packageConfigurationId`) và
   dịch vụ (`items[].services[]`) cho từng kiện; hệ thống tự tính phí và đưa sẵn vào báo giá
   nháp. Sale **không nhập lại**, chỉ sửa số tiền hoặc miễn phí một dịch vụ trên một kiện —
   dòng đó gửi lên kèm `orderItemId`.
3. **Giá ngoài bảng giá phải chờ Admin.** Sửa lệch > 1đ so với bảng giá thì bắt buộc có
   `overrideReason` (hoặc `salesNote`), và báo giá trả về `status = PENDING_PRICE_APPROVAL`
   thay vì `QUOTATION_SENT` — **khách chưa nhìn thấy** cho tới khi Admin duyệt ở
   `/admin/price-approvals`.

### 1bis.3 Hạn chế đã biết

- **Hàng đợi duyệt giá được DỰNG LẠI ở phía giao diện.** Backend chưa có endpoint liệt kê
  báo giá chờ duyệt giá, nên `/admin/price-approvals` quét các đơn ký gửi gần đây
  (`PENDING_REVIEW`, `NEED_MORE_INFO`, `QUOTATION_SENT`, `QUOTATION_REJECTED`, `APPROVED`)
  rồi đọc báo giá từng đơn (tối đa 2 trang × 50 đơn mỗi trạng thái, 5 request song song).
  Đơn rất cũ có thể không hiện ra. Màn hình nói rõ điều này bằng một thẻ cảnh báo.
- **Bộ lọc mịn của danh sách đơn chạy TẠI CHỖ.** Backend chỉ nhận `status`, `searchCode`,
  `pageNumber`, `pageSize`, `orderType`. Từ khoá tự do / loại dịch vụ / kho / khoảng ngày
  được lọc lại trên trang vừa tải, nên `totalCount` là số của server chứ không phải số dòng
  đang thấy.
- **Bốn hàm ngoài phạm vi ném lỗi `API_NOT_WIRED`**: `createConsignmentApi`,
  `validateConsignmentItemsApi`, `estimateQuotationApi`, `approveConsignmentApi`. Chúng chỉ
  được gọi từ màn "Sale tạo đơn hộ khách" — màn đó đang dùng bản `*.mock.js`.
- **Phiếu biên nhận PDF (`consignmentReceiptService`) vẫn là mock.** `GET /api/orders/consignments/{id}/receipt`
  chưa nối, nút tải phiếu ở danh sách đơn còn trả file mẫu.
- **Chưa thử với backend thật.** Toàn bộ kiểm chứng chạy offline qua adapter axios giả
  (`npm run verify:api`). Hành vi phụ thuộc dữ liệu production (bảng giá, cấu hình thuế,
  quyền theo tài khoản) chưa được xác nhận.

### 1bis.4 Cô lập đợt: bản sao `*.mock.js`

Các màn **ngoài** luồng báo giá ký gửi phải tiếp tục chạy dữ liệu mẫu, nên mỗi module dùng
chung có một **bản chép nguyên văn** đuôi `.mock.js`, và chỉ những màn đó đổi import:

| Bản sao | Màn đang dùng |
|---|---|
| `consignment/api/consignmentService.mock.js` | SaleDashboard, ConsignmentDocumentsList, chat (constants + trợ lý AI), ConsignmentOrder |
| `consignment/api/consignmentMasterService.mock.js` | ConsignmentOrder, ConsignmentBuyOrder |
| `pricing/api/pricingRuleService.mock.js` | mua hộ (4 file), PackageOptionalServices, ConsignmentOrder, ServicePricings |
| `pricing/api/servicePricingService.mock.js` | SaleDashboard, CreatePurchaseRequestQuotationModal, ServicePricings |
| `pricing/api/packageConfigurationService.mock.js` | ServicePricings |
| `warehouse/api/warehouseService.mock.js` | ConfirmPurchaseModal, PurchaseRequestDetail |

Bản sao **không** được re-export từ barrel (để `verify:barrels` sạch) và **không** được nối
mạng (`verify:api` kiểm điều này). Đợt sau nối nốt màn nào thì sửa import của màn đó về
module gốc rồi **xoá** bản sao tương ứng.

### 1bis.5 Kiểm chứng

```bash
npm run verify:mocks     # hợp đồng API + trạng thái đơn + I/O matrix (module đã nối được miễn bước soát mạng)
npm run verify:barrels   # 18 barrel nạp được, không tên nào undefined
npm run verify:api       # 41 kịch bản OFFLINE cho tầng đã nối backend — KHÔNG gọi mạng thật
npm run build
```

`verify:api` chặn `http/https/net/tls/fetch` của Node **trước** khi nạp module sản phẩm, rồi
thay adapter của axios bằng adapter giả. Không kịch bản nào chạm tới production.


---

## 2. Biến môi trường

Đúng **một** biến, và nó **tuỳ chọn**: `VITE_API_BASE_URL`. Xem [`.env.example`](./.env.example).

| Biến | Đọc ở | Thiếu thì |
|---|---|---|
| `VITE_API_BASE_URL` | `src/shared/api/httpClient.js` | dùng `https://vcl.henrytech.cloud` (production), dấu `/` cuối bị cắt |

**Đừng** trỏ sang `https://api-vcl.zushin.io.vn`: đó là một bản deploy khác chạy **code cũ**,
thiếu các API của đợt này (dịch vụ theo kiện, duyệt giá ngoại lệ, khu kho).

Kiểm chứng danh sách này: `grep -rn "import.meta.env" src/` — ngoài `httpClient.js` không
file nguồn nào đọc biến môi trường.

## 3. Cây thư mục

```
vcl-admin-ui/
├── index.html                  điểm vào của Vite, nạp /src/main.jsx
├── vite.config.js              plugin React + khai báo 6 alias
├── jsconfig.json               cùng 6 alias đó, để IDE nhảy được vào file
├── vercel.json                 rewrite mọi URL về /index.html (SPA cần, nếu không F5 sẽ 404)
├── eslint.config.js            cấu hình ESLint phẳng
├── public/                     tài nguyên copy nguyên trạng (favicon.svg, icons.svg)
├── tools/                      script chạy bằng node, KHÔNG nằm trong bundle
└── src/
```

`tools/` — bốn file, chạy tay bằng `node`, ESLint cố tình bỏ qua:

| File | Việc |
|---|---|
| `tools/migrate.mjs` | Script di trú một lần từ bản gốc `AdminVietNamLogictic` sang cây này: chuyển từng file sang vị trí mới rồi viết lại mọi import sang dạng alias. Giữ lại như **hồ sơ**: bảng `MAP` là bằng chứng file cũ nào thành file mới nào, hằng `DROPPED` ghi 11 file bị bỏ và lý do (xem mục 7). |
| `tools/api-contract.json` | Hợp đồng của tầng API: **31 module**, **349 tên export**, và module nào có `default`. Chụp lại từ bản thật trước khi thay bằng mock. |
| `tools/verify-mocks.mjs` | Đối chiếu mock với hợp đồng trên: đủ tên export chưa, còn `default` không, và có còn dấu vết mạng (`axios`, `fetch`, `WebSocket`, `httpClient`…) không; cộng bước soát trạng thái đơn ký gửi (19 mã đích) và bước **I/O matrix** của story 1 (spec-consignment-flow): chạy thật nhãn/chuẩn hoá mã đơn, tiền cọc theo `DEPOSIT_RATE` (kể cả khi thiếu rule) và đổi `DEPOSIT_RATE` 30 → 40, in PASS/FAIL từng kịch bản. Thoát mã 1 nếu sai — cắm vào CI được. |
| `tools/verify-barrels.mjs` | Nạp thật 18 barrel qua Vite rồi kiểm hai lỗi **chỉ lộ ra lúc chạy, không làm hỏng build**: `export *` từ hai module cùng đưa ra một tên (ESM âm thầm biến tên đó thành `undefined`), và barrel re-export một tên mà module đích không có. Hiện: **18/18 barrel nạp được, 459 tên xuất ra, không tên nào `undefined`**. |

Chạy `npm run verify:mocks` hiện in ra **`đạt hợp đồng: 30/31`** và **`tên export soát: 348`**.
Đó là **kết quả đúng, không phải lỗi**: `src/shared/api/apiEndpoints.js` nằm trong danh sách
`EXEMPT` của script (nó là bản đồ endpoint thật, không phải mock) nên bị bỏ qua — mất 1
module và 1 tên khỏi phần được kiểm. Dòng cuối *"Tầng mock giữ đúng toàn bộ hợp đồng"* mới
là kết luận.

`src/` — chia bốn tầng, đọc theo chiều phụ thuộc từ trên xuống:

```
src/
├── main.jsx                    mount React vào #root, không làm gì khác
├── app/                        TẦNG ỨNG DỤNG — sở hữu router và provider
│   ├── App.jsx                 <AppProviders><AppRouter /></AppProviders>
│   ├── providers/              BrowserRouter + reset.css của antd
│   ├── router/                 paths.js, roles.js, RequireAuth, RoleRedirect, 3 file route
│   └── pages/NotFound/         màn 404 — thuộc về app vì không thuộc feature nào
├── features/                   TẦNG NGHIỆP VỤ — 18 module, mỗi module một mảng việc
│   ├── admin/                  quản trị người dùng, dòng tiền, giám sát giao hàng
│   ├── auth/                   màn đăng nhập + mock xác thực
│   ├── catalog/                13 màn danh mục nền + khung CRUD AdminResourcePage
│   ├── chat/                   chăm sóc khách hàng + trợ lý AI cho Sale
│   ├── consignment/            luồng đơn KÝ GỬI: tạo → duyệt → báo giá → chi tiết
│   ├── customer/               sổ khách hàng của Sale
│   ├── dashboard/              ba bảng điều khiển: Admin / Sale / Operations
│   ├── documents/              tra cứu chứng từ (ký gửi & mua hộ)
│   ├── goship/                 đơn giao chặng cuối qua đối tác GoShip
│   ├── history/                lịch sử đơn đã đóng
│   ├── operations/             kho vận: kiện, thùng master, phiếu xuất, lô hàng, 3 cửa duyệt
│   ├── payment/                lịch sử thanh toán theo đơn
│   ├── pricing/                bảng giá, quy tắc giá, tỷ giá, cấu hình đóng gói
│   ├── purchase/               luồng đơn MUA HỘ
│   ├── receiving/              phiếu tiếp nhận tại kho GỐC
│   ├── settlement/             chốt tiền & cho hàng rời kho
│   ├── shipment/               lô hàng và hành trình vận chuyển
│   └── warehouse/              sơ đồ kho, ô kệ, tồn theo vị trí
├── layouts/                    KHUNG MÀN HÌNH dùng chung
│   ├── MainLayout/             Header + Sidebar + <Outlet /> (Sale không có Header)
│   ├── Header/                 thanh trên, hồ sơ cá nhân, đăng xuất
│   └── Sidebar/                menu trái, dựng theo MENU_BY_ROLE
├── shared/                     DÙNG CHUNG, không mang nghiệp vụ của riêng feature nào
│   ├── api/                    apiEndpoints.js (bản đồ endpoint thật), uploadImage, dịch vụ địa chỉ VN
│   ├── components/             AuthNotify, FieldLabelTooltip, LoginLoader, UserProfileModal, VietnamAddressSelector
│   ├── utils/                  authSession.js (đọc/xoá phiên, kiểm hạn token), timeUtc.js
│   └── styles/                 create-request.css + legacy/ (xem mục 7)
├── mocks/                      TẦNG DỮ LIỆU MẪU — thay chỗ của backend
│   ├── mockUtils.js            delay, paginate, deepClone, nextId/nextUuid, createApiError…
│   └── data/                   12 file fixture (chi tiết trong src/mocks/README.md)
└── assets/                     ảnh import từ JS (logo, hero, svg)
```

Quy mô hiện tại: 41 trang, 39 component thuộc feature, 31 module `api/`, hơn 200 file
`.js/.jsx/.css` trong `src/`.

### Quy ước bố cục

- **Mỗi component/trang một thư mục riêng**, chứa `Tên.jsx` + `Tên.css` cạnh nhau.
  Ngoại lệ duy nhất: `src/features/catalog/pages/AdminCatalogPages.jsx` — một file sinh
  ra cả 13 màn danh mục từ khung `AdminResourcePage`, tách thành 13 thư mục sẽ là 13 bản
  sao chép cùng một cấu hình.
- **Cùng thư mục thì dùng `"./Tên"`. Khác thư mục thì dùng alias.**
- Comment tiếng Việt, giải thích **vì sao** chứ không thuật lại dòng code.
- **Giao diện phải giữ y hệt bản gốc**: không đổi style, không đổi tên class CSS, không
  sắp xếp lại JSX, không "cải tiến" markup.

---

## 4. Thêm một trang mới

Đúng bốn bước. Ví dụ thêm màn "Báo cáo tồn kho" cho Operations:

**Bước 1 — Tạo thư mục + hai file.**

```
src/features/warehouse/pages/InventoryReportPage/
    InventoryReportPage.jsx
    InventoryReportPage.css
```

Trong `.jsx` import CSS bằng đường dẫn cùng thư mục:

```jsx
import "./InventoryReportPage.css";
```

**Bước 2 — Khai đường dẫn vào `src/app/router/paths.js`.**

Không viết chuỗi URL thẳng vào `<Link>` hay `navigate()`. `paths.js` là nguồn sự thật duy
nhất; đổi URL ở đây là đổi toàn bộ ứng dụng.

```js
export const OPERATIONS = {
  base: OPS_BASE,
  // …
  inventoryReport: `${OPS_BASE}/inventory-report`,
};
```

URL có tham số thì khai bằng hàm, có giá trị mặc định là chính pattern của React Router —
nhờ vậy cùng một dòng vừa dùng để khai báo `<Route>` vừa dùng để `navigate()`:

```js
consignmentDetail: (orderId = ":orderId") => `${SALE_BASE}/consignments/${orderId}`,
```

**Bước 3 — Thêm `<Route>` vào đúng file route theo vai trò.**

Ba file, mỗi vai trò một file: `saleRoutes.jsx`, `adminRoutes.jsx`, `operationsRoutes.jsx`.
Các `<Route>` trong đó là **con** của `<Route path="/operations-manager">`, nên phải bỏ tiền
tố — mỗi file đã có sẵn helper `rel()` làm việc đó:

```jsx
import InventoryReportPage from "@features/warehouse/pages/InventoryReportPage/InventoryReportPage";

<Route
  path={rel(OPERATIONS.inventoryReport)}
  element={<InventoryReportPage />}
/>
```

**Bước 4 — Export từ barrel của feature.**

Cả 18 feature đều đã có `index.js`. Mở `src/features/warehouse/index.js` và thêm:

```js
export { default as InventoryReportPage } from "./pages/InventoryReportPage/InventoryReportPage";
```

Barrel là **bề mặt công khai duy nhất** của feature — chỗ khác chỉ được import qua đây, chứ
không đi thẳng vào `pages/...`.

Muốn trang hiện trên menu trái thì thêm một mục vào `MENU_BY_ROLE` trong
`src/layouts/Sidebar/Sidebar.jsx` — đó là bước thứ năm, tuỳ chọn.

---

## 5. Alias import

Khai hai chỗ và **phải khớp nhau**: `vite.config.js` (để build chạy) và `jsconfig.json`
(để IDE nhảy được vào file). Sửa một chỗ mà quên chỗ kia là IDE báo đỏ nhưng app vẫn chạy,
rất mất thời gian truy.

| Alias | Trỏ tới | Dùng cho |
|---|---|---|
| `@app/*` | `src/app/*` | router, provider, màn 404 |
| `@features/*` | `src/features/*` | trang, component, module `api/` của nghiệp vụ |
| `@layouts/*` | `src/layouts/*` | `MainLayout`, `Header`, `Sidebar` |
| `@shared/*` | `src/shared/*` | component/util/style dùng chung |
| `@assets/*` | `src/assets/*` | ảnh import từ JS |
| `@/*` | `src/*` | phần còn lại — thực tế chỉ dùng cho `@/mocks/...` |

### Luật: không bao giờ viết `../../..`

Chỉ có hai dạng import hợp lệ:

```jsx
import PackageOptionalServices from "./PackageOptionalServices";      // cùng thư mục
import { getConsignmentsApi } from "@features/consignment/api/consignmentService";  // khác thư mục
```

Vì sao: đường dẫn tương đối nhiều cấp buộc phải sửa hàng loạt mỗi khi di chuyển file, và
`../../../api/SaleAPI/ConsignmentAPI/consignmentService` không cho biết file đó thuộc tầng
nào. Alias thì đọc là biết ngay. Toàn bộ cây này đã sạch `../` — `tools/migrate.mjs` viết
lại từng import khi di trú, đừng để lọt lại.

---

## 6. Cắm API thật trở lại (các màn CÒN LẠI)

Luồng báo giá ký gửi đã nối xong (mục 1bis). Mục này là công thức cho những màn còn lại.

**`src/shared/api/httpClient.js` và `src/shared/api/apiEnvelope.js` đã có sẵn — dùng lại,
đừng dựng bản thứ hai.** `httpClient` lo baseURL, Bearer token và quy tắc 401; `apiEnvelope`
lo bóc vỏ response (`getResponseData` / `getArrayItems` / `getPagedData` / `removeEmptyParams`).
Bước "cài lại axios và dựng lại httpClient" bên dưới **đã xong**, giữ lại làm ghi chú lịch sử.

Khi nối một màn đang dùng bản `*.mock.js`: sửa import của màn đó về module gốc, rồi **xoá**
bản sao `.mock.js` cùng dòng tương ứng trong `tools/api-contract.json` và trong danh sách
`OUT_OF_WAVE_IMPORTS` của `tools/verify-api.mjs`.

**`src/shared/api/apiEndpoints.js` được GIỮ NGUYÊN, cố ý.** Nó không phải mock, không bị
`verify-mocks.mjs` soi (nằm trong danh sách `EXEMPT`), và là **bản đồ endpoint thật** để cắm
lại: đường dẫn của auth, customers, consignments, purchase-requests, delivery-addresses,
uploads, product-types, warehouses, restricted-items, package-configurations,
service-pricings, pricing-rules, exchange-rates, warehouse-release-requests. Đừng sửa nó khi
làm việc trên bản UI-only.

Các bước:

**1. Cài lại axios và dựng lại `httpClient`.**

```bash
npm install axios
```

Tạo lại `src/shared/api/httpClient.js`. File này trước đây là `src/api/axiosInstance.js`
của bản gốc — xem bảng `MAP` trong `tools/migrate.mjs` để biết chính xác nó từ đâu ra. Nó
cần: `baseURL`, interceptor gắn `Authorization` từ `sessionStorage.accessToken`, và
interceptor bắt 401 gọi `expireAuthSession()` của `@shared/utils/authSession`
(`isAuthenticationError` trong file đó đã xét sẵn `error.response.status === 401`).

**2. Sửa từng module `api/`, mỗi lần một file.**

Mỗi mock đã ghi sẵn ở **đầu file** phải làm gì. Ba ví dụ có thật trong cây:

- `src/features/warehouse/api/warehouseService.js`: *"chỉ thay THÂN của `getWarehousesApi`
  và `getActiveWarehousesApi` bằng lời gọi axios cũ (`axiosInstance.get(API_ENDPOINTS.warehouses.list / .active, …)` rồi `getResponseData` → `getArrayItems` → `normalizeWarehouse`)"*.
- `src/features/receiving/api/receivingNoteService.js`: *"khôi phục `import axiosInstance from "@shared/api/httpClient"`, hằng `ENDPOINT` bên dưới, rồi bọc lại bằng `getAdminApiData`"* — kèm luôn endpoint cũ `"/api/warehouse-receiving-notes"`.
- `src/features/consignment/api/consignmentService.js`: mỗi hàm async có một mốc `THẬT:`
  ghi rõ endpoint và cách bản gốc bóc dữ liệu (`getResponseData = response.data.data ?? response.data`).

Nguyên tắc chung rút ra từ chính các file đó:

- **Giữ nguyên chữ ký hàm, tên export và hình dạng trả về.** Đây là lý do tồn tại của
  `tools/api-contract.json` — chạy `npm run verify:mocks` sau mỗi file để biết mình chưa
  làm vỡ hợp đồng.
- **Chỉ thay phần thân sau `await delay(...)`.** Các hàm thuần (`normalize*`,
  `calculate*`, `convert*`, `map*ToOptions`) không dính mạng, giữ nguyên từng dòng —
  chúng là nơi duy nhất chặn dữ liệu sai trước khi gửi đi.
- **Không đụng vào component.** Toàn bộ bài toán này được thiết kế để không phải sửa một
  dòng nào trong `.jsx`.

**3. Xoá `src/mocks/`** khi module `api/` cuối cùng đã cắm xong. Cùng lúc đó, `mockUtils` và
`tools/verify-mocks.mjs` cũng hết việc.

---

## 7. Lưu ý

### `src/shared/styles/legacy/` cố ý không được nối vào

Thư mục này giữ hai file: `index-legacy.css` (nguyên là `src/index.css` của bản gốc) và
`app-legacy.css` (nguyên là `src/App.css`). Chúng là **CSS mặc định của template Vite**:
nền `#242424`, chữ trắng, `body { display: flex; place-items: center }`, `#root` giới hạn
`max-width: 1280px` và `text-align: center`.

**Bản gốc không import chúng ở đâu cả** — đã grep `index.css` và `App.css` trên toàn bộ
`AdminVietNamLogictic/src/`: không một kết quả nào. Cây này giữ nguyên tình trạng đó.

Nối vào là hỏng ngay: đổi font và màu chữ toàn cục, ép nền tối, và `#root` co lại còn
1280px căn giữa — mọi bảng dữ liệu rộng của Admin/Operations vỡ layout. Hai file này chỉ
tồn tại để không mất dấu vết bản gốc.

### Route dùng import tĩnh, không `React.lazy` — cố ý

Ba file `saleRoutes.jsx` / `adminRoutes.jsx` / `operationsRoutes.jsx` import thẳng mọi
component ở đầu file. Đã kiểm: **không có `React.lazy` hay `lazy(` nào trong
`src/app/router/`**.

Lý do nằm ngay trong comment đầu `saleRoutes.jsx`: *"nhiều stylesheet trang khai báo
selector dùng chung, nên thứ tự nạp quyết định cái nào thắng"*. Import tĩnh nạp CSS theo
đúng thứ tự văn bản, giống hệt bản gốc. Chuyển sang `React.lazy` là CSS nạp theo thứ tự
người dùng bấm — cùng một trang sẽ trông khác nhau tuỳ đường vào.

Cùng lý do đó, `AppRouter.jsx` có comment cảnh báo giữ nguyên thứ tự ba dòng import
**Sale → Admin → Operations**. Đừng để công cụ sắp xếp import tự động chạy trên bốn file này.

### Hai bảng `ROLE_HOME` lệch nhau — nay tách rõ ra

Bản gốc có hai chỗ quyết định "trang chủ của vai trò" và **hai chỗ đó không giống nhau**.
`src/app/router/roles.js` tách hẳn thành hai hằng để nhìn thấy được:

| Hằng | Dùng khi | admin | sale | operationsmanager |
|---|---|---|---|---|
| `ROLE_HOME` | `RoleRedirect` (vào `/`) và màn Login khi đã có phiên | `/admin` | `/sale/consignments` | `/operations-manager` |
| `ROLE_FALLBACK_HOME` | `RequireAuth` khi đã đăng nhập nhưng **vào nhầm khu vực** | `/admin` | `/sale` | `/operations-manager` |

Chỗ lệch duy nhất là **sale**: vào `/` thì ra danh sách đơn ký gửi, còn bị đá khỏi khu vực
sai thì ra `SaleDashboard`. Đúng như `PrivateRoute` và `RoleRedirect` của bản gốc hành xử.
Gộp hai bảng lại **là đổi hành vi** — muốn thống nhất thì sửa đúng một dòng trong
`ROLE_FALLBACK_HOME`, và biết rõ mình đang đổi gì.

Hai hàm đọc hai bảng này là `getRoleHome()` và `getRoleFallbackHome()`; `isKnownRole()`
tra trên `ROLE_FALLBACK_HOME`. Mọi so sánh vai trò đều đi qua `normalizeRole()` — hạ chữ
thường rồi bỏ hết ký tự không phải chữ/số, nên `"Operations Manager"`,
`"operations_manager"` và `"OperationsManager"` đều ra `"operationsmanager"`.

### BUG SẴN CÓ được giữ nguyên: biểu đồ "Tỷ lệ Tuyến hàng" luôn hiện Hàn Quốc 100%

Trên `SaleDashboard`, thẻ **"Tỷ lệ Tuyến hàng (Mua hộ & Ký gửi)"** luôn báo
**🇰🇷 Hàn Quốc 100% (20 đơn)** và ba nước còn lại 0%.

Nguyên nhân, tại `src/features/dashboard/pages/SaleDashboard/SaleDashboard.jsx` dòng 288–316
(biến `routeStats`):

```js
const r = String(req?.route || req?.destinationWarehouse || "").toUpperCase();
if (r.includes("KOREA") || r.includes("HAN") || r.includes("HÀN")) krwCount++;
else if (r.includes("JAPAN") || r.includes("NHAT") || r.includes("NHẬT")) jpyCount++;
else if (r.includes("CHINA") || r.includes("TRUNG")) cnyCount++;
else if (r.includes("USA") || r.includes("US") || r.includes("MỸ")) usdCount++;
else krwCount++;          // ← nhánh else cuối dồn vào Hàn Quốc
```

Hàm phân loại tuyến bằng **tên nước viết đầy đủ** (`"CHINA"`, `"TRUNG"`, `"KOREA"`…), nhưng
chuỗi tuyến thực tế trong hệ thống là **mã hai chữ cái**: `"CN → VN"`. Chuỗi đó không chứa
`"CHINA"` cũng không chứa `"TRUNG"`, nên rơi xuống `else` cuối — mà nhánh `else` cuối lại
`krwCount++`. Mọi đơn đều thành Hàn Quốc. Và vì `usdPct = 100 - krwPct - jpyPct - cnyPct`,
cột Mỹ cũng bị ép về 0.

**Đã xác minh bằng cách chạy thật**, nạp hai mock mà dashboard gọi
(`getPurchaseRequestsApi` + `getConsignmentsApi`):

```
purchase rows: 10   consign rows: 10   total: 20
route values: { 'CN → VN': 20 }
→ { krw: 20, jpy: 0, cny: 0, usd: 0, krwPct: 100 }
```

**Đây là lỗi của component, không phải lỗi dữ liệu mẫu.** Đã `diff` file này với bản gốc
`/Volumes/RCAdvisor/CUS354/HeThongLogictic/AdminVietNamLogictic/src/pages/SalePage/SaleDashboard/SaleDashboard.jsx`:
hai file **chỉ khác nhau ở 5 dòng import** (đường dẫn tương đối → alias). Khối `routeStats`
dòng 288–316 **giống nhau từng ký tự**. Bản gốc chạy với backend thật cũng hiện Hàn Quốc
100%, vì bản gốc cũng lưu tuyến dạng `"CN → VN"`.

**Cách sửa đúng là đổi danh sách từ khoá trong component**, không phải bẻ dữ liệu mẫu cho
vừa với từ khoá. Cụ thể: thêm mã nước (`"CN"`, `"KR"`, `"JP"`, `"US"`) vào từng nhánh, và
đổi nhánh `else` cuối để nó không âm thầm dồn hết vào một nước (`usdCount++` hoặc bỏ qua).
Lưu ý khi sửa: nhánh `"US"` phải kiểm **sau** cùng hoặc so khớp chặt hơn — `"US"` là chuỗi
con của rất nhiều từ, và thứ tự `if/else if` hiện tại đã đặt nó cuối cùng cũng vì vậy.

Bản UI-only này **cố tình không sửa** — nguyên tắc là giữ giao diện và hành vi y hệt bản
gốc, kể cả lỗi.

### 11 file bị bỏ khi di trú, và vì sao

Lấy nguyên từ hằng `DROPPED` trong `tools/migrate.mjs`. Script này bắt buộc mọi file
`.js/.jsx/.css` của bản gốc phải hoặc nằm trong bảng `MAP`, hoặc nằm trong `DROPPED` —
sót một file là script dừng với `UNACCOUNTED SOURCE FILES`. Nên danh sách này là đầy đủ.

| # | File bản gốc | Lý do bỏ |
|---|---|---|
| 1 | `src/routes/AppRoutes.jsx` | thay bằng `src/app/router/*` |
| 2 | `src/pages/OperationsPage/OperationsWroPage.jsx` | shim 3 dòng re-export, router import thẳng trang thật |
| 3 | `src/pages/SalePage/CusTomerPagesale/CustomerAdress/CustomerAddressSelector.jsx` | shim 1 dòng re-export `VietnamAddressSelector` |
| 4 | `src/pages/SalePage/CusTomerPagesale/CustomerAdress/CustomerAddressSelector.css` | không file nào import |
| 5 | `src/pages/OperationsPage/OperationsWroApprovalsPage.jsx` | code chết: không route, không import |
| 6 | `src/pages/OperationsPage/components/ShipmentFormModal.jsx` | code chết: không file nào import |
| 7 | `src/pages/OperationsPage/components/WroApproveModal.jsx` | code chết: không file nào import |
| 8 | `src/pages/OperationsPage/components/wro/WroExportTypeTag.jsx` | bản trùng cũ của `OperationsWroPage/components` |
| 9 | `src/pages/OperationsPage/components/wro/WroHeader.jsx` | bản trùng cũ |
| 10 | `src/pages/OperationsPage/components/wro/WroItemExpandTable.jsx` | bản trùng cũ |
| 11 | `src/pages/OperationsPage/components/wro/WroTableList.jsx` | bản trùng cũ |

Hai file shim (#2, #3) không mất đường: bảng `REDIRECT` trong cùng script chuyển mọi import
trỏ vào chúng sang file thật.

---

## 8. Đọc tiếp

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — luật phân tầng, chiều import, giải phẫu một
  feature, cơ chế routing và phân quyền, tầng dữ liệu mock, bảng vai trò → route.
- [`src/mocks/README.md`](./src/mocks/README.md) — từng file dữ liệu mẫu có gì, bao nhiêu
  bản ghi, `mockUtils` cung cấp hàm nào, cách thêm/sửa dữ liệu.
