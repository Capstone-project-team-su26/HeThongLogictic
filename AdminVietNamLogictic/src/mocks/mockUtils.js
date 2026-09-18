/**
 * Helper dùng chung cho toàn bộ tầng mock của bản UI-only.
 *
 * Bản này gỡ hẳn tầng HTTP: mỗi module trong api/ trả dữ liệu mẫu thay vì gọi server.
 * Vì KHÔNG được sửa một dòng nào trong component, mock phải giả lập lại đúng những
 * thứ component vốn dựa vào ở tầng axios: một khoảng chờ ngắn để spinner kịp hiện,
 * hình dạng phân trang y hệt service thật, và lỗi có `error.response.status` để
 * các nhánh catch đọc được.
 *
 * Không import axios, không fetch, không WebSocket — file này phải sạch tuyệt đối
 * để tools/verify-mocks.mjs không báo còn dấu vết HTTP.
 */

/* =========================================================
   HUỶ YÊU CẦU (AbortController)
========================================================= */

/**
 * Lỗi huỷ y như axios tạo ra khi AbortSignal bị abort.
 *
 * Component nhận diện huỷ bằng ba dấu hiệu khác nhau tuỳ chỗ:
 * error.code === "ERR_CANCELED", error.name === "CanceledError", hoặc
 * error.name === "AbortError". Gắn đủ cả ba để không màn nào hiểu nhầm
 * "huỷ vì đổi bộ lọc" thành "gọi API thất bại" rồi bắn toast đỏ.
 */
export const createCanceledError = (
  message = "canceled"
) => {
  const error = new Error(message);

  error.name = "CanceledError";
  error.code = "ERR_CANCELED";
  error.__CANCEL__ = true;

  return error;
};

/** Dùng lại logic nhận diện huỷ của các component để mock tự bỏ qua request cũ. */
export const isCanceledError = (error) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError";

/* =========================================================
   DELAY
========================================================= */

/**
 * Nghỉ ngắn trước khi trả dữ liệu.
 *
 * Mock trả ngay lập tức thì màn hình nhảy thẳng từ trắng sang đầy dữ liệu:
 * người xem không thấy trạng thái loading, và những màn bật/tắt spinner theo
 * useEffect lại nhấp nháy. 220ms đủ để spinner hiện một nhịp mà không làm chậm.
 *
 * @param {number} [ms=220]
 * @param {AbortSignal} [signal] signal của component; abort thì reject bằng CanceledError
 * @returns {Promise<void>}
 */
export const delay = (
  ms = 220,
  signal
) => {
  return new Promise(
    (resolve, reject) => {
      if (signal?.aborted) {
        reject(createCanceledError());
        return;
      }

      let timeoutId = null;

      const handleAbort = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }

        reject(createCanceledError());
      };

      timeoutId = setTimeout(() => {
        signal?.removeEventListener?.(
          "abort",
          handleAbort
        );

        resolve();
      }, Math.max(0, Number(ms) || 0));

      signal?.addEventListener?.(
        "abort",
        handleAbort,
        { once: true }
      );
    }
  );
};

/* =========================================================
   CLONE
========================================================= */

/**
 * Trả bản sao sâu.
 *
 * Bộ dữ liệu mẫu nằm trong module nên tồn tại suốt phiên. Nếu trả thẳng tham
 * chiếu, một màn hình sort/mutate tại chỗ là hỏng dữ liệu của mọi màn còn lại.
 */
export const deepClone = (value) => {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return value;
  }

  if (
    typeof structuredClone ===
    "function"
  ) {
    return structuredClone(value);
  }

  return JSON.parse(
    JSON.stringify(value)
  );
};

/* =========================================================
   PHÂN TRANG
========================================================= */

const toPositiveInt = (
  value,
  fallback
) => {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return fallback;
  }

  return Math.trunc(number);
};

/**
 * Chuẩn hoá phân trang đúng hình dạng service thật đang trả về.
 *
 * consignmentService.getConsignmentsApi và purchaseRequestService.getPurchaseRequestsApi
 * đều trả { items, totalCount, pageNumber, pageSize, totalPages } và ĐÁNH SỐ TRANG TỪ 1.
 * Bản ký gửi trả thêm hasPreviousPage / hasNextPage / raw nên giữ luôn cả ba —
 * khoá dư thì component bỏ qua, khoá thiếu thì phân trang chết.
 *
 * Trang vượt quá tổng số trang được kẹp về trang cuối: PendingConsignmentList so
 * pageNumber trả về với state của nó rồi tự đồng bộ, nên kẹp ở đây giúp người xem
 * không thấy một trang rỗng loé lên trước khi tự nhảy về.
 *
 * @param {Array} rows toàn bộ bản ghi sau khi đã lọc
 * @param {{ page?: number, size?: number, pageNumber?: number, pageSize?: number, limit?: number }} [options]
 */
export const paginate = (
  rows,
  options = {}
) => {
  const source = Array.isArray(rows)
    ? rows
    : [];

  const pageSize = toPositiveInt(
    options?.size ??
      options?.pageSize ??
      options?.limit,
    10
  );

  const requestedPage = toPositiveInt(
    options?.page ??
      options?.pageNumber,
    1
  );

  const totalCount = source.length;

  const totalPages =
    totalCount > 0
      ? Math.ceil(
          totalCount / pageSize
        )
      : 0;

  const pageNumber =
    totalPages > 0
      ? Math.min(
          requestedPage,
          totalPages
        )
      : 1;

  const startIndex =
    (pageNumber - 1) * pageSize;

  const items = deepClone(
    source.slice(
      startIndex,
      startIndex + pageSize
    )
  );

  const page = {
    items,
    totalCount,
    pageNumber,
    pageSize,
    totalPages,

    hasPreviousPage: pageNumber > 1,

    hasNextPage:
      totalPages > 0 &&
      pageNumber < totalPages,
  };

  /* Service thật đính kèm payload gốc của server; giữ khoá này để màn nào đọc
     apiResult.raw vẫn thấy đủ số liệu thay vì undefined. */
  return {
    ...page,
    raw: { ...page },
  };
};

/* =========================================================
   SINH MÃ / SINH ID
========================================================= */

let sequenceCounter = 0;

const compactTimestamp = (
  date = new Date()
) => {
  return date
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
};

/**
 * Sinh mã nghiệp vụ theo đúng khuôn hệ thống đang dùng:
 * VCL-20260712105447-295805, PUR-..., PCL-..., SHP-..., WRO-...
 *
 * @param {string} [prefix="MOCK"]
 * @returns {string}
 */
export const nextId = (
  prefix = "MOCK"
) => {
  sequenceCounter += 1;

  const tail =
    100000 +
    ((sequenceCounter * 7919) %
      900000);

  const normalizedPrefix =
    String(prefix ?? "")
      .trim()
      .toUpperCase() || "MOCK";

  return `${normalizedPrefix}-${compactTimestamp()}-${tail}`;
};

/**
 * Sinh UUID v4 giả.
 *
 * Nhiều service thật chặn id không đúng khuôn UUID, và một số màn tra cứu chéo
 * bằng id (kho, loại hàng, cấu hình phí). Mock tạo bản ghi mới vẫn phải cho ra
 * id hợp khuôn để những chỗ đó không loại bỏ bản ghi.
 */
/**
 * PRNG tất định (mulberry32) — cùng seed cho ra cùng dãy số.
 *
 * Dùng thay Math.random để mỗi lần mở app dữ liệu mẫu vẫn y hệt: id ổn định thì
 * link chi tiết đã lưu vẫn mở được, và ảnh chụp màn hình so sánh được giữa các lần.
 */
const mulberry32 = (seed) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const nextUuid = () => {
  sequenceCounter += 1;

  /* Nhân với hằng số vàng 32-bit để hai seed liền nhau cho hai dãy khác hẳn nhau. */
  const rand = mulberry32(Math.imul(sequenceCounter, 0x9e3779b1));

  const hex = (length) => {
    let text = "";

    for (let index = 0; index < length; index += 1) {
      text += Math.floor(rand() * 16).toString(16);
    }

    return text;
  };

  /* Khuôn UUID v4: nibble phiên bản là 4, nibble variant nằm trong 8..b. */
  const variant = (8 + Math.floor(rand() * 4)).toString(16);

  return [hex(8), hex(4), `4${hex(3)}`, `${variant}${hex(3)}`, hex(12)].join("-");
};

/* =========================================================
   THỜI GIAN
========================================================= */

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Thời điểm hiện tại dạng ISO string — đúng kiểu API đang trả cho FE. */
export const nowIso = () =>
  new Date().toISOString();

/**
 * ISO string của n ngày trước.
 *
 * Bộ dữ liệu mẫu dùng mốc tương đối chứ không ghim ngày cứng, để danh sách luôn
 * trông như vừa phát sinh và bộ lọc khoảng ngày "7 ngày gần đây" vẫn ra kết quả.
 */
export const isoDaysAgo = (
  days = 0
) =>
  new Date(
    Date.now() -
      (Number(days) || 0) * MS_PER_DAY
  ).toISOString();

/** ISO string của n giờ trước — dùng cho mốc cập nhật trạng thái trong ngày. */
export const isoHoursAgo = (
  hours = 0
) =>
  new Date(
    Date.now() -
      (Number(hours) || 0) *
        MS_PER_HOUR
  ).toISOString();

/* =========================================================
   TÌM KIẾM TIẾNG VIỆT
========================================================= */

/**
 * Bỏ dấu tiếng Việt và hạ chữ thường để so khớp không phân biệt dấu.
 *
 * NFD không tách được đ/Đ nên phải thay tay, nếu không "Đà Nẵng" sẽ không khớp
 * với từ khoá "da nang" mà người dùng gõ không dấu.
 */
export const normalizeText = (
  value
) => {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
};

const readPath = (source, path) => {
  const segments = String(path ?? "")
    .split(".")
    .filter(Boolean);

  return segments.reduce(
    (current, segment) => {
      if (
        current === null ||
        current === undefined
      ) {
        return undefined;
      }

      /* Path đi xuyên mảng (vd "items.productName") thì lấy hết phần tử,
         nhờ vậy gõ tên một sản phẩm là tìm được cả đơn chứa nó. */
      if (Array.isArray(current)) {
        return current.map(
          (entry) => entry?.[segment]
        );
      }

      return current[segment];
    },
    source
  );
};

const flattenToText = (value) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean"
  ) {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map(flattenToText)
      .filter(Boolean)
      .join(" ");
  }

  if (typeof value === "object") {
    return Object.values(value)
      .map(flattenToText)
      .filter(Boolean)
      .join(" ");
  }

  return String(value);
};

/**
 * So khớp từ khoá với một bản ghi trên các trường được chỉ định.
 *
 * @param {Object} row
 * @param {string} keyword từ khoá thô người dùng gõ (có dấu hay không đều được)
 * @param {string[]} [fields] danh sách path, hỗ trợ "customer.fullName" và "items.productName"
 * @returns {boolean} true khi từ khoá rỗng, để bộ lọc mặc định không loại bản ghi nào
 */
export const matchesKeyword = (
  row,
  keyword,
  fields = []
) => {
  const needle = normalizeText(keyword);

  if (!needle) {
    return true;
  }

  const paths =
    Array.isArray(fields) &&
    fields.length > 0
      ? fields
      : Object.keys(row || {});

  const haystack = paths
    .map((path) =>
      normalizeText(
        flattenToText(
          readPath(row, path)
        )
      )
    )
    .filter(Boolean)
    .join(" ");

  return haystack.includes(needle);
};

/* =========================================================
   LỖI GIẢ LẬP
========================================================= */

const STATUS_TEXT = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
};

/**
 * Tạo lỗi có hình dạng như lỗi axios.
 *
 * Các nhánh catch trong component đọc theo đúng thứ tự này:
 *   error.response.data.message -> .error -> .title -> error.message
 * và authSession.isAuthenticationError còn xét error.response.status === 401.
 * Thiếu error.response thì toast hiện "undefined" và màn 401 không tự chuyển
 * về đăng nhập, nên phải dựng đủ cả cụm.
 *
 * @param {number} [status=400]
 * @param {string} [message]
 * @returns {Error}
 */
export const createApiError = (
  status = 400,
  message = "Yêu cầu không thành công."
) => {
  const httpStatus =
    Number(status) || 400;

  const text = String(
    message ??
      "Yêu cầu không thành công."
  );

  const error = new Error(text);

  error.name = "AxiosError";
  error.isAxiosError = true;

  error.code =
    httpStatus >= 500
      ? "ERR_BAD_RESPONSE"
      : "ERR_BAD_REQUEST";

  error.status = httpStatus;
  error.config = { headers: {} };
  error.request = {};

  error.response = {
    status: httpStatus,

    statusText:
      STATUS_TEXT[httpStatus] ||
      "Error",

    data: {
      message: text,
      error: text,
      title: text,
      errors: {},
    },

    headers: {},
    config: { headers: {} },
  };

  return error;
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

const mockUtils = {
  delay,
  paginate,
  deepClone,
  nextId,
  nextUuid,
  nowIso,
  isoDaysAgo,
  isoHoursAgo,
  normalizeText,
  matchesKeyword,
  createApiError,
  createCanceledError,
  isCanceledError,
};

export default mockUtils;
