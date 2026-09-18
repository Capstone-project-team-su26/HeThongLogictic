import { API_BASE_URL } from "@shared/api/httpClient";

const PUBLIC_RECEIPT_PATH = "/api/public/receipts/";

/**
 * Link PDF phiếu nhập kho (`receiptPdfUrl`), đổi host về base URL đang dùng.
 *
 * Server trả link theo cấu hình cũ (https://api-vcl.zushin.io.vn/...) — bản deploy
 * code cũ. Giữ nguyên path /api/public/receipts/{publicKey}, chỉ thay host. Link công
 * khai, không cần đăng nhập; `download: true` thêm ?download=true để tải file.
 *
 * @param {string|null|undefined} url
 * @param {{ download?: boolean }} [options]
 * @returns {string|null}
 */
export const toPublicReceiptUrl = (url, { download = false } = {}) => {
  const raw = String(url || "").trim();

  if (!raw) return null;

  let parsed;

  try {
    parsed = new URL(raw, API_BASE_URL);
  } catch {
    return null;
  }

  const pathIndex = parsed.pathname.indexOf(PUBLIC_RECEIPT_PATH);

  if (pathIndex < 0) return raw;

  const result = new URL(parsed.pathname.slice(pathIndex), API_BASE_URL);

  if (download) result.searchParams.set("download", "true");

  return result.toString();
};

export default toPublicReceiptUrl;
