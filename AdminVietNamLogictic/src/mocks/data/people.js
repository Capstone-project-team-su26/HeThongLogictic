/**
 * DỮ LIỆU MẪU: NGƯỜI DÙNG - KHÁCH HÀNG - VỊ TRÍ KHO
 *
 * File này chỉ chứa DỮ LIỆU. Các module trong `api/` sẽ import và trả về,
 * nên hình dạng ở đây phải khớp đúng cái component đang đọc — component
 * không được sửa một dòng nào.
 *
 * Ba ràng buộc dễ vỡ nhất, ghi lại để về sau không ai lỡ tay phá:
 *
 * 1. `id` của khách hàng PHẢI đúng định dạng UUID. customerService kiểm tra
 *    bằng regex `^[0-9a-f]{8}-[0-9a-f]{4}-[1-5]...-[89ab]...$` trước khi gọi
 *    API chi tiết / sửa / xoá; id sai dạng sẽ ném lỗi ngay trên UI.
 * 2. `accessToken` PHẢI là chuỗi JWT thật về mặt cấu trúc. authSession giải mã
 *    base64url phần payload để đọc `exp`; không đọc được `exp` nó sẽ rơi xuống
 *    `tokenExpiresAt`, còn đọc được `exp` đã qua thì RequireAuth xoá phiên và
 *    đá về /login.
 * 3. `note` của vị trí kho không được bắt đầu bằng "seed-", cũng không được
 *    chứa "ops-locations" hay "mock-": WarehouseLayeredView coi đó là rác kỹ
 *    thuật và ẩn ghi chú đi (xem getCleanUserNote).
 */

/* =====================================================
   HELPERS SINH DỮ LIỆU
===================================================== */

/**
 * Sinh id dạng UUID hợp lệ từ một tiền tố + số thứ tự.
 *
 * Viết tay 100 UUID thì không ai soát được, còn randomUUID() thì mỗi lần tải
 * trang lại ra id khác nhau — làm hỏng mọi liên kết chéo giữa các bộ mock.
 * Cách này vừa cố định vừa vẫn qua được regex UUID của customerService.
 */
const makeUuid = (prefix, index) =>
  `${prefix}-${String(1000 + index)}-4b8c-9d31-${String(100000000000 + index)}`;

/**
 * Đổi giờ Việt Nam (UTC+7) thành ISO string UTC.
 *
 * Nghiệp vụ nói theo giờ VN, còn API luôn trả ISO UTC; viết tách ra để số
 * ngày/giờ trong danh sách bên dưới đọc đúng như người vận hành nhìn thấy.
 */
const vnIso = (year, month, day, hour = 9, minute = 0) =>
  new Date(Date.UTC(year, month - 1, day, hour - 7, minute)).toISOString();

/* =====================================================
   TOKEN PHIÊN DEMO
===================================================== */

/**
 * JWG giả: header.payload.signature, payload base64url có exp = 2099-12-31.
 *
 * Chữ ký là chuỗi base64 vô nghĩa — FE không hề xác thực chữ ký, nó chỉ tách
 * dấu chấm rồi atob() phần giữa. Ba token khác nhau theo vai trò để khi debug
 * dán vào jwt.io còn thấy đúng người đang đăng nhập.
 */
export const DEMO_ADMIN_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzZjFhN2MyMC0xMDAxLTRiOGMtOWQzMS0xMDAwMDAwMDAwMDEiLCJlbWFpbCI6ImFkbWluQHZpZXRuYW1sb2dpc3RpY3Mudm4iLCJyb2xlIjoiQWRtaW4iLCJuYW1lIjoiQWRtaW4iLCJpc3MiOiJ2Y2wtZGVtbyIsImF1ZCI6InZjbC1hZG1pbi11aSIsImlhdCI6MTc4ODIyNDQwMCwiZXhwIjo0MTAyNDQ0Nzk5fQ.ZGVtby1zaWduYXR1cmUtdmNsLWFkbWluLXVp";

export const DEMO_SALE_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzZjFhN2MyMC0xMDAyLTRiOGMtOWQzMS0xMDAwMDAwMDAwMDIiLCJlbWFpbCI6InNhbGVAdmlldG5hbWxvZ2lzdGljcy52biIsInJvbGUiOiJTYWxlIiwibmFtZSI6IlNhbGUiLCJpc3MiOiJ2Y2wtZGVtbyIsImF1ZCI6InZjbC1hZG1pbi11aSIsImlhdCI6MTc4ODIyNDQwMCwiZXhwIjo0MTAyNDQ0Nzk5fQ.ZGVtby1zaWduYXR1cmUtdmNsLWFkbWluLXVp";

export const DEMO_OPERATIONS_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzZjFhN2MyMC0xMDAzLTRiOGMtOWQzMS0xMDAwMDAwMDAwMDMiLCJlbWFpbCI6Im9wZXJhdGlvbnNAdmlldG5hbWxvZ2lzdGljcy52biIsInJvbGUiOiJPcGVyYXRpb25zTWFuYWdlciIsIm5hbWUiOiJPcGVyYXRpb25zTWFuYWdlciIsImlzcyI6InZjbC1kZW1vIiwiYXVkIjoidmNsLWFkbWluLXVpIiwiaWF0IjoxNzg4MjI0NDAwLCJleHAiOjQxMDI0NDQ3OTl9.ZGVtby1zaWduYXR1cmUtdmNsLWFkbWluLXVp";

/** Token dùng chung cho mọi module api/ cần `Bearer ...` mà không quan tâm vai trò. */
export const demoAccessToken = DEMO_ADMIN_ACCESS_TOKEN;

export const demoRefreshToken =
  "vcl-demo-refresh-9f2c41ba7d0e4c8fa1b35d67e0c94812";

/** Trùng với `exp` trong payload JWT ở trên, để hai nguồn không nói ngược nhau. */
export const demoTokenExpiresAt = "2099-12-31T23:59:59.000Z";

/* =====================================================
   NGƯỜI DÙNG NỘI BỘ (AdminUsersPage)
===================================================== */

/**
 * Một bản ghi người dùng như /api/User trả về.
 *
 * AdminUsersPage đọc thẳng: fullName, email, phone, role, userType, region,
 * status, createdAt, isLocked (isLockedUser đọc isLocked trước, không có thì
 * dò chữ "LOCK" trong status). Drawer chi tiết in ra MỌI field vô hướng và lấy
 * luôn tên field làm nhãn, nên ở đây chỉ giữ những field đáng cho người xem
 * nhìn thấy — tuyệt đối không nhét password vào.
 */
const createUser = ({
  index,
  fullName,
  email,
  phone,
  role,
  userType = "Employee",
  region = "VN",
  status = "Active",
  isLocked = false,
  country = "Việt Nam",
  address = "",
  createdAt,
  lastLoginAt = "",
}) => ({
  id: makeUuid("3f1a7c20", index),
  userId: makeUuid("3f1a7c20", index),
  fullName,
  email,
  phone,
  role,
  roleName: role,
  userType,
  region,
  status,
  isLocked,
  isActive: status === "Active" && !isLocked,
  country,
  address,
  createdAt,
  updatedAt: createdAt,
  lastLoginAt,
});

export const users = [
  // Ba bản ghi đầu chính là ba tài khoản demo, để màn quản trị hiện đúng
  // người đang đăng nhập chứ không phải một danh sách xa lạ.
  createUser({
    index: 1,
    fullName: "Nguyễn Minh Khang",
    email: "admin@vietnamlogistics.vn",
    phone: "0901234567",
    role: "Admin",
    address: "Số 12 Ngõ 45 Trần Duy Hưng, Cầu Giấy, Hà Nội",
    createdAt: vnIso(2025, 1, 6, 8, 30),
    lastLoginAt: vnIso(2026, 9, 3, 8, 12),
  }),
  createUser({
    index: 2,
    fullName: "Trần Thị Bảo Ngọc",
    email: "sale@vietnamlogistics.vn",
    phone: "0902345678",
    role: "Sale",
    address: "Số 88 Nguyễn Trãi, Thanh Xuân, Hà Nội",
    createdAt: vnIso(2025, 1, 6, 8, 45),
    lastLoginAt: vnIso(2026, 9, 3, 7, 55),
  }),
  createUser({
    index: 3,
    fullName: "Lê Quốc Cường",
    email: "operations@vietnamlogistics.vn",
    phone: "0903456789",
    role: "OperationsManager",
    address: "Số 7 Đường Lê Hồng Phong, Ngô Quyền, Hải Phòng",
    createdAt: vnIso(2025, 1, 6, 9, 0),
    lastLoginAt: vnIso(2026, 9, 2, 17, 40),
  }),

  createUser({
    index: 4,
    fullName: "Phạm Hồng Nhung",
    email: "nhung.pham@vietnamlogistics.vn",
    phone: "0904567890",
    role: "Sale",
    address: "Số 25 Phố Huế, Hai Bà Trưng, Hà Nội",
    createdAt: vnIso(2025, 3, 18, 9, 15),
    lastLoginAt: vnIso(2026, 9, 3, 9, 5),
  }),
  createUser({
    index: 5,
    fullName: "Đỗ Thanh Tùng",
    email: "tung.do@vietnamlogistics.vn",
    phone: "0905678901",
    role: "Sale",
    status: "Inactive",
    address: "Số 310 Nguyễn Văn Cừ, Long Biên, Hà Nội",
    createdAt: vnIso(2025, 4, 2, 10, 20),
    lastLoginAt: vnIso(2026, 6, 14, 16, 20),
  }),
  createUser({
    index: 6,
    fullName: "Vũ Hải Anh",
    email: "anh.vu@vietnamlogistics.vn",
    phone: "0906789012",
    role: "OperationsManager",
    region: "CN",
    country: "Trung Quốc",
    address: "Số 88 Baiyun Avenue, Bạch Vân, Quảng Châu",
    createdAt: vnIso(2025, 4, 21, 11, 0),
    lastLoginAt: vnIso(2026, 9, 3, 6, 30),
  }),
  createUser({
    index: 7,
    fullName: "Hoàng Văn Đạt",
    email: "dat.hoang@vietnamlogistics.vn",
    phone: "0907890123",
    role: "WarehouseStaff",
    region: "CN",
    country: "Trung Quốc",
    address: "Khu logistics Bằng Tường, Quảng Tây",
    createdAt: vnIso(2025, 5, 9, 8, 10),
    lastLoginAt: vnIso(2026, 9, 3, 7, 2),
  }),
  createUser({
    index: 8,
    fullName: "Bùi Thị Kim Chi",
    email: "chi.bui@vietnamlogistics.vn",
    phone: "0908901234",
    role: "WarehouseStaff",
    address: "Lô B4 KCN Quang Minh, Mê Linh, Hà Nội",
    createdAt: vnIso(2025, 5, 26, 8, 40),
    lastLoginAt: vnIso(2026, 9, 3, 8, 1),
  }),
  createUser({
    index: 9,
    fullName: "Ngô Gia Bảo",
    email: "bao.ngo@vietnamlogistics.vn",
    phone: "0909012345",
    role: "WarehouseStaff",
    status: "Locked",
    isLocked: true,
    address: "Số 27 Đường số 7, KCN Tân Bình, TP. Hồ Chí Minh",
    createdAt: vnIso(2025, 6, 11, 14, 25),
    lastLoginAt: vnIso(2026, 7, 30, 18, 45),
  }),
  createUser({
    index: 10,
    fullName: "Đặng Minh Trí",
    email: "tri.dang@vietnamlogistics.vn",
    phone: "0910123456",
    role: "Delivery",
    address: "Số 165 Giải Phóng, Đống Đa, Hà Nội",
    createdAt: vnIso(2025, 6, 30, 7, 50),
    lastLoginAt: vnIso(2026, 9, 3, 6, 58),
  }),
  createUser({
    index: 11,
    fullName: "Trịnh Thu Hà",
    email: "ha.trinh@vietnamlogistics.vn",
    phone: "0911234567",
    role: "Delivery",
    address: "Số 44 Lê Lợi, Hải Châu, Đà Nẵng",
    createdAt: vnIso(2025, 7, 15, 9, 35),
    lastLoginAt: vnIso(2026, 9, 2, 19, 12),
  }),
  createUser({
    index: 12,
    fullName: "Lý Quang Huy",
    email: "huy.ly@vietnamlogistics.vn",
    phone: "0912345678",
    role: "Sale",
    status: "Pending",
    address: "Số 9 Nguyễn Thị Minh Khai, Quận 1, TP. Hồ Chí Minh",
    createdAt: vnIso(2026, 8, 24, 10, 5),
  }),
  createUser({
    index: 13,
    fullName: "Phan Nhật Linh",
    email: "linh.phan@vietnamlogistics.vn",
    phone: "0913456789",
    role: "Admin",
    address: "Số 102 Cầu Giấy, Cầu Giấy, Hà Nội",
    createdAt: vnIso(2025, 8, 4, 13, 15),
    lastLoginAt: vnIso(2026, 9, 1, 15, 30),
  }),
  createUser({
    index: 14,
    fullName: "Cao Bá Duy",
    email: "duy.cao@vietnamlogistics.vn",
    phone: "0914567890",
    role: "WarehouseStaff",
    region: "CN",
    country: "Trung Quốc",
    address: "Số 15 Zhanqian Road, Việt Tú, Quảng Châu",
    createdAt: vnIso(2025, 9, 19, 8, 20),
    lastLoginAt: vnIso(2026, 9, 3, 7, 25),
  }),
  createUser({
    index: 15,
    fullName: "Mai Thị Xuân",
    email: "xuan.mai@vietnamlogistics.vn",
    phone: "0915678901",
    role: "Delivery",
    status: "Locked",
    isLocked: true,
    address: "Số 58 Trường Chinh, Tân Bình, TP. Hồ Chí Minh",
    createdAt: vnIso(2025, 10, 7, 16, 45),
    lastLoginAt: vnIso(2026, 5, 21, 11, 10),
  }),
  createUser({
    index: 16,
    fullName: "Nguyễn Hữu Lâm",
    email: "lam.nguyen@vietnamlogistics.vn",
    phone: "0916789012",
    role: "OperationsManager",
    address: "Số 3 Nguyễn Văn Linh, Lê Chân, Hải Phòng",
    createdAt: vnIso(2025, 11, 2, 9, 55),
    lastLoginAt: vnIso(2026, 9, 3, 8, 40),
  }),

  // Bốn tài khoản loại "Customer": để bộ lọc "Loại TK" trên màn quản trị có
  // hơn một lựa chọn, và để số "nhân viên" ở hero không bằng tổng danh sách.
  createUser({
    index: 17,
    fullName: "Vương Thị Kiều Trinh",
    email: "kieutrinh.vuong@gmail.com",
    phone: "0921112233",
    role: "Customer",
    userType: "Customer",
    address: "Số 21 Nguyễn Khang, Cầu Giấy, Hà Nội",
    createdAt: vnIso(2026, 1, 14, 20, 30),
    lastLoginAt: vnIso(2026, 9, 2, 21, 15),
  }),
  createUser({
    index: 18,
    fullName: "Đoàn Chí Thành",
    email: "chithanh.doan@gmail.com",
    phone: "0922223344",
    role: "Customer",
    userType: "Customer",
    address: "Số 76 Hoàng Diệu, Hải Châu, Đà Nẵng",
    createdAt: vnIso(2026, 2, 8, 19, 5),
    lastLoginAt: vnIso(2026, 8, 29, 22, 40),
  }),
  createUser({
    index: 19,
    fullName: "Hồ Ngọc Mai",
    email: "ngocmai.ho@gmail.com",
    phone: "0923334455",
    role: "Customer",
    userType: "Customer",
    status: "Inactive",
    address: "Số 140 Lý Thường Kiệt, Quận 10, TP. Hồ Chí Minh",
    createdAt: vnIso(2026, 3, 3, 18, 20),
    lastLoginAt: vnIso(2026, 4, 18, 20, 5),
  }),
  createUser({
    index: 20,
    fullName: "Lâm Tuấn Kiệt",
    email: "tuankiet.lam@gmail.com",
    phone: "0924445566",
    role: "Customer",
    userType: "Customer",
    address: "Số 302 Cách Mạng Tháng Tám, Quận 3, TP. Hồ Chí Minh",
    createdAt: vnIso(2026, 4, 26, 21, 10),
    lastLoginAt: vnIso(2026, 9, 1, 22, 55),
  }),
];

/* =====================================================
   TÀI KHOẢN DEMO (Login → RequireAuth → Sidebar/Header)
===================================================== */

/**
 * Dựng một tài khoản demo từ bản ghi người dùng đã có.
 *
 * Login.jsx dò token theo thứ tự token → accessToken → access_token → jwtToken,
 * và dò vai trò theo user.roleName → user.role → data.roleName → data.role;
 * nên ở đây khai cả `token` lẫn `accessToken`, cả `role` lẫn `roleName`. Cứ dư
 * vài field còn hơn màn login báo "API không trả về vai trò người dùng".
 */
const createDemoAccount = ({ user, password, accessToken, normalizedRole, homePath }) => ({
  email: user.email,
  password,
  fullName: user.fullName,
  role: user.role,
  roleName: user.role,
  normalizedRole,
  homePath,

  token: accessToken,
  accessToken,
  refreshToken: demoRefreshToken,
  expiresAt: demoTokenExpiresAt,
  tokenExpiresAt: demoTokenExpiresAt,

  // Đây chính là object được JSON.stringify vào sessionStorage."user";
  // Sidebar lấy fullName + email, UserProfileModal lấy toàn bộ phần còn lại.
  user: { ...user },
});

export const demoAccounts = [
  createDemoAccount({
    user: users[0],
    password: "Admin@123",
    accessToken: DEMO_ADMIN_ACCESS_TOKEN,
    normalizedRole: "admin",
    homePath: "/admin",
  }),
  createDemoAccount({
    user: users[1],
    password: "Sale@123",
    accessToken: DEMO_SALE_ACCESS_TOKEN,
    normalizedRole: "sale",
    // Login.jsx tự tính đường dẫn bằng ROLE_ROUTES của chính nó ("/sale"),
    // không phải ROLE_HOME của router ("/sale/consignments"). Ghi theo Login
    // để nếu về sau có ai dùng field này thì không đổi hành vi đang chạy.
    homePath: "/sale",
  }),
  createDemoAccount({
    user: users[2],
    password: "Operations@123",
    accessToken: DEMO_OPERATIONS_ACCESS_TOKEN,
    normalizedRole: "operationsmanager",
    homePath: "/operations-manager",
  }),
];

/** Tra nhanh theo vai trò đã chuẩn hoá: admin | sale | operationsmanager. */
export const demoAccountsByRole = demoAccounts.reduce((result, account) => {
  result[account.normalizedRole] = account;
  return result;
}, {});

/**
 * Tìm tài khoản demo khớp email + mật khẩu.
 *
 * Để ở đây thay vì trong authService mock, vì phép so sánh (bỏ hoa thường,
 * cắt khoảng trắng ở email) phải đi kèm chính bộ dữ liệu này.
 */
export const findDemoAccount = (email, password) => {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const normalizedPassword = String(password ?? "");

  return (
    demoAccounts.find(
      (account) =>
        account.email.toLowerCase() === normalizedEmail &&
        account.password === normalizedPassword
    ) || null
  );
};

/* =====================================================
   KHÁCH HÀNG (CustomerList, CustomerDetailModal)
===================================================== */

/**
 * Một bản ghi khách hàng như /api/customers trả về.
 *
 * `status` để dạng SCREAMING_SNAKE đúng như normalizeCustomerStatus mong đợi
 * (ACTIVE / INACTIVE / PENDING / PENDING_VERIFICATION / BLOCKED / SUSPENDED),
 * và `isActive` luôn suy ra từ status để hai field không bao giờ nói ngược nhau
 * — thẻ trạng thái trên danh sách đọc status, còn ô đếm "Đang hoạt động" đọc
 * isActive.
 */
const createCustomer = ({
  index,
  fullName,
  email,
  phone,
  address,
  region,
  companyName = "",
  taxId = "",
  status = "ACTIVE",
  createdAt,
  updatedAt,
}) => ({
  id: makeUuid("8b3c5d90", index),
  customerId: makeUuid("8b3c5d90", index),
  customerCode: `KH-${String(index).padStart(4, "0")}`,
  fullName,
  email,
  phone,
  address,
  region,
  country: "Việt Nam",
  companyName,
  taxId,
  status,
  isActive: status === "ACTIVE",
  createdAt,
  updatedAt: updatedAt || createdAt,
});

export const customers = [
  createCustomer({
    index: 1,
    fullName: "Vương Thị Kiều Trinh",
    email: "kieutrinh.vuong@gmail.com",
    phone: "0921112233",
    address: "Số 21 Nguyễn Khang, Cầu Giấy",
    region: "Hà Nội",
    companyName: "Công ty TNHH Thương mại Kiều Trinh",
    taxId: "0106845731",
    createdAt: vnIso(2026, 1, 14, 20, 30),
    updatedAt: vnIso(2026, 8, 21, 10, 15),
  }),
  createCustomer({
    index: 2,
    fullName: "Đoàn Chí Thành",
    email: "chithanh.doan@gmail.com",
    phone: "0922223344",
    address: "Số 76 Hoàng Diệu, Hải Châu",
    region: "Đà Nẵng",
    companyName: "Công ty CP Nội thất Thành Đoàn",
    taxId: "0401742998",
    createdAt: vnIso(2026, 2, 8, 19, 5),
    updatedAt: vnIso(2026, 8, 12, 9, 40),
  }),
  createCustomer({
    index: 3,
    fullName: "Hồ Ngọc Mai",
    email: "ngocmai.ho@gmail.com",
    phone: "0923334455",
    address: "Số 140 Lý Thường Kiệt, Quận 10",
    region: "TP. Hồ Chí Minh",
    status: "INACTIVE",
    createdAt: vnIso(2026, 3, 3, 18, 20),
    updatedAt: vnIso(2026, 5, 2, 14, 0),
  }),
  createCustomer({
    index: 4,
    fullName: "Lâm Tuấn Kiệt",
    email: "tuankiet.lam@gmail.com",
    phone: "0924445566",
    address: "Số 302 Cách Mạng Tháng Tám, Quận 3",
    region: "TP. Hồ Chí Minh",
    companyName: "Hộ kinh doanh Kiệt Phát",
    taxId: "0316552104",
    createdAt: vnIso(2026, 4, 26, 21, 10),
    updatedAt: vnIso(2026, 8, 30, 16, 25),
  }),
  createCustomer({
    index: 5,
    fullName: "Nguyễn Thị Thuỳ Dương",
    email: "thuyduong.nguyen@gmail.com",
    phone: "0356778899",
    address: "Số 18 Nguyễn Thị Định, Cầu Giấy",
    region: "Hà Nội",
    companyName: "Công ty TNHH Mỹ phẩm Dương Anh",
    taxId: "0109337412",
    createdAt: vnIso(2025, 11, 12, 15, 45),
    updatedAt: vnIso(2026, 8, 28, 11, 30),
  }),
  createCustomer({
    index: 6,
    fullName: "Trần Đăng Khoa",
    email: "dangkhoa.tran@gmail.com",
    phone: "0788990011",
    address: "Số 55 Trần Phú, Ninh Kiều",
    region: "Cần Thơ",
    createdAt: vnIso(2025, 12, 2, 10, 5),
    updatedAt: vnIso(2026, 7, 19, 13, 20),
  }),
  createCustomer({
    index: 7,
    fullName: "Phạm Thị Hải Yến",
    email: "haiyen.pham@gmail.com",
    phone: "0812334455",
    address: "Số 9 Lê Thánh Tông, Ngô Quyền",
    region: "Hải Phòng",
    companyName: "Công ty TNHH Phụ kiện Hải Yến",
    taxId: "0201889376",
    status: "PENDING",
    createdAt: vnIso(2026, 8, 25, 9, 15),
  }),
  createCustomer({
    index: 8,
    fullName: "Bùi Quang Vinh",
    email: "quangvinh.bui@gmail.com",
    phone: "0905112233",
    address: "Số 230 Điện Biên Phủ, Thanh Khê",
    region: "Đà Nẵng",
    createdAt: vnIso(2025, 9, 8, 8, 50),
    updatedAt: vnIso(2026, 6, 5, 17, 10),
  }),
  createCustomer({
    index: 9,
    fullName: "Lê Thị Mỹ Hạnh",
    email: "myhanh.le@gmail.com",
    phone: "0326445566",
    address: "Số 12 Lý Tự Trọng, Thủ Dầu Một",
    region: "Bình Dương",
    companyName: "Công ty CP Bao bì Mỹ Hạnh",
    taxId: "3702445118",
    createdAt: vnIso(2025, 10, 21, 14, 30),
    updatedAt: vnIso(2026, 8, 2, 10, 50),
  }),
  createCustomer({
    index: 10,
    fullName: "Đặng Hoàng Nam",
    email: "hoangnam.dang@gmail.com",
    phone: "0977223344",
    address: "Số 61 Nguyễn Đức Cảnh, Hoàng Mai",
    region: "Hà Nội",
    status: "PENDING_VERIFICATION",
    createdAt: vnIso(2026, 8, 29, 20, 40),
  }),
  createCustomer({
    index: 11,
    fullName: "Võ Thị Thanh Trúc",
    email: "thanhtruc.vo@gmail.com",
    phone: "0367889900",
    address: "Số 47 Hùng Vương, Phú Nhuận",
    region: "TP. Hồ Chí Minh",
    companyName: "Hộ kinh doanh Trúc Xinh Shop",
    taxId: "8123447065",
    createdAt: vnIso(2025, 8, 16, 19, 25),
    updatedAt: vnIso(2026, 8, 26, 15, 35),
  }),
  createCustomer({
    index: 12,
    fullName: "Hoàng Anh Tuấn",
    email: "anhtuan.hoang@gmail.com",
    phone: "0918556677",
    address: "Số 3 Trần Hưng Đạo, Vạn Ninh",
    region: "Bắc Ninh",
    companyName: "Công ty TNHH Cơ khí Anh Tuấn",
    taxId: "2300771249",
    status: "SUSPENDED",
    createdAt: vnIso(2025, 7, 4, 11, 15),
    updatedAt: vnIso(2026, 4, 9, 9, 5),
  }),
  createCustomer({
    index: 13,
    fullName: "Nguyễn Hoàng Phúc",
    email: "hoangphuc.nguyen@gmail.com",
    phone: "0703667788",
    address: "Số 199 Nguyễn Văn Cừ, Long Biên",
    region: "Hà Nội",
    createdAt: vnIso(2026, 5, 19, 13, 50),
    updatedAt: vnIso(2026, 8, 31, 9, 20),
  }),
  createCustomer({
    index: 14,
    fullName: "Trịnh Thị Lan Anh",
    email: "lananh.trinh@gmail.com",
    phone: "0949112277",
    address: "Số 82 Quang Trung, Hà Đông",
    region: "Hà Nội",
    companyName: "Công ty TNHH Đồ chơi Lan Anh",
    taxId: "0110228493",
    status: "BLOCKED",
    createdAt: vnIso(2025, 6, 23, 16, 40),
    updatedAt: vnIso(2026, 2, 27, 10, 45),
  }),
  createCustomer({
    index: 15,
    fullName: "Cao Thị Ngọc Diệp",
    email: "ngocdiep.cao@gmail.com",
    phone: "0388445599",
    address: "Số 27 Lê Duẩn, Vinh",
    region: "Nghệ An",
    createdAt: vnIso(2026, 6, 11, 8, 25),
    updatedAt: vnIso(2026, 8, 18, 14, 15),
  }),
  createCustomer({
    index: 16,
    fullName: "Phan Văn Lộc",
    email: "vanloc.phan@gmail.com",
    phone: "0932556644",
    address: "Số 145 Nguyễn Tất Thành, Quận 4",
    region: "TP. Hồ Chí Minh",
    companyName: "Công ty CP Xuất nhập khẩu Lộc Phát",
    taxId: "0315664220",
    createdAt: vnIso(2025, 5, 30, 10, 35),
    updatedAt: vnIso(2026, 8, 22, 18, 5),
  }),
  createCustomer({
    index: 17,
    fullName: "Nguyễn Thị Bích Ngân",
    email: "bichngan.nguyen@gmail.com",
    phone: "0866778811",
    address: "Số 6 Hoàng Văn Thụ, Thái Nguyên",
    region: "Thái Nguyên",
    status: "PENDING_VERIFICATION",
    createdAt: vnIso(2026, 9, 1, 21, 55),
  }),
  createCustomer({
    index: 18,
    fullName: "Huỳnh Gia Hân",
    email: "giahan.huynh@gmail.com",
    phone: "0399224466",
    address: "Số 71 Trần Não, Thủ Đức",
    region: "TP. Hồ Chí Minh",
    companyName: "Hộ kinh doanh Gia Hân Store",
    taxId: "8365112907",
    status: "PENDING",
    createdAt: vnIso(2026, 8, 27, 17, 20),
  }),
];

/* =====================================================
   KHO: MÃ THAM CHIẾU
===================================================== */

/**
 * Bốn kho mà các vị trí bên dưới trỏ vào.
 *
 * Bộ mock danh sách kho (getWarehouses) nằm ở file khác, nên id kho phải là
 * một hằng số dùng chung — export ra đây để bên đó lấy đúng id/code/name này
 * mà khai, tránh cảnh chọn kho xong sơ đồ trống trơn vì lệch id.
 */
export const warehouseRefs = {
  hanoi: {
    id: makeUuid("5c2b9a10", 1),
    code: "VN-HAN-01",
    name: "Kho tổng Hà Nội",
    warehouseType: "DESTINATION",
    address: "Lô B4, KCN Quang Minh, Mê Linh, Hà Nội",
  },
  hochiminh: {
    id: makeUuid("5c2b9a10", 2),
    code: "VN-SGN-01",
    name: "Kho tổng TP. Hồ Chí Minh",
    warehouseType: "DESTINATION",
    address: "Số 27 Đường số 7, KCN Tân Bình, Tân Phú, TP. Hồ Chí Minh",
  },
  guangzhou: {
    id: makeUuid("5c2b9a10", 3),
    code: "CN-CAN-01",
    name: "Kho gốc Quảng Châu",
    warehouseType: "ORIGIN",
    address: "Số 88 Baiyun Avenue, Bạch Vân, Quảng Châu, Trung Quốc",
  },
  pingxiang: {
    id: makeUuid("5c2b9a10", 4),
    code: "CN-PXG-01",
    name: "Kho trung chuyển Bằng Tường",
    warehouseType: "ORIGIN",
    address: "Khu logistics Bằng Tường, Quảng Tây, Trung Quốc",
  },
};

/* =====================================================
   VỊ TRÍ KHO / Ô KỆ (WarehouseLocationsPage)
===================================================== */

/**
 * Sinh các ô chứa (bin) của một kệ.
 *
 * WarehouseLocationsPage gom cây theo zoneName → shelfCode → bin, nên dữ liệu
 * phẳng nhưng phải nhất quán ba field đó. Mỗi ô khai gọn [mã ô, dung tích cm³,
 * tải trọng kg, còn dùng?, ghi chú]; phần lặp lại (kho, khu, kệ, ngày tạo) do
 * hàm này điền để 60 bản ghi vẫn soát được bằng mắt.
 */
const buildShelf = ({ warehouse, zoneName, shelfCode, createdOn, bins }) =>
  bins.map(([binCode, maxVolume, maxWeight, isActive, note], index) => ({
    warehouseId: warehouse.id,
    warehouseCode: warehouse.code,
    warehouseName: warehouse.name,
    zoneName,
    zoneCode: zoneName,
    shelfCode,
    binCode,
    code: binCode,
    maxVolume,
    maxWeight,
    isActive,
    note,
    createdAt: vnIso(createdOn[0], createdOn[1], createdOn[2], 8, index * 7),
    updatedAt: vnIso(createdOn[0], createdOn[1], createdOn[2], 8, index * 7),
  }));

const rawWarehouseLocations = [
  /* ---------- Kho tổng Hà Nội: 20 ô ---------- */
  ...buildShelf({
    warehouse: warehouseRefs.hanoi,
    zoneName: "A",
    shelfCode: "A1",
    createdOn: [2025, 2, 10],
    bins: [
      ["A1-01", 240000, 150, true, "Ô ưu tiên kiện ký gửi nhẹ, lấy hàng nhanh"],
      ["A1-02", 240000, 150, true, "Hàng dễ vỡ, xếp tối đa hai tầng"],
      ["A1-03", 240000, 150, true, "Kiện mua hộ chờ khách xác nhận thanh toán"],
      ["A1-04", 240000, 150, false, "Đang sửa khung kệ, tạm khoá ô"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.hanoi,
    zoneName: "A",
    shelfCode: "A2",
    createdOn: [2025, 2, 10],
    bins: [
      ["A2-01", 320000, 220, true, "Kiện quần áo, phụ kiện theo lô ký gửi"],
      ["A2-02", 320000, 220, true, "Hàng gia dụng nhỏ, đóng thùng carton"],
      ["A2-03", 320000, 220, true, "Kiện chờ ghép lô về tỉnh"],
      ["A2-04", 320000, 220, true, "Hàng khách VIP, kiểm đếm hai lần"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.hanoi,
    zoneName: "A",
    shelfCode: "A3",
    createdOn: [2025, 3, 4],
    bins: [
      ["A3-01", 400000, 300, true, "Kiện quá khổ, đặt sát lối nâng hạ"],
      ["A3-02", 400000, 300, true, "Hàng nặng theo kiện, tối đa 300 kg"],
      ["A3-03", 400000, 300, false, "Chờ dán lại mã vạch định vị"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.hanoi,
    zoneName: "B",
    shelfCode: "B1",
    createdOn: [2025, 3, 18],
    bins: [
      ["B1-01", 180000, 120, true, "Hàng giá trị cao, có khoá và camera riêng"],
      ["B1-02", 180000, 120, true, "Mỹ phẩm, thực phẩm khô đóng gói kín"],
      ["B1-03", 180000, 120, true, "Kiện lẻ chờ khách tới nhận trực tiếp"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.hanoi,
    zoneName: "B",
    shelfCode: "B2",
    createdOn: [2025, 4, 7],
    bins: [
      ["B2-01", 180000, 120, true, "Hàng hoàn về, chờ đối chiếu với khách"],
      ["B2-02", 180000, 120, true, "Kiện thiếu chứng từ, chờ bổ sung hoá đơn"],
      ["B2-03", 180000, 120, false, "Ngừng dùng do ẩm chân kệ, đợi xử lý"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.hanoi,
    zoneName: "Xuất hàng",
    shelfCode: "X1",
    createdOn: [2025, 5, 12],
    bins: [
      ["X1-01", 500000, 400, true, "Kiện đã có phiếu xuất kho, chờ lên xe"],
      ["X1-02", 500000, 400, true, "Đơn hoả tốc, xuất trong ngày"],
      ["X1-03", 500000, 400, true, "Hàng giao nội thành Hà Nội"],
    ],
  }),

  /* ---------- Kho tổng TP. Hồ Chí Minh: 14 ô ---------- */
  ...buildShelf({
    warehouse: warehouseRefs.hochiminh,
    zoneName: "A",
    shelfCode: "A1",
    createdOn: [2025, 6, 2],
    bins: [
      ["A1-01", 260000, 160, true, "Kiện ký gửi khu vực Quận 1, Quận 3"],
      ["A1-02", 260000, 160, true, "Hàng mua hộ chờ tất toán công nợ"],
      ["A1-03", 260000, 160, true, "Kiện nhỏ dưới 5 kg, gom theo khách"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.hochiminh,
    zoneName: "A",
    shelfCode: "A2",
    createdOn: [2025, 6, 2],
    bins: [
      ["A2-01", 260000, 160, true, "Hàng linh kiện điện tử, tránh va đập"],
      ["A2-02", 260000, 160, false, "Tạm khoá để kiểm kê định kỳ quý"],
      ["A2-03", 260000, 160, true, "Kiện chờ giao đi Bình Dương, Đồng Nai"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.hochiminh,
    zoneName: "B",
    shelfCode: "B1",
    createdOn: [2025, 7, 21],
    bins: [
      ["B1-01", 340000, 250, true, "Hàng nội thất tháo rời, kiện dài"],
      ["B1-02", 340000, 250, true, "Kiện máy móc, cần xe nâng khi lấy"],
      ["B1-03", 340000, 250, true, "Hàng dự án, giữ nguyên lô không tách"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.hochiminh,
    zoneName: "B",
    shelfCode: "B2",
    createdOn: [2025, 8, 14],
    bins: [
      ["B2-01", 340000, 250, true, "Kiện chờ đóng lô vận chuyển đi Cần Thơ"],
      ["B2-02", 340000, 250, true, "Hàng quá hạn lưu kho, nhắc khách nhận"],
      ["B2-03", 340000, 250, true, "Kiện hoàn về từ đơn giao thất bại"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.hochiminh,
    zoneName: "Nhận hàng",
    shelfCode: "N1",
    createdOn: [2025, 9, 5],
    bins: [
      ["N1-01", 600000, 500, true, "Bãi hạ hàng từ lô về, chờ kiểm đếm"],
      ["N1-02", 600000, 500, true, "Kiện chờ cân đo lại trước khi nhập kệ"],
    ],
  }),

  /* ---------- Kho gốc Quảng Châu: 14 ô ---------- */
  ...buildShelf({
    warehouse: warehouseRefs.guangzhou,
    zoneName: "C",
    shelfCode: "C1",
    createdOn: [2025, 2, 24],
    bins: [
      ["C1-01", 280000, 180, true, "Hàng mua hộ từ Taobao, chờ ghép kiện"],
      ["C1-02", 280000, 180, true, "Kiện đã dán mã khách, chờ đóng lô"],
      ["C1-03", 280000, 180, true, "Hàng 1688 theo thùng lớn"],
      ["C1-04", 280000, 180, true, "Kiện chờ khách xác nhận cân nặng thật"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.guangzhou,
    zoneName: "C",
    shelfCode: "C2",
    createdOn: [2025, 2, 24],
    bins: [
      ["C2-01", 280000, 180, true, "Hàng ký gửi khách tự mang tới kho gốc"],
      ["C2-02", 280000, 180, false, "Tạm khoá do đổi vị trí lối đi trong kho"],
      ["C2-03", 280000, 180, true, "Kiện nhỏ gom chung theo tuyến đường bộ"],
      ["C2-04", 280000, 180, true, "Hàng chờ chụp ảnh kiểm tra cho khách"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.guangzhou,
    zoneName: "D",
    shelfCode: "D1",
    createdOn: [2025, 4, 15],
    bins: [
      ["D1-01", 450000, 350, true, "Kiện lớn đi đường biển, chờ xếp container"],
      ["D1-02", 450000, 350, true, "Hàng nặng, ưu tiên tuyến đường bộ Bằng Tường"],
      ["D1-03", 450000, 350, true, "Kiện chờ khai báo hải quan xuất"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.guangzhou,
    zoneName: "D",
    shelfCode: "D2",
    createdOn: [2025, 5, 28],
    bins: [
      ["D2-01", 450000, 350, true, "Hàng chờ bổ sung giấy tờ nhập khẩu"],
      ["D2-02", 450000, 350, true, "Kiện bị lệch kiểm đếm, chờ đối chiếu"],
      ["D2-03", 450000, 350, false, "Ngừng dùng, kệ đang gia cố lại sàn"],
    ],
  }),

  /* ---------- Kho trung chuyển Bằng Tường: 12 ô ---------- */
  ...buildShelf({
    warehouse: warehouseRefs.pingxiang,
    zoneName: "A",
    shelfCode: "A1",
    createdOn: [2025, 10, 6],
    bins: [
      ["A1-01", 300000, 200, true, "Kiện chờ thông quan cửa khẩu Hữu Nghị"],
      ["A1-02", 300000, 200, true, "Hàng đã thông quan, chờ xe về Hà Nội"],
      ["A1-03", 300000, 200, true, "Kiện tách lô theo từng đơn ký gửi"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.pingxiang,
    zoneName: "A",
    shelfCode: "A2",
    createdOn: [2025, 10, 6],
    bins: [
      ["A2-01", 300000, 200, true, "Hàng gom tuyến đường bộ, đi trong 24 giờ"],
      ["A2-02", 300000, 200, true, "Kiện tồn qua đêm do xe đầy tải"],
      ["A2-03", 300000, 200, false, "Tạm khoá, chờ lắp thêm giá đỡ"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.pingxiang,
    zoneName: "B",
    shelfCode: "B1",
    createdOn: [2025, 11, 19],
    bins: [
      ["B1-01", 220000, 140, true, "Kiện nhẹ, xếp tầng trên cùng"],
      ["B1-02", 220000, 140, true, "Hàng mẫu, khách yêu cầu đi hoả tốc"],
      ["B1-03", 220000, 140, true, "Kiện chờ đổi nhãn vận đơn nội địa"],
    ],
  }),
  ...buildShelf({
    warehouse: warehouseRefs.pingxiang,
    zoneName: "B",
    shelfCode: "B2",
    createdOn: [2025, 12, 8],
    bins: [
      ["B2-01", 220000, 140, true, "Hàng hoàn về Trung Quốc, chờ khách xử lý"],
      ["B2-02", 220000, 140, true, "Kiện thiếu thông tin người nhận"],
      ["B2-03", 220000, 140, true, "Kiện chờ ghép cùng lô kế tiếp"],
    ],
  }),
];

/**
 * Danh sách vị trí lưu trữ, đã gắn id.
 *
 * Gắn id ở bước cuối theo chỉ số trong mảng phẳng để không phải đánh số tay
 * trong từng kệ — thêm hay bớt một ô cũng không tạo id trùng.
 */
export const warehouseLocations = rawWarehouseLocations.map((location, index) => ({
  id: makeUuid("a4e17c30", index + 1),
  locationId: makeUuid("a4e17c30", index + 1),
  ...location,
}));

/** Alias theo cách gọi trong nghiệp vụ: mỗi vị trí lưu trữ là một "ô kệ". */
export const bins = warehouseLocations;

/** Nhóm sẵn theo kho, vì mọi màn hình đều xem sơ đồ của đúng một kho. */
export const warehouseLocationsByWarehouseId = warehouseLocations.reduce(
  (result, location) => {
    if (!result[location.warehouseId]) {
      result[location.warehouseId] = [];
    }

    result[location.warehouseId].push(location);
    return result;
  },
  {}
);

/**
 * Lấy vị trí theo mã kho, có đường lùi.
 *
 * Nếu bộ mock danh sách kho khai id khác warehouseRefs, trả mảng rỗng sẽ làm
 * người dùng tưởng kho chưa cấu hình sơ đồ. Bản demo thà hiện sơ đồ kho Hà Nội
 * còn hơn hiện một trang trắng, nên id lạ sẽ lùi về bộ mặc định.
 */
export const getWarehouseLocationsFor = (warehouseId) => {
  const key = String(warehouseId ?? "").trim();

  return (
    warehouseLocationsByWarehouseId[key] ||
    warehouseLocationsByWarehouseId[warehouseRefs.hanoi.id]
  );
};

/**
 * Bảng tra gọn cho bộ mock tồn kho.
 *
 * WarehouseLayeredView ghép kiện hàng vào ô theo `inv.binId === location.id`
 * hoặc `inv.binCode === location.binCode`; export sẵn để bên đó không phải
 * bịa mã ô rồi nút "Xem kiện hàng" lúc nào cũng đếm 0.
 */
export const binRefs = warehouseLocations.map((location) => ({
  id: location.id,
  binCode: location.binCode,
  shelfCode: location.shelfCode,
  zoneName: location.zoneName,
  warehouseId: location.warehouseId,
}));

/* =====================================================
   Ô SƠ ĐỒ KHO (layout items, tab "Sơ đồ lưới")
===================================================== */

/**
 * Ô toạ độ trên sơ đồ lưới của kho.
 *
 * Khác với vị trí lưu trữ ở trên: đây chỉ là ô để vẽ mặt bằng theo hàng/cột,
 * WarehouseLayoutGridView đọc zoneCode, label, gridRow, gridColumn, maxVolume.
 */
const buildLayoutItems = ({ warehouse, zoneCode, createdOn, cells }) =>
  cells.map(([label, gridRow, gridColumn, maxVolume, maxWeight, isActive, note], index) => ({
    warehouseId: warehouse.id,
    zoneCode,
    zoneName: zoneCode,
    label,
    gridRow,
    gridColumn,
    maxVolume,
    maxWeight,
    isActive,
    note,
    createdAt: vnIso(createdOn[0], createdOn[1], createdOn[2], 10, index * 5),
    updatedAt: vnIso(createdOn[0], createdOn[1], createdOn[2], 10, index * 5),
  }));

const rawWarehouseLayoutItems = [
  ...buildLayoutItems({
    warehouse: warehouseRefs.hanoi,
    zoneCode: "A",
    createdOn: [2025, 2, 11],
    cells: [
      ["A-R1C1", 1, 1, 240000, 150, true, "Kệ A1 nhìn từ cửa nhập"],
      ["A-R1C2", 1, 2, 240000, 150, true, "Kệ A2 sát lối đi giữa"],
      ["A-R1C3", 1, 3, 400000, 300, true, "Kệ A3 dành cho kiện quá khổ"],
      ["A-R2C1", 2, 1, 240000, 150, true, "Khoảng trống dự phòng mở rộng kệ"],
    ],
  }),
  ...buildLayoutItems({
    warehouse: warehouseRefs.hanoi,
    zoneCode: "B",
    createdOn: [2025, 3, 19],
    cells: [
      ["B-R1C1", 1, 1, 180000, 120, true, "Kệ B1 khu hàng giá trị cao"],
      ["B-R1C2", 1, 2, 180000, 120, true, "Kệ B2 khu hàng hoàn về"],
      ["B-R2C1", 2, 1, 180000, 120, false, "Ô chờ nghiệm thu phòng cháy"],
    ],
  }),
  ...buildLayoutItems({
    warehouse: warehouseRefs.hanoi,
    zoneCode: "Xuất hàng",
    createdOn: [2025, 5, 13],
    cells: [
      ["X-R1C1", 1, 1, 500000, 400, true, "Bãi tập kết trước cửa xuất số 1"],
      ["X-R1C2", 1, 2, 500000, 400, true, "Bãi tập kết trước cửa xuất số 2"],
    ],
  }),
  ...buildLayoutItems({
    warehouse: warehouseRefs.hochiminh,
    zoneCode: "A",
    createdOn: [2025, 6, 3],
    cells: [
      ["A-R1C1", 1, 1, 260000, 160, true, "Kệ A1 khu hàng lẻ nội thành"],
      ["A-R1C2", 1, 2, 260000, 160, true, "Kệ A2 khu hàng điện tử"],
      ["A-R2C1", 2, 1, 260000, 160, true, "Ô dự phòng cho mùa cao điểm"],
    ],
  }),
  ...buildLayoutItems({
    warehouse: warehouseRefs.hochiminh,
    zoneCode: "B",
    createdOn: [2025, 7, 22],
    cells: [
      ["B-R1C1", 1, 1, 340000, 250, true, "Kệ B1 khu hàng nội thất"],
      ["B-R1C2", 1, 2, 340000, 250, true, "Kệ B2 khu chờ đóng lô"],
      ["B-R2C1", 2, 1, 600000, 500, true, "Bãi hạ hàng khu nhận"],
    ],
  }),
  ...buildLayoutItems({
    warehouse: warehouseRefs.guangzhou,
    zoneCode: "C",
    createdOn: [2025, 2, 25],
    cells: [
      ["C-R1C1", 1, 1, 280000, 180, true, "Kệ C1 hàng mua hộ chờ ghép"],
      ["C-R1C2", 1, 2, 280000, 180, true, "Kệ C2 hàng khách tự mang tới"],
      ["C-R2C1", 2, 1, 280000, 180, true, "Ô chụp ảnh kiểm tra hàng"],
    ],
  }),
  ...buildLayoutItems({
    warehouse: warehouseRefs.guangzhou,
    zoneCode: "D",
    createdOn: [2025, 4, 16],
    cells: [
      ["D-R1C1", 1, 1, 450000, 350, true, "Kệ D1 kiện đi đường biển"],
      ["D-R1C2", 1, 2, 450000, 350, true, "Kệ D2 kiện chờ giấy tờ"],
      ["D-R2C1", 2, 1, 450000, 350, false, "Ô đang gia cố sàn, chưa dùng"],
    ],
  }),
  ...buildLayoutItems({
    warehouse: warehouseRefs.pingxiang,
    zoneCode: "A",
    createdOn: [2025, 10, 7],
    cells: [
      ["A-R1C1", 1, 1, 300000, 200, true, "Kệ A1 chờ thông quan"],
      ["A-R1C2", 1, 2, 300000, 200, true, "Kệ A2 hàng gom đường bộ"],
    ],
  }),
  ...buildLayoutItems({
    warehouse: warehouseRefs.pingxiang,
    zoneCode: "B",
    createdOn: [2025, 11, 20],
    cells: [
      ["B-R1C1", 1, 1, 220000, 140, true, "Kệ B1 kiện nhẹ"],
      ["B-R1C2", 1, 2, 220000, 140, true, "Kệ B2 hàng hoàn về"],
    ],
  }),
];

export const warehouseLayoutItems = rawWarehouseLayoutItems.map((item, index) => ({
  id: makeUuid("6d8f2b40", index + 1),
  layoutId: makeUuid("6d8f2b40", index + 1),
  ...item,
}));

export const warehouseLayoutItemsByWarehouseId = warehouseLayoutItems.reduce(
  (result, item) => {
    if (!result[item.warehouseId]) {
      result[item.warehouseId] = [];
    }

    result[item.warehouseId].push(item);
    return result;
  },
  {}
);

export const getWarehouseLayoutItemsFor = (warehouseId) => {
  const key = String(warehouseId ?? "").trim();

  return (
    warehouseLayoutItemsByWarehouseId[key] ||
    warehouseLayoutItemsByWarehouseId[warehouseRefs.hanoi.id]
  );
};

/* =====================================================
   TỔNG HỢP KHU VỰC VÀ TÌNH TRẠNG LẤP ĐẦY
===================================================== */

/**
 * Số liệu tổng hợp theo khu vực của một kho.
 *
 * Tính từ chính `warehouseLocations` chứ không gõ tay: hai màn hình cùng đếm ô
 * trên một nguồn dữ liệu thì con số trên sơ đồ và trên tab trạng thái mới khớp.
 */
const summarizeZones = (locations = []) => {
  const zones = new Map();

  locations.forEach((location) => {
    const zoneName = location.zoneName || location.zoneCode || "Chung";

    if (!zones.has(zoneName)) {
      zones.set(zoneName, {
        zoneCode: zoneName,
        zoneName,
        shelves: new Set(),
        totalBins: 0,
        activeBins: 0,
        maxVolume: 0,
        maxWeight: 0,
      });
    }

    const zone = zones.get(zoneName);

    zone.shelves.add(location.shelfCode);
    zone.totalBins += 1;
    zone.maxVolume += Number(location.maxVolume) || 0;
    zone.maxWeight += Number(location.maxWeight) || 0;

    if (location.isActive !== false) {
      zone.activeBins += 1;
    }
  });

  return [...zones.values()]
    .map((zone) => ({
      zoneCode: zone.zoneCode,
      zoneName: zone.zoneName,
      shelfCount: zone.shelves.size,
      totalBins: zone.totalBins,
      activeBins: zone.activeBins,
      inactiveBins: zone.totalBins - zone.activeBins,
      maxVolume: zone.maxVolume,
      maxWeight: zone.maxWeight,
    }))
    .sort((a, b) => a.zoneName.localeCompare(b.zoneName, "vi"));
};

/** Zone tổng hợp theo kho — nguồn cho /layout/zones. */
export const warehouseLayoutZonesByWarehouseId = Object.fromEntries(
  Object.entries(warehouseLocationsByWarehouseId).map(([warehouseId, locations]) => [
    warehouseId,
    summarizeZones(locations),
  ])
);

export const getWarehouseLayoutZonesFor = (warehouseId) => {
  const key = String(warehouseId ?? "").trim();

  return (
    warehouseLayoutZonesByWarehouseId[key] ||
    warehouseLayoutZonesByWarehouseId[warehouseRefs.hanoi.id]
  );
};

/** Tình trạng lấp đầy theo kho — nguồn cho /layout/status. */
export const warehouseLayoutStatusByWarehouseId = Object.fromEntries(
  Object.entries(warehouseLocationsByWarehouseId).map(([warehouseId, locations]) => {
    const zones = summarizeZones(locations);
    const totalBins = locations.length;
    const activeBins = locations.filter((item) => item.isActive !== false).length;

    // Số ô "đang có hàng" đặt xấp xỉ 70% số ô còn dùng được: bản demo cần một
    // tỷ lệ lấp đầy trông thật, không phải kho trống hoặc kho đầy tuyệt đối.
    const occupiedBins = Math.round(activeBins * 0.7);

    return [
      warehouseId,
      {
        warehouseId,
        totalZones: zones.length,
        totalShelves: zones.reduce((sum, zone) => sum + zone.shelfCount, 0),
        totalBins,
        activeBins,
        inactiveBins: totalBins - activeBins,
        occupiedBins,
        availableBins: activeBins - occupiedBins,
        occupancyRate: activeBins
          ? Math.round((occupiedBins / activeBins) * 100)
          : 0,
        totalMaxVolume: locations.reduce(
          (sum, item) => sum + (Number(item.maxVolume) || 0),
          0
        ),
        totalMaxWeight: locations.reduce(
          (sum, item) => sum + (Number(item.maxWeight) || 0),
          0
        ),
        updatedAt: vnIso(2026, 9, 3, 8, 0),
        zones,
      },
    ];
  })
);

export const getWarehouseLayoutStatusFor = (warehouseId) => {
  const key = String(warehouseId ?? "").trim();

  return (
    warehouseLayoutStatusByWarehouseId[key] ||
    warehouseLayoutStatusByWarehouseId[warehouseRefs.hanoi.id]
  );
};

/* =====================================================
   DEFAULT EXPORT
===================================================== */

const people = {
  demoAccounts,
  demoAccountsByRole,
  findDemoAccount,
  demoAccessToken,
  demoRefreshToken,
  demoTokenExpiresAt,

  users,
  customers,

  warehouseRefs,
  warehouseLocations,
  bins,
  binRefs,
  warehouseLocationsByWarehouseId,
  getWarehouseLocationsFor,

  warehouseLayoutItems,
  warehouseLayoutItemsByWarehouseId,
  getWarehouseLayoutItemsFor,

  warehouseLayoutZonesByWarehouseId,
  getWarehouseLayoutZonesFor,
  warehouseLayoutStatusByWarehouseId,
  getWarehouseLayoutStatusFor,
};

export default people;
