/**
 * MOCK upload ảnh — bản chỉ-giao-diện, đã gỡ hẳn tầng HTTP.
 *
 * Bản thật dựng một axios instance riêng (Authorization từ authSession, xoá
 * Content-Type khi body là FormData) rồi POST multipart lên
 * API_ENDPOINTS.uploads.image / .images và trả về response.data. Ở đây không còn
 * mạng: file người dùng chọn chỉ được kiểm định dạng, ghi vào thư viện ảnh trong
 * bộ nhớ, rồi nhận một URL CDN giả trên cdn.vietnamlogistic.vn — cùng host với
 * ảnh và chứng từ đang có trong src/mocks/data/, để mọi màn trông đồng bộ.
 *
 * HAI HÀM TRẢ VỀ HAI KIỂU KHÁC NHAU, và khác nhau là CỐ Ý vì component đọc đúng
 * như vậy — đổi cho "gọn" là màn hình hỏng ngay lúc chạy:
 *
 * - uploadImage() trả về MỘT CHUỖI URL. ConfirmPurchaseModal gán thẳng
 *   `url: await uploadImage(file)` vào item ảnh, nên trả object là thẻ <img> hỏng.
 *   WroShippingRouteModal cũng có nhánh `typeof res === "string" ? res : ...`.
 *
 * - uploadImages() trả về OBJECT { success, url, urls, data: [{ url, ... }] }.
 *   WroShippingRouteModal đọc res.data[0].url (chỉ khi res.data LÀ MẢNG),
 *   ShipmentDetailModal quét url/data/urls và chỉ nhận chuỗi bắt đầu bằng http(s),
 *   CustomerServiceChat lấy response.data rồi gom trường `url` của từng phần tử và
 *   ĐỐI CHIẾU SỐ LƯỢNG với số file gửi lên. Vì vậy mỗi file phải sinh đúng một URL
 *   riêng biệt, không trùng nhau, và đúng thứ tự file — kể cả khi người dùng chọn
 *   hai file giống tên.
 *
 * Giữ nguyên phần kiểm tra file (kèm nguyên văn thông báo tiếng Việt) và callback
 * tiến độ, vì thanh % của các modal và toast lỗi đang dựa vào chúng.
 *
 * CẮM API THẬT TRỞ LẠI: dựng lại axios instance như bản gốc, rồi trong hai hàm
 * dưới đây thay khối "giả lập" bằng POST API_ENDPOINTS.uploads.image / .images với
 * FormData field "file" / "files" và onUploadProgress của axios. Phần chuẩn hoá
 * file (normalizeImageFile / normalizeImageFiles) dùng lại được nguyên vẹn.
 */
import {
  delay,
  isoDaysAgo,
  nextId,
  nowIso,
} from "@/mocks/mockUtils";

/* ================= CONFIG ================= */

/*
 * Host giả, trùng với ảnh/chứng từ trong src/mocks/data/ nên không có request nào
 * đi ra ngoài: URL chỉ để hiển thị và để lưu vào payload đơn hàng.
 */
const MOCK_CDN_BASE_URL =
  "https://cdn.vietnamlogistic.vn/uploads";

/* Đặt khi tên file không còn ký tự nào dùng được sau khi bỏ dấu. */
const FALLBACK_SLUGS = [
  "anh-san-pham",
  "bang-chung-mua-hang",
  "anh-kien-hang",
  "anh-chung-tu",
  "anh-xuat-kho",
  "anh-dong-goi",
];

/* ================= FIXTURE TRONG BỘ NHỚ ================= */

/*
 * Thư viện ảnh đã upload của phiên làm việc.
 *
 * Upload là hành vi GHI: mỗi lần gọi phải để lại dấu vết, nếu không thì màn nào
 * mở lại cũng như chưa từng có ai tải ảnh lên. Seed sẵn vài bản ghi cũ để hình
 * dạng bản ghi tự nói lên nó, và để danh sách không rỗng ngay từ đầu phiên.
 */
const uploadedImageLibrary = [
  {
    id: "IMG-20260901084512-118372",
    fileName: "anh-san-pham-ao-khoac-gio-01.jpg",
    contentType: "image/jpeg",
    size: 428_915,
    width: 1200,
    height: 1200,
    url: `${MOCK_CDN_BASE_URL}/2026/09/anh-san-pham-ao-khoac-gio-01-118372.jpg`,
    uploadedAt: isoDaysAgo(3),
    uploadedBy: "Nguyễn Thị Hồng Nhung",
    relatedCode: "PUR-20260901084455-118372",
  },
  {
    id: "IMG-20260901084530-226194",
    fileName: "anh-san-pham-ao-khoac-gio-02.jpg",
    contentType: "image/jpeg",
    size: 511_204,
    width: 1200,
    height: 1600,
    url: `${MOCK_CDN_BASE_URL}/2026/09/anh-san-pham-ao-khoac-gio-02-226194.jpg`,
    uploadedAt: isoDaysAgo(3),
    uploadedBy: "Nguyễn Thị Hồng Nhung",
    relatedCode: "PUR-20260901084455-118372",
  },
  {
    id: "IMG-20260830143017-334016",
    fileName: "bang-chung-mua-hang-1688.png",
    contentType: "image/png",
    size: 786_330,
    width: 1440,
    height: 900,
    url: `${MOCK_CDN_BASE_URL}/2026/08/bang-chung-mua-hang-1688-334016.png`,
    uploadedAt: isoDaysAgo(5),
    uploadedBy: "Trần Quốc Bảo",
    relatedCode: "PUR-20260830142901-334016",
  },
  {
    id: "IMG-20260830143102-441838",
    fileName: "bang-chung-thanh-toan-alipay.png",
    contentType: "image/png",
    size: 654_112,
    width: 1366,
    height: 768,
    url: `${MOCK_CDN_BASE_URL}/2026/08/bang-chung-thanh-toan-alipay-441838.png`,
    uploadedAt: isoDaysAgo(5),
    uploadedBy: "Trần Quốc Bảo",
    relatedCode: "PUR-20260830142901-334016",
  },
  {
    id: "IMG-20260828101244-549660",
    fileName: "anh-kien-hang-truoc-dong-goi.jpg",
    contentType: "image/jpeg",
    size: 372_480,
    width: 1080,
    height: 1440,
    url: `${MOCK_CDN_BASE_URL}/2026/08/anh-kien-hang-truoc-dong-goi-549660.jpg`,
    uploadedAt: isoDaysAgo(7),
    uploadedBy: "Lê Minh Khoa",
    relatedCode: "PCL-20260828101130-549660",
  },
  {
    id: "IMG-20260828101320-657482",
    fileName: "anh-kien-hang-sau-dong-goi.jpg",
    contentType: "image/jpeg",
    size: 401_775,
    width: 1080,
    height: 1440,
    url: `${MOCK_CDN_BASE_URL}/2026/08/anh-kien-hang-sau-dong-goi-657482.jpg`,
    uploadedAt: isoDaysAgo(7),
    uploadedBy: "Lê Minh Khoa",
    relatedCode: "PCL-20260828101130-549660",
  },
  {
    id: "IMG-20260826091508-765304",
    fileName: "anh-kiem-kien-thieu-hang.webp",
    contentType: "image/webp",
    size: 288_640,
    width: 960,
    height: 1280,
    url: `${MOCK_CDN_BASE_URL}/2026/08/anh-kiem-kien-thieu-hang-765304.webp`,
    uploadedAt: isoDaysAgo(9),
    uploadedBy: "Phạm Thu Trang",
    relatedCode: "PCL-20260826091402-765304",
  },
  {
    id: "IMG-20260826091602-873126",
    fileName: "anh-kien-hang-hu-hong-goc-thung.webp",
    contentType: "image/webp",
    size: 301_968,
    width: 960,
    height: 1280,
    url: `${MOCK_CDN_BASE_URL}/2026/08/anh-kien-hang-hu-hong-goc-thung-873126.webp`,
    uploadedAt: isoDaysAgo(9),
    uploadedBy: "Phạm Thu Trang",
    relatedCode: "PCL-20260826091402-765304",
  },
  {
    id: "IMG-20260824164411-980948",
    fileName: "anh-xuat-kho-xe-tai-bien-so.jpg",
    contentType: "image/jpeg",
    size: 556_223,
    width: 1600,
    height: 1200,
    url: `${MOCK_CDN_BASE_URL}/2026/08/anh-xuat-kho-xe-tai-bien-so-980948.jpg`,
    uploadedAt: isoDaysAgo(12),
    uploadedBy: "Hoàng Văn Đạt",
    relatedCode: "WRO-20260824164302-980948",
  },
  {
    id: "IMG-20260824164509-188770",
    fileName: "anh-chung-tu-hai-quan-to-khai-nhap.jpg",
    contentType: "image/jpeg",
    size: 623_407,
    width: 1654,
    height: 2339,
    url: `${MOCK_CDN_BASE_URL}/2026/08/anh-chung-tu-hai-quan-to-khai-nhap-188770.jpg`,
    uploadedAt: isoDaysAgo(12),
    uploadedBy: "Hoàng Văn Đạt",
    relatedCode: "WRO-20260824164302-980948",
  },
  {
    id: "IMG-20260821112035-296592",
    fileName: "anh-lo-hang-niem-phong-container.jpg",
    contentType: "image/jpeg",
    size: 702_118,
    width: 1600,
    height: 1200,
    url: `${MOCK_CDN_BASE_URL}/2026/08/anh-lo-hang-niem-phong-container-296592.jpg`,
    uploadedAt: isoDaysAgo(15),
    uploadedBy: "Đặng Thị Mai Chi",
    relatedCode: "SHP-20260821111908-296592",
  },
  {
    id: "IMG-20260821112144-404414",
    fileName: "anh-lo-hang-manifest-ban-cung.jpg",
    contentType: "image/jpeg",
    size: 488_902,
    width: 1240,
    height: 1754,
    url: `${MOCK_CDN_BASE_URL}/2026/08/anh-lo-hang-manifest-ban-cung-404414.jpg`,
    uploadedAt: isoDaysAgo(15),
    uploadedBy: "Đặng Thị Mai Chi",
    relatedCode: "SHP-20260821111908-296592",
  },
  {
    id: "IMG-20260818153311-512236",
    fileName: "anh-chat-khach-gui-mau-vai.jpg",
    contentType: "image/jpeg",
    size: 254_663,
    width: 828,
    height: 1104,
    url: `${MOCK_CDN_BASE_URL}/2026/08/anh-chat-khach-gui-mau-vai-512236.jpg`,
    uploadedAt: isoDaysAgo(18),
    uploadedBy: "Vũ Ngọc Hiếu",
    relatedCode: "VCL-20260818153204-512236",
  },
  {
    id: "IMG-20260818153402-620058",
    fileName: "anh-chat-khach-gui-bang-mau.jpg",
    contentType: "image/jpeg",
    size: 233_915,
    width: 828,
    height: 1104,
    url: `${MOCK_CDN_BASE_URL}/2026/08/anh-chat-khach-gui-bang-mau-620058.jpg`,
    uploadedAt: isoDaysAgo(18),
    uploadedBy: "Vũ Ngọc Hiếu",
    relatedCode: "VCL-20260818153204-512236",
  },
];

/* Thư viện là fixture của phiên, không phải log: giữ trần để không phình vô hạn. */
const MAX_LIBRARY_SIZE = 80;

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

/* ================= SINH URL GIẢ ================= */

/*
 * Tên file thật → slug đặt được trong URL: bỏ dấu tiếng Việt, hạ chữ, gộp dấu gạch.
 * Giữ lại tên gốc để người xem nhận ra ảnh mình vừa chọn trong danh sách chứng từ.
 */
const slugifyFileName = (fileName, index = 0) => {
  const baseName = String(fileName || "")
    .trim()
    .replace(/\.[^.]+$/, "");

  const slug = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 44)
    .replace(/^-+|-+$/g, "");

  if (slug) {
    return slug;
  }

  return FALLBACK_SLUGS[index % FALLBACK_SLUGS.length];
};

const getImageSizeFallback = (file) => {
  const size = Number(file?.size);

  /* Blob dựng trong test/kéo-thả có thể size 0; số 0 làm cột "dung lượng" trông lỗi. */
  return Number.isFinite(size) && size > 0
    ? size
    : 245_760;
};

/**
 * Ghi một file vừa "upload" vào thư viện trong bộ nhớ và trả về bản ghi.
 *
 * URL phải DUY NHẤT cho từng file: CustomerServiceChat và ConsignmentBuyOrder đều
 * so số URL nhận được với số file gửi lên, mà cả hai đều gom URL theo kiểu loại
 * trùng lặp. Chọn cùng lúc hai file trùng tên mà sinh ra một URL giống nhau là
 * lỗi "API chỉ trả về 1/2 URL ảnh" ngay trên màn hình. Đuôi số lấy từ nextId nên
 * mỗi lần gọi là một số khác.
 */
const registerUploadedImage = (file, index = 0) => {
  const assetId = nextId("IMG");
  const uniqueTail = assetId.slice(-6);
  const uploadedAt = nowIso();
  const stamp = new Date(uploadedAt);
  const year = stamp.getFullYear();
  const month = String(stamp.getMonth() + 1).padStart(2, "0");

  const extension = getExtensionFromMimeType(file?.type);
  const slug = slugifyFileName(file?.name, index);

  const record = {
    id: assetId,
    fileName:
      String(file?.name || "").trim() ||
      `${slug}.${extension}`,
    contentType:
      String(file?.type || "").trim() || "image/jpeg",
    size: getImageSizeFallback(file),
    width: 1200,
    height: 1600,
    url: `${MOCK_CDN_BASE_URL}/${year}/${month}/${slug}-${uniqueTail}.${extension}`,
    uploadedAt,
    uploadedBy: "Người dùng đang đăng nhập",
    relatedCode: "",
  };

  uploadedImageLibrary.unshift(record);

  if (uploadedImageLibrary.length > MAX_LIBRARY_SIZE) {
    uploadedImageLibrary.length = MAX_LIBRARY_SIZE;
  }

  return record;
};

/* Chỉ trả những trường payload thật có; thêm bừa trường chứa URL khác là làm lệch
   phép đếm URL/file ở CustomerServiceChat và ConsignmentBuyOrder. */
const toUploadedImagePayload = (record) => ({
  id: record.id,
  fileName: record.fileName,
  contentType: record.contentType,
  size: record.size,
  width: record.width,
  height: record.height,
  url: record.url,
  uploadedAt: record.uploadedAt,
});

/* ================= TIẾN ĐỘ UPLOAD ================= */

/*
 * Axios bắn onUploadProgress nhiều nhịp trong lúc gửi byte. Mock trả ngay thì
 * thanh % nhảy thẳng 0 → biến mất: WroShippingRouteModal có Progress hiển thị
 * uploadProgress, ConsignmentBuyOrder in "... : {percent}%" vào dòng trạng thái.
 * Vì vậy vẫn phải bắn từng nhịp và chờ giữa các nhịp.
 */
const PROGRESS_STEPS = [12, 38, 64, 86, 100];

const emitUploadProgress = async (onUploadProgress) => {
  if (typeof onUploadProgress !== "function") {
    await delay(320);
    return;
  }

  for (const percent of PROGRESS_STEPS) {
    await delay(64);
    onUploadProgress(percent);
  }
};

/* ================= UPLOAD MULTIPLE IMAGES ================= */

/**
 * Upload một hoặc nhiều ảnh.
 *
 * @param {File|Blob|FileList|Array<File|Blob>} inputFiles
 * @param {(percent: number) => void} onUploadProgress
 * @returns {Promise<{success: boolean, url: string, urls: string[], data: Array<object>}>}
 */
export const uploadImages = async (
  inputFiles,
  onUploadProgress,
) => {
  const files = normalizeImageFiles(inputFiles);

  await emitUploadProgress(onUploadProgress);
  /* Nhịp chờ cuối: bản thật còn phải đợi server xử lý sau khi gửi xong 100%. */
  await delay(180);

  const records = files.map((file, index) =>
    registerUploadedImage(file, index),
  );

  const urls = records.map((record) => record.url);

  /*
   * Ba trường url / urls / data cùng tồn tại vì ba màn hình đọc ba đường khác nhau:
   * data[0].url (WRO), quét url + data + urls (lô hàng), response.data rồi map url
   * (chat). Cả ba đều loại URL trùng nên nhắc lại cùng một URL là vô hại.
   */
  return {
    success: true,
    statusCode: 200,
    message:
      files.length > 1
        ? `Đã tải ${files.length} ảnh lên thành công.`
        : "Đã tải ảnh lên thành công.",
    count: records.length,
    url: urls[0],
    urls,
    data: records.map(toUploadedImagePayload),
  };
};

/* ================= UPLOAD SINGLE IMAGE ================= */

/**
 * Upload một ảnh và trả về CHUỖI URL.
 *
 * Cố ý không bọc object: ConfirmPurchaseModal gán trực tiếp giá trị này vào
 * `url` của item ảnh rồi đưa vào <img src>, còn ConsignmentOrder chạy nó qua
 * bộ dò URL vốn nhận cả chuỗi trần.
 *
 * @param {File|Blob} inputFile
 * @param {(percent: number) => void} onUploadProgress
 * @returns {Promise<string>}
 */
export const uploadImage = async (
  inputFile,
  onUploadProgress,
) => {
  const file = normalizeImageFile(inputFile);

  if (!file.type?.startsWith("image/")) {
    throw new Error(`File "${file.name || "đã chọn"}" không phải là hình ảnh.`);
  }

  await emitUploadProgress(onUploadProgress);
  await delay(180);

  const record = registerUploadedImage(file);

  return record.url;
};

/* ================= STUB THAY AXIOS INSTANCE ================= */

/*
 * Bản gốc export axios instance để chỗ khác gọi lại được. Hiện không màn nào
 * import nó, nhưng export phải còn nguyên tên nếu không tầng kiểm hợp đồng sẽ
 * báo lệch. Đây là stub trơ: không có mạng, post() đi qua đúng mock ở trên nên
 * nếu sau này có ai dùng lại thì vẫn nhận đúng hình dạng { data } kiểu axios.
 */
const uploadAxios = {
  defaults: {
    /* Rỗng để thấy rõ: không có request nào đi ra ngoài trong bản chỉ-giao-diện. */
    baseURL: "",
    timeout: 60_000,
    headers: {
      Accept: "text/plain, application/json, */*",
    },
  },
  interceptors: {
    request: { use: () => 0, eject: () => {} },
    response: { use: () => 0, eject: () => {} },
  },
  post: async (_url, body) => {
    const pickedFiles =
      typeof FormData !== "undefined" &&
      body instanceof FormData
        ? [...body.getAll("files"), ...body.getAll("file")]
        : body;

    const data = await uploadImages(pickedFiles);

    return {
      data,
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    };
  },
};

export { uploadAxios };

export default uploadImage;
