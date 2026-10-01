import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Empty, Input, Select, Space, Switch, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

import {
  getStageMeta,
  getTrackingApiError,
  listTrackedOrders,
  TRACKING_STAGES,
} from "@features/tracking/api/orderTrackingService";
import "@features/operations/styles/OperationsPage.css";
import { displayCode, textOr } from "@shared/utils/statusLabel";
import { SHIPMENT_STATUS_META } from "@features/shipment";
import { tablePagination } from "@shared/utils/tablePagination";

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
 * Theo dõi đơn — danh sách đơn đang có hàng ở kho hoặc trên đường (GET /api/orders/consignments/tracking).
 * Bấm vào đơn mở trang hành trình chi tiết: `${basePath}/tracking/:orderId`.
 *
 * @param {{ basePath?: string, eyebrow?: string }} props
 */
export default function OrderTrackingListPage({ basePath = "/sale", eyebrow = "KINH DOANH (SALE)" }) {
  const navigate = useNavigate();
  const [stages, setStages] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [includeFinished, setIncludeFinished] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  /* Phân trang phía server (GET /api/orders/consignments/tracking, backend kẹp tối đa 100). */
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await listTrackedOrders({
        stage: stages.join(","),
        search: keyword.trim(),
        includeFinished,
        pageNumber,
        pageSize,
      });
      setRows(result.items);
      setTotalCount(result.totalCount);
    } catch (error) {
      setErrorMessage(getTrackingApiError(error, "Không tải được danh sách đơn đang theo dõi."));
    } finally {
      setLoading(false);
    }
  }, [stages, keyword, includeFinished, pageNumber, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      title: "Mã đơn",
      dataIndex: "consignmentCode",
      width: 210,
      render: (value, row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`${basePath}/tracking/${row.orderId}`)}>
          {value || "—"}
        </Button>
      ),
    },
    { title: "Khách hàng", dataIndex: "customerName", render: (v) => v || "—" },
    {
      title: "Chặng hiện tại",
      dataIndex: "currentStage",
      width: 220,
      render: (value, row) => <Tag color={getStageMeta(value).color}>{textOr(row.currentStageText, getStageMeta(value).label)}</Tag>,
    },
    { title: "Kiện", dataIndex: "parcelCount", align: "center", width: 80 },
    {
      title: "Chuyến",
      dataIndex: "shipmentCodes",
      render: (value) =>
        Array.isArray(value) && value.length ? value.map((code) => <Tag key={code}>{code}</Tag>) : "—",
    },
    {
      title: "Sự kiện mới nhất",
      key: "last",
      width: 240,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>{row.lastEventTitle ? displayCode(row.lastEventTitle, SHIPMENT_STATUS_META) : "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatDateTime(row.lastEventAt)}
          </Text>
        </Space>
      ),
    },
    { title: "Dự kiến về", dataIndex: "estimatedArrivalDate", width: 120, render: formatDate },
  ];

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>{eyebrow}</span>
          <h1>Theo Dõi Đơn</h1>
          <p>
            Đơn đang có hàng ở kho hoặc trên đường, sắp theo sự kiện mới nhất. Mở đơn để xem hành trình,
            sự cố, thanh toán và giữ hàng thay khách.
          </p>
        </div>
      </section>

      {errorMessage && <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} />}

      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          mode="multiple"
          allowClear
          placeholder="Lọc theo chặng"
          style={{ minWidth: 280 }}
          value={stages}
          onChange={(value) => {
            setStages(value);
            setPageNumber(1);
          }}
          options={TRACKING_STAGES.map((stage) => ({ value: stage.value, label: stage.label }))}
        />
        <Input.Search
          allowClear
          placeholder="Mã đơn, tên khách, mã chuyến"
          style={{ width: 280 }}
          onSearch={(value) => {
            setKeyword(value);
            setPageNumber(1);
          }}
        />
        <Switch
          checked={includeFinished}
          onChange={(value) => {
            setIncludeFinished(value);
            setPageNumber(1);
          }}
        />
        <Text>Gồm cả đơn đã giao / hoàn thành</Text>
        <Button icon={<ReloadOutlined spin={loading} />} onClick={load} disabled={loading}>
          Làm mới
        </Button>
      </Space>

      <Table
        rowKey="orderId"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1150 }}
        pagination={tablePagination({
          unit: "đơn",
          current: pageNumber,
          pageSize,
          total: totalCount,
          onChange: (page, size) => {
            setPageNumber(size !== pageSize ? 1 : page);
            setPageSize(size);
          },
        })}
        locale={{ emptyText: <Empty description="Không có đơn nào." /> }}
      />
    </div>
  );
}
