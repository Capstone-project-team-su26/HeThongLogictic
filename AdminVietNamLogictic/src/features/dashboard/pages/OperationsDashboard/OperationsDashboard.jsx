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
import { getOperationsDashboardApi } from "@features/dashboard/api/dashboardService";
import {
  BarList,
  ChartCard,
  ColumnChart,
  StatTile,
} from "@features/dashboard/components/DashboardCharts";
import { formatCount, formatDayLabel } from "@features/dashboard/components/dashboardFormat";
import "@features/operations/styles/OperationsPage.css";

/*
 * Mỗi thẻ là MỘT hàng đợi việc của quản lý kho, đếm bằng API thật.
 * Một nguồn lỗi chỉ làm thẻ đó hiện "—", các thẻ còn lại vẫn dùng được.
 *
 * Phần thống kê bên dưới đọc từ GET /api/operations/dashboard (backend tự đếm): tồn kho theo
 * kho, luồng kiện 7 ngày (giờ VN), lô theo trạng thái, sự cố, thời gian xử lý chứng từ.
 * Bảng này cố ý KHÔNG có số tiền — quản lý vận hành không có quyền xem tài chính.
 */
const FLOW_SERIES = [
  { key: "originInbound", label: "Xếp kệ kho nguồn" },
  { key: "exported", label: "Xuất kho (bàn giao lô)" },
  { key: "arrivedVn", label: "Tiếp nhận kho VN" },
  { key: "dispatchedDelivery", label: "Giao cho hãng nội địa" },
];

const formatKg = (value) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(value) || 0)} kg`;

const oneDecimal = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/* Backend trả số phút trung bình; đổi ra đơn vị dễ đọc. */
const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 1) return "< 1 phút";
  if (minutes < 60) return `${Math.round(minutes)} phút`;
  if (minutes < 48 * 60) return `${oneDecimal.format(minutes / 60)} giờ`;
  return `${oneDecimal.format(minutes / 1440)} ngày`;
};

const WAREHOUSE_TYPE_LABELS = { ORIGIN: "Kho nguồn", DESTINATION: "Kho VN" };

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
  const [stats, setStats] = useState(null);
  const [statsFailed, setStatsFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [statsResult, ...results] = await Promise.allSettled([
      getOperationsDashboardApi(),
      ...CARDS.map((card) => card.count()),
    ]);
    setStats(statsResult.status === "fulfilled" ? statsResult.value : null);
    setStatsFailed(statsResult.status !== "fulfilled");
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

        {statsFailed && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Không tải được phần thống kê vận hành."
          />
        )}

        {stats && <OperationsStats stats={stats} />}
      </Spin>
    </div>
  );
}

/* ───────────────────────── Thống kê vận hành ───────────────────────── */

function OperationsStats({ stats }) {
  const totals = stats.stockTotals;
  const activeShipmentRows = stats.shipmentsByStatus.filter((row) => row.count > 0);

  return (
    <div className="dash-section">
      <h2 className="dash-section__title">Thống kê vận hành</h2>

      <div className="dash-stats">
        <StatTile
          label="Kiện đang lưu kho"
          value={formatCount(totals.storedParcels)}
          hint={`${formatKg(totals.storedWeightKg)} · ${stats.warehouses.length} kho`}
        />
        <StatTile
          label="Ô kệ đang có hàng"
          value={`${totals.occupancyPercent}%`}
          hint={`${formatCount(totals.occupiedBins)} / ${formatCount(totals.activeBins)} ô đang bật`}
        />
        <StatTile
          label="Lô quốc tế đang chạy"
          value={formatCount(stats.shipmentsInProgress)}
          hint="Từ bàn giao tới khi về Việt Nam"
        />
        <StatTile
          label="Sự cố đang mở"
          value={formatCount(stats.openIncidents)}
          hint="Chờ khách chọn hoặc chờ quyết định"
          tone={stats.openIncidents > 0 ? "warning" : "default"}
        />
      </div>

      <div className="dash-grid-2">
        <ChartCard title="Tồn kho theo kho" subtitle="Kiện đang nằm trên ô kệ (tồn AVAILABLE / RESERVED)">
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Kho</th>
                  <th>Kiện</th>
                  <th>Cân</th>
                  <th>Ô có hàng</th>
                </tr>
              </thead>
              <tbody>
                {stats.warehouses.map((w) => (
                  <tr key={w.warehouseId || w.warehouseName}>
                    <td>
                      <strong>{w.warehouseName || w.warehouseCode}</strong>
                      <br />
                      <small>{WAREHOUSE_TYPE_LABELS[w.warehouseType] ?? w.warehouseType}</small>
                    </td>
                    <td>{formatCount(w.storedParcels)}</td>
                    <td>{formatKg(w.storedWeightKg)}</td>
                    <td title={`${w.occupiedBins} / ${w.activeBins} ô đang bật`}>
                      {w.occupancyPercent}% ({w.occupiedBins}/{w.activeBins})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title="Luồng kiện 7 ngày" subtitle="Số kiện qua từng chặng mỗi ngày (giờ Việt Nam)">
          <ColumnChart
            data={stats.flow7Days}
            xKey="date"
            xLabel={formatDayLabel}
            series={FLOW_SERIES}
            ariaLabel="Số kiện theo chặng trong 7 ngày gần nhất"
          />
        </ChartCard>
      </div>

      <div className="dash-grid-3">
        <ChartCard title="Lô vận chuyển quốc tế" subtitle="Số lô theo trạng thái hiện tại">
          <BarList
            rows={activeShipmentRows.map((row) => ({
              key: row.key,
              label: row.label,
              value: row.count,
              valueText: `${formatCount(row.count)} (${row.percent}%)`,
            }))}
            emptyText="Chưa có lô nào."
          />
        </ChartCard>

        <ChartCard title="Sự cố hàng hoá" subtitle="Theo loại — đang mở / tổng">
          <BarList
            rows={stats.incidentsByType.map((row) => ({
              key: row.type,
              label: row.label,
              value: row.total,
              valueText: `${formatCount(row.open)} mở / ${formatCount(row.total)}`,
            }))}
            color="#eb6834"
          />
          <p className="dash-section__note" style={{ margin: 0 }}>
            {stats.incidentsByStatus.map((row) => `${row.label}: ${formatCount(row.count)}`).join(" · ")}
          </p>
        </ChartCard>

        <ChartCard
          title="Thời gian xử lý trung bình"
          subtitle={`Chứng từ được quyết định trong ${stats.processingWindowDays} ngày gần nhất`}
        >
          <div className="dash-table-wrap">
            <table className="dash-table">
              <tbody>
                {stats.processingTimes.map((row) => (
                  <tr key={row.key} title={row.measure}>
                    <td>
                      <strong>{row.label}</strong>
                      <br />
                      <small>{row.measure}</small>
                    </td>
                    <td>
                      <strong>{formatDuration(row.averageMinutes)}</strong>
                      <br />
                      <small>{formatCount(row.sampleCount)} chứng từ</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
