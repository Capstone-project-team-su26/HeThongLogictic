import axios from "axios";
import { API_ENDPOINTS } from "../apiEndpoints";
import {
  expireAuthSession,
  getStoredAccessToken,
  isAccessTokenExpired,
} from "../../utils/Common/authSession";

/* ================= CONFIG ================= */

const DEFAULT_API_BASE_URL = "https://api-vcl.zushin.io.vn";

const getEnvValue = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\/+$/, "");
};

const UPLOAD_API_BASE_URL =
  getEnvValue(import.meta.env.VITE_UPLOAD_API_BASE_URL) ||
  getEnvValue(import.meta.env.VITE_API_BASE_URL) ||
  DEFAULT_API_BASE_URL;

/* ================= AXIOS INSTANCE ================= */

const uploadAxios = axios.create({
  baseURL: UPLOAD_API_BASE_URL,
  timeout: 60_000,
  headers: {
    /*
     * Swagger khai báo text/plain, nhưng API thực tế có thể trả JSON.
     * Chấp nhận cả hai để Axios xử lý đúng response.
     */
    Accept: "text/plain, application/json, */*",
  },
});

/* ================= REQUEST INTERCEPTOR ================= */

uploadAxios.interceptors.request.use(
  (config) => {
    const token = getStoredAccessToken();

    if (token && isAccessTokenExpired(token)) {
      expireAuthSession();

      const error = new Error(
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      );
      error.code = "AUTH_SESSION_EXPIRED";
      return Promise.reject(error);
    }

    config.headers = config.headers || {};

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    /*
     * Chỉ xóa Content-Type khi body là FormData.
     * Không tự đặt multipart/form-data vì trình duyệt phải tự thêm boundary.
     */
    if (
      typeof FormData !== "undefined" &&
      config.data instanceof FormData
    ) {
      if (typeof config.headers.delete === "function") {
        config.headers.delete("Content-Type");
        config.headers.delete("content-type");
      } else {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/* ================= RESPONSE INTERCEPTOR ================= */

uploadAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(
      "[UploadImage] API error:",
      error?.response || error,
    );

    const status = error?.response?.status;

    if (status === 401) {
      expireAuthSession();
    }

    return Promise.reject(error);
  },
);

/* ================= FILE HELPERS ================= */

const getExtensionFromMimeType = (mimeType) => {
  const normalizedMimeType = String(mimeType || "")
    .trim()
    .toLowerCase();

  const extensionMap = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };

  return extensionMap[normalizedMimeType] || "jpg";
};

const normalizeImageFile = (inputFile, index = 0) => {
  if (!inputFile) {
    throw new Error("Vui lòng chọn ảnh.");
  }

  if (
    typeof File !== "undefined" &&
    inputFile instanceof File
  ) {
    return inputFile;
  }

  if (
    typeof Blob !== "undefined" &&
    inputFile instanceof Blob
  ) {
    const mimeType = inputFile.type || "image/jpeg";
    const extension = getExtensionFromMimeType(mimeType);

    return new File(
      [inputFile],
      `image-${Date.now()}-${index + 1}.${extension}`,
      {
        type: mimeType,
      },
    );
  }

  throw new Error("File ảnh không hợp lệ.");
};

const normalizeImageFiles = (inputFiles) => {
  let rawFiles = [];

  if (
    typeof FileList !== "undefined" &&
    inputFiles instanceof FileList
  ) {
    rawFiles = Array.from(inputFiles);
  } else if (Array.isArray(inputFiles)) {
    rawFiles = inputFiles;
  } else if (inputFiles) {
    rawFiles = [inputFiles];
  }

  if (!rawFiles.length) {
    throw new Error("Vui lòng chọn ít nhất một ảnh.");
  }

  return rawFiles.map((file, index) => {
    const normalizedFile = normalizeImageFile(file, index);

    if (!normalizedFile.type?.startsWith("image/")) {
      throw new Error(
        `File "${normalizedFile.name || index + 1}" không phải là hình ảnh.`,
      );
    }

    return normalizedFile;
  });
};

/* ================= ERROR HELPER ================= */

const getUploadErrorMessage = (error) => {
  const status = error?.response?.status;
  const responseData = error?.response?.data;

  if (
    typeof responseData === "string" &&
    responseData.trim()
  ) {
    return responseData.trim();
  }

  if (typeof responseData?.message === "string") {
    return responseData.message;
  }

  if (typeof responseData?.error === "string") {
    return responseData.error;
  }

  if (typeof responseData?.title === "string") {
    return responseData.title;
  }

  if (responseData?.errors) {
    return Object.entries(responseData.errors)
      .map(([field, messages]) => {
        const content = Array.isArray(messages)
          ? messages.join(", ")
          : String(messages);

        return `${field}: ${content}`;
      })
      .join(" | ");
  }

  if (status === 400) {
    return (
      "Dữ liệu ảnh gửi lên không hợp lệ. " +
      "Vui lòng kiểm tra file ảnh và định dạng multipart gửi lên."
    );
  }

  if (status === 401) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }

  if (status === 403) {
    return "Bạn không có quyền tải ảnh lên.";
  }

  if (status === 404) {
    return "Không tìm thấy API upload ảnh. Vui lòng kiểm tra endpoint.";
  }

  if (status === 413) {
    return "Dung lượng ảnh vượt quá giới hạn máy chủ cho phép.";
  }

  if (status === 415) {
    return (
      "Máy chủ không hỗ trợ định dạng ảnh hoặc request multipart chưa đúng."
    );
  }

  if (status >= 500) {
    return "Máy chủ gặp lỗi khi xử lý ảnh.";
  }

  return error?.message || "Tải ảnh lên thất bại.";
};

/* ================= UPLOAD MULTIPLE IMAGES ================= */

/**
 * Upload một hoặc nhiều ảnh.
 *
 * Swagger/cURL yêu cầu:
 * - Endpoint: POST /api/uploads/images
 * - multipart field: files
 *
 * @param {File|Blob|FileList|Array<File|Blob>} inputFiles
 * @param {(percent: number) => void} onUploadProgress
 * @returns {Promise<any>} Dữ liệu gốc API trả về.
 */
export const uploadImages = async (
  inputFiles,
  onUploadProgress,
) => {
  const files = normalizeImageFiles(inputFiles);
  const formData = new FormData();

  /*
   * Quan trọng: tên field phải là "files", không phải "file".
   * Nhiều file được append lặp lại cùng một key "files".
   */
  files.forEach((file) => {
    formData.append(
      "files",
      file,
      file.name || `image-${Date.now()}.jpg`,
    );
  });

  try {
    const response = await uploadAxios.post(
      API_ENDPOINTS.uploads.images,
      formData,
      {
        onUploadProgress: (progressEvent) => {
          if (
            typeof onUploadProgress !== "function" ||
            !progressEvent.total
          ) {
            return;
          }

          const percent = Math.min(
            100,
            Math.round(
              (progressEvent.loaded * 100) /
                progressEvent.total,
            ),
          );

          onUploadProgress(percent);
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error("[UploadImage] Upload failed:", {
      status: error?.response?.status,
      responseData: error?.response?.data,
      message: error?.message,
    });

    throw new Error(getUploadErrorMessage(error), { cause: error });
  }
};

/* ================= UPLOAD SINGLE IMAGE ================= */


export const uploadImage = async (
  inputFile,
  onUploadProgress,
) => {
  const file = normalizeImageFile(inputFile);

  if (!file.type?.startsWith("image/")) {
    throw new Error(`File "${file.name || "đã chọn"}" không phải là hình ảnh.`);
  }

  const formData = new FormData();
  formData.append("file", file, file.name || `image-${Date.now()}.jpg`);

  try {
    const response = await uploadAxios.post(
      API_ENDPOINTS.uploads.image,
      formData,
      {
        onUploadProgress: (progressEvent) => {
          if (typeof onUploadProgress !== "function" || !progressEvent.total) {
            return;
          }

          onUploadProgress(
            Math.min(
              100,
              Math.round((progressEvent.loaded * 100) / progressEvent.total),
            ),
          );
        },
      },
    );

    return response.data;
  } catch (error) {
    throw new Error(getUploadErrorMessage(error), { cause: error });
  }
};

export { uploadAxios };

export default uploadImage;
