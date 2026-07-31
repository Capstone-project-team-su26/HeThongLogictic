import axiosInstance from "../axiosInstance";
import { getAdminApiData, getAdminApiError, getAdminApiList } from "../AdminAPI/adminService";
import {
  buildConsolidationSummary,
  countConsolidationParcels,
  getConsolidationStatusMeta,
} from "./operationsMappers";

export {
  buildConsolidationSummary,
  countConsolidationParcels,
  getConsolidationStatusMeta,
  getAdminApiError as getOperationsApiError,
};

export async function createOperationalConsolidation(orderIds) {
  const ids = [...new Set((orderIds ?? []).filter(Boolean))];
  if (!ids.length) throw new Error("Cần chọn ít nhất một lô hàng.");

  const response = await axiosInstance.post("/api/consolidation", {
    orderIds: ids,
    status: "waiting",
  });
  return getAdminApiData(response);
}

export async function listConsolidations({ status, search } = {}) {
  const params = {};
  if (status) params.status = status;
  if (search) params.search = search;

  const response = await axiosInstance.get("/api/consolidation", { params });
  const data = getAdminApiData(response);
  if (Array.isArray(data)) return data;
  return getAdminApiList(response);
}

export async function getConsolidationDetail(id) {
  if (!id) throw new Error("Thiếu id lô gom hàng.");
  const response = await axiosInstance.get(
    `/api/consolidation/${encodeURIComponent(id)}`
  );
  return getAdminApiData(response);
}
