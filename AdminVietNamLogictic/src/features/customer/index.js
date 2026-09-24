/**
 * Bề mặt công khai của feature "customer".
 *
 * Feature này sở hữu danh mục khách hàng của khối Sale: trang danh sách
 * CustomerList, ba modal thao tác trên một khách hàng (xem chi tiết, tạo mới,
 * sửa) và tầng mock customerService — nơi giữ store khách hàng trong bộ nhớ
 * cùng toàn bộ chuẩn hoá / kiểm tra trùng số điện thoại, email.
 *
 * Chỉ có MỘT module api trong feature (api/customerService.js) nên "export *"
 * ở đây không thể va tên với module api nào khác của cùng barrel; các tên
 * component bên dưới cũng không nằm trong danh sách named export của nó.
 * Đã đối chiếu cả 12 named export của customerService trên toàn src: không
 * module nào khác dùng lại tên nào, nên feature này cũng không kéo theo va
 * chạm nếu sau này bị gộp chung với barrel khác.
 *
 * Nếu về sau thêm module api thứ hai vào feature, phải soát lại giao nhau
 * trước khi thêm một "export *" nữa, vì tên trùng giữa hai "export *" sẽ bị
 * ESM biến thành undefined mà không báo lỗi — `npm run verify:barrels` nạp
 * thật từng barrel và bắt đúng loại lỗi âm thầm đó.
 *
 * ĐÃ CÓ module api thứ hai: api/customerLookupService.js (bản THẬT — tra khách và
 * đọc sổ địa chỉ của khách cho màn Sale tạo đơn hộ). CỐ TÌNH KHÔNG re-export ở đây:
 * nó có `requireCustomerId` trùng tên với một hàm nội bộ của customerService, nên
 * thêm một `export *` nữa là đúng cái bẫy mô tả ở đoạn trên. Nơi dùng import thẳng
 * "@features/customer/api/customerLookupService".
 */

export { default as CustomerList } from "./pages/CustomerList/CustomerList";

export { default as CustomerDetailModal } from "./components/CustomerDetailModal/CustomerDetailModal";
export { default as CreateCustomerSale } from "./components/CreateCustomerSale/CreateCustomerSale";
export { default as EditCustomerSale } from "./components/EditCustomerSale/EditCustomerSale";

/* customerService.js có cả default (object gom hàm, tiện gọi
   customerService.getCustomersApi) lẫn named export, nên re-export cả hai. */
export { default as customerService } from "./api/customerService";
export * from "./api/customerService";
