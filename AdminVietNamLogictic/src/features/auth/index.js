/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "auth".
 *
 * Module này sở hữu phần xác thực của trang quản trị: màn đăng nhập — trang duy
 * nhất chạy NGOÀI vùng gác quyền — và ba lời gọi mock về phiên/hồ sơ người dùng.
 *
 * Nó KHÔNG sở hữu việc lưu-xoá phiên (thứ đó ở @shared/utils/authSession) cũng
 * không sở hữu việc chặn route (ở @app/router/RequireAuth). Ghi rõ ranh giới này
 * để sau không ai đi tìm hai thứ đó ở đây rồi thêm nhầm vào barrel.
 *
 * Vì sao bề mặt chỉ vỏn vẹn hai dòng: cả feature hiện chỉ có pages/Login và
 * api/authService — không có components/ hay styles/ riêng. Mọi helper trong
 * Login.jsx (ROLE_ROUTES, normalizeRole, getLoginData, saveLoginSession) đều là
 * biến nội bộ không export, nên không có gì khác để lộ ra.
 *
 * VỀ NGUY CƠ VA CHẠM TÊN của `export *`: feature này chỉ có MỘT module api, nên
 * không thể xảy ra cảnh hai `export *` cùng đưa ra một tên rồi bị ESM lặng lẽ
 * biến thành undefined. Đã đối chiếu cả ba tên loginApi / getUserProfileApi /
 * updateUserProfileApi trên toàn bộ src: không module nào khác export trùng.
 * Vì vậy spread ở đây an toàn, chưa cần alias.
 */

/* Trang đăng nhập: Login.jsx chỉ có đúng một export default (function Login),
   không kèm named export nào — nên chỉ cần đổi tên default, không có gì thêm. */
export { default as Login } from "./pages/Login/Login";

/* Mock xác thực: authService.js chỉ có named export (loginApi,
   getUserProfileApi, updateUserProfileApi) và KHÔNG có default,
   nên không có default nào để re-export kèm. */
export * from "./api/authService";
