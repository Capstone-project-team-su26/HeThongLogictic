import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Spin } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

import {
  listDeliveryRequests,
  listInboundRequests,
  listWarehouseReleases,
} from "@features/operations";
import { listReceivingNotes } from "@features/receiving";
import { listIncidents } from "@features/incident";
import { getTrackingQueue } from "@features/shipment";
import "@features/operations/styles/OperationsPage.css";

/*
 * Mỗi thẻ là MỘT hàng đợi việc của quản lý kho, đếm bằng API thật. Không còn biểu đồ dựng từ
 * dữ liệu mẫu: số liệu phân tích cũ không có API tương ứng ở backend nên đã bỏ.
 * Một nguồn lỗi chỉ làm thẻ đó hiện "—", các thẻ còn lại vẫn dùng được.
 */
const CARDS = [
  {
    key: "wro",
    label: "Phiếu xuất kho chờ duyệt",
    path: "/operations-manager/wro",
    count: async () => (await listWarehouseReleases({ status: "PENDING_APPROVAL", pageSize: 1 })).totalCount,
  },
  {
    key: "receiving",
    label: "Phiếu nhập kho gốc cần quyết định",
    path: "/operations-manager/receiving-approvals",
    count: async () => (await listReceivingNotes({ status: "AWAITING" })).totalCount,
  },
  {
    key: "incidents",
    label: "Sự cố hàng hoá chờ quyết",
    path: "/operations-manager/incidents",
    count: async () => (await listIncidents({ status: "OPEN,CUSTOMER_RESPONDED", pageSize: 1 })).totalCount,
  },
  {
    key: "inbound",
    label: "Phiếu nhập kho VN chờ duyệt",
    path: "/operations-manager/inbound-approvals",
    count: async () => (await listInboundRequests({ status: "INBOUND_PENDING" })).length,
  },
  {
    key: "delivery",
    label: "Yêu cầu giao chờ duyệt",
    path: "/operations-manager/delivery-approvals",
    count: async () => (await listDeliveryRequests({ status: "DELIVERY_PENDING" })).length,
  },
  {
    key: "shipments",
    label: "Lô cần chú ý (trễ / tạm giữ / lâu chưa cập nhật)",
    path: "/operations-manager/shipments",
    count: async () => (await getTrackingQueue({ attentionOnly: true })).length,
  },
];

export default function OperationsDashboard() {
  const [counts, setCounts] = useState({});
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled(CARDS.map((card) => card.count()));
    const next = {};
    const errors = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") next[CARDS[index].key] = result.value;
      else errors.push(CARDS[index].label);
    });
    setCounts(next);
    setFailed(errors);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>BỘ PHẬN VẬN HÀNH (OPS)</span>
          <h1>Tổng Quan Vận Hành</h1>
          <p>Các việc đang chờ quản lý kho quyết định. Bấm vào thẻ để mở hàng đợi tương ứng.</p>
        </div>
        <div className="ops-page__hero-actions">
          <Button type="primary" icon={<ReloadOutlined spin={loading} />} onClick={load} disabled={loading}>
            Làm mới
          </Button>
        </div>
      </section>

      {failed.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Không tải được: ${failed.join(", ")}.`}
        />
      )}

      <Spin spinning={loading}>
        <div className="ops-kpi-grid">
          {CARDS.map((card) => (
            <Link key={card.key} to={card.path} className="ops-kpi-card">
              <span className="ops-kpi-card__label">{card.label}</span>
              <strong className="ops-kpi-card__value">
                {counts[card.key] === undefined ? "—" : counts[card.key]}
              </strong>
            </Link>
          ))}
        </div>
      </Spin>
    </div>
  );
}
