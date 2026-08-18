/**
 * Hành trình lô hàng của một đơn — dùng chung cho cả ký gửi lẫn mua hộ.
 *
 * Sale là người nghe khách hỏi "hàng em tới đâu rồi", nên cần thấy đúng thứ màn Vận chuyển của
 * OM đang thấy: mã lô, chặng, và kết quả kho VN kiểm đếm từng kiện. Component chỉ dựng phần
 * ruột — mỗi màn tự bọc bằng khung section của mình để không phá bố cục sẵn có.
 */

import { Tag } from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  TagsOutlined,
} from "@ant-design/icons";

import "./ShipmentJourney.css";

/** Màu tag theo chặng của lô — dùng chung cách gọi màu với màn Vận chuyển của OM. */
const SHIPMENT_TONE_MAP = {
  MANIFESTED: "processing",
  CUSTOMS_EXPORT_PENDING: "warning",
  IN_TRANSIT: "processing",
  CUSTOMS_IMPORT_PENDING: "warning",
  ARRIVED: "success",
  ARRIVED_DESTINATION: "success",
  ARRIVED_IN_VN: "success",
  CUSTOMS_REJECTED: "error",
  HOLD: "error",
  ISSUE: "error",
  CANCELLED: "error",
};

const PARCEL_TONE_MAP = {
  IN_TRANSIT: "processing",
  ARRIVED_DESTINATION: "processing",
  RECEIVED_AT_DESTINATION: "success",
  DELIVERED: "success",
  RETURNED_TO_WAREHOUSE: "error",
};

const formatKg = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "";
  }

  return `${number.toLocaleString("vi-VN", {
    maximumFractionDigits: 3,
  })} kg`;
};

const formatMoment = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

function ParcelCard({ parcel }) {
  const inspection = parcel?.inspection;
  const weightText = formatKg(parcel?.weight);
  const inspectedAt = formatMoment(inspection?.inspectedAt);

  return (
    <div
      className={`shipment-journey-parcel ${
        inspection?.hasDiscrepancy ? "is-discrepancy" : ""
      }`}
    >
      <div className="shipment-journey-parcel__top">
        <strong>{parcel?.packageCode || "Kiện chưa có mã"}</strong>

        <Tag color={PARCEL_TONE_MAP[parcel?.status] || "default"}>
          {parcel?.statusText || "Đang xử lý"}
        </Tag>
      </div>

      <div className="shipment-journey-parcel__facts">
        {weightText && <span>{weightText}</span>}

        {parcel?.destinationHandlingText && (
          <span>{parcel.destinationHandlingText}</span>
        )}

        {inspectedAt && <span>Kho kiểm đếm {inspectedAt}</span>}
      </div>

      {inspection?.hasDiscrepancy && (
        <p className="shipment-journey-parcel__alert">
          <CloseCircleOutlined />

          <span>
            Kho ghi nhận: <strong>{inspection.summary}</strong>
            {inspection.note ? ` — “${inspection.note}”` : ""}
          </span>
        </p>
      )}

      {inspection && !inspection.hasDiscrepancy && (
        <p className="shipment-journey-parcel__ok">
          <CheckCircleOutlined />
          <span>Kho kiểm đếm khớp khai báo</span>
        </p>
      )}
    </div>
  );
}

/**
 * Một lô và những kiện của đơn đang đi theo lô đó.
 *
 * Gom theo lô chứ không liệt kê phẳng, vì đơn bị tách làm nhiều chuyến là chuyện bình thường —
 * khách hỏi thì Sale phải trả lời được từng kiện đang ở đâu.
 */
function ShipmentLot({ group }) {
  const parcels = Array.isArray(group?.parcels) ? group.parcels : [];
  const shippedAt = formatMoment(group?.shippedAt);
  const deliveredAt = formatMoment(group?.deliveredAt);

  const hasRoute =
    group?.originWarehouseName || group?.destinationWarehouseName;

  return (
    <article className="shipment-journey-lot">
      <header className="shipment-journey-lot__head">
        <div className="shipment-journey-lot__id">
          <span>{group?.shipmentId ? "Lô vận chuyển" : "Kiện chưa xếp lô"}</span>

          <strong>{group?.shipmentCode || "Chưa có mã lô"}</strong>
        </div>

        <Tag color={SHIPMENT_TONE_MAP[group?.status] || "default"}>
          {group?.statusText || "Đang xử lý"}
        </Tag>
      </header>

      <div className="shipment-journey-lot__meta">
        {hasRoute && (
          <span>
            <EnvironmentOutlined />
            {group?.originWarehouseName || "Kho nước ngoài"} →{" "}
            {group?.destinationWarehouseName || "Kho Việt Nam"}
          </span>
        )}

        {group?.carrierTrackingCode && (
          <span>
            <TagsOutlined />
            Vận đơn hãng: <strong>{group.carrierTrackingCode}</strong>
          </span>
        )}

        {shippedAt && (
          <span>
            <CalendarOutlined />
            Rời kho {shippedAt}
          </span>
        )}

        {deliveredAt && (
          <span>
            <CheckCircleOutlined />
            Về kho {deliveredAt}
          </span>
        )}
      </div>

      <div className="shipment-journey-parcels">
        {parcels.map((parcel) => (
          <ParcelCard key={parcel?.parcelId} parcel={parcel} />
        ))}
      </div>
    </article>
  );
}

/**
 * @param {{ groups: Array, discrepancyCount: number }} props
 */
export default function ShipmentJourney({ groups, discrepancyCount = 0 }) {
  const safeGroups = Array.isArray(groups) ? groups : [];

  if (safeGroups.length === 0) {
    return null;
  }

  return (
    <>
      {discrepancyCount > 0 && (
        <div className="shipment-journey-warning">
          <CloseCircleOutlined />

          <span>
            <strong>{discrepancyCount} kiện</strong> bị kho Việt Nam ghi nhận
            lệch so với khai báo. Nên chủ động gọi báo khách trước khi khách phát
            hiện.
          </span>
        </div>
      )}

      <div className="shipment-journey-list">
        {safeGroups.map((group) => (
          <ShipmentLot
            key={group?.shipmentId || "unassigned"}
            group={group}
          />
        ))}
      </div>
    </>
  );
}
