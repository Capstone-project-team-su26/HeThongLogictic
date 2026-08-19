import { Steps, Tooltip, Typography } from "antd";
import {
  CheckCircleOutlined,
  HomeOutlined,
  InboxOutlined,
  SendOutlined,
  CarOutlined,
} from "@ant-design/icons";

import { SHIPMENT_STATUS_META } from "../../api/OperationsAPI/consolidationWorkflowService";

/**
 * Hành trình lô vẽ thành một dải mốc, dùng chung cho cả ba vai.
 *
 * Mục đích: nhìn một cái là biết lô đang ở đâu và ai đang phải bấm nút tiếp theo — thay vì đọc
 * một chuỗi trạng thái viết hoa rồi tự đoán thứ tự.
 */

const JOURNEY = [
  {
    key: "CREATED",
    title: "Gom lô",
    actor: "Kho quốc tế",
    icon: <InboxOutlined />,
    desc: "Kiện đã bốc xong được gom thành lô.",
  },
  {
    key: "READY_TO_SHIP",
    title: "Sẵn sàng xuất kho",
    actor: "Kho quốc tế",
    icon: <SendOutlined />,
    desc: "Hàng xếp xong, chờ đối tác tới lấy.",
  },
  {
    key: "IN_TRANSIT",
    title: "Đang về VN",
    actor: "Kho quốc tế",
    icon: <CarOutlined />,
    desc: "Đối tác đã lấy hàng. Ô kệ được nhả, tồn kho trừ đi.",
  },
  {
    key: "ARRIVED_VN",
    title: "Đã về Việt Nam",
    actor: "Sale",
    icon: <CheckCircleOutlined />,
    desc: "Hàng tới VN, chờ xe chuyển về kho. Khách được báo tự động.",
  },
  {
    key: "ARRIVED_DESTINATION",
    title: "Về tới kho VN",
    actor: "Sale",
    icon: <HomeOutlined />,
    desc: "Kho VN mở lô đối soát từng kiện.",
  },
];

/** Trạng thái của lô cũ nằm ngoài dải mốc — quy về mốc gần nhất để thanh tiến trình không vỡ. */
const LEGACY_POSITION = {
  MANIFESTED: 0,
  LOT_CREATED: 0,
  PREPARING: 0,
  CUSTOMS_EXPORT_PENDING: 2,
  CUSTOMS_IMPORT_PENDING: 2,
  ARRIVED: 4,
  ARRIVED_IN_VN: 4,
};

export function getJourneyIndex(status) {
  const key = String(status || "").toUpperCase();
  const direct = JOURNEY.findIndex((step) => step.key === key);
  if (direct >= 0) return direct;
  return LEGACY_POSITION[key] ?? 0;
}

export default function ShipmentJourneySteps({ status, size = "small", direction = "horizontal" }) {
  const key = String(status || "").toUpperCase();
  const current = getJourneyIndex(status);

  // Lô đang treo thì dải mốc phải nói ra, không thì nhìn vào tưởng vẫn đang chạy bình thường.
  const isBlocked = key === "HOLD" || key === "ISSUE" || key === "CUSTOMS_REJECTED";
  const meta = SHIPMENT_STATUS_META[key];

  return (
    <div>
      <Steps
        size={size}
        direction={direction}
        current={current}
        status={isBlocked ? "error" : current >= JOURNEY.length - 1 ? "finish" : "process"}
        items={JOURNEY.map((step, index) => ({
          title: (
            <Tooltip title={step.desc}>
              <span>{step.title}</span>
            </Tooltip>
          ),
          description: (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {index <= current ? step.actor : `${step.actor} sẽ bấm`}
            </Typography.Text>
          ),
          icon: step.icon,
        }))}
      />
      {isBlocked ? (
        <Typography.Text type="danger" style={{ display: "block", marginTop: 8 }}>
          Lô đang ở trạng thái {meta?.label || key} — cần người xử lý trước khi đi tiếp.
        </Typography.Text>
      ) : null}
    </div>
  );
}

export { JOURNEY as SHIPMENT_JOURNEY };
