import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Button,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ReloadOutlined,
  RiseOutlined,
  FallOutlined,
  MinusOutlined,
  InboxOutlined,
  FileDoneOutlined,
} from "@ant-design/icons";

import {
  getOperationalDashboard,
  getOperationsApiError,
} from "../../api/OperationsAPI/operationsDashboardService";
import {
  buildOperationalAnalytics,
  canonicalizeConsignmentStatus,
  CONSIGNMENT_TYPE_FILTER_OPTIONS,
  getConsignmentStatusLabel,
} from "../../api/OperationsAPI/operationsMappers";
import AuthNotify from "../../utils/Common/AuthNotify";
import "./OperationsPage.css";

const RANGE_OPTIONS = [
  { value: 7, label: "7 ngày" },
  { value: 30, label: "30 ngày" },
  { value: 90, label: "90 ngày" },
];

const KPI_META = {
  total: { label: "Tổng lô hàng", description: "Được tạo trong kỳ" },
  ready: { label: "Sẵn sàng gom", description: "Đã duyệt, chờ consolidation" },
  moving: { label: "Đang vận chuyển", description: "Đang xử lý hoặc chờ hàng" },
  completed: { label: "Đã hoàn tất", description: "Kết thúc trong kỳ" },
};

const STATUS_TAG_COLOR = {
  APPROVED: "success",
  COMPLETED: "success",
  REJECTED: "error",
  CANCELLED: "error",
  IN_PROGRESS: "processing",
  WAITING_FOR_PARCEL: "warning",
  PENDING_REVIEW: "warning",
};

function formatDateRange(range) {
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
  return `${formatter.format(range.from)} – ${formatter.format(range.to)}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

function KpiCard({ item, loading }) {
  const meta = KPI_META[item?.key] ?? KPI_META.total;
  const changeClass =
    item?.change > 0 ? "is-up" : item?.change < 0 ? "is-down" : "";
  const ChangeIcon =
    item?.change > 0 ? RiseOutlined : item?.change < 0 ? FallOutlined : MinusOutlined;

  return (
    <article className="ops-kpi-card">
      <p className="ops-kpi-card__label">{meta.label}</p>
      <p className="ops-kpi-card__value">
        {loading ? "…" : Number(item?.value ?? 0).toLocaleString("vi-VN")}
      </p>
      <div className="ops-kpi-card__meta">
        <p>{meta.description}</p>
        {!loading ? (
          <span
            className={`ops-kpi-card__change ${changeClass}`}
            title={`Kỳ trước: ${Number(item?.previousValue ?? 0).toLocaleString("vi-VN")}`}
          >
            <ChangeIcon /> {Math.abs(item?.change ?? 0)}%
          </span>
        ) : null}
      </div>
    </article>
  );
}

export default function OperationsDashboard() {
  const displayName =
    String(sessionStorage.getItem("fullName") || "")
      .trim()
      .split(/\s+/)
      .at(-1) || "Ops";

  const [sourceItems, setSourceItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState({
    days: 30,
    status: "",
    consignmentType: "",
  });

  const loadDashboard = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    setLoadError("");
    try {
      const result = await getOperationalDashboard();
      setSourceItems(result?.items ?? []);
    } catch (error) {
      const errMsg = getOperationsApiError(error, "Không thể tải dữ liệu dashboard.");
      AuthNotify.error("Lỗi tải dữ liệu", errMsg);
      setLoadError(errMsg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const analytics = useMemo(
    () => buildOperationalAnalytics(sourceItems, filters),
    [filters, sourceItems]
  );

  const statusOptions = useMemo(() => {
    const statuses = [
      ...new Set(
        sourceItems
          .map((item) => canonicalizeConsignmentStatus(item.status))
          .filter(Boolean)
      ),
    ];
    return statuses
      .sort((a, b) =>
        getConsignmentStatusLabel(a).localeCompare(
          getConsignmentStatusLabel(b),
          "vi"
        )
      )
      .map((value) => ({ value, label: getConsignmentStatusLabel(value) }));
  }, [sourceItems]);

  const maxTrend = Math.max(1, ...analytics.trend.map((point) => point.count));

  const columns = useMemo(
    () => [
      {
        title: "Mã lô",
        dataIndex: "consignmentCode",
        key: "consignmentCode",
        render: (value) => (
          <Typography.Text code>{value || "—"}</Typography.Text>
        ),
      },
      {
        title: "Khách hàng",
        dataIndex: "customerName",
        key: "customerName",
        ellipsis: true,
      },
      {
        title: "Tuyến",
        key: "route",
        ellipsis: true,
        render: (_, row) => row.route || row.destination || "—",
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        render: (status) => (
          <Tag color={STATUS_TAG_COLOR[canonicalizeConsignmentStatus(status)] || "default"}>
            {getConsignmentStatusLabel(status)}
          </Tag>
        ),
      },
      {
        title: "Trọng lượng",
        dataIndex: "totalWeight",
        key: "totalWeight",
        align: "right",
        render: (value) =>
          value == null ? "—" : `${Number(value).toLocaleString("vi-VN")} kg`,
      },
      {
        title: "Ngày tạo",
        dataIndex: "createdAt",
        key: "createdAt",
        align: "right",
        render: (value) => (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {formatDateTime(value)}
          </Typography.Text>
        ),
      },
    ],
    []
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>Trung tâm vận hành</span>
          <h1>Chào {displayName}, tổng quan hôm nay</h1>
          <p>
            Theo dõi luồng hàng và nhận biết điểm nghẽn. Duyệt WRO, gom lô và tồn
            kho nằm ở các trang riêng.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Khối lượng kỳ</small>
            <strong>
              {analytics.totalWeight.toLocaleString("vi-VN")} kg
            </strong>
          </div>
          <Link to="/operations-manager/wro">
            <Button>Duyệt WRO</Button>
          </Link>
          <Link to="/operations-manager/shipments">
            <Button icon={<InboxOutlined />}>Lô vận chuyển</Button>
          </Link>
          <Link to="/operations-manager/releases">
            <Button icon={<FileDoneOutlined />}>Duyệt xuất kho</Button>
          </Link>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={isRefreshing} />}
            disabled={isRefreshing || isLoading}
            onClick={() => loadDashboard({ refresh: true })}
          >
            Làm mới
          </Button>
        </div>
      </section>

      <section className="ops-page__filters" aria-label="Bộ lọc dashboard">
        <div>
          <label htmlFor="ops-days">Khoảng thời gian</label>
          <Select
            id="ops-days"
            style={{ width: "100%" }}
            value={filters.days}
            options={RANGE_OPTIONS}
            onChange={(value) =>
              setFilters((current) => ({ ...current, days: Number(value) }))
            }
          />
        </div>
        <div>
          <label htmlFor="ops-status">Trạng thái</label>
          <Select
            id="ops-status"
            style={{ width: "100%" }}
            value={filters.status}
            options={[
              { value: "", label: "Tất cả trạng thái" },
              ...statusOptions,
            ]}
            onChange={(value) =>
              setFilters((current) => ({ ...current, status: value }))
            }
          />
        </div>
        <div>
          <label htmlFor="ops-type">Loại vận chuyển</label>
          <Select
            id="ops-type"
            style={{ width: "100%" }}
            value={filters.consignmentType}
            options={CONSIGNMENT_TYPE_FILTER_OPTIONS}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                consignmentType: value,
              }))
            }
          />
        </div>
        <div className="ops-page__range">{formatDateRange(analytics.range)}</div>
      </section>

      {loadError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={loadError}
          action={
            <Button size="small" onClick={() => loadDashboard()}>
              Thử lại
            </Button>
          }
        />
      ) : null}

      <section className="ops-kpi-grid" aria-label="Chỉ số vận hành">
        {(isLoading
          ? Object.keys(KPI_META).map((key) => ({ key }))
          : analytics.kpis
        ).map((item) => (
          <KpiCard key={item.key} item={item} loading={isLoading} />
        ))}
      </section>

      <div className="ops-panel-grid">
        <section className="ops-panel">
          <h3>Xu hướng tạo lô</h3>
          {analytics.trend.every((point) => point.count === 0) ? (
            <Typography.Text type="secondary">Chưa có dữ liệu kỳ này.</Typography.Text>
          ) : (
            <div className="ops-trend-bars" aria-hidden>
              {analytics.trend.map((point) => (
                <div
                  key={point.date}
                  title={`${point.label}: ${point.count}`}
                  style={{ height: `${Math.max(4, (point.count / maxTrend) * 100)}%` }}
                />
              ))}
            </div>
          )}
        </section>

        <section className="ops-panel">
          <h3>Phân bố trạng thái</h3>
          {analytics.statusBreakdown.length === 0 ? (
            <Typography.Text type="secondary">Chưa có dữ liệu.</Typography.Text>
          ) : (
            analytics.statusBreakdown.slice(0, 6).map((row) => (
              <div key={row.status} className="ops-status-row">
                <div>
                  <div>{getConsignmentStatusLabel(row.status)}</div>
                  <Progress
                    percent={row.percent}
                    size="small"
                    showInfo={false}
                    strokeColor="#2563eb"
                  />
                </div>
                <strong>{row.count}</strong>
              </div>
            ))
          )}
        </section>

        <section className="ops-panel">
          <h3>Tuyến nổi bật</h3>
          {analytics.topRoutes.length === 0 ? (
            <Typography.Text type="secondary">Chưa có tuyến trong kỳ.</Typography.Text>
          ) : (
            analytics.topRoutes.map((row) => (
              <div key={row.route} className="ops-route-row">
                <span>{row.route}</span>
                <Space size={8}>
                  <Typography.Text type="secondary">{row.count} lô</Typography.Text>
                  <strong>
                    {Number(row.totalWeight || 0).toLocaleString("vi-VN")} kg
                  </strong>
                </Space>
              </div>
            ))
          )}
        </section>
      </div>

      <div className="ops-table-card">
        <div className="ops-table-card__head">
          <h3>Lô hàng gần đây</h3>
          <span>{analytics.rows.length} lô</span>
        </div>
        <Table
          rowKey={(row) => row.id || row.orderId || row.consignmentCode}
          columns={columns}
          dataSource={analytics.rows}
          loading={isLoading}
          sticky={{ offsetHeader: 0 }}
          scroll={{ x: 900, y: "calc(100vh - 450px)" }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} lô` }}
          locale={{ emptyText: "Chưa có lô hàng trong khoảng thời gian này." }}
        />
      </div>
    </div>
  );
}
