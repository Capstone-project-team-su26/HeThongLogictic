/*
 * Danh mục vận chuyển — ĐÃ NỐI API THẬT: hãng vận chuyển + tuyến vận chuyển (Admin).
 *
 *   GET    /api/carriers              → MẢNG TRẦN CarrierDto (chỉ Admin)
 *   GET    /api/carriers/{id}         → object trần
 *   POST   /api/carriers              PUT /api/carriers/{id}      DELETE /api/carriers/{id}
 *   GET    /api/shipping-routes       → { message, data: ShippingRouteDto[] }
 *   GET    /api/shipping-routes/{id}  → { message, data }
 *   POST   /api/shipping-routes       PUT /api/shipping-routes/{id}   DELETE /api/shipping-routes/{id}
 *
 * Tuyến là gốc của phiếu xuất kho: kho nguồn + kho đích của phiếu lấy từ tuyến, nên tuyến phải
 * có ĐỦ hai kho (thiếu thì lập phiếu xuất bị 400) — chặn trước khi lưu.
 *
 * Tách khỏi adminService (vẫn là mock) vì màn mua hộ ConfirmPurchaseModal còn đọc tuyến mock
 * khớp với kho mock của nó; đổi chung sẽ làm hỏng luồng mua hộ nằm ngoài đợt này.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getArrayItems, getResponseData } from "@shared/api/apiEnvelope";

const trimText = (value) => String(value ?? "").trim();

const requireId = (value, label) => {
  const id = trimText(value);
  if (!id) throw new Error(`Không tìm thấy ${label}.`);
  return id;
};

/* ==================== HÃNG VẬN CHUYỂN ==================== */

const toCarrierPayload = (payload = {}) => ({
  carrierName: trimText(payload.carrierName),
  carrierCode: trimText(payload.carrierCode),
  carrierType: trimText(payload.carrierType),
  apiUrl: trimText(payload.apiUrl) || null,
  contactEmail: trimText(payload.contactEmail) || null,
  contactPhone: trimText(payload.contactPhone) || null,
  supportedShippingMethods: trimText(payload.supportedShippingMethods) || null,
  supportedRegions: trimText(payload.supportedRegions) || null,
  internalNotes: trimText(payload.internalNotes) || null,
  isActive: payload.isActive !== false,
});

export const getCarriersApi = async () => {
  const response = await httpClient.get(API_ENDPOINTS.carriers.list);
  return getArrayItems(getResponseData(response));
};

export const getActiveCarriersApi = async () => {
  const response = await httpClient.get(API_ENDPOINTS.carriers.active);
  return getArrayItems(getResponseData(response));
};

export const getCarrierDetailApi = async (carrierId) => {
  const response = await httpClient.get(
    API_ENDPOINTS.carriers.detail(requireId(carrierId, "mã đơn vị vận chuyển")),
  );
  return getResponseData(response);
};

export const createCarrierApi = async (payload) => {
  const response = await httpClient.post(API_ENDPOINTS.carriers.list, toCarrierPayload(payload));
  return getResponseData(response);
};

export const updateCarrierApi = async (carrierId, payload) => {
  const response = await httpClient.put(
    API_ENDPOINTS.carriers.detail(requireId(carrierId, "mã đơn vị vận chuyển")),
    toCarrierPayload(payload),
  );
  return getResponseData(response);
};

export const deleteCarrierApi = async (carrierId) => {
  const response = await httpClient.delete(
    API_ENDPOINTS.carriers.detail(requireId(carrierId, "mã đơn vị vận chuyển")),
  );
  return getResponseData(response);
};

/* ==================== TUYẾN VẬN CHUYỂN ==================== */

const toRoutePayload = (payload = {}) => {
  const originWarehouseId = trimText(payload.originWarehouseId);
  const destinationWarehouseId = trimText(payload.destinationWarehouseId);
  if (!originWarehouseId || !destinationWarehouseId) {
    throw new Error("Tuyến phải có cả kho đi và kho đến — phiếu xuất kho lấy hai kho này từ tuyến.");
  }

  const days = payload.estimatedTransitDays;
  return {
    routeCode: trimText(payload.routeCode),
    routeName: trimText(payload.routeName),
    originCountry: trimText(payload.originCountry),
    destinationCountry: trimText(payload.destinationCountry),
    originWarehouseId,
    destinationWarehouseId,
    transportMode: trimText(payload.transportMode).toUpperCase(),
    carrierId: trimText(payload.carrierId) || null,
    estimatedTransitDays: days === "" || days === null || days === undefined ? null : Number(days),
    note: trimText(payload.note),
    isActive: payload.isActive !== false,
  };
};

export const getShippingRoutesApi = async (params = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.shippingRoutes.list, { params });
  return getArrayItems(getResponseData(response));
};

export const getShippingRouteDetailApi = async (routeId) => {
  const response = await httpClient.get(
    API_ENDPOINTS.shippingRoutes.detail(requireId(routeId, "mã tuyến vận chuyển")),
  );
  return getResponseData(response);
};

export const createShippingRouteApi = async (payload) => {
  const response = await httpClient.post(API_ENDPOINTS.shippingRoutes.list, toRoutePayload(payload));
  return getResponseData(response);
};

export const updateShippingRouteApi = async (routeId, payload) => {
  const response = await httpClient.put(
    API_ENDPOINTS.shippingRoutes.detail(requireId(routeId, "mã tuyến vận chuyển")),
    toRoutePayload(payload),
  );
  return getResponseData(response);
};

export const deleteShippingRouteApi = async (routeId) => {
  const response = await httpClient.delete(
    API_ENDPOINTS.shippingRoutes.detail(requireId(routeId, "mã tuyến vận chuyển")),
  );
  return getResponseData(response);
};

export default {
  getCarriersApi,
  getActiveCarriersApi,
  getCarrierDetailApi,
  createCarrierApi,
  updateCarrierApi,
  deleteCarrierApi,
  getShippingRoutesApi,
  getShippingRouteDetailApi,
  createShippingRouteApi,
  updateShippingRouteApi,
  deleteShippingRouteApi,
};
