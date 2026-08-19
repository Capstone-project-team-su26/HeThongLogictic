import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ReloadOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import {
  getGoshipApiError,
  getGoshipOrders,
  getPackageStatusMeta,
  GOSHIP_STATUS_STEPS,
  simulateGoshipStatus,
  syncGoshipShipment,
} from "../../../api/OperationsAPI/goshipOrderService";
import AuthNotify from "../../../utils/Common/AuthNotify";
import "../../OperationsPage/OperationsPage.css";
import "../../OperationsPage/OperationsWroPage/OperationsWroPage.css";

const { Text } = Typography;

/**
 * Theo dõi vận đơn GoShip của các phiếu giao đã đặt.
 *
 * Trạng thái phiếu đứng yên ở `DELIVERY_DISPATCHED` suốt chặng giao — tiến độ thật nằm trên
 * TRẠNG THÁI KIỆN do hãng vận chuyển đẩy về, nên bảng này đọc kiện.
 *
 * Sandbox GoShip giữ mọi đơn ở "Đơn mới" và không bắn webhook, nên có thêm nút đặt tay trạng
 * thái để chạy thử hết luồng. Đường đó đi đúng logic mà webhook thật đi qua, và bị máy chủ khoá
 * ở môi trường Production.
 */

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

/** Trạng thái chung của phiếu suy từ các kiện — kiện lệch nhau thì lấy cái chậm nhất. */
const resolveOrderProgress = (order) => {
  const statuses = (order.parcels || [])
    .map((parcel) => String(parcel.packageStatus || "").toUpperCase())
    .filter(Boolean);

  if (statuses.length === 0) return "AWAITING_PICKUP";
  if (statuses.every((status) => status === "DELIVERED")) return "DELIVERED";

  const unfinished = statuses.filter((status) => status !== "DELIVERED");
  return unfinished[0];
};

export default function SaleGoshipOrdersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyCode, setBusyCode] = useState("");
  const [simulating, setSimulating] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await getGoshipOrders());
    } catch (err) {
      setError(getGoshipApiError(err, "Không tải được danh sách vận đơn GoShip."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      [row.deliveryCode, row.orderCode, row.carrierTrackingCode, row.customerName, row.receiverName]
        .some((value) => String(value || "").toLowerCase().includes(keyword)),
    );
  }, [rows, search]);

  const handleSync = useCallback(
    async (order) => {
      setBusyCode(order.carrierTrackingCode);
      try {
        const result = await syncGoshipShipment(order.carrierTrackingCode);
        AuthNotify.success(
          "Đã hỏi GoShip",
          `${order.carrierTrackingCode}: ${result?.statusText || "đã cập nhật"}.`,
        );
        await load();
      } catch (err) {
        AuthNotify.error(
          "Chưa tra được trạng thái",
          getGoshipApiError(err, "GoShip không trả về trạng thái."),
        );
      } finally {
        setBusyCode("");
      }
    },
    [load],
  );

  const handleSimulate = useCallback(
    async (order, step) => {
      setBusyCode(order.carrierTrackingCode);
      try {
        await simulateGoshipStatus(order.carrierTrackingCode, step.code, step.label);
        AuthNotify.success(
          "Đã đặt trạng thái",
          `${order.carrierTrackingCode} → ${step.label}.`,
        );
        setSimulating(null);
        await load();
      } catch (err) {
        AuthNotify.error(
          "Chưa đặt được trạng thái",
          getGoshipApiError(err, "Không đặt được trạng thái vận đơn."),
        );
      } finally {
        setBusyCode("");
      }
    },
    [load],
  );

  const columns = useMemo(
    () => [
      {
        title: "Mã vận đơn",
        dataIndex: "carrierTrackingCode",
        width: 170,
        render: (value, row) => (
          <Space orientation="vertical" size={0}>
            <Text strong copyable={{ text: value }}>
              {value}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.deliveryCode}
            </Text>
          </Space>
        ),
      },
      {
        title: "Đơn ký gửi",
        dataIndex: "orderCode",
        width: 210,
        render: (value, row) => (
          <Space orientation="vertical" size={0}>
            <Text>{value || "—"}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.customerName || "Khách hàng VCL"}
            </Text>
          </Space>
        ),
      },
      {
        title: "Người nhận",
        dataIndex: "receiverName",
        render: (value, row) => (
          <Space orientation="vertical" size={0}>
            <Text>
              {value || "—"} · {row.receiverPhone || "—"}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.fullAddress || "—"}
            </Text>
          </Space>
        ),
      },
      {
        title: "Kiện",
        dataIndex: "totalParcels",
        width: 80,
        align: "center",
        render: (value) => `${value ?? 0}`,
      },
      {
        title: "Tiến độ giao",
        width: 180,
        render: (_, row) => {
          const meta = getPackageStatusMeta(resolveOrderProgress(row));
          return <Tag color={meta.tone === "default" ? undefined : meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "Đặt giao lúc",
        dataIndex: "dispatchedAt",
        width: 165,
        render: (value) => formatDateTime(value),
      },
      {
        title: "Thao tác",
        width: 210,
        render: (_, row) => (
          <Space>
            <Tooltip title="Hỏi GoShip trạng thái mới nhất">
              <Button
                size="small"
                icon={<SyncOutlined />}
                loading={busyCode === row.carrierTrackingCode}
                onClick={() => handleSync(row)}
              >
                Đồng bộ
              </Button>
            </Tooltip>
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ThunderboltOutlined />}
              onClick={() => setSimulating(row)}
            >
              Mô phỏng
            </Button>
          </Space>
        ),
      },
    ],
    [busyCode, handleSync],
  );

  const deliveredCount = useMemo(
    () => rows.filter((row) => resolveOrderProgress(row) === "DELIVERED").length,
    [rows],
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>KINH DOANH (SALE)</span>
          <h1>Đơn GoShip</h1>
          <p>
            Vận đơn của những phiếu giao đã đặt hãng. Tiến độ lấy từ trạng thái kiện GoShip đẩy
            về; sandbox không tự báo nên bấm đồng bộ, hoặc đặt tay trạng thái khi chạy thử.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Đang theo dõi</small>
            <strong>{rows.length} vận đơn</strong>
          </div>
          <div className="ops-page__weight-chip">
            <small>Đã giao xong</small>
            <strong>{deliveredCount} vận đơn</strong>
          </div>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={loading} />}
            disabled={loading}
            onClick={load}
          >
            Làm mới
          </Button>
        </div>
      </section>

      {error ? (
        <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />
      ) : null}

      <Input.Search
        allowClear
        placeholder="Tìm theo mã vận đơn, mã phiếu, đơn ký gửi, khách hàng..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        style={{ maxWidth: 460, marginBottom: 16 }}
      />

      <Table
        rowKey={(row) => row.deliveryRequestId || row.carrierTrackingCode}
        columns={columns}
        dataSource={filtered}
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: false }}
        locale={{
          emptyText: (
            <Empty
              description="Chưa có phiếu giao nào đặt vận đơn GoShip."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
      />

      <Modal
        open={!!simulating}
        onCancel={() => setSimulating(null)}
        footer={null}
        width={560}
        title={
          <>
            Đặt trạng thái vận đơn{" "}
            <Typography.Text code>{simulating?.carrierTrackingCode}</Typography.Text>
          </>
        }
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Chỉ dùng khi chạy thử"
          description="Đặt tay đi đúng đường mà webhook của hãng đi qua: đổi trạng thái kiện, và khi mọi kiện của đơn đã giao xong thì đơn tự chuyển sang Đã giao. Môi trường thật khoá thao tác này."
        />

        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          {GOSHIP_STATUS_STEPS.map((step) => (
            <Button
              key={step.code}
              block
              loading={busyCode === simulating?.carrierTrackingCode}
              onClick={() => handleSimulate(simulating, step)}
              style={{ textAlign: "left", height: "auto", padding: "8px 14px" }}
            >
              <Space>
                <Tag>{step.code}</Tag>
                <Text strong>{step.label}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  kiện → {step.packageStatus}
                </Text>
              </Space>
            </Button>
          ))}
        </Space>
      </Modal>
    </div>
  );
}
