// Dữ liệu tĩnh của màn hình chat CSKH: bảng tra nhãn, option, giới hạn ảnh, nhịp poll.
// Tách khỏi component vì đây là phần không bao giờ thay đổi theo state — để chung
// khiến phải cuộn qua hàng trăm dòng bảng tra mới tới được logic thật.

import { getConsignmentsApi } from "@features/consignment/api/consignmentService.mock";
import { getPurchaseRequestsApi } from "@features/purchase/api/purchaseRequestService";

export const RELATED_TYPE_OPTIONS = [
  {
    value: "",
    label: "Không liên kết",
  },
  {
    value: "PURCHASE_REQUEST",
    label: "Yêu cầu mua hộ",
  },
  {
    value: "CONSIGNMENT",
    label: "Yêu cầu ký gửi",
  },
];

export const RELATED_TYPE_LABELS = {
  PURCHASE_REQUEST: "Yêu cầu mua hộ",
  PURCHASEREQUEST: "Yêu cầu mua hộ",
  BUY_FOR_ME: "Yêu cầu mua hộ",
  BUYFORME: "Yêu cầu mua hộ",
  CONSIGNMENT: "Yêu cầu ký gửi",
  CONSIGNMENT_REQUEST: "Yêu cầu ký gửi",
  CONSIGNMENTREQUEST: "Yêu cầu ký gửi",
  QUOTATION: "Báo giá",
  SUPPORT: "Hỗ trợ chung",
};

export const STATUS_LABELS = {
  PENDING: "Đang chờ xử lý",
  PENDING_REVIEW: "Đang chờ duyệt",
  PROCESSING: "Đang xử lý",
  IN_PROGRESS: "Đang xử lý",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  CANCELED: "Đã hủy",
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
  QUOTATION_SENT: "Đã gửi báo giá",
};

export const RELATED_TYPE_LOADERS = {
  PURCHASE_REQUEST: getPurchaseRequestsApi,
  CONSIGNMENT: getConsignmentsApi,
};

export const INITIAL_CREATE_FORM = {
  relatedType: "",
  relatedId: "",
  message: "",
};

export const INITIAL_MESSAGE_FORM = {
  content: "",
};

export const MAX_IMAGE_COUNT = 1;
export const MAX_IMAGE_SIZE_MB = 6;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export const ACCEPTED_CHAT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const MESSAGE_POLL_INTERVAL_MS = 2500;

export const MESSAGE_GROUP_GAP_MS = 5 * 60 * 1000;
