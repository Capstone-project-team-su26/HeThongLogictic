import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Input, Select, Space, Switch, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

import {
  getInventoryApiError,
  getInventoryStatusMeta,
  INVENTORY_STATUS_META,
  listInventories,
} from "@features/operations/api/inventoryService";
import { getActiveWarehousesApi } from "@features/warehouse/api/warehouseService";
import "@features/operations/styles/OperationsPage.css";

const { Text } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

/**
 * Tồn kho theo kho (GET /api/inventories) — chỉ xem. Quản lý kho và Admin (giám sát) dùng chung.
 * Chuyển ô / tách / gộp / kiểm kê là thao tác của nhân viên kho trên app kho.
 */
export default function OperationsParcelsPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState("");
  const [includeReleased, setIncludeReleased] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    getActiveWarehousesApi()
      .then(setWarehouses)
      .catch((error) => setErrorMessage(getInventoryApiError(error, "Không tải được danh sách kho.")));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      setRows(await listInventories({ warehouseId, status }));
    } catch (error) {
      setErrorMessage(getInventoryApiError(error, "Không tải được tồn kho."));
    } finally {
      setLoading(false);
    }
  }, [warehouseId, status]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleRows = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      if (!includeReleased && !status && String(row.status).toUpperCase() === "RELEASED") return false;
      if (!needle) return true;
      return [row.packageCode, row.consignmentCode, row.customerName, row.customerCode, row.binCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [rows, keyword, includeReleased, status]);

  const columns = [
    { title: "Mã kiện", dataIndex: "packageCode", width: 170, render: (v) => <Text code>{v || "—"}</Text> },
    { title: "Đơn", dataIndex: "consignmentCode", width: 200, render: (v) => v || "—" },
    {
      title: "Khách hàng",
      key: "customer",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>{row.customerName || "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.customerCode || ""} {row.customerPhone ? `· ${row.customerPhone}` : ""}
          </Text>
        </Space>
      ),
    },
    {
      title: "Kho / ô kệ",
      key: "bin",
      width: 200,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>{row.warehouseName || "—"}</Text>
          <Text type="secondary">{row.binCode || "—"}</Text>
        </Space>
      ),
    },
    {
      title: "Cân nặng",
      dataIndex: "actualWeight",
      align: "right",
      width: 100,
      render: (v) => (v != null ? `${Number(v).toLocaleString("vi-VN")} kg` : "—"),
    },
    { title: "Lên kệ lúc", dataIndex: "storedAt", width: 165, render: formatDateTime },
    { title: "Ngày lưu", dataIndex: "storageDays", align: "center", width: 90 },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 180,
      render: (value) => {
        const meta = getInventoryStatusMeta(value);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
  ];

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>KHO VẬN</span>
          <h1>Tồn Kho</h1>
          <p>Kiện đang nằm trong kho theo từng ô kệ, kèm số ngày lưu. Chỉ xem — thao tác kho làm trên app kho.</p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Đang hiển thị</small>
            <strong>{visibleRows.length} kiện</strong>
          </div>
        </div>
      </section>

      {errorMessage && <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} />}

      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          allowClear
          placeholder="Tất cả kho"
          style={{ width: 240 }}
          value={warehouseId || undefined}
          onChange={(value) => setWarehouseId(value || "")}
          options={warehouses.map((item) => ({ value: item.id, label: item.name }))}
        />
        <Select
          allowClear
          placeholder="Mọi trạng thái"
          style={{ width: 220 }}
          value={status || undefined}
          onChange={(value) => setStatus(value || "")}
          options={Object.entries(INVENTORY_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
        />
        <Input.Search
          allowClear
          placeholder="Mã kiện, mã đơn, khách, ô kệ"
          style={{ width: 280 }}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Switch checked={includeReleased} onChange={setIncludeReleased} disabled={Boolean(status)} />
        <Text>Gồm cả hàng đã xuất</Text>
        <Button icon={<ReloadOutlined spin={loading} />} onClick={load} disabled={loading}>
          Làm mới
        </Button>
      </Space>

      <Table
        rowKey="inventoryId"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={visibleRows}
        scroll={{ x: 1250 }}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="Không có hàng tồn." /> }}
      />
    </div>
  );
}
