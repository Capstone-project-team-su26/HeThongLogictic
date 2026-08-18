/**
 * Biên bản kiểm đếm kiện tại kho VN — phần chênh lệch so với khai báo.
 *
 * Hệ thống chỉ GHI NHẬN. Việc đòi hãng vận chuyển hay đền khách do OM xử lý bên ngoài, nên ở
 * đây không có thao tác duyệt hay đóng hồ sơ — chỉ đọc và lọc.
 */

import axiosInstance from "../axiosInstance";
import { getAdminApiData, getAdminApiError } from "../AdminAPI/adminService";
import { getShipmentDetail } from "./consolidationWorkflowService";

export { getAdminApiError as getInspectionApiError };

const ENDPOINT = "/api/parcel-inspections";

export const CONDITION_META = Object.freeze({
  INTACT: { label: "Nguyên vẹn", tone: "success" },
  MISSING: { label: "Thiếu hàng", tone: "error" },
  DAMAGED: { label: "Hư hỏng", tone: "error" },
  WET: { label: "Ẩm ướt", tone: "warning" },
  SEAL_BROKEN: { label: "Rách niêm phong", tone: "warning" },
});

export const getConditionMeta = (condition) =>
  CONDITION_META[String(condition || "").toUpperCase()] || {
    label: condition || "Không ghi nhận",
    tone: "default",
  };

const emptyList = () => ({
  summary: { total: 0, withDiscrepancy: 0, recentDiscrepancy: 0, damagedParcels: 0 },
  items: [],
});

/**
 * @param {{ onlyDiscrepancy?: boolean, shipmentId?: string }} options
 * Mặc định chỉ lấy biên bản có lệch — đó là thứ OM mở màn này để xem.
 */
export const listParcelInspections = async ({
  onlyDiscrepancy = true,
  shipmentId = "",
} = {}) => {
  const params = { onlyDiscrepancy };
  if (shipmentId) params.shipmentId = shipmentId;

  const response = await axiosInstance.get(ENDPOINT, { params });
  const data = getAdminApiData(response);

  if (!data) return emptyList();

  return {
    summary: { ...emptyList().summary, ...(data.summary || {}) },
    items: Array.isArray(data.items) ? data.items : [],
  };
};

/**
 * Toàn cảnh một lô: mọi kiện trong lô, kèm kết quả kho đã đối chiếu (nếu có).
 *
 * Danh sách chính chỉ hiện kiện LỆCH, nên OM không biết lô đó còn bao nhiêu kiện khớp và
 * bao nhiêu kiện kho chưa đếm. Hàm này ghép hai nguồn để trả lời đúng câu đó.
 */
export const getShipmentInspectionOverview = async (shipmentId) => {
  if (!shipmentId) return { parcels: [], shipmentCode: "" };

  // Một nguồn hỏng thì vẫn dựng được phần còn lại, đừng để trắng cả drawer.
  const [shipmentResult, inspectionResult] = await Promise.allSettled([
    getShipmentDetail(shipmentId),
    listParcelInspections({ onlyDiscrepancy: false, shipmentId }),
  ]);

  const shipment = shipmentResult.status === "fulfilled" ? shipmentResult.value : null;
  const inspections =
    inspectionResult.status === "fulfilled" ? inspectionResult.value.items : [];

  const byParcel = new Map(inspections.map((row) => [row.parcelId, row]));

  // Lấy danh sách kiện từ lô; lô không tải được thì lùi về đúng những kiện đã có biên bản.
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
        // Lô là nguồn chuẩn; biên bản chỉ dùng bù khi lô không trả về thông tin đơn/khách.
        orderCode: parcel.orderCode || inspection?.orderCode || "",
        customerName: parcel.customerName || inspection?.customerName || "",
        customerPhone: inspection?.customerPhone || "",
        inspection,
      };
    }),
  };
};

export default { listParcelInspections, getConditionMeta, getShipmentInspectionOverview };
