import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Empty, Space, Switch, Table, Tabs, Tag, Tooltip, Typography } from "antd";
import { ClockCircleOutlined, ReloadOutlined, WarningOutlined } from "@ant-design/icons";

import {
  getShipmentApiError,
  getShipmentStatusMeta,
  getTrackingQueue,
} from "@features/shipment/api/internationalShipmentService";
import ShipmentTimelineDrawer from "@features/shipment/components/ShipmentTimelineDrawer/ShipmentTimelineDrawer";
import ShipmentWorkspace from "@features/shipment/components/ShipmentWorkspace/ShipmentWorkspace";
import { getDocumentTypeLabel } from "@features/attachments";
import "@features/operations/styles/OperationsPage.css";

const { Text } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN");
};

/**
 * Theo dõi lô về Việt Nam — màn làm việc hằng ngày của Sale (api-xuat-kho.md mục M).
 *
 * Tab 1 "Hàng đợi theo dõi": lô đã bàn giao mà chưa về kho đích, xếp lô bàn giao mới nhất lên
 * trên; FE tô đỏ `isOverdue`, nhắc `needsUpdate` (bật công tắc "Chỉ lô cần xử lý" để lọc).
 * Nút ghi mốc CHỈ hiện đúng các mốc trong `nextMilestones` (mở Drawer để ghi kèm lời nhắn cho
 * khách, ghi chú nội bộ, vị trí, mã tra cứu; thiếu giấy tờ thì tải lên ngay cạnh nút).
 * Tab 2 "Tất cả lô": tra cứu mọi lô theo trạng thái.
 */
export default function SaleShipmentsPage() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [openId, setOpenId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      setRows(await getTrackingQueue({ attentionOnly }));
    } catch (error) {
      setErrorMessage(getShipmentApiError(error, "Không tải được hàng đợi theo dõi lô."));
    } finally {
      setLoading(false);
    }
  }, [attentionOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const openOrder = useCallback((orderId) => navigate(`/sale/tracking/${orderId}`), [navigate]);

  /* Lô bàn giao mới nhất lên trên (theo yêu cầu vận hành); lô quá hạn vẫn tô đỏ để không bị sót. */
  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) => new Date(b.handedOverAt || 0).getTime() - new Date(a.handedOverAt || 0).getTime(),
      ),
    [rows],
  );

  const overdueCount = useMemo(() => rows.filter((row) => row.isOverdue).length, [rows]);
  const staleCount = useMemo(() => rows.filter((row) => row.needsUpdate).length, [rows]);

  const columns = useMemo(
    () => [
      {
        title: "Mã lô",
        dataIndex: "shipmentCode",
        width: 190,
        render: (value, row) => (
          <Space direction="vertical" size={2}>
            <Button type="link" style={{ padding: 0 }} onClick={() => setOpenId(row.shipmentId)}>
              {value || "—"}
            </Button>
            {row.isOverdue ? (
              <Tag color="error" icon={<WarningOutlined />}>
                Quá ngày dự kiến
              </Tag>
            ) : null}
            {row.needsUpdate ? (
              <Tag color="warning" icon={<ClockCircleOutlined />}>
                {row.daysSinceLastUpdate} ngày chưa cập nhật
              </Tag>
            ) : null}
          </Space>
        ),
      },
      {
        title: "Tuyến / hãng",
        key: "route",
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Text>
              {row.originWarehouseName || "—"} → {row.destinationWarehouseName || "—"}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.carrierName || "—"}
              {row.carrierTrackingCode ? ` · ${row.carrierTrackingCode}` : ""}
            </Text>
          </Space>
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 180,
        render: (value, row) => {
          const meta = getShipmentStatusMeta(value);
          return <Tag color={meta.color}>{row.statusText || meta.label}</Tag>;
        },
      },
      {
        title: "Mốc thời gian",
        key: "dates",
        width: 210,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Text>Bàn giao: {formatDateTime(row.handedOverAt)}</Text>
            <Text type={row.isOverdue ? "danger" : "secondary"}>
              Dự kiến về: {formatDate(row.estimatedArrivalDate)}
            </Text>
            <Text type="secondary">Cập nhật: {formatDateTime(row.lastUpdateAt)}</Text>
          </Space>
        ),
      },
      {
        title: "Quy mô",
        key: "scale",
        width: 120,
        render: (_, row) => `${row.orderCount || 0} đơn · ${row.parcelCount || 0} kiện`,
      },
      {
        title: "Mốc tiếp theo",
        key: "next",
        width: 280,
        render: (_, row) => {
          const next = Array.isArray(row.nextMilestones) ? row.nextMilestones : [];
          if (!next.length) return <Text type="secondary">—</Text>;
          return (
            <Space size={[4, 4]} wrap>
              {next.map((item) => {
                const missing = item.missingDocuments || [];
                return (
                  <Tooltip
                    key={item.status}
                    title={missing.length ? `Thiếu: ${missing.map(getDocumentTypeLabel).join(", ")}` : ""}
                  >
                    <Button
                      size="small"
                      type={missing.length ? "default" : "primary"}
                      danger={missing.length > 0}
                      onClick={() => setOpenId(row.shipmentId)}
                    >
                      {item.text || item.status}
                    </Button>
                  </Tooltip>
                );
              })}
            </Space>
          );
        },
      },
    ],
    [],
  );

  const queueTab = (
    <>
      {!!errorMessage && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={errorMessage} />
      )}
      <Space style={{ marginBottom: 12 }} wrap>
        <Switch checked={attentionOnly} onChange={setAttentionOnly} />
        <Text>Chỉ lô cần xử lý (quá hạn, ≥ 3 ngày chưa có mốc, đang trễ / tạm giữ)</Text>
        <Button icon={<ReloadOutlined spin={loading} />} onClick={load} disabled={loading}>
          Làm mới
        </Button>
      </Space>
      <Table
        rowKey="shipmentId"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={sortedRows}
        scroll={{ x: 1250 }}
        rowClassName={(row) => (row.isOverdue ? "ops-row--danger" : "")}
        pagination={{ pageSize: 15, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="Không có lô nào đang trên đường." /> }}
      />
    </>
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>KINH DOANH (SALE)</span>
          <h1>Theo Dõi Lô Về Việt Nam</h1>
          <p>
            Ghi từng mốc hành trình sau khi kho bàn giao lô cho hãng. Mỗi mốc tự báo cho khách của
            từng đơn trong lô — lời nhắn cho khách và ghi chú nội bộ nhập riêng.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Quá ngày dự kiến</small>
            <strong>{overdueCount} lô</strong>
          </div>
          <div className="ops-page__weight-chip">
            <small>Lâu chưa cập nhật</small>
            <strong>{staleCount} lô</strong>
          </div>
        </div>
      </section>

      <Tabs
        items={[
          { key: "queue", label: `Hàng đợi theo dõi (${rows.length})`, children: queueTab },
          {
            key: "all",
            label: "Tất cả lô",
            children: <ShipmentWorkspace canUpdate onOpenOrder={openOrder} />,
          },
        ]}
      />

      <ShipmentTimelineDrawer
        open={!!openId}
        shipmentId={openId}
        onClose={() => setOpenId("")}
        onChanged={load}
        onOpenOrder={openOrder}
      />
    </div>
  );
}
