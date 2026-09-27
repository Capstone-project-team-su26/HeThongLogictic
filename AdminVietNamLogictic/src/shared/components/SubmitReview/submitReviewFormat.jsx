/**
 * Phần "không phải component" của khối xem lại trước khi gửi: định dạng số, cộng tổng dòng
 * hàng, cột chuẩn của bảng hàng, props chuẩn của Modal.
 *
 * Tách khỏi SubmitReview.jsx vì Vite Fast Refresh chỉ nạp nóng được file CHỈ export
 * component (luật react-refresh/only-export-components). Xem giải thích đầy đủ ở
 * SubmitReview.jsx.
 */

import { Space, Tag, Typography } from "antd";

const { Text } = Typography;

/* =========================
   ĐỊNH DẠNG SỐ
========================= */

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/** Tiền VNĐ. Không có số thì "—" (khác hẳn 0đ — 0đ là số thật backend trả). */
export const formatReviewMoney = (value) => {
  const number = toNumber(value);
  return number === null ? "—" : `${number.toLocaleString("vi-VN")}đ`;
};

export const formatReviewNumber = (value, digits = 2) => {
  const number = toNumber(value);
  return number === null
    ? "—"
    : number.toLocaleString("vi-VN", { maximumFractionDigits: digits });
};

export const formatReviewKg = (value) => {
  const number = toNumber(value);
  return number === null ? "—" : `${formatReviewNumber(number, 3)} kg`;
};

/** D×R×C theo cm; thiếu một chiều là coi như chưa khai, không hiện nửa vời. */
export const formatReviewDimensions = (length, width, height) => {
  const values = [length, width, height].map(toNumber);
  if (values.some((value) => value === null || value <= 0)) return "—";
  return `${values.map((value) => formatReviewNumber(value, 1)).join(" × ")} cm`;
};

export const formatReviewDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

/* =========================
   CỘNG TỔNG DÒNG HÀNG
========================= */

/**
 * Tổng các dòng hàng khách khai.
 *
 * `weight` và `declaredValue` của một dòng là số CỦA CẢ DÒNG (backend cũng cộng thẳng
 * `Sum(i.Weight)` ra `TotalWeight` của đơn), nên ở đây chỉ cộng, không nhân với số lượng.
 * Trường nào không dòng nào có thì trả null để màn hiện "—" thay vì "0".
 */
export const summarizeDeclaredItems = (items = []) => {
  const list = Array.isArray(items) ? items : [];

  const sumOf = (pick) => {
    let seen = false;
    const total = list.reduce((sum, item) => {
      const number = toNumber(pick(item));
      if (number === null) return sum;
      seen = true;
      return sum + number;
    }, 0);
    return seen ? total : null;
  };

  return {
    lineCount: list.length,
    quantity: sumOf((item) => item?.quantity ?? item?.declaredQuantity),
    weight: sumOf((item) => item?.weight ?? item?.declaredWeight),
    declaredValue: sumOf((item) => item?.declaredValue),
    volumetricWeight: sumOf((item) => item?.volumetricWeight),
  };
};

/* =========================
   CỘT MẶC ĐỊNH CỦA BẢNG HÀNG
========================= */

/** Thùng gỗ + dịch vụ đi kèm một dòng hàng, ghép thành các nhãn nhỏ. */
const renderItemExtras = (item) => {
  const tags = [];

  const crate = item?.packageConfiguration;
  if (crate && (crate.configName || crate.configCode)) {
    tags.push(
      <Tag key="crate" color="gold">
        Thùng: {crate.configName || crate.configCode}
      </Tag>,
    );
  }

  (Array.isArray(item?.services) ? item.services : []).forEach((service, index) => {
    const label = service?.name || service?.code;
    if (label) {
      tags.push(<Tag key={service?.pricingRuleId || service?.code || index}>{label}</Tag>);
    }
  });

  return tags.length ? (
    <Space size={[4, 4]} wrap>
      {tags}
    </Space>
  ) : (
    <Text type="secondary">Không chọn thêm</Text>
  );
};

/**
 * Cột chuẩn cho dòng hàng khách khai: tên · loại · SL · cân · D×R×C · khai giá · thùng/dịch vụ.
 * Màn nào có thêm cột riêng (link sản phẩm, đơn giá...) thì truyền `columns` của mình.
 */
export const buildDeclaredItemColumns = () => [
  {
    title: "Tên hàng",
    dataIndex: "productName",
    render: (value, item) => (
      <Space direction="vertical" size={0}>
        <Text strong>{value || "—"}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {item?.productTypeName || item?.productType || "Chưa phân loại"}
        </Text>
        {item?.domesticTrackingCode ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Mã vận đơn nội địa: {item.domesticTrackingCode}
          </Text>
        ) : null}
      </Space>
    ),
  },
  {
    title: "SL",
    key: "quantity",
    width: 60,
    align: "center",
    render: (_, item) => formatReviewNumber(item?.quantity ?? item?.declaredQuantity, 0),
  },
  {
    title: "Cân khai",
    key: "weight",
    width: 100,
    align: "right",
    render: (_, item) => formatReviewKg(item?.weight ?? item?.declaredWeight),
  },
  {
    title: "D × R × C",
    key: "dimensions",
    width: 150,
    render: (_, item) => formatReviewDimensions(item?.length, item?.width, item?.height),
  },
  {
    title: "Khai giá",
    dataIndex: "declaredValue",
    width: 120,
    align: "right",
    render: (value) => formatReviewMoney(value),
  },
  {
    title: "Thùng · dịch vụ kèm",
    key: "extras",
    width: 220,
    render: (_, item) => renderItemExtras(item),
  },
];

/**
 * Props dùng chung cho Modal chứa phần xem lại: đủ rộng để đọc bảng, thân modal tự cuộn nên
 * hàng dài bao nhiêu thì nút gửi ở chân modal vẫn luôn nhìn thấy.
 */
export const REVIEW_MODAL_PROPS = Object.freeze({
  width: 1000,
  centered: true,
  styles: Object.freeze({
    body: Object.freeze({ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }),
  }),
});
