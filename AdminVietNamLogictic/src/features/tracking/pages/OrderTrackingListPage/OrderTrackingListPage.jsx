import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Empty,
  Input,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CalendarOutlined,
  CarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CompassOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  GlobalOutlined,
  InboxOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SendOutlined,
  WarningFilled,
} from "@ant-design/icons";

import {
  getStageMeta,
  getTrackingApiError,
  listTrackedOrders,
  TRACKING_STAGES,
} from "@features/tracking/api/orderTrackingService";
import "@features/operations/styles/OperationsPage.css";
import "./OrderTrackingListPage.css";
import { displayCode, textOr } from "@shared/utils/statusLabel";
import { SHIPMENT_STATUS_META } from "@features/shipment";
import { tablePagination } from "@shared/utils/tablePagination";

const { Text, Paragraph } = Typography;

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

const getStageTagIcon = (stage) => {
  const s = String(stage || "").toUpperCase();
  if (s.includes("DELIVERED")) return <CheckCircleFilled />;
  if (s.includes("OUT_FOR_DELIVERY")) return <CarOutlined />;
  if (s.includes("ARRIVED") || s.includes("VN")) return <EnvironmentOutlined />;
  if (s.includes("CUSTOMS")) return <SafetyCertificateOutlined />;
  if (s.includes("IN_TRANSIT") || s.includes("DEPARTED") || s.includes("HANDED_OVER"))
    return <SendOutlined />;
  if (s.includes("HOLD") || s.includes("DELAY") || s.includes("QUARANTINE"))
    return <WarningFilled />;
  return <InboxOutlined />;
};

/** Phân nhóm chặng lớn để lọc nhanh theo tiến độ logistics */
const STAGE_QUICK_GROUPS = [
  { key: "ALL", label: "Tất cả chặng" },
  {
    key: "ORIGIN",
    label: "Tại kho nguồn",
    stages: ["NOT_RECEIVED", "AT_ORIGIN_WAREHOUSE", "PREPARING_EXPORT"],
  },
  {
    key: "TRANSIT",
    label: "Vận chuyển quốc tế",
    stages: ["HANDED_OVER", "DEPARTED", "IN_TRANSIT"],
  },
  {
    key: "VN_HUB",
    label: "Tại kho Việt Nam",
    stages: ["CUSTOMS_CLEARED", "ARRIVED_VN", "ARRIVED_DESTINATION", "RECEIVED_AT_VN", "STORED_AT_VN"],
  },
  {
    key: "DELIVERING",
    label: "Đang giao hàng",
    stages: ["OUT_FOR_DELIVERY"],
  },
  {
    key: "ALERT",
    label: "Chậm / Tạm giữ",
    stages: ["ON_HOLD", "DELAYED", "QUARANTINED", "DELIVERY_FAILED"],
  },
];

/**
 * Theo dõi đơn — Danh sách đơn hàng đang có hàng ở kho hoặc trên đường vận chuyển.
 * Cho phép lọc nhanh theo chặng, tìm kiếm đa năng và mở xem hành trình chi tiết.
 *
 * @param {{ basePath?: string, eyebrow?: string }} props
 */
export default function OrderTrackingListPage({
  basePath = "/sale",
  eyebrow = "KINH DOANH (SALE)",
}) {
  const navigate = useNavigate();
  const [stages, setStages] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [includeFinished, setIncludeFinished] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTabKey, setActiveTabKey] = useState("ALL");

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
      setRows(result.items || []);
      setTotalCount(result.totalCount || 0);
    } catch (error) {
      setErrorMessage(getTrackingApiError(error, "Không tải được danh sách đơn đang theo dõi."));
    } finally {
      setLoading(false);
    }
  }, [stages, keyword, includeFinished, pageNumber, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  // Xử lý khi chọn tab nhóm chặng nhanh
  const handleQuickGroupChange = (key) => {
    setActiveTabKey(key);
    setPageNumber(1);
    const group = STAGE_QUICK_GROUPS.find((g) => g.key === key);
    if (!group || key === "ALL") {
      setStages([]);
    } else {
      setStages(group.stages || []);
    }
  };

  // Thống kê nhanh từ danh sách hiện tại
  const stats = useMemo(() => {
    const transitCount = rows.filter((r) =>
      ["HANDED_OVER", "DEPARTED", "IN_TRANSIT"].includes(String(r.currentStage).toUpperCase()),
    ).length;
    const vnHubCount = rows.filter((r) =>
      [
        "CUSTOMS_CLEARED",
        "ARRIVED_VN",
        "ARRIVED_DESTINATION",
        "RECEIVED_AT_VN",
        "STORED_AT_VN",
      ].includes(String(r.currentStage).toUpperCase()),
    ).length;
    const alertCount = rows.filter((r) =>
      ["ON_HOLD", "DELAYED", "QUARANTINED", "DELIVERY_FAILED"].includes(
        String(r.currentStage).toUpperCase(),
      ),
    ).length;

    return {
      transitCount,
      vnHubCount,
      alertCount,
    };
  }, [rows]);

  const columns = [
    {
      title: "Mã đơn hàng",
      dataIndex: "consignmentCode",
      width: 210,
      render: (value, row) => (
        <div className="tracking-order-cell">
          <Button
            type="link"
            style={{ padding: 0, fontWeight: 700 }}
            onClick={() => navigate(`${basePath}/tracking/${row.orderId}`)}
          >
            <span className="tracking-order-cell__code">{value || "—"}</span>
          </Button>
          {value && (
            <Paragraph
              copyable={{ text: value, tooltips: ["Sao chép", "Đã sao chép"] }}
              style={{ display: "inline", margin: 0, color: "#64748b" }}
            />
          )}
        </div>
      ),
    },
    {
      title: "Khách hàng",
      dataIndex: "customerName",
      width: 190,
      render: (name) => {
        const initial = (name || "K").trim().charAt(0).toUpperCase();
        return (
          <div className="tracking-customer-cell">
            <div className="tracking-customer-cell__avatar">{initial}</div>
            <div className="tracking-customer-cell__info">
              <span className="tracking-customer-cell__name">{name || "Khách vãng lai"}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: "Chặng hiện tại",
      dataIndex: "currentStage",
      width: 230,
      render: (value, row) => {
        const meta = getStageMeta(value);
        return (
          <Space direction="vertical" size={2}>
            <Tag
              color={meta.color}
              icon={getStageTagIcon(value)}
              style={{ borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}
            >
              {textOr(row.currentStageText, meta.label)}
            </Tag>
            {row.isSplitAcrossStages ? (
              <Tag color="orange" style={{ borderRadius: 4, fontSize: 11 }}>
                Kiện đi tách chuyến
              </Tag>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: "Kiện",
      dataIndex: "parcelCount",
      align: "center",
      width: 90,
      render: (v) => (
        <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 700, padding: "2px 8px" }}>
          {v ?? 0} kiện
        </Tag>
      ),
    },
    {
      title: "Chuyến lô quốc tế",
      dataIndex: "shipmentCodes",
      width: 180,
      render: (value) =>
        Array.isArray(value) && value.length ? (
          <Space wrap size={4}>
            {value.map((code) => (
              <Tag key={code} color="purple" style={{ borderRadius: 4, fontWeight: 650, margin: 0 }}>
                {code}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Sự kiện gần nhất",
      key: "last",
      width: 250,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: 13, color: "#1e293b" }}>
            {row.lastEventTitle ? displayCode(row.lastEventTitle, SHIPMENT_STATUS_META) : "—"}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {formatDateTime(row.lastEventAt)}
          </Text>
        </Space>
      ),
    },
    {
      title: "Dự kiến về VN",
      dataIndex: "estimatedArrivalDate",
      width: 140,
      render: (v) =>
        v ? (
          <Tag color="green" icon={<CalendarOutlined />} style={{ borderRadius: 6, fontWeight: 600 }}>
            {formatDate(v)}
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Thao tác",
      key: "actions",
      align: "center",
      width: 120,
      render: (_, row) => (
        <Button
          type="primary"
          ghost
          size="small"
          icon={<EyeOutlined />}
          style={{ borderRadius: 6, fontWeight: 600 }}
          onClick={() => navigate(`${basePath}/tracking/${row.orderId}`)}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div className="ops-page tracking-list-page">
      {/* --- HERO BANNER --- */}
      <section className="tracking-list-hero">
        <div className="tracking-list-hero__content">
          <div className="tracking-list-hero__info">
            <div className="tracking-list-hero__eyebrow">
              <CompassOutlined />
              <span>{eyebrow}</span>
            </div>
            <h1 className="tracking-list-hero__title">Giám Sát & Theo Dõi Hành Trình Đơn Hàng</h1>
            <p className="tracking-list-hero__desc">
              Theo dõi trạng thái vị trí thời gian thực của các đơn hàng ký gửi & vận chuyển xuyên biên
              giới từ kho quốc tế về Việt Nam. Giám sát tiến độ từng chặng, quản lý lệnh giữ hàng và xử
              lý kịp thời các sự cố phát sinh.
            </p>
          </div>

          <div className="tracking-list-hero__actions">
            <Button
              size="large"
              type="primary"
              icon={<ReloadOutlined spin={loading} />}
              onClick={load}
              disabled={loading}
              style={{
                borderRadius: 10,
                fontWeight: 700,
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              Làm mới
            </Button>
          </div>
        </div>
      </section>

      {/* Thông báo lỗi nếu có */}
      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message="Lỗi tải danh sách theo dõi"
          description={errorMessage}
          style={{ borderRadius: 12 }}
        />
      )}

      {/* --- KPI SUMMARY METRICS (4 CARDS) --- */}
      <div className="tracking-list-kpi-grid">
        {/* Card 1: Tổng đơn đang theo dõi */}
        <div className="tracking-list-kpi-card">
          <div className="tracking-list-kpi-card__main">
            <span className="tracking-list-kpi-card__label">Tổng đơn đang theo dõi</span>
            <span className="tracking-list-kpi-card__value">{totalCount}</span>
            <span className="tracking-list-kpi-card__sub">
              {includeFinished ? "Bao gồm đơn hoàn thành" : "Chỉ các đơn đang lưu thông"}
            </span>
          </div>
          <div className="tracking-list-kpi-card__icon-box tracking-list-kpi-card__icon-box--blue">
            <GlobalOutlined />
          </div>
        </div>

        {/* Card 2: Đang trên đường vận chuyển */}
        <div className="tracking-list-kpi-card">
          <div className="tracking-list-kpi-card__main">
            <span className="tracking-list-kpi-card__label">Vận chuyển quốc tế</span>
            <span className="tracking-list-kpi-card__value">{stats.transitCount}</span>
            <span className="tracking-list-kpi-card__sub">Đang bay hoặc trên tuyến chuyển tiếp</span>
          </div>
          <div className="tracking-list-kpi-card__icon-box tracking-list-kpi-card__icon-box--cyan">
            <SendOutlined />
          </div>
        </div>

        {/* Card 3: Đã cập bến kho Việt Nam */}
        <div className="tracking-list-kpi-card">
          <div className="tracking-list-kpi-card__main">
            <span className="tracking-list-kpi-card__label">Tại kho Việt Nam</span>
            <span className="tracking-list-kpi-card__value">{stats.vnHubCount}</span>
            <span className="tracking-list-kpi-card__sub">Đã thông quan & lưu kho chuẩn bị giao</span>
          </div>
          <div className="tracking-list-kpi-card__icon-box tracking-list-kpi-card__icon-box--green">
            <EnvironmentOutlined />
          </div>
        </div>

        {/* Card 4: Cảnh báo chậm trễ / Tạm giữ */}
        <div className="tracking-list-kpi-card">
          <div className="tracking-list-kpi-card__main">
            <span className="tracking-list-kpi-card__label">Chậm trễ / Tạm giữ</span>
            <span
              className="tracking-list-kpi-card__value"
              style={{ color: stats.alertCount > 0 ? "#dc2626" : "#16a34a" }}
            >
              {stats.alertCount}
            </span>
            <span className="tracking-list-kpi-card__sub">
              {stats.alertCount > 0 ? "Cần liên hệ kho nguồn kiểm tra" : "Tiến độ lưu thông ổn định"}
            </span>
          </div>
          <div className="tracking-list-kpi-card__icon-box tracking-list-kpi-card__icon-box--amber">
            {stats.alertCount > 0 ? <LockOutlined /> : <CheckCircleFilled style={{ color: "#16a34a" }} />}
          </div>
        </div>
      </div>

      {/* --- TABLE & TOOLBAR SECTION --- */}
      <div className="tracking-list-table-card">
        {/* Quick Segmented Tabs by Stage Phase */}
        <div className="tracking-quick-tabs">
          <Tabs
            activeKey={activeTabKey}
            onChange={handleQuickGroupChange}
            items={STAGE_QUICK_GROUPS.map((g) => ({
              key: g.key,
              label: (
                <Space size={6}>
                  <span>{g.label}</span>
                </Space>
              ),
            }))}
          />
        </div>

        {/* Filter Bar */}
        <div className="tracking-list-filter-bar">
          <div className="tracking-list-filter-bar__inputs">
            <Input.Search
              allowClear
              placeholder="Tìm theo mã đơn, tên khách, mã chuyến bay/tàu..."
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={(value) => {
                setKeyword(value);
                setPageNumber(1);
              }}
              style={{ width: 340, borderRadius: 8 }}
            />

            <Select
              mode="multiple"
              allowClear
              placeholder="Chọn chặng cụ thể"
              style={{ minWidth: 260, borderRadius: 8 }}
              value={stages}
              onChange={(value) => {
                setStages(value);
                setPageNumber(1);
                setActiveTabKey("CUSTOM");
              }}
              options={TRACKING_STAGES.map((stage) => ({
                value: stage.value,
                label: (
                  <Space size={6}>
                    <Tag color={stage.color} style={{ fontSize: 11, margin: 0 }}>
                      {stage.label}
                    </Tag>
                  </Space>
                ),
              }))}
            />
          </div>

          <div className="tracking-list-filter-bar__options">
            <Space align="center" size={8}>
              <Switch
                checked={includeFinished}
                onChange={(value) => {
                  setIncludeFinished(value);
                  setPageNumber(1);
                }}
              />
              <Text style={{ fontSize: 13, color: "#475569" }}>Gồm đơn đã giao / hoàn tất</Text>
            </Space>

            <Tooltip title="Làm mới bảng danh sách">
              <Button icon={<ReloadOutlined spin={loading} />} onClick={load} disabled={loading} />
            </Tooltip>
          </div>
        </div>

        {/* Table */}
        <Table
          className="tracking-list-table"
          rowKey="orderId"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1200 }}
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
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div style={{ padding: "24px 0" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
                      Không tìm thấy đơn hàng nào phù hợp
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                      Hãy thử đổi từ khóa tìm kiếm hoặc bỏ bớt các chặng đã lọc.
                    </div>
                  </div>
                }
              />
            ),
          }}
        />
      </div>
    </div>
  );
}
