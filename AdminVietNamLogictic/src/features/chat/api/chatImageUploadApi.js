/* =========================================================
   chatImageUploadApi.js — upload ảnh đính kèm chat CSKH phía nhân viên.

   Từ 27/09/2026 chỉ là lớp mỏng trên @shared/api/uploadImage (đã là API THẬT
   POST /api/uploads/images): kiểm định dạng/dung lượng, gửi mỗi request một ảnh, đổi
   413/HTML thành câu tiếng Việt, chỉ nhận URL http(s) — tất cả nằm ở shared, không
   lặp lại ở đây. Mỗi tin nhắn chat chỉ lưu MỘT attachmentUrl (≤ 500 ký tự).

   Giữ nguyên tên export cũ để màn chat, barrel và tools/verify-api.mjs không đổi:
   uploadChatImages(files, onUploadProgress) trả MẢNG URL đúng thứ tự file.
   ========================================================= */

import {
  UPLOAD_MAX_FILE_SIZE_BYTES,
  uploadAxios,
  uploadImageUrls,
} from "@shared/api/uploadImage";

export const CHAT_IMAGE_MAX_SIZE_BYTES = UPLOAD_MAX_FILE_SIZE_BYTES;

/* Cùng một instance với shared (timeout dài, token Bearer, quy tắc 401). */
export const chatUploadAxios = uploadAxios;

/**
 * Upload ảnh đính kèm chat.
 *
 * @param {File|Blob|FileList|Array<File|Blob>} inputFiles
 * @param {(percent: number) => void} [onUploadProgress]
 * @returns {Promise<string[]>} URL ảnh theo đúng thứ tự file.
 */
export const uploadChatImages = (inputFiles, onUploadProgress) =>
  uploadImageUrls(inputFiles, onUploadProgress);

export default uploadChatImages;
