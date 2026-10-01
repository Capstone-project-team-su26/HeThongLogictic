/**
 * Biên bản kiểm đếm kiện tại kho VN — ĐÃ NỐI API THẬT.
 *
 *   GET /api/parcel-inspections?onlyDiscrepancy=&shipmentId=
 *       → { message, data: { summary: { total, withDiscrepancy, recentDiscrepancy, damagedParcels }, items } }
 *       items[].photos: ảnh kho VN chụp lúc tiếp nhận (VN_ARRIVAL_PROOF) — tải kèm token qua downloadUrl.
 *
 * Hệ thống chỉ GHI NHẬN chênh lệch; kiện lỗi / cân lệch > 10% đã tự mở SỰ CỐ để quản lý kho
 * quyết ở màn "Sự cố hàng hoá". Màn này chỉ đọc và lọc.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getArrayItems, getResponseData, removeEmptyParams } from "@shared/api/apiEnvelope";
import { getAdminApiError } from "@features/admin/api/adminService";
import { getShipmentDetail } from "@features/shipment";
import { labelOf } from "@shared/utils/statusLabel";

export { getAdminApiError as getInspectionApiError };

/*
 * Tình trạng kiện lúc kho VN tiếp nhận: bộ mới GOOD / DAMAGED / WRONG_ITEM / MISSING_ITEMS;
 * giữ nhãn cho giá trị cũ app kho cũ còn gửi (INTACT / WET / SEAL_BROKEN / MISSING).
 */
export const CONDITION_META = Object.freeze({
  GOOD: { label: "Nguyên vẹn", tone: "success" },
  DAMAGED: { label: "Hư hỏng", tone: "error" },
  WRONG_ITEM: { label: "Sai hàng", tone: "error" },
  MISSING_ITEMS: { label: "Thiếu hàng", tone: "error" },
  INTACT: { label: "Nguyên vẹn", tone: "success" },
  MISSING: { label: "Thiếu hàng", tone: "error" },
  WET: { label: "Ẩm ướt", tone: "warning" },
  SEAL_BROKEN: { label: "Rách niêm phong", tone: "warning" },
});

export const getConditionMeta = (condition) =>
  CONDITION_META[String(condition || "").toUpperCase()] || {
    label: condition ? labelOf(CONDITION_META, condition, { generic: "Tình trạng khác" }) : "Không ghi nhận",
    tone: "default",
  };

const EMPTY_SUMMARY = { total: 0, withDiscrepancy: 0, recentDiscrepancy: 0, damagedParcels: 0 };

/**
 * @param {{ onlyDiscrepancy?: boolean, shipmentId?: string }} options
 * Mặc định chỉ lấy biên bản có lệch — đó là thứ OM mở màn này để xem.
 */
export const listParcelInspections = async ({ onlyDiscrepancy = true, shipmentId = "" } = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.parcelInspections, {
    params: removeEmptyParams({ onlyDiscrepancy, shipmentId }),
  });

  const data = getResponseData(response) || {};
  return {
    summary: { ...EMPTY_SUMMARY, ...(data?.summary || {}) },
    items: getArrayItems(data),
  };
};

/**
 * Toàn cảnh một lô: mọi kiện trong lô (GET /api/international-shipments/{id}) ghép với biên
 * bản kho đã đối chiếu — để OM thấy cả kiện khớp và kiện kho chưa đếm, không chỉ kiện lệch.
 */
export const getShipmentInspectionOverview = async (shipmentId) => {
  if (!shipmentId) return { parcels: [], shipmentCode: "" };

  /* Một nguồn hỏng thì vẫn dựng được phần còn lại, đừng để trắng cả drawer. */
  const [shipmentResult, inspectionResult] = await Promise.allSettled([
    getShipmentDetail(shipmentId),
    listParcelInspections({ onlyDiscrepancy: false, shipmentId }),
  ]);

  const shipment = shipmentResult.status === "fulfilled" ? shipmentResult.value : null;
  const inspections = inspectionResult.status === "fulfilled" ? inspectionResult.value.items : [];
  const byParcel = new Map(inspections.map((row) => [row.parcelId, row]));

  const source =
    shipment?.parcels?.length > 0
      ? shipment.parcels
      : inspections.map((row) => ({
          parcelId: row.parcelId,
          packageCode: row.packageCode,
          weight: row.declaredWeight,
          orderCode: row.orderCode,
          customerName: row.customerName,
        }));

  return {
    shipmentCode: shipment?.shipmentCode || inspections[0]?.shipmentCode || "",
    parcels: source.map((parcel) => {
      const inspection = byParcel.get(parcel.parcelId) || null;
      return {
        parcelId: parcel.parcelId,
        packageCode: parcel.packageCode,
        declaredWeight: parcel.weight,
        orderCode: parcel.orderCode || inspection?.orderCode || "",
        customerName: parcel.customerName || inspection?.customerName || "",
        customerPhone: inspection?.customerPhone || "",
        /* Ảnh tiếp nhận kho VN: lấy từ lô (có cả kiện chưa đếm) hoặc từ biên bản. */
        photos: parcel.arrivalPhotos || inspection?.photos || [],
        inspection,
      };
    }),
  };
};

export default { listParcelInspections, getConditionMeta, getShipmentInspectionOverview };
