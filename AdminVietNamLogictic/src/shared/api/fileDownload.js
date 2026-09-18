/* =========================================================
   fileDownload.js — tải file nhị phân (PDF, ảnh đính kèm) CÓ gửi Authorization.

   Vì sao không mở link trần (href / window.open thẳng URL API):
   - Phiếu xuất kho PDF, manifest lô, giấy tờ đính kèm đều nằm sau JWT; trình duyệt mở
     link trần sẽ không gắn Bearer → 401 và người dùng thấy trang lỗi JSON.
   - File đính kèm "riêng tư trên máy chủ, không có link công khai" (api-xuat-kho.md J1).
   Nên luôn đi qua httpClient (gắn token + xử lý 401 như mọi request khác), nhận Blob,
   rồi mở bằng object URL.

   Module này KHÔNG mang nghiệp vụ: chỉ biết "URL tương đối → Blob → mở / lưu". Endpoint
   cụ thể do tầng api/ của từng feature truyền vào.
   ========================================================= */

import httpClient from "@shared/api/httpClient";

/* Object URL giữ file trong bộ nhớ tab — thu hồi sau một phút, đủ để tab mới kịp đọc. */
const REVOKE_AFTER_MS = 60_000;

/*
 * Khi responseType = "blob", body lỗi ({ message }) của server cũng bị trả về dưới dạng Blob.
 * Đọc lại thành JSON và gắn vào error.response.data để các hàm getXxxApiError hiện đúng
 * câu tiếng Việt của server thay vì "[object Blob]".
 */
const unwrapBlobError = async (error) => {
  const data = error?.response?.data;

  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      const text = await data.text();
      try {
        error.response.data = JSON.parse(text);
      } catch {
        error.response.data = { message: text || undefined };
      }
    } catch {
      /* Không đọc được body thì giữ nguyên lỗi gốc. */
    }
  }

  return error;
};

/** Lấy tên file từ header Content-Disposition (nếu CORS cho đọc). */
const readFileName = (headers, fallback) => {
  const disposition =
    (typeof headers?.get === "function" && headers.get("content-disposition")) ||
    headers?.["content-disposition"] ||
    "";

  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* rơi xuống dạng thường */
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1] || fallback;
};

/**
 * Tải file về dạng Blob, có gắn Authorization.
 *
 * @param {string} url đường dẫn tương đối, ví dụ "/api/attachments/{id}/download"
 * @param {{ fileName?: string, signal?: AbortSignal }} [options]
 * @returns {Promise<{ blob: Blob, fileName: string, contentType: string }>}
 */
export const fetchFileBlob = async (url, { fileName = "tai-lieu", signal } = {}) => {
  try {
    const response = await httpClient.get(url, { responseType: "blob", signal });
    const blob = response?.data;

    return {
      blob,
      fileName: readFileName(response?.headers, fileName),
      contentType: blob?.type || "",
    };
  } catch (error) {
    throw await unwrapBlobError(error);
  }
};

const triggerSave = (objectUrl, fileName) => {
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

/**
 * Mở file trong tab mới (PDF/ảnh xem ngay được trên trình duyệt).
 *
 * Tab được mở NGAY lúc bấm (trước khi chờ mạng) — mở sau `await` sẽ bị trình chặn popup
 * coi là tự ý mở cửa sổ. Tab bị chặn thì lùi về tải file xuống.
 */
export const openFileInNewTab = async (url, { fileName = "tai-lieu" } = {}) => {
  const popup = typeof window !== "undefined" ? window.open("", "_blank") : null;

  try {
    const result = await fetchFileBlob(url, { fileName });
    const objectUrl = URL.createObjectURL(result.blob);

    if (popup && !popup.closed) {
      popup.location.href = objectUrl;
    } else {
      triggerSave(objectUrl, result.fileName);
    }

    setTimeout(() => URL.revokeObjectURL(objectUrl), REVOKE_AFTER_MS);
    return result;
  } catch (error) {
    if (popup && !popup.closed) popup.close();
    throw error;
  }
};

/** Tải file xuống máy (giữ tên gốc server trả nếu đọc được). */
export const saveFile = async (url, { fileName = "tai-lieu" } = {}) => {
  const result = await fetchFileBlob(url, { fileName });
  const objectUrl = URL.createObjectURL(result.blob);

  triggerSave(objectUrl, result.fileName);
  setTimeout(() => URL.revokeObjectURL(objectUrl), REVOKE_AFTER_MS);

  return result;
};

export default { fetchFileBlob, openFileInNewTab, saveFile };
