import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Input, Space, Table, Tabs, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

import {
  getShipmentApiError,
  getShipmentStatusMeta,
  listShipments,
  SHIPMENT_STATUS_TABS,
} from "@features/shipment/api/internationalShipmentService";
import ShipmentTimelineDrawer from "@features/shipment/components/ShipmentTimelineDrawer/ShipmentTimelineDrawer";

const { Text } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

/**
 * Danh sách lô vận chuyển quốc tế (GET /api/international-shipments) + Drawer hành trình.
 * Dùng chung cho Sale (tab "Tất cả lô"), Operations Manager và Admin.
 *
 * @param {{ canUpdate?: boolean, defaultTab?: string, onOpenOrder?: (orderId) => void,
 *   embedded?: boolean }} props
 */
export default function ShipmentWorkspace({
  canUpdate = true,
  defaultTab = "",
  onOpenOrder,
}) {
  const [statusTab, setStatusTab] = useState(defaultTab);
  const [keyword, setKeyword] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [openId, setOpenId] = useState("");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await listShipments({ statusTab, search: keyword.trim(), pageNumber, pageSize: 20 });
      setRows(result.items);
      setTotalCount(result.totalCount);
    } catch (error) {
      setErrorMessage(getShipmentApiError(error, "Không tải được danh sách lô vận chuyển."));
    } finally {
      setLoading(false);
    }
  }, [statusTab, keyword, pageNumber]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const columns = useMemo(
    () => [
      {
        title: "Mã lô",
        dataIndex: "shipmentCode",
        width: 190,
        render: (value, row) => (
          <Button type="link" style={{ padding: 0 }} onClick={() => setOpenId(row.shipmentId)}>
            {value || "—"}
          </Button>
        ),
      },
      {
        title: "Kho đi → kho đến",
        key: "route",
        render: (_, row) => `${row.originWarehouseName || "—"} → ${row.destinationWarehouseName || "—"}`,
      },
      {
        title: "Hãng / mã tra cứu",
        key: "carrier",
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Text>{row.carrierName || "—"}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.carrierTrackingCode || ""}
            </Text>
          </Space>
        ),
      },
      {
        title: "Kiện / cân",
        key: "size",
        width: 130,
        render: (_, row) =>
          `${row.totalPackages ?? row.parcels?.length ?? 0} kiện · ${Number(row.totalWeight || 0).toLocaleString("vi-VN")} kg`,
      },
      { title: "Bàn giao lúc", dataIndex: "shippedAt", width: 170, render: formatDateTime },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 190,
        render: (value) => {
          const meta = getShipmentStatusMeta(value);
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
    ],
    [],
  );

  return (
    <>
      {!!errorMessage && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={errorMessage}
          action={
            <Button size="small" onClick={fetchRows}>
              Thử lại
            </Button>
          }
        />
      )}

      <Tabs
        activeKey={statusTab}
        onChange={(key) => {
          setStatusTab(key);
          setPageNumber(1);
        }}
        items={SHIPMENT_STATUS_TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
      />

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Tìm theo mã lô"
          style={{ width: 300 }}
          onSearch={(value) => {
            setKeyword(value);
            setPageNumber(1);
          }}
        />
        <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchRows} disabled={loading}>
          Làm mới
        </Button>
        <Text type="secondary">{totalCount ? `${totalCount} lô` : ""}</Text>
      </Space>

      <Table
        rowKey="shipmentId"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1100 }}
        pagination={{
          current: pageNumber,
          pageSize: 20,
          total: totalCount,
          showSizeChanger: false,
          onChange: setPageNumber,
        }}
        locale={{ emptyText: <Empty description="Không có lô nào." /> }}
      />

      <ShipmentTimelineDrawer
        open={!!openId}
        shipmentId={openId}
        canUpdate={canUpdate}
        onClose={() => setOpenId("")}
        onChanged={fetchRows}
        onOpenOrder={onOpenOrder}
      />
    </>
  );
}
