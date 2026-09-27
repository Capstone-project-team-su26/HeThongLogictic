# Kiến trúc `vcl-admin-ui`

Tài liệu này giải thích **vì sao** cây thư mục được sắp như vậy và những luật nào phải giữ
khi thêm code. Muốn biết cách chạy dự án, xem [`README.md`](./README.md).

Mọi khẳng định dưới đây đọc từ code thật. Chỗ nào code **chưa** khớp với luật, tài liệu nói
thẳng chỗ đó chưa khớp — không giả vờ.

---

## 1. Bốn tầng và chiều import

```
        app/            router, provider, màn 404
          │             biết mọi feature; không feature nào biết nó
          ▼
      features/         18 module nghiệp vụ
          │
          ▼
   layouts/  shared/    khung màn hình  ·  component/util/style dùng chung
                        không được biết gì về nghiệp vụ
          ▼
        mocks/          dữ liệu mẫu — chỉ module api/ được chạm vào
```

### Luật

**1. `app/` phụ thuộc `features/`, không bao giờ ngược lại.**
Ba file route trong `src/app/router/` import toàn bộ component trang từ `@features/*`.
Chiều ngược lại sạch: không một file nào trong `src/features/` **import** `@app/*` — vài
barrel có nhắc `@app/router/...` nhưng chỉ trong **comment**, để ghi rõ "feature này không
sở hữu việc gác route".

**2. `features/` được dùng `layouts/` và `shared/`; `shared/` không mang nghiệp vụ.**
Thực tế: **không một file nào trong `src/features/` import `@layouts`** — khung màn hình chỉ
do `AppRouter` lắp vào, trang không tự dựng khung. Đúng như thiết kế.

**3. `shared/` không bao giờ import `features/` — luật này hiện có HAI chỗ vi phạm.**

Đây là nợ kỹ thuật có thật, không phải mô tả lý tưởng:

| File trong `shared/` | Import | Vì sao nó vi phạm |
|---|---|---|
| `src/shared/components/FieldLabelTooltip/FieldLabelTooltip.jsx:19-21` | `@features/catalog/api/restrictedItemService` | Tooltip dùng chung nhưng lại tự đi tra danh mục hàng hạn chế |
| `src/shared/components/UserProfileModal/UserProfileModal.jsx:15-18` | `@features/auth/api/authService` | Modal hồ sơ dùng chung nhưng tự gọi API xác thực |

Cả hai kế thừa nguyên trạng từ bản gốc và **không được sửa** trong bản UI-only (nguyên tắc:
giao diện và hành vi giữ y hệt). Ghi ra đây để: (a) không ai tưởng đây là hình mẫu để bắt
chước, (b) khi nào được phép refactor thì biết chính xác hai chỗ cần gỡ — cách gỡ là để
trang truyền dữ liệu/hàm xuống qua props thay vì component `shared/` tự đi gọi.

**Ngoài hai chỗ trên, đừng thêm chỗ thứ ba.** Nếu một component `shared/` cần dữ liệu
nghiệp vụ, nhận nó qua props.

**4. Feature gọi feature khác thì đi qua barrel — hiện tại là MỤC TIÊU, chưa phải hiện trạng.**

Đếm thật trên cây hiện tại: **hơn 50 lượt import chéo feature, tất cả đều đi đường sâu, 0
lượt đi qua barrel.** Ví dụ:

```jsx
// hiện tại — đường sâu, xuyên qua cấu trúc bên trong của feature khác
import { getConsignmentsApi } from "@features/consignment/api/consignmentService";

// mục tiêu — chỉ chạm vào bề mặt công khai
import { getConsignmentsApi } from "@features/consignment";
```

Cả **18/18 feature đều đã có `index.js`**, và các barrel đó được viết **chính vì** lý do
này — comment mở đầu `src/features/consignment/index.js` nói rõ: *"các feature khác
(chat, dashboard, documents, history, purchase) đang trỏ thẳng vào đường dẫn sâu bên trong
feature này. Barrel gom một điểm vào duy nhất để sau này đổi cấu trúc thư mục bên trong mà
không phải sửa mọi nơi đang import."*

Nghĩa là: **barrel đã dựng xong, chưa ai chuyển sang dùng.** Việc chuyển hơn 50 import đó
đụng vào file `.jsx` của component, mà bản UI-only không được sửa component — nên nó nằm
lại cho lần refactor sau.

**Luật cho code MỚI:** import chéo feature phải qua barrel. Đường sâu chỉ được phép trong
`src/app/router/*` (router bắt buộc trỏ thẳng vào file trang để giữ thứ tự nạp CSS — xem
mục 3).

Bốn module bị gọi từ ngoài nhiều nhất, ưu tiên dọn trước:
`@features/admin/api/adminService`, `@features/pricing/api/pricingRuleService`,
`@features/consignment/api/consignmentService`, `@features/purchase/api/purchaseRequestService`.

---

## 2. Mỗi thư mục cấp cao để làm gì

### `src/app/` — tầng ứng dụng

Sở hữu **cách ứng dụng được lắp lại**, không sở hữu nghiệp vụ nào.

- `App.jsx` — `<AppProviders><AppRouter /></AppProviders>`, đúng 8 dòng.
- `providers/AppProviders.jsx` — `BrowserRouter` + `import "antd/dist/reset.css"`. Bản gốc
  để hai thứ này thẳng trong `main.jsx`; tách ra để `main.jsx` chỉ còn việc mount.
- `router/` — toàn bộ định tuyến và phân quyền (mục 3, 4).
- `pages/NotFound/` — màn 404. Ở đây vì nó không thuộc feature nào.

`src/main.jsx` chỉ mount React vào `#root` trong `<React.StrictMode>`. Không logic.

### `src/features/` — tầng nghiệp vụ

18 module, mỗi module sở hữu trọn một mảng việc: trang, component riêng, module `api/`, và
đôi khi stylesheet dùng chung trong nội bộ feature.

### `src/layouts/` — khung màn hình

`MainLayout` = `Header` + `Sidebar` + `<Outlet />`. Đây là `element` của ba `<Route>` cha,
nên mọi trang trong khu vực có quyền đều nằm trong khung này.

Một chi tiết dễ bất ngờ: **Sale không có Header.** `MainLayout` đọc `role` từ
`sessionStorage`, và nếu là `sale` thì bỏ `<Header />` đồng thời thêm class
`app-layout--without-header`. Giữ nguyên từ bản gốc.

`Sidebar` dựng menu từ hằng `MENU_BY_ROLE` — thêm trang mới muốn hiện trên menu thì thêm
mục ở đó.

### `src/shared/` — dùng chung, không nghiệp vụ

- `api/` — **tầng HTTP thật.** `httpClient.js` (axios instance dùng chung: baseURL từ
  `VITE_API_BASE_URL`, Bearer token từ `sessionStorage`, quy tắc 401), `apiEnvelope.js`
  (bóc vỏ response của backend), `apiEndpoints.js` (bản đồ endpoint), cộng hai mock còn lại
  `uploadImage.js` và `vietnamAddressService.js`.
- `components/` — 6 component: `AuthNotify` (toast), `FieldLabelTooltip`, `LoginLoader`,
  `UserProfileModal`, `VietnamAddressSelector`, và `SubmitReview` — khối "xem lại trước khi
  gửi" cho mọi hộp xác nhận thao tác ghi (bảng dữ kiện, bảng hàng/kiện, bảng tiền, trạng thái
  đang tải / lỗi, hook `useSubmitReviewData`). Chỉ trình bày, nhận dữ liệu qua props — phần nạp
  chi tiết đơn nằm ở `@features/consignment` (`useOrderReview` + `OrderReviewPanel`).
- `utils/` — `authSession.js` (đọc/xoá phiên, kiểm hạn token) và `timeUtc.js`.
- `styles/` — `create-request.css` dùng chung cho các màn tạo đơn, và `legacy/` là hai
  file CSS template Vite **cố ý không được import ở đâu cả** (xem README mục 7).

### `src/mocks/` — tầng dữ liệu mẫu

Thay chỗ của backend. Chi tiết ở mục 5 và [`src/mocks/README.md`](./src/mocks/README.md).

### `tools/` — script node, ngoài bundle

`migrate.mjs` (hồ sơ di trú), `api-contract.json` (hợp đồng tầng api — nay 40 module, có cờ
`realApi` cho module đã nối backend và `mockCopyOf` cho bản sao `*.mock.js`),
`verify-mocks.mjs` (`npm run verify:mocks`), `verify-barrels.mjs` (`npm run verify:barrels`),
`verify-api.mjs` (`npm run verify:api` — kiểm tầng đã nối backend hoàn toàn OFFLINE).
ESLint bỏ qua thư mục này.

---

## 3. Giải phẫu một feature module

Lấy `src/features/consignment/` làm mẫu — đầy đủ nhất:

```
src/features/consignment/
├── index.js                    ← BARREL: bề mặt công khai duy nhất
├── api/                        ← ranh giới dữ liệu (hiện là mock)
│   ├── consignmentService.js
│   ├── consignmentMasterService.js
│   ├── consignmentReceiptService.js
│   └── deliveryAddressService.js
├── pages/                      ← màn hình gắn vào <Route>
│   ├── PendingConsignmentList/{.jsx,.css}
│   ├── ConsignmentDetail/{.jsx,.css}
│   ├── ConsignmentOrder/{.jsx,.css}
│   └── CreateConsignmentQuotation/{.jsx,.css}
└── components/                 ← chỉ dùng trong feature này
    ├── ConsignmentOrderConfirm/{.jsx,.css}
    ├── ConfirmConsignmentQuotation/{.jsx,.css}
    └── PackageOptionalServices/{.jsx,.css}
```

Biến thể hợp lệ:

- **Không có `api/`** — `documents/`, `history/`, `shipment/` chỉ có trang/component, dùng
  `api/` của feature khác.
- **Có `styles/`** — `admin/styles/AdminPage.css`, `operations/styles/OperationsPage.css`
  và `OperationsWroPage.css`. Mỗi trang tự `import "@features/admin/styles/AdminPage.css"`
  ngay trong file của nó, **không** gom về một chỗ — để thứ tự nạp CSS giống hệt bản gốc.
- **Component lồng nhau** — `operations/components/wro/` gom 5 mảnh chỉ dùng cho màn phiếu
  xuất kho.

### Barrel viết thế nào

Hai file `index.js` đáng đọc trước khi viết cái mới, vì chúng ghi lại các bẫy thật:

- `src/features/catalog/index.js` — khi feature chỉ có **một** module `api/`, `export *`
  là an toàn vì không thể đụng tên với `export *` nào khác.
- `src/features/consignment/index.js` — khi có **nhiều** module `api/` mà một module
  re-export tên của module kia, phải **liệt kê tay**. Comment trong file giải thích lý do:
  ESM chỉ coi là nhập nhằng khi hai `export *` trỏ về hai binding *khác nhau*, nên hiện tại
  vẫn chạy — nhưng chỉ cần ai đó định nghĩa lại tên đó thay vì re-export, ESM sẽ **âm thầm**
  loại tên khỏi namespace của barrel và build không hề cảnh báo.

- `src/features/warehouse/index.js` — mẫu tốt nhất về **kiểm va chạm tên trước khi viết**:
  comment ghi rõ đã đối chiếu 8 tên của `warehouseService` với `adminService`, và cảnh báo
  `getWarehouses` (bên `admin`) *trông* giống nhưng **không** trùng `getWarehousesApi`
  (bên `warehouse`) — cái bẫy dành cho ai sau này định gộp barrel cấp trên.

Quy tắc rút gọn: `export *` chỉ khi chắc chắn không trùng tên. Còn lại liệt kê tay, và luôn
nêu riêng `default` (vì `export *` không bao giờ kéo theo `default`).

`npm run verify:barrels` kiểm điều đó bằng máy (18/18 barrel, 452 tên) và liệt kê **7 tên
đang trùng giữa hai feature** — đây là danh sách những tên **không được** gộp bằng
`export *` nếu sau này ai đó dựng một barrel cấp trên:

| Tên | Xuất hiện ở |
|---|---|
| `buildOperationalAnalytics` | `dashboard`, `operations` |
| `getOperationsApiError` | `dashboard`, `operations` |
| `EMPTY_PACKAGE_SERVICES` | `consignment`, `purchase` |
| `getPackageConfigurations` | `admin`, `pricing` |
| `getPricingRules` | `admin`, `pricing` |
| `getPackageStatusMeta` | `goship`, `operations` |
| `PACKAGE_STATUS_META` | `goship`, `operations` |

---

## 4. Routing

### Chuỗi lắp ráp

```
paths.js  +  roles.js
     │
     ├── saleRoutes.jsx  /  adminRoutes.jsx  /  operationsRoutes.jsx
     │        (mảnh <Route> con, đã bỏ tiền tố bằng helper rel())
     ▼
AppRouter.jsx
     │  <Route path={ADMIN.base} element={<RequireAuth role="admin"><MainLayout/></RequireAuth>}>
     │      {adminRoutes}
     │  </Route>
     ▼
RequireAuth  →  MainLayout  →  <Outlet />  →  trang
```

- **`paths.js`** — nguồn sự thật duy nhất cho mọi URL. Bốn nhóm: `COMMON` (`/`, `/login`,
  `/unauthorized`), `ADMIN`, `SALE`, `OPERATIONS`. URL có tham số khai bằng hàm với giá trị
  mặc định là chính pattern React Router
  (`consignmentDetail: (orderId = ":orderId") => …`), nhờ vậy một dòng dùng được cho cả
  khai báo `<Route>` lẫn `navigate()`.
- **`roles.js`** — ba vai trò, hai bảng trang chủ, và `normalizeRole()` (mục 5).
- **Ba file route** — mảnh `<Route>` con, không tự bọc layout hay guard.
- **`AppRouter.jsx`** — lắp `/login`, ba khu vực có quyền, `/` (`RoleRedirect`) và `*`
  (`NotFound`).
- **`RequireAuth`** — cổng chặn (mục 5).
- **`MainLayout`** — khung, có `<Outlet />`.

### Vì sao thứ tự import ba file route lại quan trọng

`AppRouter.jsx` có comment ngay trên ba dòng import:

> *Thứ tự ba dòng import dưới đây có ý nghĩa: nó quyết định thứ tự nạp CSS của toàn bộ màn
> hình, đúng như bản gốc (Sale → Admin → Operations). Đừng sắp lại.*

Cơ chế: mỗi file route import tĩnh mọi component trang của khu vực; mỗi component trang
`import "./Tên.css"`. Với ES module, **CSS được nạp theo thứ tự import được duyệt**, không
theo thứ tự trang được mở. Nhiều stylesheet trong dự án khai cùng một selector (`.ant-table`,
`.page-header`, các class dùng chung của bản gốc), nên **file nạp sau thắng**.

Đảo `saleRoutes` xuống dưới `adminRoutes` là đảo luôn cái nào thắng — giao diện đổi mà
không một dòng CSS nào bị sửa. Cùng lý do đó, `saleRoutes.jsx` cũng có comment giữ nguyên
thứ tự 22 dòng import bên trong nó.

Hệ quả kèm theo: **không được chuyển route sang `React.lazy`**. Nạp lười nghĩa là thứ tự
CSS phụ thuộc đường người dùng bấm — cùng một trang sẽ trông khác nhau tuỳ vào trước đó họ
đã mở màn nào. Đã kiểm: `src/app/router/` hiện không có `React.lazy` hay `lazy(` nào.

**Đừng bật công cụ tự sắp xếp import** trên `AppRouter.jsx` và ba file route.

---

## 5. Phân quyền

### Phiên đăng nhập được lưu ở đâu

`Login.jsx` (hàm `saveLoginSession`) ghi vào **`sessionStorage`**, sáu khoá:

| Khoá | Nội dung |
|---|---|
| `accessToken` | JWT (bản demo: token giả có `exp` năm 2099) |
| `refreshToken` | chỉ ghi nếu mock trả về |
| `tokenExpiresAt` | chỉ ghi nếu mock trả về |
| `user` | object hồ sơ, `JSON.stringify` |
| `role` | vai trò **đã chuẩn hoá**: `admin` / `sale` / `operationsmanager` |
| `isAuth` | chuỗi `"true"` |

Vì là `sessionStorage`, **đóng tab là mất phiên**. Không có refresh token flow trong bản
UI-only.

`src/shared/utils/authSession.js` là chỗ duy nhất biết cách đọc/dọn phiên:

- `getStoredAccessToken()` — đọc `sessionStorage` **rồi mới** `localStorage`. Dự phòng cho
  trường hợp bản cũ từng ghi vào `localStorage`.
- `getAccessTokenExpiresAt()` — giải mã payload JWT lấy `exp` (giây → mili giây); không có
  `exp` thì đọc khoá `tokenExpiresAt`, chấp nhận cả giây, mili giây lẫn chuỗi ngày.
- `isAccessTokenExpired()` — **không có token là hết hạn**; có token mà không đọc được hạn
  thì coi như còn hạn (`expiresAt === null` → `false`).
- `clearAuthSession()` — xoá cả 6 khoá ở **cả** `sessionStorage` **và** `localStorage`.
- `redirectToLogin()` / `expireAuthSession()` — `window.location.replace("/login")`, có
  chặn khi đang ở sẵn `/login` để khỏi lặp.
- `isAuthenticationError()` — nhận diện lỗi phiên: `error.code === "AUTH_SESSION_EXPIRED"`
  hoặc `error.response.status === 401`. Đây là lý do `mockUtils.createApiError()` phải dựng
  đủ cụm `error.response.status`.

### Ba lớp chặn của `RequireAuth`

`src/app/router/RequireAuth.jsx` chạy đúng ba lớp, theo thứ tự này:

**Lớp 1 — chưa đăng nhập hoặc token hết hạn → về `/login`.**
Điều kiện: `!isAuth || !accessToken || isAccessTokenExpired(accessToken)`, đọc trực tiếp từ
`sessionStorage`. Trước khi chuyển hướng, gọi `clearAuthSession()`, và **mang theo
`state={{ from: location.pathname }}`** để sau này quay lại đúng trang.

**Lớp 2 — vai trò lạ → xoá phiên rồi về `/login`.**
`normalizeRole(storedRole)` rồi `isKnownRole()`. Đây là lớp phòng khi backend đổi tên vai
trò mà FE chưa biết: thà bắt đăng nhập lại còn hơn để người dùng kẹt ở màn trắng.

**Lớp 3 — đã đăng nhập nhưng sai khu vực → đá về trang chủ của vai trò đó.**
Gom `role` / `roles` (nhận cả một chuỗi lẫn một mảng) thành `requiredRoles`, chuẩn hoá,
rồi so với `userRole`. Không khớp thì `<Navigate to={getRoleFallbackHome(userRole)} />`.

Có một cái bẫy đã được xử lý sẵn: **nếu trang chủ fallback lại chính là URL đang đứng, đá
về đó sẽ tạo vòng lặp `Navigate` vô tận** — nên trường hợp đó chuyển sang
`COMMON.unauthorized` thay vì lặp. Đừng bỏ nhánh này.

`requiredRoles.length === 0` nghĩa là **cho qua** — dùng cho vùng chỉ cần đăng nhập, không
kén vai trò.

### Hai cổng còn lại

`RoleRedirect.jsx` chứa hai component nhỏ dùng chung hàm `readSession()`:

- **`<RoleRedirect />`** — gắn ở `/`. Phiên hợp lệ thì đẩy về `getRoleHome(role)`; phiên
  hỏng hoặc vai trò lạ thì `clearAuthSession()` rồi về `/login`.
- **`<RedirectIfAuthenticated>`** — bọc quanh `<Login />`. Đã có phiên thì không cho quay
  lại màn đăng nhập. Đặt ở đây thay vì nhét logic vào chính `Login.jsx`.

### Chuẩn hoá vai trò

`normalizeRole()` trong `roles.js` là **chỗ duy nhất** định nghĩa phép chuẩn hoá: hạ chữ
thường, cắt khoảng trắng, rồi bỏ mọi ký tự không phải `a-z0-9`. Nhờ vậy
`"Operations Manager"`, `"operations_manager"`, `"OperationsManager"` đều ra
`"operationsmanager"`. Mọi so sánh vai trò phải đi qua hàm này — đừng so chuỗi trực tiếp.

`ROLE_HOME` và `ROLE_FALLBACK_HOME` lệch nhau ở vai trò `sale` một cách **có chủ ý**, giữ
nguyên từ bản gốc — bảng đối chiếu ở [README mục 7](./README.md#7-lưu-ý).

---

## 6. Tầng dữ liệu: nửa thật, nửa mẫu

> **Trạng thái nối API (tóm tắt).** Luồng **báo giá ký gửi** của Sale/Admin đã chạy trên
> backend thật (`https://vcl.henrytech.cloud`), mọi màn khác vẫn dùng dữ liệu mẫu. Danh
> sách module, API, thay đổi nghiệp vụ và hạn chế đã biết nằm ở
> [`README.md` mục 1bis](./README.md#1bis-trạng-thái-nối-api).

### `src/mocks/` có gì

```
src/mocks/
├── mockUtils.js        13 helper dùng chung cho toàn bộ tầng mock
└── data/               12 file fixture: người, đơn, kho, tiền, chat, địa chỉ…
```

Số bản ghi từng file: [`src/mocks/README.md`](./src/mocks/README.md).

### `mockUtils.js` cung cấp gì

Mỗi hàm tồn tại để **giả lập lại một thứ mà component vốn dựa vào ở tầng axios**, chứ không
phải để cho tiện:

| Hàm | Vì sao cần |
|---|---|
| `delay(ms = 220, signal)` | Trả ngay lập tức thì màn hình nhảy thẳng từ trắng sang đầy dữ liệu, spinner không kịp hiện. 220ms đủ một nhịp. Nhận `AbortSignal`, abort thì reject bằng `CanceledError`. |
| `createCanceledError()` / `isCanceledError()` | Component nhận diện "huỷ request" bằng **ba** dấu hiệu khác nhau tuỳ chỗ: `code === "ERR_CANCELED"`, `name === "CanceledError"`, `name === "AbortError"`. Lỗi giả gắn đủ cả ba để không màn nào hiểu nhầm "đổi bộ lọc" thành "API lỗi" rồi bắn toast đỏ. |
| `createApiError(status, message)` | Dựng **đủ cụm** `error.response.{status, statusText, data:{message,error,title,errors}, headers, config}`. Các nhánh `catch` đọc theo thứ tự `data.message → .error → .title → error.message`; thiếu `error.response` thì toast hiện `undefined` và lỗi 401 không tự đá về đăng nhập. |
| `paginate(rows, options)` | Trả **đúng** hình dạng service thật: `{ items, totalCount, pageNumber, pageSize, totalPages, hasPreviousPage, hasNextPage, raw }`, **đánh số trang từ 1**. Trang vượt tổng số trang bị kẹp về trang cuối để không loé lên một trang rỗng. |
| `deepClone(value)` | Fixture sống suốt phiên. Trả thẳng tham chiếu thì một màn sort/mutate tại chỗ là hỏng dữ liệu của mọi màn còn lại. |
| `nextId(prefix)` | Sinh mã nghiệp vụ đúng khuôn hệ thống: `VCL-20260712105447-295805`, `PUR-…`, `PCL-…`, `SHP-…`, `WRO-…`. |
| `nextUuid()` | UUID v4 hợp khuôn, sinh bằng PRNG **tất định** (mulberry32) — cùng seed cho cùng dãy, nên id ổn định giữa các lần mở app: link chi tiết đã lưu vẫn mở được. |
| `nowIso()` / `isoDaysAgo(n)` / `isoHoursAgo(n)` | Fixture dùng mốc **tương đối** chứ không ghim ngày cứng, để danh sách luôn trông như vừa phát sinh và bộ lọc "7 ngày gần đây" vẫn ra kết quả. |
| `normalizeText(value)` | Bỏ dấu tiếng Việt + hạ chữ thường. NFD không tách được `đ/Đ` nên phải thay tay, nếu không "Đà Nẵng" không khớp với "da nang". |
| `matchesKeyword(row, keyword, fields)` | So khớp không dấu trên danh sách path, hỗ trợ `"customer.fullName"` và path xuyên mảng `"items.productName"` (gõ tên một sản phẩm là tìm được cả đơn chứa nó). Từ khoá rỗng trả `true`. |

`mockUtils.js` **tuyệt đối không** import axios, không `fetch`, không WebSocket — để
`tools/verify-mocks.mjs` không báo còn dấu vết HTTP.

### Module `api/` là ranh giới để cắm API thật

Các module `api/` là **đường biên duy nhất** giữa component và nguồn dữ liệu. Ranh giới đó
vừa chứng minh được giá trị: đợt nối **luồng báo giá ký gửi** đã đổi 10 module từ mock sang
axios mà **không đổi hình dạng trả về**, nên phần lớn component không phải sửa một dòng nào.

Hôm nay cây này ở trạng thái **nửa thật nửa mẫu**:

| Nhóm | Nguồn dữ liệu |
|---|---|
| `shared/api/httpClient.js`, `shared/api/apiEnvelope.js` | tầng HTTP thật |
| `auth`, `consignment` (`consignmentService`, `quotationService`, `consignmentMasterService`), `warehouse`, `pricing` (3 module) | **backend thật** |
| Mọi module `api/` còn lại | `src/mocks/` |
| `*.mock.js` (6 bản sao) | `src/mocks/` — giữ các màn ngoài đợt chạy được |

**Bản sao `*.mock.js` là cơ chế cô lập đợt.** Khi một module dùng chung được nối thật mà các
màn khác chưa sẵn sàng, ta chép nguyên văn module đó thành `<tên>.mock.js` và chỉ đổi import
của những màn chưa nối. Ba luật cho bản sao:

1. **Không re-export từ barrel** — barrel chỉ đưa ra bản thật, `verify:barrels` phải sạch.
2. **Không được dính `httpClient` / `axios`** — `verify:api` kiểm điều này.
3. **Xoá ngay khi màn cuối cùng dùng nó được nối thật**, kèm dòng tương ứng trong
   `tools/api-contract.json` và `tools/verify-api.mjs`.

Quy ước cho module ĐÃ nối thật:

- **Bóc vỏ response ở tầng `api/`, không bao giờ ở component.** Backend VCL không thống nhất
  một kiểu bọc (`{message,data}`, `{items}`, object/mảng trần) — `apiEnvelope.js` là chỗ duy
  nhất biết điều đó.
- **Không gửi lên những con số client tự tính** khi backend tính lại. Màn lập báo giá chỉ
  gửi `warehouseId`, `servicePricingId`, phí Sale thật sự sửa và lý do ngoại lệ; tổng tiền
  hiển thị là **bản xem trước**.
- **Chặn trước các luật backend chắc chắn sẽ từ chối** (trạng thái `APPROVED` đã bỏ, từ chối
  giá ngoại lệ mà thiếu lý do…) để người dùng đọc câu tiếng Việt thay vì lỗi 400 trần.

Ba mẫu có thật, cho thấy ranh giới này được giữ chặt đến mức nào:

- `auth/api/authService.js` — comment đầu file ghi lại hai chỗ hình dạng cực dễ vỡ:
  `Login.jsx` bóc kết quả bằng `response?.data?.data ?? response?.data ?? response`, nên
  payload đăng nhập **tuyệt đối không được có khoá `data`** (sẽ bóc lầm một tầng rồi mất
  token); còn `UserProfileModal` dò tiếp `data.profile || data.user || data.userInfo ||
  data.account`, nên hồ sơ cá nhân **phải là object phẳng** — ngược lại hoàn toàn với
  payload đăng nhập, chỗ đó lại **bắt buộc** phải có `user`.
- `customer/api/customerService.js` — vẫn chặn id không đúng khuôn UUID **trước khi** tra
  cứu, y như bản thật, để giữ đúng thông báo *"Mã khách hàng không đúng định dạng UUID."*
  Và các hàm ghi **phải mutate** `customerStore`, không chỉ trả bản ghi mới:
  `CustomerList.onSaved` gọi lại `loadCustomers()` rồi đi tìm khách vừa lưu trong danh sách
  mới để đẩy lên đầu bảng — store không đổi thì người xem tưởng tính năng hỏng.
- `warehouse/api/warehouseService.js` — cả bốn hàm trả **mảng trần** các bản ghi đã chuẩn
  hoá đúng 6 field, **không** bọc `{ items, totalCount }`. Trả sai kiểu thì ô chọn kho rỗng
  chứ không phải lỗi build — nên sai kiểu rất khó phát hiện.

Ba nguyên tắc rút ra:

1. **Tên export, chữ ký hàm và hình dạng trả về là hợp đồng.** `tools/api-contract.json`
   ghim từng module và từng tên export; `npm run verify:mocks` kiểm máy móc (module có cờ
   `realApi` được miễn riêng bước soát dấu vết mạng, mọi phép kiểm khác vẫn áp dụng), còn
   `npm run verify:api` kiểm hành vi của tầng đã nối backend hoàn toàn offline.
2. **Hàm thuần giữ nguyên.** `normalize*`, `calculate*`, `convert*`, `map*ToOptions` không
   dính mạng — chúng vẫn là nơi duy nhất chặn dữ liệu sai.
3. **Hàm ghi phải mutate fixture**, vì màn hình luôn gọi lại hàm đọc ngay sau khi ghi.

### Luật: component không bao giờ import thẳng từ `src/mocks/`

Đã kiểm toàn bộ cây. Các file import `@/mocks/...`:

- **các module `api/` chưa nối backend** (kể cả 6 bản sao `*.mock.js`), cộng
  `shared/api/uploadImage.js` và `shared/api/vietnamAddressService.js` — hợp lệ, đây là việc
  của chúng.
- **5 file trong chính `src/mocks/data/`** import lẫn nhau — hợp lệ.
- **0 file `.jsx`.** Không một component nào chạm vào `src/mocks/`.

Luật này là thứ khiến bước "xoá `src/mocks/`" ở cuối quá trình cắm API thật trở nên khả thi:
chỉ các file `api/` phải sửa, và không file nào trong đó là giao diện. Phá luật này một lần
là mất luôn tính chất đó.

Vài barrel có nhắc `@/mocks/data/...` trong **comment** để nói "feature này không sở hữu dữ
liệu mẫu" — đó là chú thích, không phải import.

---

## 7. Vai trò → route sở hữu

Suy ra từ `src/app/router/paths.js` và ba file route. Ba khu vực **tách rời hoàn toàn**:
mỗi khu vực một prefix, một `RequireAuth` với đúng một vai trò.

### `admin` → `/admin`

| URL | Component | Ghi chú |
|---|---|---|
| `/admin` | `AdminDashboard` | route `index` |
| `/admin/users` | `AdminUsersPage` | |
| `/admin/warehouse-locations` | `WarehouseLocationsPage` | |
| `/admin/warehouses` | `WarehousesAdminPage` | 13 màn danh mục dưới đây đều sinh từ `AdminResourcePage` |
| `/admin/carriers` | `CarriersAdminPage` | |
| `/admin/shipping-methods` | `ShippingMethodsAdminPage` | |
| `/admin/shipping-routes` | `ShippingRoutesAdminPage` | |
| `/admin/package-configurations` | `PackageConfigurationsAdminPage` | |
| `/admin/additional-service-fees` | `<Navigate to=/admin/pricing-rules replace>` | Phí dịch vụ bổ sung đã gộp vào `pricingRules`; `AdditionalServiceFeesAdminPage` vẫn export nhưng không còn route/menu |
| `/admin/service-pricings` | `ServicePricingsAdminPage` | |
| `/admin/pricing-rules` | `PricingRulesAdminPage` | |
| `/admin/exchange-rates` | `ExchangeRatesAdminPage` | |
| `/admin/restricted-items` | `RestrictedItemsAdminPage` | |
| `/admin/product-types` | `ProductTypesAdminPage` | |
| `/admin/units-of-measure` | `UnitsOfMeasureAdminPage` | |
| `/admin/suppliers` | `SuppliersAdminPage` | |
| `/admin/consignments` | `PendingConsignmentList` | **`readOnly`** + `basePath="/admin"` |
| `/admin/consignments/:orderId` | `ConsignmentDetail` | **`readOnly`** |
| `/admin/consignments/:orderId/payments` | `OrderPaymentHistory` | **`readOnly`** |
| `/admin/inventory` | `OperationsParcelsPage` | tồn kho, chỉ xem |
| `/admin/wro` | `OperationsWroPage` | `requireReason` — Admin duyệt thay phải ghi lý do |
| `/admin/warehouse-zones` | `WarehouseZonesPage` | khu kho + kiện sai khu |
| `/admin/incidents` | `AdminCompensationsPage` | ghi nhận đã chi bồi thường |
| `/admin/tracking`, `/admin/tracking/:orderId` | `OrderTrackingListPage` / `OrderTrackingDetailPage` | `canComplete` — chốt đơn tay |
| `/admin/shipments` | `AdminShipmentsPage` | |
| `/admin/receiving-notes` | `AdminReceivingNotesPage` | |
| `/admin/deliveries` | `AdminDeliveriesPage` | |
| `/admin/cash-flow` | `AdminCashFlowPage` | |
| `/admin/user`, `/admin/roles` | → `Navigate` `/admin/users` | URL cũ còn trong bookmark |
| `/admin/settings` | → `Navigate` `/admin/warehouses` | |

Điểm đáng chú ý: **Admin giám sát bằng cách dùng lại chính màn của Sale/Operations với cờ
`readOnly`**, không dựng bản sao. Đây là lý do một số trang nhận prop `readOnly` và
`basePath`.

### `sale` → `/sale`

| URL | Component | Ghi chú |
|---|---|---|
| `/sale` | `SaleDashboard` | route `index` |
| `/sale/dashboard` | `SaleDashboard` | cùng màn, hai lối vào |
| `/sale/consignments` | `PendingConsignmentList` | trang chủ khi vào `/` |
| `/sale/consignments/:orderId` | `ConsignmentDetail` | |
| `/sale/consignments/:orderId/create-quotation` | `CreateConsignmentQuotation` | |
| `/sale/create-order/buy-orders` | `ConsignmentBuyOrder` | tạo đơn mua hộ hộ khách |
| `/sale/create-order/consignment` | `ConsignmentOrder` | tạo đơn ký gửi hộ khách |
| `/sale/settlements` | `SaleSettlementPage` | chốt tiền với khách |
| `/sale/releases` | `SaleReleasePage` | cho hàng rời kho |
| `/sale/customers` | `CustomerList` | |
| `/sale/restricted-items` | `RestrictedItems` | |
| `/sale/service-pricings` | `ServicePricings` | |
| `/sale/history/order` | `PendingConsignmentListHistory` | |
| `/sale/history/purchase-requests` | `PendingPurchaseRequestListHistory` | |
| `/sale/documents/consignments` | `ConsignmentDocumentsList` | |
| `/sale/documents/purchase-requests` | `PurchaseDocumentsList` | |
| `/sale/orders/:orderId/payments/history` | `OrderPaymentHistory` | |
| `/sale/purchase-requests` | `PurchaseRequestList` | |
| `/sale/purchase-requests/:purchaseRequestId` | `PurchaseRequestDetail` | |
| `/sale/shipments` | `SaleShipmentsPage` | hàng đợi theo dõi lô + ghi mốc hành trình |
| `/sale/deliveries` | `SaleDeliveriesPage` | bằng chứng giao, giao lại |
| `/sale/tracking`, `/sale/tracking/:orderId` | `OrderTrackingListPage` / `OrderTrackingDetailPage` | theo dõi đơn, giữ hàng thay khách |
| `/sale/incidents` | `SaleIncidentsPage` | sự cố, chỉ đọc |
| `/sale/wro/*`, `/sale/goship-orders` | → `Navigate` | màn cũ đã xoá |
| `/sale/customer-service` | `CustomerServiceChat` | |

Cấu hình khác nhau giữa các vai truyền qua prop ngay trong `<Route>` (ví dụ `basePath`,
`canComplete`, `requireReason`), không đọc query string trong trang.

### `operationsmanager` → `/operations-manager`

| URL | Component | Ghi chú |
|---|---|---|
| `/operations-manager` | `OperationsDashboard` | route `index` |
| `/operations-manager/wro` | `OperationsWroPage` | duyệt phiếu xuất kho |
| `/operations-manager/incidents` | `OperationsIncidentsPage` | quyết định sự cố hàng hoá |
| `/operations-manager/warehouse-zones` | `WarehouseZonesPage` | khu kho + kiện sai khu |
| `/operations-manager/shipments` | `OperationsShipmentsPage` | |
| `/operations-manager/parcels` | `OperationsParcelsPage` | kiện hàng |
| `/operations-manager/purchase-store` | `OperationsPurchaseStorePage` | |
| `/operations-manager/inspections` | `OperationsInspectionsPage` | |
| `/operations-manager/parcel-returns` | → `Navigate` `/operations-manager/delivery-approvals` | hàng hoàn nay đi qua yêu cầu giao |
| `/operations-manager/receiving-approvals` | `OperationsReceivingApprovalsPage` | **cửa duyệt 1** — phiếu tiếp nhận kho GỐC |
| `/operations-manager/inbound-approvals` | `OperationsInboundApprovalsPage` | **cửa duyệt 2** — nhập kho VN |
| `/operations-manager/delivery-approvals` | `OperationsDeliveryApprovalsPage` | **cửa duyệt 3** — giao hàng |
| `/operations-manager/releases` | → `Navigate` `/operations-manager/wro` | trang cũ đã gộp |

### Ngoài ba khu vực

| URL | Xử lý |
|---|---|
| `/` | `<RoleRedirect />` — đẩy về `ROLE_HOME` của vai trò đang đăng nhập, hoặc `/login` |
| `/login` | `<RedirectIfAuthenticated><Login /></RedirectIfAuthenticated>` |
| `/unauthorized` | Khai trong `COMMON` và được `RequireAuth` dùng làm lối thoát chống lặp — **hiện chưa gắn `<Route>` riêng**, nên rơi vào `*` và hiện `NotFound` |
| `*` | `<NotFound />` |
