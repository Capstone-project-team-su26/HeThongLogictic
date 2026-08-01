import { getConsignmentsApi } from "../SaleAPI/ConsignmentAPI/consignmentService";
import { getAdminApiError } from "../AdminAPI/adminService";
import { buildOperationalAnalytics } from "./operationsMappers";

export { buildOperationalAnalytics };
export { getAdminApiError as getOperationsApiError };

/** Dashboard tổng hợp từ danh sách consignments (BE chưa có analytics riêng). */
export async function getOperationalDashboard(filters = {}) {
  const result = await getConsignmentsApi({
    pageNumber: 1,
    pageSize: 2000,
    sortBy: "createdAt",
    sortDir: "desc",
    ...filters,
  });

  const items = (result?.items ?? []).map((item) => ({
    ...item,
    id: item.id || item.orderId,
    orderId: item.orderId || item.id,
  }));

  return { ...result, items };
}
