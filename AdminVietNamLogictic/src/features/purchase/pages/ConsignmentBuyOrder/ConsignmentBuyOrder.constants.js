// Dữ liệu tĩnh của trang mua hộ (giới hạn ảnh, giá trị khởi tạo của form).
// Tách khỏi trang vì đây là bảng giá trị cố định, không dính tới state,
// nên để riêng giúp trang chỉ còn logic và JSX.

import { EMPTY_PACKAGE_SERVICES } from "@features/purchase/components/PackageOptionalServicesS1/PackageOptionalServicesS1";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_ITEM = 5;

/*
 * GIỚI HẠN ĐẦU VÀO của yêu cầu mua hộ — khớp backend (vượt là 400 kèm câu tiếng Việt).
 * FE chặn trước để Sale không điền xong cả form mới ăn lỗi. Đổi số ở đây là đổi cả
 * nhãn gợi ý, maxLength của ô lẫn câu báo lỗi.
 */
export const MAX_PURCHASE_ITEMS = 50;
export const MAX_PURCHASE_ITEM_QUANTITY = 999;

/* Độ dài tối đa (ký tự, tính sau khi trim) của từng trường gửi lên. */
export const PURCHASE_FIELD_MAX_LENGTH = Object.freeze({
  productLink: 1000,
  sourceWebsite: 500,
  productType: 100,
  productName: 255,
  attributes: 500,
  note: 500,
  receiverName: 255,
  receiverPhone: 50,
  receiverAddress: 500,
  /* Ghi chú chung SAU KHI backend nối thêm câu dịch vụ + câu "đơn do nhân viên lên hộ". */
  generalNote: 1000,
  /* Các URL ảnh của MỘT sản phẩm nối bằng "|". */
  imageUrls: 1000,
});

/*
 * Backend lưu ghi chú chung = generalNote.trim() nối bằng ". " với câu của từng dịch vụ
 * được tick (đúng thứ tự dưới đây), rồi — vì đơn do Sale tạo — thêm câu
 * STAFF_CREATED_NOTE ở cuối. Tổng phải ≤ PURCHASE_FIELD_MAX_LENGTH.generalNote.
 */
export const PURCHASE_SERVICE_NOTES = Object.freeze([
  { key: "requiresPacking", text: "Yêu cầu đóng gói lại" },
  { key: "requiresWoodenCrate", text: "Yêu cầu đóng thùng gỗ" },
  { key: "requiresInsurance", text: "Đăng ký bảo hiểm" },
]);

export const STAFF_CREATED_NOTE = "Đơn do nhân viên lên hộ khách";

export const INITIAL_FORM = {
  route: "",
  shippingOption: "",
  receiverName: "",
  receiverPhone: "",
  selectedDeliveryAddress: "",
  optionalServices: {
    ...EMPTY_PACKAGE_SERVICES,
  },
  generalNote: "",
};

export const INITIAL_ADDRESS_SELECT = {
  provinceCode: "",
  districtCode: "",
  wardCode: "",
};
