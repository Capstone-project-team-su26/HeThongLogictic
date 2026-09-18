/*
 * Sự cố hàng hoá ở chặng Việt Nam — ĐÃ NỐI API THẬT (api-hang-ve-viet-nam.md mục E).
 *
 *   GET  /api/parcel-incidents?status=A,B&orderId=&incidentType=&pageNumber=&pageSize=
 *        → { message, data: { items, totalCount, pageNumber, pageSize, totalPages } }
 *   GET  /api/parcel-incidents/{id}                    → { message, data: Incident + attachments }
 *   POST /api/parcel-incidents/{id}/resolve            { resolution, compensationAmount, note }
 *        (quản lý kho VN / OM — khác người lập biên bản; Admin làm thay phải ghi note)
 *   POST /api/parcel-incidents/{id}/compensation-paid  { reference, note }   (Admin)
 *
 * Trình tự bắt buộc của backend được chặn trước ở đây để người dùng đọc câu tiếng Việt:
 *   - quyết định cần có ảnh INCIDENT_PHOTO gắn vào sự cố (entityType = INCIDENT);
 *   - COMPENSATE cần compensationAmount > 0; khách chưa chọn mà vẫn quyết thì bắt buộc note;
 *   - ghi nhận chi bồi thường cần chứng từ COMPENSATION_RECEIPT + mã giao dịch.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getPagedData, getResponseData, removeEmptyParams } from "@shared/api/apiEnvelope";
import { getAdminApiError } from "@features/admin/api/adminService";

export { getAdminApiError as getIncidentApiError };

export const INCIDENT_STATUS_META = Object.freeze({
  OPEN: { label: "Chờ khách chọn", color: "gold" },
  CUSTOMER_RESPONDED: { label: "Khách đã chọn", color: "processing" },
  RESOLVED: { label: "Đã xử lý", color: "success" },
});

export const INCIDENT_TYPE_LABELS = Object.freeze({
  DAMAGED: "Hư hỏng",
  WRONG_ITEM: "Sai hàng",
  MISSING_ITEMS: "Thiếu hàng",
  WEIGHT_DEVIATION: "Lệch cân > 10%",
  COMPLAINT: "Khiếu nại sau giao",
});

export const RESOLUTION_LABELS = Object.freeze({
  ACCEPT: "Nhận như hiện trạng",
  COMPENSATE: "Bồi thường",
  DISPOSE: "Huỷ hàng",
});

export const getIncidentStatusMeta = (status) =>
  INCIDENT_STATUS_META[String(status || "").toUpperCase()] || { label: status || "—", color: "default" };

export const getIncidentTypeLabel = (type) =>
  INCIDENT_TYPE_LABELS[String(type || "").toUpperCase()] || type || "—";

export const getResolutionLabel = (value) =>
  RESOLUTION_LABELS[String(value || "").toUpperCase()] || value || "—";

/**
 * Hướng quyết định hợp lệ theo loại sự cố (bảng mục E):
 *   - WEIGHT_DEVIATION: chỉ ACCEPT (dùng số cân VN);
 *   - COMPLAINT: ACCEPT / COMPENSATE (không huỷ được hàng đã giao);
 *   - còn lại: ACCEPT / COMPENSATE / DISPOSE.
 */
export const getAllowedResolutions = (incidentType) => {
  const type = String(incidentType || "").toUpperCase();
  if (type === "WEIGHT_DEVIATION") return ["ACCEPT"];
  if (type === "COMPLAINT") return ["ACCEPT", "COMPENSATE"];
  return ["ACCEPT", "COMPENSATE", "DISPOSE"];
};

/** Sự cố đã quyết bồi thường mà Admin chưa ghi nhận chi. */
export const isAwaitingCompensation = (incident) =>
  String(incident?.resolution || "").toUpperCase() === "COMPENSATE" && !incident?.compensationPaidAt;

const trimText = (value) => String(value ?? "").trim();

const requireId = (value) => {
  const id = trimText(value);
  if (!id) throw new Error("Thiếu mã sự cố.");
  return id;
};

/** Danh sách sự cố → { items, totalCount, pageNumber, pageSize }. Backend tối đa 100 dòng/trang. */
export const listIncidents = async ({
  status = "",
  orderId = "",
  incidentType = "",
  pageNumber = 1,
  pageSize = 50,
} = {}) => {
  const size = Math.min(Number(pageSize) || 50, 100);
  const response = await httpClient.get(API_ENDPOINTS.parcelIncidents.list, {
    params: removeEmptyParams({ status, orderId, incidentType, pageNumber, pageSize: size }),
  });

  const page = getPagedData(getResponseData(response), { pageNumber, pageSize: size });
  return {
    items: page.items,
    totalCount: page.totalCount,
    pageNumber: page.pageNumber,
    pageSize: page.pageSize,
  };
};

/**
 * Sự cố chờ Admin chi bồi thường. Backend không có bộ lọc "chưa chi", nên đọc các sự cố đã
 * RESOLVED (tối đa 5 trang × 100) rồi lọc tại chỗ `resolution = COMPENSATE` và chưa có
 * `compensationPaidAt`.
 */
export const listAwaitingCompensation = async () => {
  const collected = [];
  for (let pageNumber = 1; pageNumber <= 5; pageNumber += 1) {
    const page = await listIncidents({ status: "RESOLVED", pageNumber, pageSize: 100 });
    collected.push(...page.items);
    if (pageNumber * page.pageSize >= page.totalCount || page.items.length === 0) break;
  }
  return collected.filter(isAwaitingCompensation);
};

/** Chi tiết sự cố kèm ảnh / chứng từ đính kèm. */
export const getIncidentDetail = async (incidentId) => {
  const response = await httpClient.get(API_ENDPOINTS.parcelIncidents.detail(requireId(incidentId)));
  return getResponseData(response);
};

const hasDocument = (incident, documentType) =>
  (incident?.attachments || []).some(
    (item) => String(item?.documentType || "").toUpperCase() === documentType,
  );

/** Mọi loại trừ WEIGHT_DEVIATION đều phải có ảnh hiện trạng trước khi quyết. */
export const requiresIncidentPhoto = (incident) =>
  String(incident?.incidentType || "").toUpperCase() !== "WEIGHT_DEVIATION";

/**
 * Quản lý kho quyết định sự cố.
 *
 * @param {object} incident bản ghi chi tiết (để kiểm ảnh hiện trạng + khách đã chọn chưa)
 * @param {{ resolution: string, compensationAmount?: number, note?: string, noteRequired?: boolean }} payload
 */
export const resolveIncident = async (
  incident,
  { resolution, compensationAmount, note = "", noteRequired = false } = {},
) => {
  const value = trimText(resolution).toUpperCase();
  if (!getAllowedResolutions(incident?.incidentType).includes(value)) {
    throw new Error("Hướng xử lý không hợp lệ với loại sự cố này.");
  }
  /* Cân lệch do hệ thống tự mở, không có ảnh hiện trạng — backend chỉ bắt ảnh với các loại còn lại. */
  if (requiresIncidentPhoto(incident) && !hasDocument(incident, "INCIDENT_PHOTO")) {
    throw new Error("Phải có ảnh hiện trạng (INCIDENT_PHOTO) gắn vào sự cố trước khi quyết định.");
  }

  const amount = Number(compensationAmount);
  if (value === "COMPENSATE" && !(amount > 0)) {
    throw new Error("Bồi thường thì số tiền phải lớn hơn 0.");
  }

  const cleanNote = trimText(note);
  const customerChose = Boolean(trimText(incident?.customerChoice));
  const awaitsChoice = Boolean(incident?.awaitsCustomerChoice);
  if (awaitsChoice && !customerChose && !cleanNote) {
    throw new Error("Khách chưa chọn cách xử lý — phải ghi chú lý do quyết định thay.");
  }
  if (noteRequired && !cleanNote) {
    throw new Error("Admin làm thay quản lý kho thì bắt buộc ghi chú.");
  }

  const response = await httpClient.post(API_ENDPOINTS.parcelIncidents.resolve(requireId(incident?.id)), {
    resolution: value,
    ...(value === "COMPENSATE" ? { compensationAmount: amount } : {}),
    ...(cleanNote ? { note: cleanNote } : {}),
  });

  return getResponseData(response);
};

/** Admin ghi nhận đã chi bồi thường — cần chứng từ COMPENSATION_RECEIPT đã tải lên trước. */
export const markCompensationPaid = async (incident, { reference, note = "" } = {}) => {
  if (!trimText(reference)) throw new Error("Phải ghi mã giao dịch chi bồi thường.");
  if (!hasDocument(incident, "COMPENSATION_RECEIPT")) {
    throw new Error("Phải tải chứng từ chi (COMPENSATION_RECEIPT) vào sự cố trước.");
  }

  const response = await httpClient.post(
    API_ENDPOINTS.parcelIncidents.compensationPaid(requireId(incident?.id)),
    { reference: trimText(reference), ...(trimText(note) ? { note: trimText(note) } : {}) },
  );

  return getResponseData(response);
};

export default {
  listIncidents,
  listAwaitingCompensation,
  getIncidentDetail,
  resolveIncident,
  markCompensationPaid,
  getIncidentStatusMeta,
  getIncidentTypeLabel,
  getResolutionLabel,
  getAllowedResolutions,
};
