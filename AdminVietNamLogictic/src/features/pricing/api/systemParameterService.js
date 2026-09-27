/**
 * THAM SỐ VẬN HÀNH — API THẬT cho trang Admin chỉnh các con số điều khiển nghiệp vụ.
 *
 * VÌ SAO CÓ MODULE RIÊNG
 * Các con số này nằm ở HAI bảng khác nhau và backend đọc mỗi con số từ đúng một bảng:
 *
 *   ADDITIONAL_SERVICE_FEES  →  DEPOSIT_RATE, PURCHASE_PRICE_TOLERANCE_RATE,
 *                               PURCHASE_CANCEL_FEE_RATE
 *   PRICING_RULES            →  VOLUMETRIC_DIVISOR, VAT, IMPORT_TAX, phụ phí theo kiện,
 *                               phí mua hộ
 *
 * Trang danh mục cũ của Admin gộp hai bảng làm một và ghi tất cả vào PRICING_RULES, nên
 * sửa "tỷ lệ cọc" ở đó thì số trên màn hình đổi mà hệ thống vẫn thu theo giá trị cũ.
 * Module này giữ bản đồ mã → bảng ở một chỗ và LUÔN ghi vào đúng bảng.
 *
 * VÌ SAO KHÔNG PATCH TỪNG TRƯỜNG
 * Cả hai endpoint PUT đều nhận NGUYÊN bản ghi (tên, mã, cách tính, trạng thái… đều
 * [Required]). Nên mỗi lần lưu là đọc bản ghi hiện tại, ghép giá trị mới vào, rồi gửi cả
 * bản ghi. Không tự bịa trường thiếu: thiếu thì backend trả 400 và người dùng thấy lý do.
 *
 * ĐIỀU QUAN TRỌNG THỨ BA: THAM SỐ CÓ THỂ CHƯA TỒN TẠI
 * Production hiện không có dòng PURCHASE_PRICE_TOLERANCE_RATE lẫn PURCHASE_CANCEL_FEE_RATE
 * — backend đang chạy bằng giá trị mặc định trong mã nguồn (5% và 0%). Lần Admin lưu đầu
 * tiên phải TẠO dòng (POST), các lần sau mới là sửa (PUT). Màn hình phân biệt hai trạng
 * thái đó để người dùng biết con số đang là "mặc định" hay "đã cấu hình".
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getResponseData } from "@shared/api/apiEnvelope";

/* =========================
   NGUỒN DỮ LIỆU
========================= */

/** Bảng ADDITIONAL_SERVICE_FEES. */
export const SOURCE_FEE = "fee";

/** Bảng PRICING_RULES. */
export const SOURCE_RULE = "rule";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const trimText = (value) => String(value ?? "").trim();

const sameCode = (a, b) =>
  trimText(a).toUpperCase() === trimText(b).toUpperCase();

const getArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

/* =========================
   ĐỌC
========================= */

/**
 * Một bản ghi tham số, đã chuẩn hoá về cùng một hình dạng bất kể nằm ở bảng nào.
 * `raw` giữ nguyên bản ghi backend trả về để lúc ghi còn gửi lại đủ trường.
 */
const normalizeFee = (fee = {}) => ({
  source: SOURCE_FEE,
  id: fee.id ?? fee.feeId ?? null,
  code: trimText(fee.feeCode),
  name: trimText(fee.feeName),
  calculationType: trimText(fee.calculationType) || "FIXED",
  value: toNumber(fee.value),
  unit: trimText(fee.unit),
  isActive: fee.isActive !== false,
  description: trimText(fee.description),
  conditionType: "",
  conditionValue: "",
  updatedAt: fee.updatedAt ?? null,
  raw: fee,
});

const normalizeRule = (rule = {}) => ({
  source: SOURCE_RULE,
  id: rule.id ?? rule.pricingRuleId ?? null,
  code: trimText(rule.ruleCode),
  name: trimText(rule.ruleName),
  calculationType: trimText(rule.calculationType) || "FIXED",
  value: toNumber(rule.value),
  unit: "",
  isActive: trimText(rule.status).toUpperCase() === "ACTIVE",
  description: trimText(rule.description),
  conditionType: trimText(rule.conditionType),
  conditionValue: trimText(rule.conditionValue),
  updatedAt: rule.updatedAt ?? null,
  raw: rule,
});

/**
 * Đọc CẢ HAI bảng một lượt.
 *
 * Gọi song song và để Promise.all ném lỗi: thiếu một trong hai bảng thì màn hình sẽ
 * hiển thị sai một nửa số tham số mà người dùng không biết — thà báo lỗi hẳn.
 */
export const getSystemParametersApi = async ({ signal } = {}) => {
  const [feeResponse, ruleResponse] = await Promise.all([
    httpClient.get(API_ENDPOINTS.additionalServiceFees.list, { signal }),
    httpClient.get(API_ENDPOINTS.pricingRules.list, { signal }),
  ]);

  const fees = getArray(getResponseData(feeResponse))
    .map(normalizeFee)
    .filter((item) => item.code);

  const rules = getArray(getResponseData(ruleResponse))
    .map(normalizeRule)
    .filter((item) => item.code);

  return [...fees, ...rules];
};

/** Tìm bản ghi của một mã trong đúng bảng của nó. */
export const findParameterRecord = (records = [], { code, source }) =>
  records.find(
    (record) => record.source === source && sameCode(record.code, code),
  ) || null;

/* =========================
   GHI
========================= */

/**
 * Lưu giá trị mới.
 *
 * `definition` là mô tả tham số lấy từ bảng hằng của màn hình (mã, bảng, tên hiển thị,
 * cách tính, đơn vị) — dùng khi phải TẠO dòng mới. `record` là bản ghi đang có, null khi
 * hệ thống còn chạy bằng giá trị mặc định.
 */
export const saveSystemParameterApi = async ({
  definition,
  record = null,
  value,
  conditionValue,
  isActive = true,
}) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error("Giá trị phải là số không âm.");
  }

  if (definition.source === SOURCE_FEE) {
    const body = {
      feeName: record?.name || definition.label,
      feeCode: definition.code,
      calculationType:
        record?.calculationType || definition.calculationType || "FIXED",
      value: numericValue,
      unit: record?.unit || definition.unit || "",
      isActive,
      description: record?.description || definition.affects || "",
    };

    const response = record?.id
      ? await httpClient.put(
          API_ENDPOINTS.additionalServiceFees.detail(record.id),
          body,
        )
      : await httpClient.post(API_ENDPOINTS.additionalServiceFees.list, body);

    return getResponseData(response);
  }

  /*
   * PRICING_RULES: PUT đòi nguyên bản ghi. Không có bản ghi cũ thì KHÔNG tạo mới ở đây —
   * một quy tắc tính giá còn cần servicePricingId, ruleType, min/max… mà màn tham số
   * không hỏi. Thiếu thì người dùng vào danh mục quy tắc tạo trước.
   */
  if (!record?.id) {
    throw new Error(
      `Chưa có quy tắc ${definition.code} trong bảng giá. Vào Danh mục › Quy tắc tính giá để tạo trước.`,
    );
  }

  const raw = record.raw || {};
  const body = {
    servicePricingId: raw.servicePricingId ?? null,
    ruleName: record.name || definition.label,
    ruleCode: definition.code,
    ruleType: trimText(raw.ruleType) || definition.code,
    conditionType: record.conditionType || null,
    conditionValue:
      conditionValue === undefined
        ? record.conditionValue || null
        : trimText(conditionValue) || null,
    calculationType: record.calculationType,
    value: numericValue,
    minAmount: raw.minAmount ?? null,
    maxAmount: raw.maxAmount ?? null,
    isRequired: Boolean(raw.isRequired),
    status: isActive ? "ACTIVE" : "INACTIVE",
    description: record.description || definition.affects || "",
  };

  const response = await httpClient.put(
    API_ENDPOINTS.pricingRules.detail(record.id),
    body,
  );

  return getResponseData(response);
};

/** Thông điệp lỗi backend, rơi về câu chung khi không có gì đọc được. */
export const getSystemParameterApiError = (
  error,
  fallback = "Không lưu được tham số.",
) => {
  const data = error?.response?.data;

  if (typeof data === "string" && data.trim()) return data.trim();
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message.trim();
  }
  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

export default {
  getSystemParametersApi,
  findParameterRecord,
  saveSystemParameterApi,
  getSystemParameterApiError,
  SOURCE_FEE,
  SOURCE_RULE,
};
