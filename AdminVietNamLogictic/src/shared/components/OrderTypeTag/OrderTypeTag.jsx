import { Tag, Tooltip } from "antd";

import { isPurchaseRecord } from "./orderType";

/**
 * Nhãn loại hàng dùng chung — "Mua hộ" tím, "Ký gửi" xanh — cho phiếu tiếp nhận, phiếu xuất kho,
 * lô vận chuyển: nhìn lướt bảng là tách được hai loại.
 *
 * @param {{ record?: object, purchase?: boolean, showCode?: boolean }} props
 *   `record` có isPurchase / orderType / purchaseCode; hoặc truyền thẳng `purchase`.
 *   `showCode`: rê chuột vào nhãn "Mua hộ" hiện mã yêu cầu mua hộ.
 */
export default function OrderTypeTag({ record, purchase, showCode = true }) {
  const isPurchase = typeof purchase === "boolean" ? purchase : isPurchaseRecord(record);
  if (!isPurchase) {
    return (
      <Tag color="blue" style={{ marginInlineEnd: 0 }}>
        Ký gửi
      </Tag>
    );
  }
  const tag = (
    <Tag color="purple" style={{ marginInlineEnd: 0 }}>
      Mua hộ
    </Tag>
  );
  return showCode && record?.purchaseCode ? (
    <Tooltip title={`Yêu cầu mua hộ ${record.purchaseCode}`}>{tag}</Tooltip>
  ) : (
    tag
  );
}
