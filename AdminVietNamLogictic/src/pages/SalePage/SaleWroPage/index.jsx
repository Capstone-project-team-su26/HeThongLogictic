import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EyeOutlined,
  InboxOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";

import {
  getOperationsApiError,
  listCarriers,
  listWarehouses,
  listWroRequests,
  notifyWroCustomer,
  updateWroStatus,
  wroNeedsApproval,
  WRO_STATUS_META,
} from "../../../api/OperationsAPI/consolidationWorkflowService";
import WroExportTypeTag from "../../OperationsPage/OperationsWroPage/components/WroExportTypeTag";
import WroItemExpandTable from "../../OperationsPage/OperationsWroPage/components/WroItemExpandTable";
import WroFilterBar from "../../OperationsPage/OperationsWroPage/components/WroFilterBar";
import WroViewModal from "../../OperationsPage/components/WroViewModal";
import AuthNotify from "../../../utils/Common/AuthNotify";
import "../../OperationsPage/OperationsWroPage/OperationsWroPage.css";

const INITIAL_FILTERS = {
  status: "",
  search: "",
  customsStatus: "",
  warehouseId: "",
  carrierId: "",
  exportType: "",
  dateRange: null,
};

// Các trạng thái đã bàn giao cho ĐVVC / xuất hàng được phép bấm Thông báo KH
const HANDED_OVER_STATUSES = new Set([
  "HANDED_OVER",
  "SHIPPED",
  "IN_TRANSIT",
  "RELEASED",
]);

const SALE_ALLOWED_STATUSES = [
  {
    value: "ARRIVED_IN_VN",
    label: "Đã về VN (Báo khách & Chuyển thông quan)",
    description: "Cập nhật phiếu xuất kho đã về VN và chuyển sang hải quan thông quan",
    color: "purple",
  },
  {
    value: "IN_TRANSIT",
    label: "Đang vận chuyển",
    description: "Đơn xuất kho đang trong quá trình vận chuyển quốc tế",
    color: "blue",
  },
  {
    value: "RELEASE_APPROVED",
    label: "Đã duyệt xuất kho",
    description: "Đã phê duyệt thông tin phiếu xuất kho",
    color: "cyan",
  },
  {
    value: "DELIVERED",
    label: "Đã giao hàng",
    description: "Đã giao thành công cho khách hàng",
    color: "green",
  },
  {
    value: "COMPLETED",
    label: "Hoàn thành",
    description: "Hoàn tất toàn bộ quy trình xuất kho",
    color: "green",
  },
  {
    value: "RELEASE_REJECTED",
    label: "Từ chối xuất kho",
    description: "Từ chối yêu cầu xuất kho này",
    color: "red",
  },
];

export default function SaleWroPage({ exportTypeFilter: propExportType } = {}) {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine exportType from props or path
  const currentPathType = useMemo(() => {
    if (propExportType) return propExportType;
    if (location.pathname.endsWith("/express")) return "SINGLE";
    if (location.pathname.endsWith("/batch")) return "BATCH";
    return "";
  }, [propExportType, location.pathname]);

  const [wroList, setWroList] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [lookups, setLookups] = useState({
    warehouses: [],
    carriers: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [viewWroId, setViewWroId] = useState(null);

  // Status update modal state
  const [statusTarget, setStatusTarget] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("ARRIVED_IN_VN");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Fetch Lookups (Warehouses & Carriers)
  const loadLookups = useCallback(async () => {
    try {
      const [whList, crList] = await Promise.all([
        listWarehouses().catch(() => []),
        listCarriers().catch(() => []),
      ]);
      setLookups({
        warehouses: Array.isArray(whList) ? whList : [],
        carriers: Array.isArray(crList) ? crList : [],
      });
    } catch {
      // Lookup fallbacks
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  // Main Data Loader
  const loadData = useCallback(
    async ({ refresh = false } = {}) => {
      refresh ? setIsRefreshing(true) : setIsLoading(true);
      setLoadError("");
      try {
        const apiStatus =
          filters.status && filters.status !== "NEEDS_APPROVAL"
            ? filters.status
            : undefined;

        const page = await listWroRequests({
          status: apiStatus,
          search: filters.search,
          pageSize: 250,
        });

        setWroList(page.items ?? []);
      } catch (error) {
        const errMsg = getOperationsApiError(
          error,
          "Không thể tải danh sách phiếu WRO từ hệ thống."
        );
        AuthNotify.error("Lỗi tải dữ liệu WRO", errMsg);
        setLoadError(errMsg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [filters.status, filters.search]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  // Filter Handlers
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  // Status Update Execution (PUT /api/warehouse-release-requests/{id}/status)
  const handleOpenStatusModal = (wro, defaultTargetStatus = "ARRIVED_IN_VN") => {
    setStatusTarget(wro);
    setSelectedStatus(defaultTargetStatus);
    setRejectionReason("");
  };

  const handleConfirmStatusUpdate = async () => {
    if (!statusTarget) return;
    const wroId = statusTarget.id || statusTarget.wroId;
    const wroCode = statusTarget.code || statusTarget.wroCode || wroId;

    setIsUpdatingStatus(true);
    try {
      await updateWroStatus(wroId, selectedStatus, rejectionReason);
      const targetMeta =
        SALE_ALLOWED_STATUSES.find((s) => s.value === selectedStatus) || {};
      AuthNotify.success(
        "Cập nhật trạng thái thành công",
        `Phiếu WRO ${wroCode} đã được chuyển sang trạng thái: ${targetMeta.label || selectedStatus}`
      );
      setStatusTarget(null);
      loadData({ refresh: true });
    } catch (err) {
      AuthNotify.error(
        "Cập nhật thất bại",
        getOperationsApiError(err, "Không thể cập nhật trạng thái phiếu xuất kho WRO.")
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Thông báo cho khách hàng (POST /api/warehouse-release-requests/{id}/notify-customer & PUT ARRIVED_IN_VN)
  const handleNotifyCustomer = async (wro) => {
    const wroId = wro.id || wro.wroId;
    const wroCode = wro.code || wro.wroCode || wroId;
    setIsUpdatingStatus(true);
    try {
      await notifyWroCustomer(wroId);
      try {
        await updateWroStatus(wroId, "ARRIVED_IN_VN");
      } catch (stErr) {
        // Ignored if status was already updated backend side
      }
      AuthNotify.success(
        "Gửi thông báo thành công!",
        `Đã gửi thông báo cho khách hàng & cập nhật phiếu WRO ${wroCode} sang 'Đã về VN'.`
      );
      loadData({ refresh: true });
    } catch (err) {
      AuthNotify.error(
        "Gửi thông báo thất bại",
        getOperationsApiError(err, "Không thể gửi thông báo cho khách hàng.")
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Client-side Filter Processor
  const filteredList = useMemo(() => {
    return wroList.filter((row) => {
      // Primary exportType filter (SINGLE vs BATCH if viewing specific route/mode)
      const targetExportType = currentPathType || filters.exportType;
      if (
        targetExportType &&
        String(row.exportType).toUpperCase() !== String(targetExportType).toUpperCase()
      ) {
        return false;
      }

      // Filter by Status
      if (filters.status) {
        if (filters.status === "NEEDS_APPROVAL") {
          if (!wroNeedsApproval(row.status)) return false;
        } else if (row.status !== filters.status) {
          return false;
        }
      }

      // Filter by Customs Status
      if (
        filters.customsStatus &&
        row.customsStatus !== filters.customsStatus &&
        row.customsStatusText !== filters.customsStatus
      ) {
        return false;
      }

      // Filter by Warehouse
      if (
        filters.warehouseId &&
        row.warehouseId !== filters.warehouseId &&
        row.raw?.warehouseId !== filters.warehouseId
      ) {
        return false;
      }

      // Filter by Carrier
      if (
        filters.carrierId &&
        row.carrierId !== filters.carrierId &&
        row.raw?.carrierId !== filters.carrierId
      ) {
        return false;
      }

      // Filter by Date Range
      if (filters.dateRange && filters.dateRange.length === 2 && row.createdAt) {
        const rowDate = new Date(row.createdAt).getTime();
        const startDate = filters.dateRange[0].startOf("day").valueOf();
        const endDate = filters.dateRange[1].endOf("day").valueOf();
        if (rowDate < startDate || rowDate > endDate) return false;
      }

      // Multi-keyword Search Filter
      if (filters.search && filters.search.trim()) {
        const kw = filters.search.trim().toLowerCase();
        const searchableText = [
          row.code,
          row.wroCode,
          row.exportBarcode,
          row.orderCode,
          row.customerName,
          row.receiverName,
          row.receiverPhone,
          row.consigneeName,
          row.consigneePhone,
          row.carrierName,
          row.driverName,
          row.vehicleNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(kw)) return false;
      }

      return true;
    });
  }, [wroList, currentPathType, filters]);

  // Statistics
  const stats = useMemo(() => {
    const relevantList = currentPathType
      ? wroList.filter(
          (row) => String(row.exportType).toUpperCase() === String(currentPathType).toUpperCase()
        )
      : wroList;

    const total = relevantList.length;
    const pendingApproval = relevantList.filter((row) => wroNeedsApproval(row.status)).length;
    const arrivedInVn = relevantList.filter(
      (row) => row.status === "ARRIVED_IN_VN" || row.customsStatus === "CUSTOMS_PENDING"
    ).length;
    const released = relevantList.filter(
      (row) =>
        row.status === "RELEASE_APPROVED" ||
        row.status === "SHIPPED" ||
        row.status === "DELIVERED" ||
        row.status === "COMPLETED"
    ).length;

    return { total, pendingApproval, arrivedInVn, released };
  }, [wroList, currentPathType]);

  const pageTitle = useMemo(() => {
    if (currentPathType === "SINGLE") return "Quản lý Phiếu Xuất Hỏa Tốc";
    if (currentPathType === "BATCH") return "Quản lý Phiếu Xuất Theo Lô";
    return "Quản lý Phiếu Xuất Kho";
  }, [currentPathType]);

  const pageSubtitle = useMemo(() => {
    if (currentPathType === "SINGLE")
      return "Danh sách phiếu xuất kho hỏa tốc đơn lẻ";
    if (currentPathType === "BATCH")
      return "Danh sách phiếu xuất kho theo lô / gom hàng";
    return "Quản lý và theo dõi thông tin phiếu xuất kho dành cho nhân viên kinh doanh";
  }, [currentPathType]);

  // Custom Table Columns for Sale
  const columns = [
    {
      title: "Mã WRO / Barcode",
      key: "wroCode",
      fixed: "left",
      width: 180,
      render: (_, row) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography.Text code style={{ fontWeight: 700, fontSize: 13, color: "#1e40af" }}>
            {row.code || row.wroCode || "—"}
          </Typography.Text>
          {row.exportBarcode ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.exportBarcode}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    {
      title: "Loại xuất",
      dataIndex: "exportType",
      key: "exportType",
      width: 130,
      render: (type) => <WroExportTypeTag exportType={type} />,
    },
    {
      title: "Đơn hàng & Khách hàng",
      key: "orderCustomer",
      width: 200,
      render: (_, row) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {row.orderCode ? (
            <Typography.Text code style={{ fontWeight: 600 }}>
              {row.orderCode}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary">—</Typography.Text>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            KH: {row.customerName || "—"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Người nhận & SĐT",
      key: "receiver",
      width: 220,
      render: (_, row) => (
        <div>
          <Typography.Text strong style={{ display: "block", color: "#0f172a" }}>
            {row.receiverName || row.consigneeName || "—"}
          </Typography.Text>
          {row.receiverPhone || row.consigneePhone ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.receiverPhone || row.consigneePhone}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 170,
      render: (_, row) => {
        const meta = WRO_STATUS_META[row.status] || {
          label: row.status,
          tone: "default",
        };
        return <Tag color={meta.tone} style={{ fontWeight: 600 }}>{meta.label}</Tag>;
      },
    },
    {
      title: "Số kiện",
      key: "totalQuantity",
      align: "right",
      width: 90,
      render: (_, row) => (
        <Tag color="blue" style={{ fontWeight: 700, borderRadius: 10 }}>
          {row.items?.length || row.totalQuantity || 0} kiện
        </Tag>
      ),
    },
    {
      title: "Thao tác (Sale)",
      key: "actions",
      fixed: "right",
      width: 320,
      render: (_, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <Button
            size="small"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => setViewWroId(row.id)}
            style={{ padding: "0 2px", fontSize: 12, fontWeight: 600 }}
          >
            Chi tiết
          </Button>

          {HANDED_OVER_STATUSES.has(String(row.status || "").toUpperCase()) ? (
            <Button
              size="small"
              type="primary"
              icon={<SendOutlined />}
              loading={isUpdatingStatus}
              onClick={() => handleNotifyCustomer(row)}
              style={{
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 650,
                background: "#0284c7",
                borderColor: "#0369a1",
              }}
            >
              Thông báo KH
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: "#f8fafc", minHeight: "100vh" }}>
      {/* Top Banner */}
      <div
        className="wro-hero-banner"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <div className="wro-hero-banner__tag">
            <CheckSquareOutlined /> QUẢN LÝ PHIẾU XUẤT KHO (SALE)
          </div>
          <Typography.Title level={2} style={{ color: "#fff", margin: 0, fontWeight: 800 }}>
            {pageTitle}
          </Typography.Title>
          <Typography.Text style={{ color: "#93c5fd", fontSize: 14 }}>
            {pageSubtitle}
          </Typography.Text>
        </div>

        <Button
          type="primary"
          icon={<ReloadOutlined spin={isRefreshing} />}
          loading={isRefreshing}
          onClick={() => loadData({ refresh: true })}
          className="wro-refresh-btn"
        >
          Làm mới
        </Button>
      </div>

      {loadError ? (
        <Alert
          type="error"
          showIcon
          message="Lỗi kết nối dữ liệu"
          description={loadError}
          action={
            <Button size="small" type="primary" danger onClick={() => loadData()}>
              Thử lại
            </Button>
          }
          style={{ marginBottom: 20, borderRadius: 12 }}
        />
      ) : null}

      {/* KPI Stats Cards */}
      <div className="wro-kpi-grid-enhanced">
        <div className="ops-kpi-card wro-kpi-card--blue">
          <div className="wro-kpi-card__icon-box">
            {currentPathType === "SINGLE" ? (
              <SendOutlined />
            ) : currentPathType === "BATCH" ? (
              <InboxOutlined />
            ) : (
              <AppstoreOutlined />
            )}
          </div>
          <div className="wro-kpi-card__body">
            <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 700 }}>
              {currentPathType === "SINGLE"
                ? "TỔNG PHIẾU HỎA TỐC"
                : currentPathType === "BATCH"
                ? "TỔNG PHIẾU THEO LÔ"
                : "TỔNG SỐ PHIẾU WRO"}
            </Typography.Text>
            <div className="ops-kpi-card__value" style={{ fontSize: 24, fontWeight: 800 }}>
              {stats.total.toLocaleString("vi-VN")}
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--amber">
          <div className="wro-kpi-card__icon-box">
            <ClockCircleOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 700 }}>
              CẦN DUYỆT / CHỜ XỬ LÝ
            </Typography.Text>
            <div className="ops-kpi-card__value" style={{ fontSize: 24, fontWeight: 800 }}>
              {stats.pendingApproval.toLocaleString("vi-VN")}
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--purple">
          <div className="wro-kpi-card__icon-box">
            <SafetyCertificateOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 700 }}>
              ĐÃ VỀ VN / CHỜ THÔNG QUAN
            </Typography.Text>
            <div className="ops-kpi-card__value" style={{ fontSize: 24, fontWeight: 800 }}>
              {stats.arrivedInVn.toLocaleString("vi-VN")}
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--cyan">
          <div className="wro-kpi-card__icon-box">
            <CheckCircleOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 700 }}>
              ĐÃ DUYỆT / ĐANG XUẤT
            </Typography.Text>
            <div className="ops-kpi-card__value" style={{ fontSize: 24, fontWeight: 800 }}>
              {stats.released.toLocaleString("vi-VN")}
            </div>
          </div>
        </div>
      </div>

      {/* Optional Mode Tabs if not locked to express or batch */}
      {!propExportType && (
        <Card
          size="small"
          style={{ marginBottom: 16, borderRadius: 14, border: "1px solid #e2e8f0" }}
        >
          <Tabs
            activeKey={currentPathType || "ALL"}
            onChange={(key) => {
              if (key === "SINGLE") navigate("/sale/wro/express");
              else if (key === "BATCH") navigate("/sale/wro/batch");
              else navigate("/sale/wro");
            }}
            items={[
              {
                key: "ALL",
                label: (
                  <Space>
                    <AppstoreOutlined />
                    <span>Tất cả WRO</span>
                    <Tag color="blue">{wroList.length}</Tag>
                  </Space>
                ),
              },
              {
                key: "SINGLE",
                label: (
                  <Space>
                    <SendOutlined />
                    <span>Xuất Hỏa Tốc</span>
                    <Tag color="red">
                      {
                        wroList.filter((r) => String(r.exportType).toUpperCase() === "SINGLE")
                          .length
                      }
                    </Tag>
                  </Space>
                ),
              },
              {
                key: "BATCH",
                label: (
                  <Space>
                    <InboxOutlined />
                    <span>Xuất Theo Lô</span>
                    <Tag color="purple">
                      {
                        wroList.filter((r) => String(r.exportType).toUpperCase() === "BATCH")
                          .length
                      }
                    </Tag>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* Filter Panel */}
      <WroFilterBar
        filters={filters}
        onChangeFilter={handleFilterChange}
        onResetFilters={handleResetFilters}
        warehouses={lookups.warehouses}
        carriers={lookups.carriers}
        totalResultCount={filteredList.length}
      />

      {/* Main Table */}
      <Card
        size="small"
        style={{
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 18px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography.Text strong style={{ fontSize: 15, color: "#1e293b" }}>
            Danh sách phiếu xuất kho ({filteredList.length} / {wroList.length})
          </Typography.Text>

          {currentPathType ? (
            <Tag color={currentPathType === "SINGLE" ? "red" : "purple"} style={{ fontWeight: 700 }}>
              Loại: {currentPathType === "SINGLE" ? "HỎA TỐC" : "THEO LÔ"}
            </Tag>
          ) : null}
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredList}
          loading={isLoading}
          sticky={{ offsetHeader: 0 }}
          scroll={{ x: 1380 }}
          expandable={{
            expandedRowRender: (record) => (
              <WroItemExpandTable items={record.items || []} />
            ),
            rowExpandable: (record) => Boolean(record.items && record.items.length > 0),
          }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50"],
            showTotal: (total) => `Tổng ${total} phiếu xuất kho`,
          }}
          locale={{
            emptyText: isLoading
              ? "Đang tải dữ liệu phiếu xuất kho WRO..."
              : "Không tìm thấy phiếu xuất kho nào phù hợp với bộ lọc.",
          }}
        />
      </Card>

      {/* Detail View Modal */}
      <WroViewModal
        open={Boolean(viewWroId)}
        wroId={viewWroId}
        onClose={() => setViewWroId(null)}
      />
    </div>
  );
}
