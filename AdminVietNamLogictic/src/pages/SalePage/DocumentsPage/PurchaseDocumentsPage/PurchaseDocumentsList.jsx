import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Tooltip,
  Card,
  Row,
  Col,
  Empty,
  Modal,
} from "antd";
import {
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  ShoppingOutlined,
  FileDoneOutlined,
  FilterOutlined,
  UserOutlined,
} from "@ant-design/icons";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import { getPurchaseRequestsApi } from "../../../../api/SaleAPI/PurchaseRequestAPI/purchaseRequestService";
import { formatVietnamDateTime } from "../../../../utils/timeUtc";
import "./PurchaseDocumentsList.css";

const { Option } = Select;

/* =========================================================
   STATUS CONFIGURATION (100% VIETNAMESE)
========================================================= */
const PURCHASE_STATUS_MAP = {
  PENDING_REVIEW: { label: "Chờ duyệt", color: "gold", bg: "#fefce8", border: "#fef08a", text: "#854d0e" },
  APPROVED: { label: "Đã duyệt", color: "blue", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  QUOTATION_SENT: { label: "Đã gửi báo giá", color: "cyan", bg: "#ecfeff", border: "#a5f3fc", text: "#0891b2" },
  QUOTATION_CONFIRMED: { label: "Đã xác nhận báo giá", color: "teal", bg: "#f0fdfa", border: "#99f6e4", text: "#0f766e" },
  WAITING_DEPOSIT: { label: "Chờ đặt cọc", color: "orange", bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
  DEPOSITED: { label: "Đã cọc tiền", color: "blue", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  PURCHASED: { label: "Đã mua hàng", color: "teal", bg: "#f0fdfa", border: "#99f6e4", text: "#0f766e" },
  WAREHOUSE_RECEIVED: { label: "Kho đã nhận", color: "purple", bg: "#faf5ff", border: "#e9d5ff", text: "#6b21a8" },
  CHECKED_IN: { label: "Đã kiểm kho", color: "green", bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  CANCELLED: { label: "Đã hủy", color: "red", bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
  REJECTED: { label: "Đã từ chối", color: "red", bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
  PROCESSING: { label: "Đang xử lý", color: "blue", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  DELIVERING: { label: "Đang vận chuyển", color: "indigo", bg: "#eef2ff", border: "#c7d2fe", text: "#4338ca" },
  DELIVERED: { label: "Đã giao hàng", color: "green", bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  COMPLETED: { label: "Hoàn tất", color: "emerald", bg: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
};

const getPurchaseStatusBadge = (statusKey, statusDisplayName) => {
  const code = String(statusKey || "").toUpperCase();
  const config = PURCHASE_STATUS_MAP[code] || {
    label: statusDisplayName || statusKey || "Đang xử lý",
    color: "blue",
    bg: "#eff6ff",
    border: "#bfdbfe",
    text: "#1d4ed8",
  };

  return (
    <span
      className="vcl-status-chip"
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
        color: config.text,
      }}
    >
      <span className="vcl-status-chip__dot" style={{ backgroundColor: config.text }} />
      {config.label}
    </span>
  );
};

const formatRouteText = (route) => {
  if (!route) return "HQ ➔ VN";
  const str = String(route).trim();
  if (str.toLowerCase().includes("hàn quốc") && str.toLowerCase().includes("việt nam")) {
    return "HQ ➔ VN";
  }
  if (str.toLowerCase().includes("trung quốc") && str.toLowerCase().includes("việt nam")) {
    return "TQ ➔ VN";
  }
  return str.replace(/-->/g, "➔").replace(/->/g, "➔");
};

export default function PurchaseDocumentsList() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchPurchaseDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPurchaseRequestsApi({ pageNumber: 1, pageSize: 1000 });
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setItems(list);
    } catch (err) {
      console.error("Fetch purchase documents error:", err);
      AuthNotify.error("Không thể tải danh sách giấy tờ mua hộ", err?.message || "Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchaseDocuments();
  }, [fetchPurchaseDocuments]);

  const handleViewDetails = (record) => {
    setSelectedDoc(record);
    setModalOpen(true);
  };

  // Only statuses that have official physical document receipts (warehouse received / stored / delivering / completed)
  const ALLOWED_DOCUMENT_STATUSES = useMemo(
    () =>
      new Set([
        "APPROVED",
        "WAREHOUSE_RECEIVED",
        "CHECKED_IN",
        "STORED",
        "WAITING_STORED",
        "ARRIVED_ORIGIN_WAREHOUSE",
        "WAITING_FOR_PARCEL",
        "WAITING_PARCEL",
        "PURCHASED",
        "DELIVERING",
        "DELIVERED",
        "COMPLETED",
      ]),
    []
  );

  // Filter items to only include eligible document orders
  const documentItems = useMemo(() => {
    return items.filter((item) => {
      const code = String(item.status || "").toUpperCase();
      return code && ALLOWED_DOCUMENT_STATUSES.has(code);
    });
  }, [items, ALLOWED_DOCUMENT_STATUSES]);

  // Dynamic available status options
  const availableStatusOptions = useMemo(() => {
    const statusMap = new Map();

    documentItems.forEach((item) => {
      const code = String(item.status || "").toUpperCase();
      if (!code) return;

      if (!statusMap.has(code)) {
        const mapped = PURCHASE_STATUS_MAP[code];
        statusMap.set(code, {
          value: code,
          label: mapped ? mapped.label : item.statusDisplayName || code,
        });
      }
    });

    return Array.from(statusMap.values());
  }, [documentItems]);

  // Filtered List
  const filteredData = useMemo(() => {
    return documentItems.filter((item) => {
      const code = String(item.purchaseCode || item.id || "").toLowerCase();
      const customer = String(item.customerName || item.customerPhone || "").toLowerCase();
      const search = searchText.trim().toLowerCase();

      const matchesSearch = !search || code.includes(search) || customer.includes(search);
      const matchesStatus =
        selectedStatus === "ALL" ||
        String(item.status || "").toUpperCase() === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [documentItems, searchText, selectedStatus]);

  // Table Columns
  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      align: "center",
      render: (_, __, index) => (
        <div className="vcl-table-stt-wrapper">
          <span className="vcl-table-stt">{index + 1}</span>
        </div>
      ),
    },
    {
      title: "Mã đơn mua hộ",
      key: "purchaseCode",
      render: (record) => (
        <div className="doc-code-block">
          <strong className="doc-code-text">{record.purchaseCode || record.id}</strong>
          <div className="doc-meta-row">
            <span className="doc-route-badge">Tuyến: {formatRouteText(record.route)}</span>
            {record.createdAt && (
              <span className="doc-date-text">{formatVietnamDateTime(record.createdAt)}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Khách hàng",
      key: "customer",
      render: (record) => (
        <div className="customer-info-box">
          <div className="customer-avatar">
            <UserOutlined />
          </div>
          <div>
            <strong className="customer-name">{record.customerName || "Khách hàng"}</strong>
            <small style={{ color: "#64748b" }}>📞 {record.customerPhone || "—"}</small>
          </div>
        </div>
      ),
    },
    {
      title: "Loại chứng từ",
      key: "docType",
      render: () => (
        <Tag color="purple" icon={<FileDoneOutlined />} className="doc-type-tag">
          Hóa đơn & Báo giá mua hộ
        </Tag>
      ),
    },
    {
      title: "Trạng thái",
      key: "status",
      render: (record) => getPurchaseStatusBadge(record.status, record.statusDisplayName),
    },
    {
      title: "Thao tác",
      key: "actions",
      align: "center",
      width: 160,
      render: (record) => (
        <Space size="small">
          <Tooltip title="Xem thông tin chi tiết giấy tờ mua hộ">
            <Button
              type="default"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
              className="btn-preview-doc"
            >
              Xem chi tiết
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="purchase-docs-page">
      <div className="documents-header">
        <div>
          <h2 className="documents-title">
            <ShoppingOutlined style={{ marginRight: 10, color: "#9333ea" }} />
            Quản lý giấy tờ Mua hộ
          </h2>
          <p className="documents-subtitle">
            Tra cứu chứng từ mua hộ, hóa đơn báo giá và biên nhận đàm phán nhà cung cấp.
          </p>
        </div>

        <Button
          icon={<ReloadOutlined />}
          onClick={fetchPurchaseDocuments}
          loading={loading}
          size="large"
          className="btn-refresh-page"
        >
          Làm mới dữ liệu
        </Button>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} className="documents-summary-row">
        <Col xs={24} sm={8}>
          <Card className="summary-card is-primary" bodyStyle={{ padding: "18px 20px" }}>
            <span className="summary-card__label">Tổng đơn mua hộ</span>
            <strong className="summary-card__val text-primary">{documentItems.length}</strong>
            <span className="summary-card__sub">Dữ liệu toàn hệ thống</span>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="summary-card is-success" bodyStyle={{ padding: "18px 20px" }}>
            <span className="summary-card__label">Chứng từ đang lọc</span>
            <strong className="summary-card__val text-success">{filteredData.length}</strong>
            <span className="summary-card__sub">Phù hợp điều kiện</span>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="summary-card is-purple" bodyStyle={{ padding: "18px 20px" }}>
            <span className="summary-card__label">Loại chứng từ chính</span>
            <strong className="summary-card__val text-purple">Hóa đơn mua hộ</strong>
            <span className="summary-card__sub">Đã xác thực dữ liệu</span>
          </Card>
        </Col>
      </Row>

      {/* Filter Section */}
      <div className="documents-filter-bar">
        <Input
          prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
          placeholder="Tìm theo mã mua hộ, tên khách hàng, SĐT..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          className="filter-search-input"
        />

        <div className="filter-select-group">
          <FilterOutlined style={{ color: "#64748b", fontSize: "14px" }} />
          <Select
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val)}
            className="filter-status-select"
          >
            <Option value="ALL">Tất cả trạng thái ({documentItems.length})</Option>
            {availableStatusOptions.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        </div>
      </div>

      {/* Main Table */}
      <Card className="documents-table-card" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey={(r) => r.purchaseRequestId || r.id || r.purchaseCode}
          loading={loading}
          scroll={{ y: "calc(100vh - 410px)" }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total) => `Tổng cộng ${total} chứng từ mua hộ`,
          }}
          locale={{ emptyText: <Empty description="Chưa có giấy tờ mua hộ nào trong hệ thống" /> }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        open={modalOpen}
        title={
          <div className="preview-modal-title">
            <FileDoneOutlined style={{ color: "#9333ea", marginRight: 8 }} />
            Chi tiết chứng từ mua hộ — {selectedDoc?.purchaseCode || selectedDoc?.id}
          </div>
        }
        onCancel={() => setModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setModalOpen(false)}>
            Đóng cửa sổ
          </Button>,
        ]}
        width={720}
        centered
      >
        {selectedDoc && (
          <div style={{ padding: "16px 0", fontSize: "14px", lineHeight: "1.8" }}>
            <div style={{ marginBottom: "10px" }}><strong>Mã đơn mua hộ:</strong> <span style={{ color: "#2563eb", fontWeight: "700" }}>{selectedDoc.purchaseCode || selectedDoc.id}</span></div>
            <div style={{ marginBottom: "10px" }}><strong>Khách hàng:</strong> {selectedDoc.customerName || "—"}</div>
            <div style={{ marginBottom: "10px" }}><strong>Số điện thoại:</strong> {selectedDoc.customerPhone || "—"}</div>
            <div style={{ marginBottom: "10px" }}><strong>Tuyến vận chuyển:</strong> {selectedDoc.route || "Hàn Quốc ➔ Việt Nam"}</div>
            <div style={{ marginBottom: "10px" }}><strong>Trạng thái:</strong> {getPurchaseStatusBadge(selectedDoc.status, selectedDoc.statusDisplayName)}</div>
            <div style={{ marginBottom: "10px" }}><strong>Tổng chi phí dự kiến:</strong> {selectedDoc.totalAmount ? `${new Intl.NumberFormat("vi-VN").format(selectedDoc.totalAmount)} ₫` : "—"}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
