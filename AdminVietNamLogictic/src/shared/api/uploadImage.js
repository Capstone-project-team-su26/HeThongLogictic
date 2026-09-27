/**
 * Upload ảnh — API THẬT (POST /api/uploads/images, UploadsController, [Authorize]).
 *
 * Backend: multipart field BẮT BUỘC là "files", JPG/PNG/WEBP (theo MIME), mỗi ảnh
 * ≤ 5MB, ≤ 10 ảnh/lần → { message, urls: string[] } đúng thứ tự file. 500 { message }
 * khi Cloudinary chưa cấu hình. Bản mock cũ (URL giả cdn.vietnamlogistic.vn) nằm ở
 * uploadImage.mock.js — không màn nào import.
 *
 * GỬI MỖI REQUEST MỘT ẢNH (như web khách): nginx trước API chặn body lớn bằng trang
 * HTML 413, gom 10 ảnh điện thoại vào một request là vượt ngay dù từng ảnh ≤ 5MB.
 *
 * HỢP ĐỒNG GIỮ NGUYÊN BẢN MOCK — component đọc đúng như vậy:
 * - uploadImage(file, onProgress)  → MỘT CHUỖI URL (ConsignmentOrder bóc URL từ chuỗi).
 * - uploadImages(files, onProgress) → OBJECT { success, message, count, url, urls,
 *   data: [{ url, fileName, contentType, size }] } (ConsignmentBuyOrder quét
 *   url/urls/data). Mỗi file đúng một URL, đúng thứ tự.
 * - uploadImageUrls(files, onProgress) → MẢNG URL (chat CSKH dùng qua chatImageUploadApi).
 * - onUploadProgress nhận phần trăm 0..100 của CẢ lượt (cộng dồn các ảnh).
 *
 * Chỉ nhận URL http(s) server trả. Mọi lỗi được đổi thành Error câu tiếng Việt (giữ
 * lỗi gốc ở `cause`): getApiErrorMessage của các màn in thẳng response.data nếu là
 * chuỗi, nên để lọt axios error 413 là toast hiện nguyên trang HTML của nginx.
 */
import { createHttpClient } from "@shared/api/httpClient";

/* ================= CONFIG ================= */

const UPLOAD_ENDPOINT = "/api/uploads/images";

/* Ảnh chụp điện thoại nặng: dài hơn timeout 30 giây của instance chung. */
const UPLOAD_TIMEOUT_MS = 120_000;

/* Khớp UploadsController.AllowedContentTypes / MaxFileSizeBytes / MaxFilesPerRequest. */
export const UPLOAD_ALLOWED_IMAGE_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const UPLOAD_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const UPLOAD_MAX_FILES_PER_BATCH = 10;

/* ================= FILE HELPERS ================= */

const getExtensionFromMimeType = (mimeType) => {
  const extensionMap = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensionMap[String(mimeType || "").trim().toLowerCase()] || "jpg";
};

const normalizeImageFile = (inputFile, index = 0) => {
  if (!inputFile) {
    throw new Error("Vui lòng chọn ảnh.");
  }

  if (typeof File !== "undefined" && inputFile instanceof File) {
    return inputFile;
  }

  if (typeof Blob !== "undefined" && inputFile instanceof Blob) {
    const mimeType = inputFile.type || "";

    return new File(
      [inputFile],
      `image-${Date.now()}-${index + 1}.${getExtensionFromMimeType(mimeType)}`,
      { type: mimeType },
    );
  }

  throw new Error("File ảnh không hợp lệ.");
};

const toRawFileList = (inputFiles) => {
  if (typeof FileList !== "undefined" && inputFiles instanceof FileList) {
    return Array.from(inputFiles);
  }

  if (Array.isArray(inputFiles)) {
    return inputFiles.filter(Boolean);
  }

  return inputFiles ? [inputFiles] : [];
};

/**
 * Kiểm TRƯỚC khi gửi đúng giới hạn backend, để ảnh HEIC / > 5MB / rỗng báo lỗi tiếng
 * Việt ngay thay vì tải lên xong mới bị 400/413. Ném Error, không gửi request nào.
 */
export const validateUploadImageFiles = (inputFiles) => {
  const rawFiles = toRawFileList(inputFiles);

  if (!rawFiles.length) {
    throw new Error("Vui lòng chọn ít nhất một ảnh.");
  }

  if (rawFiles.length > UPLOAD_MAX_FILES_PER_BATCH) {
    throw new Error(
      `Chỉ được upload tối đa ${UPLOAD_MAX_FILES_PER_BATCH} ảnh mỗi lần.`,
    );
  }

  return rawFiles.map((rawFile, index) => {
    const file = normalizeImageFile(rawFile, index);
    const label = file.name || index + 1;
    const mimeType = String(file.type || "").trim().toLowerCase();

    if (!UPLOAD_ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      throw new Error(`Ảnh "${label}": chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.`);
    }

    const size = Number(file.size);

    if (!(size > 0)) {
      throw new Error(`Ảnh "${label}" rỗng, vui lòng chọn ảnh khác.`);
    }

    if (size > UPLOAD_MAX_FILE_SIZE_BYTES) {
      throw new Error(`Ảnh "${label}": vượt quá dung lượng tối đa 5MB.`);
    }

    return file;
  });
};

/* ================= AXIOS INSTANCE ================= */

/* Tạo qua createHttpClient: cùng baseURL, token Bearer và quy tắc 401 của app. */
export const uploadAxios = createHttpClient({
  timeout: UPLOAD_TIMEOUT_MS,
  headers: {
    Accept: "text/plain, application/json, */*",
  },
});

const isHttpUrl = (value) => /^https?:\/\/\S+$/i.test(String(value ?? "").trim());

/** Backend trả { message, urls }; chấp nhận thêm { url } cho chắc. Chỉ giữ URL http(s). */
const extractServerUrls = (body) => {
  let list = [];

  if (Array.isArray(body?.urls)) list = body.urls;
  else if (Array.isArray(body?.data?.urls)) list = body.data.urls;
  else if (typeof body?.url === "string") list = [body.url];

  return list.map((url) => String(url ?? "").trim()).filter(isHttpUrl);
};

/** Đổi lỗi axios thành câu tiếng Việt, không để trang HTML của nginx lọt ra toast. */
const toUploadError = (error, file) => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const label = file?.name ? ` "${file.name}"` : "";
  const isHtml = typeof data === "string" && /^\s*</.test(data);

  let message;

  if (status === 413 || (isHtml && status >= 400)) {
    message = `Ảnh${label} quá lớn, máy chủ từ chối. Vui lòng chọn ảnh nhỏ hơn 5MB.`;
  } else if (typeof data?.message === "string" && data.message.trim()) {
    message = data.message.trim();
  } else if (status === 401) {
    message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi tải ảnh lên.";
  } else if (status === 403) {
    message = "Tài khoản của bạn không có quyền tải ảnh lên.";
  } else if (!error?.response) {
    message = `Không kết nối được máy chủ để tải ảnh${label}. Vui lòng kiểm tra mạng và thử lại.`;
  } else {
    message = `Tải ảnh${label} lên thất bại (mã ${status}). Vui lòng thử lại.`;
  }

  const wrapped = new Error(message, { cause: error });
  wrapped.status = status;

  return wrapped;
};

/* ================= CORE ================= */

/**
 * Upload lần lượt từng ảnh (mỗi request một ảnh) và trả MẢNG URL đúng thứ tự file.
 *
 * @param {File|Blob|FileList|Array<File|Blob>} inputFiles
 * @param {(percent: number) => void} [onUploadProgress]
 * @returns {Promise<string[]>}
 */
export const uploadImageUrls = async (inputFiles, onUploadProgress) => {
  const files = validateUploadImageFiles(inputFiles);
  const totalBytes = files.reduce((sum, file) => sum + Number(file.size), 0);
  const report = typeof onUploadProgress === "function" ? onUploadProgress : null;
  const urls = [];
  let doneBytes = 0;
  let lastPercent = -1;

  const emit = (bytes) => {
    if (!report || !(totalBytes > 0)) return;

    const percent = Math.min(100, Math.round((bytes * 100) / totalBytes));

    if (percent !== lastPercent) {
      lastPercent = percent;
      report(percent);
    }
  };

  for (const file of files) {
    const formData = new FormData();
    formData.append("files", file, file.name);

    let response;

    try {
      response = await uploadAxios.post(UPLOAD_ENDPOINT, formData, {
        onUploadProgress: (event) => {
          const total = Number(event?.total);
          const loaded = Number(event?.loaded);

          if (Number.isFinite(total) && total > 0 && Number.isFinite(loaded)) {
            /* Byte multipart nhỉnh hơn byte ảnh: quy về tỉ lệ rồi nhân cỡ ảnh. */
            emit(doneBytes + Math.min(1, loaded / total) * Number(file.size));
          }
        },
      });
    } catch (error) {
      throw toUploadError(error, file);
    }

    const [url] = extractServerUrls(response?.data);

    if (!url) {
      throw new Error(
        `Máy chủ không trả đường dẫn ảnh hợp lệ cho "${file.name}". Vui lòng thử lại.`,
      );
    }

    urls.push(url);
    doneBytes += Number(file.size);
    emit(doneBytes);
  }

  return urls;
};

/* ================= UPLOAD MULTIPLE IMAGES ================= */

/**
 * Upload một hoặc nhiều ảnh.
 *
 * @param {File|Blob|FileList|Array<File|Blob>} inputFiles
 * @param {(percent: number) => void} [onUploadProgress]
 * @returns {Promise<{success: boolean, message: string, count: number, url: string, urls: string[], data: Array<{url: string, fileName: string, contentType: string, size: number}>}>}
 */
export const uploadImages = async (inputFiles, onUploadProgress) => {
  const files = validateUploadImageFiles(inputFiles);
  const urls = await uploadImageUrls(files, onUploadProgress);

  return {
    success: true,
    message:
      urls.length > 1
        ? `Đã tải ${urls.length} ảnh lên thành công.`
        : "Đã tải ảnh lên thành công.",
    count: urls.length,
    url: urls[0],
    urls,
    data: urls.map((url, index) => ({
      url,
      fileName: files[index].name,
      contentType: files[index].type,
      size: files[index].size,
    })),
  };
};

/* ================= UPLOAD SINGLE IMAGE ================= */

/**
 * Upload một ảnh và trả về CHUỖI URL (cố ý không bọc object — xem đầu file).
 *
 * @param {File|Blob} inputFile
 * @param {(percent: number) => void} [onUploadProgress]
 * @returns {Promise<string>}
 */
export const uploadImage = async (inputFile, onUploadProgress) => {
  if (Array.isArray(inputFile) || (typeof FileList !== "undefined" && inputFile instanceof FileList)) {
    throw new Error("uploadImage chỉ nhận một ảnh; dùng uploadImages cho nhiều ảnh.");
  }

  const [url] = await uploadImageUrls([inputFile], onUploadProgress);

  return url;
};

export default uploadImage;
