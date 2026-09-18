/**
 * MOCK phiếu biên nhận đơn ký gửi (receipt PDF) — bản chỉ-giao-diện.
 *
 * Tầng HTTP đã bị gỡ: không axiosInstance, không API_ENDPOINTS, không responseType blob.
 * Thay vì tải file từ server, file này DỰNG một PDF hợp lệ ngay trong bộ nhớ từ bộ mẫu
 * `consignments` rồi trả về đúng thứ bản thật trả về: một Blob type "application/pdf".
 *
 * Vì sao phải là PDF thật chứ không phải Blob text: ConsignmentDocumentsList.jsx gọi
 * URL.createObjectURL(pdfBlob) rồi nhồi vào khung xem trước. Blob rỗng hoặc không đúng
 * cấu trúc PDF thì modal hiện khung trắng / báo lỗi của trình đọc PDF, mà component thì
 * không được sửa một dòng nào để bù.
 *
 * CẮM API THẬT TRỞ LẠI: xem khối "// [API THẬT]" trong getConsignmentReceiptApi — chỉ cần
 * thay đoạn dựng PDF bằng lời gọi axiosInstance.get(endpoint, { responseType: "blob" })
 * rồi bọc lại `new Blob([response.data], { type: "application/pdf" })`. Nhánh tự tải file
 * theo options.download phía dưới giữ nguyên được, vì nó chỉ làm việc với Blob.
 */

import {
  consignments as consignmentFixtures,
  findConsignmentById,
  findConsignmentByCode,
} from "@/mocks/data/consignments";
import { delay } from "@/mocks/mockUtils";

/* =========================================================
   CHUẨN HOÁ CHUỖI CHO PDF

   PDF dựng ở đây dùng font gốc Helvetica (base-14) với WinAnsiEncoding — bảng mã này
   KHÔNG có glyph tiếng Việt có dấu. Nhúng font Unicode vào một mock là quá nặng, nên
   mọi chữ vẽ lên phiếu đều được bỏ dấu trước. Đây cũng là lý do file này giữ bất biến
   "chuỗi PDF chỉ chứa ASCII": nhờ vậy độ dài chuỗi = số byte, và bảng xref tính bằng
   String.length ở dưới mới đúng offset.
========================================================= */

const stripDiacritics = (value) => {
  const text = String(value ?? "");

  return (
    text
      /* NFD tách dấu thành ký tự tổ hợp (kể cả dấu móc U+031B của ơ/ư) rồi xoá sạch. */
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      /* đ/Đ không tổ hợp được nên phải thay tay. */
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
  );
};

/**
 * Chốt bất biến ASCII: ký tự lạ còn sót lại thành "?" thay vì làm lệch offset xref.
 *
 * Trước khi rơi vào "?" thì dịch mấy ký hiệu fixture hay dùng: route ghi "CN → VN"
 * và các màn khác dùng "➔", để nguyên thì phiếu in ra thành "CN ? VN".
 */
const toPdfAscii = (value) =>
  stripDiacritics(value)
    .replace(/[→➔➜⟶⇒]/g, "->")
    .replace(/[–—]/g, "-")
    .replace(/[•·]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, "?");

/** Ba ký tự này là cú pháp của chuỗi PDF, không escape thì file vỡ cấu trúc. */
const escapePdfText = (value) =>
  toPdfAscii(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

/** Cắt bớt để chữ không tràn khỏi khổ giấy — PDF không tự wrap. */
const clipText = (value, maxLength) => {
  const text = String(value ?? "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
};

/* =========================================================
   ĐỊNH DẠNG NGHIỆP VỤ
========================================================= */

/**
 * Tiền VND định dạng tay chứ không dùng Intl.NumberFormat("vi-VN"):
 * Intl chèn khoảng trắng hẹp U+202F/U+00A0 vào chuỗi, phá bất biến ASCII của PDF.
 */
const formatVnd = (amount) => {
  const rounded = Math.round(
    Number(amount) || 0
  );

  const sign = rounded < 0 ? "-" : "";

  const grouped = String(
    Math.abs(rounded)
  ).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    "."
  );

  return `${sign}${grouped} VND`;
};

const formatNumber = (value, digits = 2) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return String(
    Number(number.toFixed(digits))
  );
};

const pad2 = (value) =>
  String(value).padStart(2, "0");

/** ISO string -> "dd/MM/yyyy HH:mm" cho khớp cách các màn khác hiển thị ngày. */
const formatDateTime = (isoString) => {
  if (!isoString) {
    return "-";
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${pad2(date.getDate())}/${pad2(
    date.getMonth() + 1
  )}/${date.getFullYear()} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;
};

/* =========================================================
   DỰNG PDF

   Một trang A4, hai font base-14, một content stream. Offset của từng object được
   tính lại khi ghép file nên không có số cứng nào phải bảo trì bằng tay.
========================================================= */

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_LEFT = 48;
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN_LEFT;

const FONT_REGULAR = "F1";
const FONT_BOLD = "F2";

const drawText = (
  x,
  y,
  size,
  font,
  value
) =>
  `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(
    value
  )}) Tj ET`;

const drawLine = (x1, y1, x2, y2, width = 0.6) =>
  `${width} w ${x1} ${y1} m ${x2} ${y2} l S`;

const drawBand = (x, y, width, height) =>
  `0.898 0.933 0.988 rg ${x} ${y} ${width} ${height} re f 0 0 0 rg`;

/**
 * Hàng "Nhãn: giá trị" của khối thông tin đơn.
 *
 * valueOffset phải truyền tay theo từng khối: nhãn dài như "Tong gia tri khai bao"
 * cần chỗ rộng hơn "Ma van don", mà PDF không đo được bề rộng chữ để tự canh.
 */
const drawField = (
  x,
  y,
  label,
  value,
  valueOffset
) => [
  drawText(x, y, 9, FONT_BOLD, `${label}:`),
  drawText(
    x + valueOffset,
    y,
    9,
    FONT_REGULAR,
    value || "-"
  ),
];

/**
 * Ghép các object thành file PDF hoàn chỉnh.
 *
 * xref bắt buộc trỏ đúng byte offset của từng object, nên phải cộng dồn độ dài
 * trong lúc ghép — đây là chỗ bất biến ASCII ở trên phát huy tác dụng.
 */
const assemblePdf = (objects) => {
  const header = "%PDF-1.4\n";

  let cursor = header.length;
  let body = "";

  const offsets = [];

  objects.forEach((content, index) => {
    const chunk = `${index + 1} 0 obj\n${content}\nendobj\n`;

    offsets.push(cursor);
    body += chunk;
    cursor += chunk.length;
  });

  const xrefOffset = cursor;

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  offsets.forEach((offset) => {
    xref += `${String(offset).padStart(
      10,
      "0"
    )} 00000 n \n`;
  });

  const trailer = `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return `${header}${body}${xref}${trailer}`;
};

/** Nội dung phiếu: header công ty, khối thông tin đơn, bảng kiện, chỗ ký. */
const buildReceiptContentStream = (
  receipt
) => {
  const operations = [];

  let y = PAGE_HEIGHT - 56;

  /* ----- Đầu phiếu ----- */
  operations.push(
    drawBand(
      MARGIN_LEFT,
      y - 12,
      CONTENT_RIGHT - MARGIN_LEFT,
      58
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT + 12,
      y + 26,
      15,
      FONT_BOLD,
      "CONG TY TNHH VIET NAM LOGISTIC"
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT + 12,
      y + 10,
      8.5,
      FONT_REGULAR,
      "So 27 Nguyen Van Cu, Long Bien, Ha Noi  -  Hotline 1900 6868  -  vietnamlogistic.vn"
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT + 12,
      y - 5,
      8.5,
      FONT_REGULAR,
      "Tuyen van chuyen quoc te: Trung Quoc -> Viet Nam"
    )
  );

  y -= 46;

  operations.push(
    drawText(
      MARGIN_LEFT,
      y,
      16,
      FONT_BOLD,
      "PHIEU BIEN NHAN HANG KY GUI"
    )
  );

  y -= 18;

  operations.push(
    drawText(
      MARGIN_LEFT,
      y,
      9,
      FONT_REGULAR,
      `Ma phieu: ${receipt.receiptCode}    -    Ngay in: ${receipt.printedAt}`
    )
  );

  y -= 10;

  operations.push(
    drawLine(
      MARGIN_LEFT,
      y,
      CONTENT_RIGHT,
      y,
      1
    )
  );

  /* ----- Thông tin đơn: hai cột ----- */
  y -= 22;

  const columnRightX = 320;

  const leftFields = [
    ["Ma don ky gui", receipt.consignmentCode],
    ["Ma van don", receipt.trackingCode],
    ["Loai dich vu", receipt.serviceLabel],
    ["Trang thai", receipt.statusLabel],
    ["Ngay tao don", receipt.createdAt],
    ["Tuyen", receipt.route],
  ];

  const rightFields = [
    ["Khach hang", receipt.customerName],
    ["Dien thoai", receipt.customerPhone],
    ["Nguoi nhan", receipt.receiverName],
    ["DT nguoi nhan", receipt.receiverPhone],
    ["Kho nhan hang", receipt.warehouseName],
    ["Ma kho", receipt.warehouseCode],
  ];

  leftFields.forEach(([label, value], index) => {
    operations.push(
      ...drawField(
        MARGIN_LEFT,
        y - index * 15,
        label,
        clipText(value, 30),
        84
      )
    );
  });

  rightFields.forEach(([label, value], index) => {
    operations.push(
      ...drawField(
        columnRightX,
        y - index * 15,
        label,
        clipText(value, 30),
        84
      )
    );
  });

  y -= leftFields.length * 15 + 4;

  operations.push(
    ...drawField(
      MARGIN_LEFT,
      y,
      "Dia chi nhan",
      clipText(receipt.receiverAddress, 92),
      84
    )
  );

  y -= 15;

  operations.push(
    ...drawField(
      MARGIN_LEFT,
      y,
      "Yeu cau dich vu",
      clipText(receipt.serviceNotes, 92),
      84
    )
  );

  /* ----- Bảng kiện hàng ----- */
  y -= 26;

  operations.push(
    drawText(
      MARGIN_LEFT,
      y,
      10.5,
      FONT_BOLD,
      "CHI TIET KIEN HANG KY GUI"
    )
  );

  y -= 14;

  /* Mốc x đặt tay và chừa dư: cột cuối bắt đầu ở 430 để nhãn "GIA TRI KHAI BAO"
     cùng số tiền dài nhất vẫn nằm trong lề phải 547 — PDF không tự cắt chữ tràn. */
  const columns = [
    { x: MARGIN_LEFT + 4, label: "STT" },
    { x: MARGIN_LEFT + 28, label: "TEN HANG HOA" },
    { x: MARGIN_LEFT + 230, label: "SL" },
    { x: MARGIN_LEFT + 260, label: "KL (kg)" },
    { x: MARGIN_LEFT + 304, label: "QUY CACH (cm)" },
    { x: MARGIN_LEFT + 382, label: "GIA TRI KHAI BAO" },
  ];

  operations.push(
    drawBand(
      MARGIN_LEFT,
      y - 5,
      CONTENT_RIGHT - MARGIN_LEFT,
      18
    )
  );

  columns.forEach((column) => {
    operations.push(
      drawText(
        column.x,
        y,
        8.5,
        FONT_BOLD,
        column.label
      )
    );
  });

  y -= 18;

  receipt.rows.forEach((row, index) => {
    const cells = [
      String(index + 1),
      clipText(row.productName, 38),
      String(row.quantity),
      formatNumber(row.weight),
      row.dimensions,
      formatVnd(row.declaredValue),
    ];

    cells.forEach((cell, cellIndex) => {
      operations.push(
        drawText(
          columns[cellIndex].x,
          y,
          8.5,
          FONT_REGULAR,
          cell
        )
      );
    });

    operations.push(
      drawLine(
        MARGIN_LEFT,
        y - 5,
        CONTENT_RIGHT,
        y - 5,
        0.3
      )
    );

    y -= 16;
  });

  if (receipt.hiddenRowCount > 0) {
    operations.push(
      drawText(
        MARGIN_LEFT + 28,
        y,
        8.5,
        FONT_REGULAR,
        `... va ${receipt.hiddenRowCount} kien khac (xem chi tiet tren he thong)`
      )
    );

    y -= 16;
  }

  /* ----- Tổng hợp ----- */
  y -= 4;

  operations.push(
    drawLine(
      MARGIN_LEFT,
      y + 8,
      CONTENT_RIGHT,
      y + 8,
      1
    )
  );

  const totals = [
    ["Tong so kien", `${receipt.packageCount} kien`],
    ["Tong so luong", `${receipt.totalQuantity} san pham`],
    ["Tong khoi luong", `${formatNumber(receipt.totalWeight)} kg`],
    [
      "Khoi luong quy doi",
      `${formatNumber(receipt.totalDimWeight)} kg`,
    ],
    ["Tong the tich", `${formatNumber(receipt.totalVolumeM3, 4)} m3`],
    ["Tong gia tri khai bao", formatVnd(receipt.declaredValue)],
  ];

  totals.forEach(([label, value], index) => {
    operations.push(
      ...drawField(
        columnRightX,
        y - index * 15,
        label,
        value,
        118
      )
    );
  });

  operations.push(
    drawText(
      MARGIN_LEFT,
      y,
      9,
      FONT_BOLD,
      "TAM TINH CHI PHI"
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT,
      y - 15,
      9,
      FONT_REGULAR,
      `Tong bao gia: ${receipt.quotationTotalText}`
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT,
      y - 30,
      9,
      FONT_REGULAR,
      `Dat coc: ${receipt.depositText}`
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT,
      y - 45,
      8.5,
      FONT_REGULAR,
      "Chi phi cuoi cung chot theo can do thuc te tai kho."
    )
  );

  /* ----- Ghi chú + chỗ ký ----- */
  y -= totals.length * 15 + 12;

  operations.push(
    drawText(
      MARGIN_LEFT,
      y,
      9,
      FONT_BOLD,
      "Ghi chu:"
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT + 52,
      y,
      9,
      FONT_REGULAR,
      clipText(receipt.note, 84)
    )
  );

  const signatureY = 132;

  operations.push(
    drawText(
      MARGIN_LEFT + 20,
      signatureY,
      9,
      FONT_BOLD,
      "NGUOI GUI HANG"
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT + 210,
      signatureY,
      9,
      FONT_BOLD,
      "NHAN VIEN KHO"
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT + 384,
      signatureY,
      9,
      FONT_BOLD,
      "DAI DIEN CONG TY"
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT + 4,
      signatureY - 14,
      8,
      FONT_REGULAR,
      "(Ky, ghi ro ho ten)"
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT + 196,
      signatureY - 14,
      8,
      FONT_REGULAR,
      "(Ky, ghi ro ho ten)"
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT + 372,
      signatureY - 14,
      8,
      FONT_REGULAR,
      "(Ky, ghi ro ho ten)"
    )
  );

  operations.push(
    drawLine(
      MARGIN_LEFT,
      68,
      CONTENT_RIGHT,
      68,
      0.4
    )
  );

  operations.push(
    drawText(
      MARGIN_LEFT,
      56,
      7.5,
      FONT_REGULAR,
      "Phieu duoc xuat tu he thong quan tri Viet Nam Logistic - ban demo giao dien (du lieu mau)."
    )
  );

  return operations.join("\n");
};

const buildReceiptPdfString = (receipt) => {
  const contentStream =
    buildReceiptContentStream(receipt);

  return assemblePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",

    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",

    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /${FONT_REGULAR} 5 0 R /${FONT_BOLD} 6 0 R >> >> ` +
      "/Contents 4 0 R >>",

    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,

    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",

    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ]);
};

/* =========================================================
   GOM DỮ LIỆU PHIẾU TỪ FIXTURE
========================================================= */

const SERVICE_LABELS = {
  STANDARD: "Ky gui tieu chuan",
  EXPRESS: "Ky gui nhanh",
  ECONOMY: "Ky gui tiet kiem",
  SEA: "Ky gui duong bien",
};

const buildServiceNotes = (order) => {
  const notes = [];

  if (order?.requiresInspection) {
    notes.push("Kiem hang truoc khi dong");
  }

  if (order?.requiresPacking) {
    notes.push("Dong go tieu chuan");
  }

  if (order?.requiresWoodenCrate) {
    notes.push("Dong thung go");
  }

  if (order?.requiresInsurance) {
    notes.push("Mua bao hiem hang hoa");
  }

  if (
    order?.defaultDestinationHandlingText
  ) {
    notes.push(
      order.defaultDestinationHandlingText
    );
  }

  return notes.length > 0
    ? notes.join(" | ")
    : "Khong co yeu cau dac biet";
};

const MAX_RECEIPT_ROWS = 12;

/**
 * Ghép mọi thứ phiếu cần từ một bản ghi ký gửi.
 *
 * `order` có thể là null khi màn hình truyền vào id không nằm trong bộ mẫu. Bản mock
 * chọn vẽ phiếu rỗng thay vì ném lỗi 404: mục tiêu của bản chỉ-giao-diện là luồng
 * xem trước / tải phiếu luôn chạy được, không phải mô phỏng lỗi tra cứu.
 */
const buildReceiptModel = (
  order,
  fallbackCode
) => {
  const items = Array.isArray(order?.items)
    ? order.items
    : [];

  const visibleItems = items.slice(
    0,
    MAX_RECEIPT_ROWS
  );

  const quotation = order?.quotation || null;

  const quotationTotal =
    quotation?.totalEstimatedCost ??
    quotation?.total ??
    null;

  const depositAmount =
    quotation?.depositAmount ?? null;

  return {
    receiptCode: `RCPT-${
      order?.consignmentCode ||
      fallbackCode ||
      "KY-GUI"
    }`,

    printedAt: formatDateTime(
      new Date().toISOString()
    ),

    consignmentCode:
      order?.consignmentCode ||
      fallbackCode ||
      "-",
    trackingCode:
      order?.trackingCode ||
      order?.orderCode ||
      fallbackCode ||
      "-",

    serviceLabel:
      SERVICE_LABELS[
        String(
          order?.consignmentType || ""
        ).toUpperCase()
      ] || "Ky gui tieu chuan",

    statusLabel:
      order?.statusDisplayName ||
      order?.status ||
      "-",

    createdAt: formatDateTime(
      order?.createdAt
    ),

    route: order?.route || "CN -> VN",

    customerName:
      order?.customerName || "-",
    customerPhone:
      order?.customerPhone || "-",

    receiverName:
      order?.receiverName || "-",
    receiverPhone:
      order?.receiverPhone || "-",
    receiverAddress:
      order?.receiverAddress || "-",

    warehouseName:
      order?.warehouseName || "-",
    warehouseCode:
      order?.warehouseCode || "-",

    serviceNotes:
      buildServiceNotes(order),

    rows: visibleItems.map((item) => ({
      productName:
        item?.productName || "-",
      quantity: item?.quantity ?? 0,
      weight: item?.weight ?? 0,
      dimensions: `${formatNumber(
        item?.length,
        1
      )} x ${formatNumber(
        item?.width,
        1
      )} x ${formatNumber(
        item?.height,
        1
      )}`,
      declaredValue:
        item?.declaredValue ?? 0,
    })),

    hiddenRowCount: Math.max(
      0,
      items.length - visibleItems.length
    ),

    packageCount:
      order?.packageCount ?? items.length,
    totalQuantity:
      order?.totalQuantity ?? 0,
    totalWeight: order?.totalWeight ?? 0,
    totalDimWeight:
      order?.totalDimWeight ?? 0,
    totalVolumeM3:
      order?.totalVolumeM3 ?? 0,
    declaredValue:
      order?.declaredValue ?? 0,

    quotationTotalText:
      quotationTotal === null
        ? "Chua co bao gia"
        : formatVnd(quotationTotal),

    depositText:
      depositAmount === null
        ? "Chua phat sinh"
        : formatVnd(depositAmount),

    note:
      order?.note ||
      "Hang duoc tiep nhan nguyen trang theo khai bao cua khach.",
  };
};

/**
 * Tra bản ghi ký gửi theo mọi dạng khoá màn hình có thể truyền vào.
 *
 * ConsignmentDocumentsList truyền `record.orderId || record.id`, PendingConsignmentList
 * cũng vậy, nhưng vài chỗ khác lại truyền mã đơn. Dò cả ba đường để mock không phụ
 * thuộc vào việc màn nào đang gọi.
 */
const resolveConsignment = (orderId) => {
  const needle = String(orderId ?? "")
    .trim()
    .toLowerCase();

  if (!needle) {
    return null;
  }

  return (
    findConsignmentById(orderId) ||
    findConsignmentByCode(orderId) ||
    consignmentFixtures.find(
      (order) =>
        String(order?.id ?? "")
          .toLowerCase() === needle
    ) ||
    null
  );
};

/**
 * Kích hoạt tải file — giữ đúng hành vi và đúng tên file của bản thật, vì toast
 * thành công của component nói "đã xuất file PDF" nên phải có file thật rơi xuống máy.
 */
const triggerBlobDownload = (
  blob,
  fileName
) => {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return;
  }

  const blobUrl =
    window.URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = blobUrl;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(blobUrl);
};

/* =========================================================
   API
========================================================= */

/**
 * Lấy file PDF phiếu biên nhận đơn ký gửi theo orderId.
 *
 * @param {string} orderId - GUID đơn hàng ký gửi (hoặc mã đơn / mã vận đơn)
 * @param {Object} options
 * @param {boolean} options.download - Nếu true sẽ tự động tải file PDF về máy
 * @returns {Promise<Blob>} Blob dữ liệu PDF
 */
export const getConsignmentReceiptApi = async (orderId, options = {}) => {
  if (!orderId) {
    throw new Error("Không tìm thấy mã ID đơn ký gửi (orderId).");
  }

  const normalizedOrderId = String(orderId).trim();

  /* Chờ một nhịp để state downloadingId của component kịp hiện spinner trên đúng dòng. */
  await delay();

  try {
    /* [API THẬT]
       GET /api/orders/consignments/{orderId}/receipt  (responseType: "blob")
       Thay cả khối dưới bằng lời gọi axios rồi bọc response.data vào Blob PDF. */
    const order = resolveConsignment(
      normalizedOrderId
    );

    const pdfString =
      buildReceiptPdfString(
        buildReceiptModel(
          order,
          normalizedOrderId
        )
      );

    const pdfBlob = new Blob([pdfString], {
      type: "application/pdf",
    });

    if (options?.download) {
      triggerBlobDownload(
        pdfBlob,
        `Phieu-Bien-Nhan-Ky-Gui-${normalizedOrderId}.pdf`
      );
    }

    return pdfBlob;
  } catch (error) {
    console.error("GET CONSIGNMENT RECEIPT API ERROR:", error);
    throw new Error(
      error?.response?.data?.message ||
        error?.message ||
        "Không thể lấy phiếu biên nhận ký gửi.",
      { cause: error }
    );
  }
};

export default getConsignmentReceiptApi;
