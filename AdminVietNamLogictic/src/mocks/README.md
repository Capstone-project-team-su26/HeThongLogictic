# `src/mocks/` — tầng dữ liệu mẫu

> **Cập nhật sau đợt nối API báo giá ký gửi.** Một số module `api/` đã chuyển sang gọi
> backend thật và KHÔNG còn đọc thư mục này: `auth/authService`, `consignment/consignmentService`,
> `consignment/consignmentMasterService`, `warehouse/warehouseService`, và ba module của
> `pricing`. Các màn chưa nối vẫn dùng **bản sao** `*.mock.js` của chúng — bản sao đọc đúng
> những fixture mô tả bên dưới. Xem `README.md` mục 1bis của dự án.

Thư mục này **thay chỗ của backend**. Bản `vcl-admin-ui` là bản CHỈ GIAO DIỆN: tầng HTTP đã
bị gỡ (`axios` không còn trong `package.json`, `src/shared/api/httpClient.js` đã xoá), nên
31 module `api/` của dự án đọc dữ liệu từ đây thay vì gọi server.

```
src/mocks/
├── mockUtils.js        helper dùng chung cho toàn bộ tầng mock
├── data/               12 file fixture
└── README.md           file này
```

**Hai luật bất di bất dịch:**

1. **Component không bao giờ import thẳng từ `src/mocks/`.** Chỉ module `api/` được chạm
   vào. Đã kiểm toàn cây: 0 file `.jsx` import `@/mocks`. Nhờ vậy khi cắm API thật, chỉ 29
   file phải sửa và không file nào trong đó là giao diện.
2. **Không đổi tên export của module `api/`.** Xem mục cuối — đây là cách nhanh nhất để
   làm hỏng ứng dụng mà build vẫn xanh.

---

## `mockUtils.js`

13 hàm, mỗi hàm tồn tại để giả lập lại **một thứ mà component vốn dựa vào ở tầng axios**.

### Vòng đời request

| Hàm | Làm gì |
|---|---|
| `delay(ms = 220, signal)` | Nghỉ ngắn trước khi trả dữ liệu. Trả ngay lập tức thì spinner không kịp hiện và màn hình nhảy thẳng từ trắng sang đầy dữ liệu. Nhận `AbortSignal`; abort thì reject bằng `CanceledError`. |
| `createCanceledError(message)` | Lỗi huỷ y như axios tạo ra. Gắn **đủ ba** dấu hiệu — `name: "CanceledError"`, `code: "ERR_CANCELED"`, `__CANCEL__: true` — vì component nhận diện huỷ bằng ba cách khác nhau tuỳ chỗ. |
| `isCanceledError(error)` | Nhận `ERR_CANCELED` / `CanceledError` / `AbortError`. Dùng để mock tự bỏ qua request cũ khi người dùng đổi bộ lọc. |
| `createApiError(status = 400, message)` | Lỗi có **đủ cụm** `error.response.{status, statusText, data:{message,error,title,errors}, headers, config}` cộng `isAxiosError`, `code`, `config`, `request`. Thiếu `error.response` thì toast hiện `undefined` và lỗi 401 không tự đá về đăng nhập. |

### Dữ liệu

| Hàm | Làm gì |
|---|---|
| `paginate(rows, options)` | Trả `{ items, totalCount, pageNumber, pageSize, totalPages, hasPreviousPage, hasNextPage, raw }` — **đánh số trang từ 1**, đúng hình dạng service thật. Nhận `page`/`pageNumber` và `size`/`pageSize`/`limit`. Trang vượt tổng số trang bị kẹp về trang cuối. |
| `deepClone(value)` | `structuredClone` nếu có, không thì `JSON.parse(JSON.stringify(...))`. Fixture sống suốt phiên: trả thẳng tham chiếu thì một màn sort/mutate tại chỗ là hỏng dữ liệu của mọi màn còn lại. |
| `nextId(prefix = "MOCK")` | Mã nghiệp vụ đúng khuôn hệ thống: `VCL-20260712105447-295805`, `PUR-…`, `PCL-…`, `SHP-…`, `WRO-…`. |
| `nextUuid()` | UUID v4 hợp khuôn (nibble version `4`, variant `8..b`), sinh bằng PRNG **tất định** mulberry32 — cùng seed cho cùng dãy, nên id ổn định giữa các lần mở app. |

### Thời gian

| Hàm | Làm gì |
|---|---|
| `nowIso()` | ISO string hiện tại. |
| `isoDaysAgo(days)` | ISO string của n ngày trước. |
| `isoHoursAgo(hours)` | ISO string của n giờ trước. |

Fixture dùng **mốc tương đối**, không ghim ngày cứng — để danh sách luôn trông như vừa
phát sinh và bộ lọc "7 ngày gần đây" vẫn ra kết quả.

### Tìm kiếm tiếng Việt

| Hàm | Làm gì |
|---|---|
| `normalizeText(value)` | NFD bỏ dấu + hạ chữ thường. NFD **không** tách được `đ/Đ` nên phải thay tay, nếu không "Đà Nẵng" không khớp với "da nang". |
| `matchesKeyword(row, keyword, fields)` | So khớp không dấu trên danh sách path. Hỗ trợ `"customer.fullName"` và path **xuyên mảng** `"items.productName"` — gõ tên một sản phẩm là tìm được cả đơn chứa nó. Từ khoá rỗng trả `true`, để bộ lọc mặc định không loại bản ghi nào. |

Ngoài 13 named export còn có `default` là object gom đủ 13 hàm.

**`mockUtils.js` tuyệt đối không import axios, không `fetch`, không WebSocket** — để
`npm run verify:mocks` không báo còn dấu vết HTTP.

---

## `src/mocks/data/` — 12 file

Số bản ghi dưới đây **đếm thật** bằng cách nạp từng module qua Vite và đo `.length`, không
ước lượng.

### `people.js` — 1.331 dòng

Người dùng, khách hàng, vị trí kho.

| Export | Số lượng |
|---|---|
| `demoAccounts` | **3** tài khoản demo (admin / sale / operationsmanager) |
| `users` | **20** nhân sự — 3 bản ghi đầu chính là 3 tài khoản demo |
| `customers` | **18** khách hàng |
| `warehouseLocations` | **60** ô kệ (`bins` là **cùng một mảng**, chỉ khác tên; `binRefs` là **60** bản rút gọn 5 field) |
| `warehouseLayoutItems` | **25** ô trên sơ đồ kho |
| `warehouseLocationsByWarehouseId` | 4 kho: 20 / 14 / 14 / 12 ô |
| `warehouseLayoutZonesByWarehouseId` | 4 kho: 3 / 3 / 2 / 2 khu |
| Hằng khác | `DEMO_ADMIN_ACCESS_TOKEN`, `DEMO_SALE_ACCESS_TOKEN`, `DEMO_OPERATIONS_ACCESS_TOKEN`, `demoRefreshToken`, `demoTokenExpiresAt`, `demoAccountsByRole` |

Ràng buộc dễ vỡ: `id` khách hàng **phải** đúng khuôn UUID (customerService kiểm bằng regex
trước khi gọi chi tiết/sửa/xoá); `accessToken` **phải** là JWT thật về mặt cấu trúc
(`authSession` giải base64url để đọc `exp`).

Dùng bởi: `admin/api/adminService.js`, `auth/api/authService.js`,
`customer/api/customerService.js`, `operations/api/parcelReturnService.js`.

### `catalog.js` — 2.067 dòng

12 danh mục nền mà `adminService` CRUD, và là nền cho mọi bộ nghiệp vụ khác tham chiếu.
Phí dịch vụ bổ sung **không còn bộ riêng**: đã gộp vào `pricingRules` (dòng có `feeCode`),
các hàm `*AdditionalServiceFee*` của adminService đọc/ghi trên đó.

| Export | Bản ghi |
|---|---|
| `restrictedItems` | **21** |
| `unitsOfMeasure` | **17** |
| `productTypes` | **16** |
| `packageConfigurations` | **20** (gồm 7 cỡ thùng gỗ `WOOD_CRATE_*`) |
| `servicePricings` | **15** |
| `pricingRules` | **25** (gồm `DEPOSIT_RATE` 30%, `VOLUMETRIC_DIVISOR` 6000, phụ phí gộp) |
| `suppliers` | **14** |
| `shippingRoutes` | **14** (mỗi tuyến có 8 giới hạn khai báo `max*`) |
| `warehouses` | **13** |
| `carriers` | **13** |
| `shippingMethods` | **13** |
| `exchangeRates` | **12** |

Cộng `catalogCollections` (object gom cả 12 mảng), `volumetricDivisor` = **6000** (đọc từ rule),
`volumetricDivisorRule`, và **25** hàm tra cứu `find*` (`find*ById`, `find*ByCode`, cùng
`findProductTypeByName`, `findExchangeRateByCurrency` và helper chung `findIn`).

Ràng buộc: mỗi bản ghi **bắt buộc có `id`** (`AdminResourcePage` dùng làm `rowKey`); field
bind vào `<Input>` phải là **chuỗi**, không phải mảng.

Dùng bởi 10 module: `admin`, `catalog`, `consignment` (×2), `pricing` (×4), `purchase`,
`warehouse`.

### `consignments.js` — 2.205 dòng

Bộ đơn **ký gửi** — nguồn duy nhất cho mọi mock liên quan.

| Export | Số lượng |
|---|---|
| `consignments` (= `default`) | **27** đơn |
| `CONSIGNMENT_CUSTOMERS` | **8** khách |
| `PRODUCT_TYPES` | **7** loại hàng |
| `PACKAGE_CONFIGURATIONS` | **4** cấu hình đóng gói |
| `WAREHOUSES` | **4** kho |
| `CONSIGNMENT_STATUSES` | **19 mã trạng thái đơn đích** theo thứ tự `ORDER_STATUS_ORDER` — là danh sách enum, **không phải** bản ghi |
| `CONSIGNMENT_STATUS_LABELS` | nhãn của 19 mã (trùng `ORDER_STATUS_LABELS`, `verify:mocks` so khớp) |
| `VOLUMETRIC_DIVISOR` | `6000` (đọc từ rule `VOLUMETRIC_DIVISOR` của catalog) |

Ràng buộc: `totalVolume` tính bằng **cm³** (không phải m³) — trả m³ thì thể tích hiện ra bé
đi một triệu lần.

Dùng bởi: `consignment/api/*` (×3), `settlement/api/settlementService.js`.

### `purchaseRequests.js` — 1.552 dòng

Bộ yêu cầu **mua hộ**.

| Export | Số lượng |
|---|---|
| `purchaseRequests` (= `default`) | **21** yêu cầu |
| `PURCHASE_CUSTOMERS` | **6** khách |
| `PURCHASE_REQUEST_STATUSES` | **21 mã trạng thái** — danh sách enum, không phải bản ghi |

Ràng buộc: id kho và id cấu hình phí **phải lấy từ `catalog.js`**, không lấy từ
`consignments.js` — vì màn hình đối chiếu id của đơn với danh sách tải từ
`warehouseService` / `pricingRuleService`, hai API này phục vụ đúng mảng của `catalog`.

Dùng bởi: `purchase/api/confirmPurchaseApi.js`, `purchase/api/purchaseRequestService.js`,
`settlement/api/settlementService.js`.

### `deliveryAddresses.js` — 429 dòng

Sổ địa chỉ nhận hàng.

| Export | Bản ghi |
|---|---|
| `deliveryAddresses` (= `default`) | **18** địa chỉ |

Mọi bản ghi có đủ `address` + `fullAddress` (thiếu là bị `filter(Boolean)` loại thẳng),
chuỗi địa chỉ **duy nhất tuyệt đối** (form so bằng chuỗi, không so bằng id), và **đúng một**
bản ghi có `isDefault: true`.

Dùng bởi: `consignment/api/deliveryAddressService.js`.

### `conversations.js` — 828 dòng

Hội thoại chăm sóc khách hàng.

| Export | Số lượng |
|---|---|
| `conversations` (= `default`) | **15** hội thoại |
| `CONVERSATION_RELATED_TYPES` | **3** loại liên kết |
| `CHAT_ATTACHMENT_IMAGES` | 4 ảnh đính kèm |
| `SALE_STAFF` / `SALE_STAFF_SECOND` | 2 nhân viên |

Ràng buộc nặng nhất cả thư mục: tin nhắn của nhân viên **phải** có `senderId` trùng claim
`sub` trong `DEMO_SALE_ACCESS_TOKEN` (`3f1a7c20-1002-4b8c-9d31-100000000002`). Lệch một ký
tự là toàn bộ bong bóng chat dồn sang một bên.

Dùng bởi: `chat/api/conversationApi.js`.

### `addresses.js` — 704 dòng

Danh mục hành chính Việt Nam. Bản thật lấy từ `provinces.open-api.vn` — một API công khai
**bên ngoài**, nghĩa là bản UI-only mất mạng là ba ô select địa chỉ trống trơn. Fixture này
thay hẳn nguồn đó.

| Export | Số lượng |
|---|---|
| `provinceSeeds` | **20** tỉnh/thành |
| `districtSeedsByProvince` | 20 khoá, **185** quận/huyện |
| `wardSeedsByDistrict` | 185 khoá, **2.196** phường/xã |

Cộng ba hàm `listProvinceSeeds` / `listDistrictSeeds` / `listWardSeeds` và `toCodename`.

Mã tỉnh (1, 79, 48, 31, 92, 56, 74, 75, 46, 38) khớp với `deliveryAddresses.js`, để một địa
chỉ có sẵn và một địa chỉ vừa thêm qua select không mâu thuẫn nhau.

Dùng bởi: `shared/api/vietnamAddressService.js`.

---

## Thêm / sửa dữ liệu mẫu

### Sửa một bản ghi có sẵn

Mở file trong `data/`, sửa, lưu. Vite HMR nạp lại ngay. Ba thứ phải giữ:

1. **Giữ nguyên `id` và mã nghiệp vụ** nếu bản ghi được tra cứu chéo. `orderId` /
   `consignmentCode` / `purchaseRequestId` là **khoá điều hướng**
   (`/sale/consignments/:orderId`) và khoá nối giữa các bộ dữ liệu. Đổi một cái là màn chi
   tiết trắng và link đã lưu chết.
2. **Giữ nguyên kiểu.** Chuỗi vẫn là chuỗi, số vẫn là số. `carriers.supportedShippingMethods`
   là text `"AIR, SEA, ROAD"` chứ không phải mảng — vì form bind nó vào `<Input>`.
3. **Dùng `isoDaysAgo()` / `isoHoursAgo()` cho ngày tháng**, đừng ghim chuỗi ISO cứng. Ngày
   cứng thì vài tháng nữa mọi bộ lọc "7 ngày gần đây" đều ra rỗng.

### Thêm một bản ghi

Hầu hết các file đã có sẵn hàm `create*` / `make*` gói toàn bộ hình dạng bản ghi
(`createUser`, `createCustomer`, `makeNote`…). **Gọi hàm đó**, đừng viết tay object mới —
những hàm này còn tự tính các cờ phụ thuộc lẫn nhau (ví dụ `makeNote` suy `awaitingApproval`
từ status; `createCustomer` suy `isActive` từ `status` để hai field không nói ngược nhau).

Sau khi thêm, kiểm ba chỗ:

- Bản ghi có `id` chưa? `AdminResourcePage` dùng `id` làm `rowKey` — thiếu là React cảnh
  báo và bảng hiển thị sai.
- `id` có đúng khuôn UUID không, nếu là khách hàng / kho / loại hàng? Nhiều service chặn id
  sai khuôn **trước khi** tra cứu. Cần id mới thì dùng `nextUuid()` của `mockUtils`.
- Có bản ghi khác trỏ tới nó không? Kiểm các file `data/*.js` còn lại có dựng dữ liệu
  **từ** fixture đó không.

### Thêm một file dữ liệu mới

Đặt trong `data/`, export named (kèm `default` nếu tiện), **không** import gì từ `features/`.
Chỉ module `api/` được import nó.

### Kiểm lại sau khi sửa

```bash
npm run verify:mocks
```

Script `tools/verify-mocks.mjs` nạp thật từng module `api/` qua Vite rồi đối chiếu với
`tools/api-contract.json` (**31 module**, **349 tên export**): đủ tên export chưa, module
nào cần `default` có `default` chưa, export nào bị `undefined`, và có còn dấu vết mạng
(`axios`, `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `httpClient`)
không. Thoát mã 1 nếu sai.

Kết quả bình thường:

```
modules kiểm tra : 31
đạt hợp đồng     : 30/31
tên export soát  : 348

Tầng mock giữ đúng toàn bộ hợp đồng, không còn lời gọi mạng nào.
```

**`30/31` và `348` là đúng, không phải lỗi.** `src/shared/api/apiEndpoints.js` nằm trong
danh sách `EXEMPT` — nó không phải mock mà là bản đồ endpoint thật giữ lại để cắm API sau
này — nên bị bỏ qua, mất 1 module và 1 tên (`API_ENDPOINTS`) khỏi phần được kiểm. Dòng cuối
mới là kết luận.

Lưu ý: script chỉ soi **code thật** — nó bóc comment và nội dung chuỗi trước khi tìm, nếu
không thì chính các comment "cắm API thật trở lại" trong mock sẽ bị báo nhầm là còn gọi mạng.

---

## Cảnh báo: đừng đổi tên export của module `api/`

**Component không được sửa.** Đó là ràng buộc gốc của bản UI-only, và nó biến bề mặt của
mỗi module `api/` thành **hợp đồng cứng**.

Cụ thể, ba thứ không được đổi:

- **Tên từng export.** `PendingConsignmentList` import
  `{ getConsignmentsApi } from "@features/consignment/api/consignmentService"`. Đổi thành
  `fetchConsignments` là màn hình chết ngay — và Vite **không** cảnh báo lúc build, lỗi chỉ
  nổ trong trình duyệt.
- **Có hay không có `default`.** Nhiều màn gọi kiểu `consignmentService.getConsignmentsApi()`.
  Bỏ `default` là mất luôn cách gọi đó.
- **Hình dạng giá trị trả về.** Một số hàm trả **mảng trần**, một số trả object phân trang
  `{ items, totalCount, … }`, một số trả object bản ghi phẳng. Trả sai kiểu thường **không
  gây lỗi** — nó chỉ làm bảng rỗng hoặc ô select trống, nên rất khó truy. Ví dụ có thật:
  cả bốn hàm của `warehouseService` trả mảng trần, và hai màn tiêu thụ đều kiểm
  `Array.isArray(result.value) && length > 0` trước khi dùng — trả `{ items: [...] }` thì ô
  chọn kho im lặng trống.

Ngoài ra có hai chỗ **hình dạng ngược nhau**, ghi lại vì rất dễ nhầm khi sửa
`auth/api/authService.js`:

- Payload **đăng nhập** tuyệt đối **không được** có khoá `data` — `Login.jsx` bóc bằng
  `response?.data?.data ?? response?.data ?? response` nên sẽ bóc lầm một tầng rồi mất
  token. Nhưng payload đó **bắt buộc phải có** khoá `user`.
- Payload **hồ sơ cá nhân** phải là object **phẳng** — `UserProfileModal.unwrapProfileData`
  dò tiếp `data.profile || data.user || data.userInfo || data.account`, có `user` lồng
  trong là bóc sai.

Cần đổi tên thật thì phải đổi **cùng lúc** ở ba nơi: module `api/`, mọi chỗ import nó, và
`tools/api-contract.json`. Chạy `npm run verify:mocks` để chắc mình không bỏ sót chỗ nào.


> Đợt ghép API xuất kho / hàng về VN (18/09/2026) đã xoá `operations.js`, `finance.js`,
> `payments.js`, `goshipOrders.js`, `receivingNotes.js` — không còn module nào dùng.
