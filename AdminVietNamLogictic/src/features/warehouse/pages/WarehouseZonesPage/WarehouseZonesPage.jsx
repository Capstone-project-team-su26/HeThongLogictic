import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Empty, Input, Modal, Select, Space, Table, Tag, Typography } from "antd";
import { EditOutlined, ReloadOutlined, WarningOutlined } from "@ant-design/icons";

import { getActiveWarehousesApi } from "@features/warehouse/api/warehouseService";
import {
  getZoneApiError,
  getZoneTypeMeta,
  listMisplacedParcels,
  listWarehouseZones,
  updateWarehouseZone,
  ZONE_TYPE_OPTIONS,
} from "@features/warehouse/api/warehouseZoneService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import "@features/operations/styles/OperationsPage.css";

const { Text, Title } = Typography;

/**
 * Khu kho và kiện nằm sai khu — màn của quản lý kho / Admin (api-kho-xep-ke-theo-khu.md A, D).
 *
 * Mỗi khu phải được khai loại (nhận / cách ly / lưu kho / xuất); chỉ khu STORAGE đang dùng mới
 * xếp hàng lưu kho được (`acceptsStorage` tô xanh). Bảng dưới là báo cáo kiện đang nằm sai khu —
 * hệ thống KHÔNG tự di chuyển, kho chuyển ô về khu lưu kho trên app kho. Kiện đang trong phiếu
 * xuất (tồn PICKED) để luồng xuất kho xử lý.
 */
export default function WarehouseZonesPage({ eyebrow = "BỘ PHẬN VẬN HÀNH (OPS)" }) {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [zones, setZones] = useState([]);
  const [misplaced, setMisplaced] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getActiveWarehousesApi()
      .then((items) => {
        if (cancelled) return;
        setWarehouses(items);
        setWarehouseId((current) => current || items[0]?.id || "");
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(getZoneApiError(error, "Không tải được danh sách kho."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    setErrorMessage("");
    const [zoneResult, misplacedResult] = await Promise.allSettled([
      listWarehouseZones(warehouseId),
      listMisplacedParcels(warehouseId),
    ]);
    if (zoneResult.status === "fulfilled") setZones(zoneResult.value);
    else setErrorMessage(getZoneApiError(zoneResult.reason, "Không tải được danh sách khu."));
    setMisplaced(misplacedResult.status === "fulfilled" ? misplacedResult.value : []);
    setLoading(false);
  }, [warehouseId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateWarehouseZone(editing.zoneId, editing);
      AuthNotify.success("Đã cập nhật khu", editing.zoneName || editing.zoneCode || "");
      setEditing(null);
      load();
    } catch (error) {
      AuthNotify.error("Không cập nhật được khu", getZoneApiError(error, "Vui lòng thử lại."));
    } finally {
      setSaving(false);
    }
  };

  const zoneColumns = [
    {
      title: "Khu",
      key: "zone",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.zoneName || "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.zoneCode || ""}
          </Text>
        </Space>
      ),
    },
    {
      title: "Loại khu",
      dataIndex: "zoneType",
      width: 170,
      render: (value, row) => (
        <Tag color={getZoneTypeMeta(value).color}>{row.zoneTypeText || getZoneTypeMeta(value).label}</Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 130,
      render: (value) =>
        String(value).toUpperCase() === "ACTIVE" ? <Tag color="success">Đang dùng</Tag> : <Tag>Ngừng dùng</Tag>,
    },
    {
      title: "Xếp hàng lưu kho",
      dataIndex: "acceptsStorage",
      width: 150,
      render: (value) => (value ? <Tag color="green">Được</Tag> : <Tag>Không</Tag>),
    },
    { title: "Kệ", dataIndex: "shelfCount", align: "center", width: 70 },
    {
      title: "Ô kệ (đang dùng / tổng)",
      key: "bins",
      align: "center",
      width: 170,
      render: (_, row) => `${row.activeBinCount ?? 0} / ${row.binCount ?? 0}`,
    },
    { title: "Kiện đang chứa", dataIndex: "parcelCount", align: "center", width: 130 },
    {
      title: "",
      key: "actions",
      width: 110,
      render: (_, row) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() =>
            setEditing({
              zoneId: row.zoneId,
              zoneName: row.zoneName || "",
              zoneCode: row.zoneCode || "",
              zoneType: row.zoneType || "",
              status: row.status || "ACTIVE",
            })
          }
        >
          Sửa
        </Button>
      ),
    },
  ];

  const misplacedColumns = [
    { title: "Mã kiện", dataIndex: "packageCode", render: (v) => <Text code>{v}</Text> },
    { title: "Đơn", dataIndex: "consignmentCode", render: (v) => v || "—" },
    { title: "Trạng thái kiện", dataIndex: "packageStatus", render: (v) => <Tag>{v || "—"}</Tag> },
    { title: "Ô kệ", dataIndex: "binCode" },
    {
      title: "Khu hiện tại",
      key: "zone",
      render: (_, row) => (
        <Space>
          <Text>{row.zoneName || "—"}</Text>
          <Tag color={getZoneTypeMeta(row.zoneType).color}>{getZoneTypeMeta(row.zoneType).label}</Tag>
        </Space>
      ),
    },
    { title: "Lý do", dataIndex: "reason", render: (v) => <Text type="danger">{v}</Text> },
  ];

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>{eyebrow}</span>
          <h1>Khu Kho & Kiện Sai Khu</h1>
          <p>
            Khai loại cho từng khu. Hàng lưu kho chỉ được xếp vào ô thuộc khu lưu kho đang dùng —
            xếp kệ, chuyển ô, tách/gộp kiện vào khu khác đều bị chặn.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <Select
            style={{ width: 260 }}
            value={warehouseId || undefined}
            placeholder="Chọn kho"
            onChange={setWarehouseId}
            options={warehouses.map((item) => ({
              value: item.id,
              label: `${item.name}${item.warehouseType ? ` (${item.warehouseType})` : ""}`,
            }))}
          />
          <Button type="primary" icon={<ReloadOutlined spin={loading} />} onClick={load} disabled={loading || !warehouseId}>
            Làm mới
          </Button>
        </div>
      </section>

      {errorMessage && <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} />}

      <Table
        rowKey="zoneId"
        size="middle"
        loading={loading}
        columns={zoneColumns}
        dataSource={zones}
        pagination={false}
        scroll={{ x: 1100 }}
        rowClassName={(row) => (row.acceptsStorage ? "ops-row--storage" : "")}
        locale={{ emptyText: <Empty description="Kho chưa khai khu nào." /> }}
      />

      <Title level={5} style={{ marginTop: 24 }}>
        <WarningOutlined /> Kiện nằm sai khu ({misplaced.length})
      </Title>
      <Text type="secondary">
        Chuyển các kiện này về ô khu lưu kho bằng thao tác chuyển ô trên app kho. Kiện đang trong phiếu
        xuất (đã bốc sang khu xuất) không hiện ở đây.
      </Text>
      <Table
        style={{ marginTop: 8 }}
        rowKey="parcelId"
        size="small"
        loading={loading}
        columns={misplacedColumns}
        dataSource={misplaced}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="Không có kiện nào nằm sai khu." /> }}
      />

      <Modal
        open={!!editing}
        title="Sửa khu kho"
        okText="Lưu"
        cancelText="Huỷ"
        okButtonProps={{ loading: saving, disabled: !editing?.zoneType }}
        onOk={save}
        onCancel={() => setEditing(null)}
      >
        {editing && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Input
              addonBefore="Tên khu"
              value={editing.zoneName}
              onChange={(event) => setEditing((e) => ({ ...e, zoneName: event.target.value }))}
            />
            <Input
              addonBefore="Mã khu"
              value={editing.zoneCode}
              onChange={(event) => setEditing((e) => ({ ...e, zoneCode: event.target.value }))}
            />
            <Select
              style={{ width: "100%" }}
              placeholder="Loại khu (bắt buộc)"
              value={editing.zoneType || undefined}
              onChange={(value) => setEditing((e) => ({ ...e, zoneType: value }))}
              options={ZONE_TYPE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
            />
            <Select
              style={{ width: "100%" }}
              value={String(editing.status || "ACTIVE").toUpperCase()}
              onChange={(value) => setEditing((e) => ({ ...e, status: value }))}
              options={[
                { value: "ACTIVE", label: "Đang dùng" },
                { value: "INACTIVE", label: "Ngừng dùng" },
              ]}
            />
            <Alert
              type="info"
              showIcon
              message="Khu lưu kho đang chứa hàng không đổi sang loại khác và không ngừng dùng được — chuyển hàng ra trước."
            />
          </Space>
        )}
      </Modal>
    </div>
  );
}
