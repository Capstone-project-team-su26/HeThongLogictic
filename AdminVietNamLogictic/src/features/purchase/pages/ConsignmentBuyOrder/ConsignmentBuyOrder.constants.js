// Dữ liệu tĩnh của trang mua hộ (giới hạn ảnh, giá trị khởi tạo của form).
// Tách khỏi trang vì đây là bảng giá trị cố định, không dính tới state,
// nên để riêng giúp trang chỉ còn logic và JSX.

import { EMPTY_PACKAGE_SERVICES } from "@features/purchase/components/PackageOptionalServicesS1/PackageOptionalServicesS1";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_ITEM = 5;

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
