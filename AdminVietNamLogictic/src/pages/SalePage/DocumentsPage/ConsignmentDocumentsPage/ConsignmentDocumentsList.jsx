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
  Spin,
  Empty,
  Modal,
} from "antd";
import {
  FileTextOutlined,
  DownloadOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  InboxOutlined,
  PrinterOutlined,
  UserOutlined,
  CarOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import { getConsignmentsApi } from "../../../../api/SaleAPI/ConsignmentAPI/consignmentService";
import { getConsignmentReceiptApi } from "../../../../api/SaleAPI/ConsignmentAPI/consignmentReceiptService";
import { formatVietnamDateTime } from "../../../../utils/timeUtc";
import "./ConsignmentDocumentsList.css";

const { Option } = Select;

/* =========================================================
   STATUS CONFIGURATION (100% VIETNAMESE)
========================================================= */
const CONSIGNMENT_STATUS_MAP = {
  CHECKED_IN: { label: "Đã kiểm kho", color: "green", bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  PENDING_REVIEW: { label: "Chờ duyệt", color: "gold", bg: "#fefce8", border: "#fef08a", text: "#854d0e" },
  APPROVED: { label: "Đã duyệt", color: "blue", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  QUOTATION_SENT: { label: "Đã gửi báo giá", color: "cyan", bg: "#ecfeff", border: "#a5f3fc", text: "#0891b2" },
  QUOTATION_CONFIRMED: { label: "Đã xác nhận báo giá", color: "teal", bg: "#f0fdfa", border: "#99f6e4", text: "#0f766e" },
  WAITING_DEPOSIT: { label: "Chờ đặt cọc", color: "orange", bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
  WAREHOUSE_RECEIVED: { label: "Kho đã nhận", color: "purple", bg: "#faf5ff", border: "#e9d5ff", text: "#6b21a8" },
  WAITING_FOR_PARCEL: { label: "Chờ kiện hàng", color: "gold", bg: "#fefce8", border: "#fef08a", text: "#854d0e" },
  WAITING_PARCEL: { label: "Chờ kiện hàng", color: "gold", bg: "#fefce8", border: "#fef08a", text: "#854d0e" },
  WAITING_PAYMENT: { label: "Chờ thanh toán", color: "orange", bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
  PAID: { label: "Đã thanh toán", color: "blue", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  STORED: { label: "Đã nhập kho", color: "purple", bg: "#faf5ff", border: "#e9d5ff", text: "#6b21a8" },
  WAITING_STORED: { label: "Chờ nhập kho", color: "amber", bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  ARRIVED_ORIGIN_WAREHOUSE: { label: "Đã về kho gốc", color: "geekblue", bg: "#f0f5ff", border: "#adc6ff", text: "#1d39c4" },
  CANCELLED: { label: "Đã hủy", color: "red", bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
  REJECTED: { label: "Đã từ chối", color: "red", bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
  PROCESSING: { label: "Đang xử lý", color: "blue", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  PURCHASED: { label: "Đã mua hàng", color: "teal", bg: "#f0fdfa", border: "#99f6e4", text: "#0f766e" },
  DELIVERING: { label: "Đang vận chuyển", color: "indigo", bg: "#eef2ff", border: "#c7d2fe", text: "#4338ca" },
  DELIVERED: { label: "Đã giao hàng", color: "green", bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  DRAFT: { label: "Bản nháp", color: "default", bg: "#f8fafc", border: "#e2e8f0", text: "#475569" },
  COMPLETED: { label: "Hoàn tất", color: "emerald", bg: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
};

const getStatusBadge = (statusKey, statusDisplayName) => {
  const code = String(statusKey || "").toUpperCase();
  const config = CONSIGNMENT_STATUS_MAP[code] || {
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

const getConsignmentTypeLabel = (type) => {
  const raw = String(type || "").toUpperCase();
  if (raw === "STANDARD" || raw === "TIÊU CHUẨN") return "Tiêu chuẩn";
  if (raw === "EXPRESS" || raw === "HỎA TỐC") return "Hỏa tốc";
  if (raw === "ECONOMY" || raw === "TIẾT KIỆM") return "Tiết kiệm";
  return type || "Tiêu chuẩn";
};

const formatRouteText = (route) => {
  if (!route) return "TQ ➔ VN";
  const str = String(route).trim();
  if (str.toLowerCase().includes("trung quốc") && str.toLowerCase().includes("việt nam")) {
    return "TQ ➔ VN";
  }
  if (str.toLowerCase().includes("hàn quốc") && str.toLowerCase().includes("việt nam")) {
    return "HQ ➔ VN";
  }
  return str.replace(/-->/g, "➔").replace(/->/g, "➔");
};

export default function ConsignmentDocumentsList() {
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");

  const fetchConsignmentDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getConsignmentsApi({ pageNumber: 1, pageSize: 1000 });
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setItems(list);
    } catch (err) {
      console.error("Fetch consignment documents error:", err);
      AuthNotify.error("Không thể tải danh sách giấy tờ", err?.message || "Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsignmentDocuments();
  }, [fetchConsignmentDocuments]);

  // Handle Receipt PDF Download
  const handleDownloadReceipt = async (record) => {
    const orderId = record?.orderId || record?.id;
    if (!orderId) return;

    try {
      setDownloadingId(orderId);
      if (record?.receiptPdfUrl) {
        window.open(record.receiptPdfUrl, "_blank");
      } else {
        await getConsignmentReceiptApi(orderId, { download: true });
      }
      AuthNotify.success(
        "Tải phiếu thành công",
        `Đã xuất file PDF phiếu biên nhận cho đơn ${record?.consignmentCode || record?.orderCode || record?.trackingCode || orderId}.pdf`
      );
    } catch (err) {
      console.error("Download receipt error:", err);
      AuthNotify.error("Không thể tải phiếu biên nhận", err?.message || "Vui lòng thử lại sau.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Receipt PDF Preview Modal
  const handlePreviewReceipt = async (record) => {
    const orderId = record?.orderId || record?.id;
    if (!orderId) return;

    try {
      setDownloadingId(orderId);
      let pdfUrl = record?.receiptPdfUrl;
      if (!pdfUrl) {
        const pdfBlob = await getConsignmentReceiptApi(orderId, { download: false });
        pdfUrl = URL.createObjectURL(pdfBlob);
      }
      setPreviewPdfUrl(pdfUrl);
      setPreviewTitle(`Phiếu biên nhận ký gửi — ${record?.consignmentCode || record?.orderCode || record?.trackingCode || orderId}`);
      setPreviewModalOpen(true);
    } catch (err) {
      console.error("Preview receipt error:", err);
      AuthNotify.error("Không thể xem trước phiếu", err?.message || "Vui lòng thử lại sau.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleClosePreview = () => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
    }
    setPreviewPdfUrl(null);
    setPreviewModalOpen(false);
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
      const code = String(item.consignmentStatus || item.status || "").toUpperCase();
      return code && ALLOWED_DOCUMENT_STATUSES.has(code);
    });
  }, [items, ALLOWED_DOCUMENT_STATUSES]);

  // Dynamic available status options
  const availableStatusOptions = useMemo(() => {
    const statusMap = new Map();

    documentItems.forEach((item) => {
      const code = String(item.status || item.consignmentStatus || "").toUpperCase();
      if (!code) return;

      if (!statusMap.has(code)) {
        const mapped = CONSIGNMENT_STATUS_MAP[code];
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
      const code = String(item.consignmentCode || item.orderCode || item.trackingCode || "").toLowerCase();
      const name = String(item.customer?.fullName || item.customerName || item.receiverName || "").toLowerCase();
      const phone = String(item.receiverPhone || item.customer?.phone || "").toLowerCase();
      const search = searchText.trim().toLowerCase();

      const matchesSearch = !search || code.includes(search) || name.includes(search) || phone.includes(search);
      const matchesStatus =
        selectedStatus === "ALL" ||
        String(item.consignmentStatus || item.status || "").toUpperCase() === selectedStatus;

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
      title: "Mã vận đơn / Đơn ký gửi",
      key: "orderCode",
      render: (record) => (
        <div className="doc-code-block">
          <strong className="doc-code-text">
            {record.consignmentCode || record.trackingCode || record.orderCode || record.id}
          </strong>
          <div className="doc-meta-row">
            <span className="doc-route-badge">Tuyến: {formatRouteText(record.route)}</span>
            {record.createdAt && (
              <span className="doc-date-text">
                {formatVietnamDateTime(record.createdAt)}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Khách hàng & Người nhận",
      key: "customer",
      render: (record) => (
        <div className="customer-info-box">
          <div className="customer-avatar">
            <UserOutlined />
          </div>
          <div>
            <strong className="customer-name">
              {record.customer?.fullName || record.customerName || record.receiverName || "—"}
            </strong>
            <div className="customer-sub-info">
              <span>📞 {record.receiverPhone || record.customer?.phone || "—"}</span>
              {record.receiverAddress && (
                <span className="customer-address" title={record.receiverAddress}>
                  📍 {record.receiverAddress}
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Loại vận chuyển & Chứng từ",
      key: "documentType",
      render: (record) => (
        <div className="doc-type-group">
          <Tag color="blue" className="doc-type-tag">
            <FileTextOutlined style={{ marginRight: 4 }} /> Phiếu biên nhận ký gửi
          </Tag>
          <span className="shipping-type-pill">
            <CarOutlined style={{ marginRight: 4 }} />
            {getConsignmentTypeLabel(record.consignmentType)}
          </span>
        </div>
      ),
    },
    {
      title: "Trạng thái xử lý",
      key: "status",
      render: (record) => getStatusBadge(record.status || record.consignmentStatus, record.statusDisplayName),
    },
    {
      title: "Thao tác chứng từ",
      key: "actions",
      align: "center",
      width: 200,
      render: (record) => {
        const isCurrentDownloading = downloadingId === (record.orderId || record.id);
        return (
          <Space size="small">
            <Tooltip title="Xem trước phiếu biên nhận PDF">
              <Button
                type="default"
                size="small"
                icon={<EyeOutlined />}
                loading={isCurrentDownloading}
                onClick={() => handlePreviewReceipt(record)}
                className="btn-preview-doc"
              >
                Xem trước
              </Button>
            </Tooltip>

            <Tooltip title="Xuất / Tải về file PDF">
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                loading={isCurrentDownloading}
                onClick={() => handleDownloadReceipt(record)}
                className="btn-download-doc"
              >
                Tải PDF
              </Button>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="consignment-docs-page">
      {/* Header Banner */}
      <div className="documents-header">
        <div>
          <h2 className="documents-title">
            <InboxOutlined style={{ marginRight: 10, color: "#2563eb" }} />
            Quản lý giấy tờ Ký gửi
          </h2>
          <p className="documents-subtitle">
            Tra cứu, xem trước và xuất file PDF phiếu biên nhận / chứng từ giao nhận đơn hàng ký gửi.
          </p>
        </div>

        <Button
          icon={<ReloadOutlined />}
          onClick={fetchConsignmentDocuments}
          loading={loading}
          size="large"
          className="btn-refresh-page"
        >
          Làm mới dữ liệu
        </Button>
      </div>

      {/* Summary Cards Row */}
      <Row gutter={[16, 16]} className="documents-summary-row">
        <Col xs={24} sm={8}>
          <Card className="summary-card is-primary" styles={{ body: { padding: "18px 20px" } }}>
            <span className="summary-card__label">Tổng số chứng từ ký gửi</span>
            <strong className="summary-card__val text-primary">{documentItems.length}</strong>
            <span className="summary-card__sub">Dữ liệu toàn hệ thống</span>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="summary-card is-success" styles={{ body: { padding: "18px 20px" } }}>
            <span className="summary-card__label">Chứng từ sẵn sàng xuất PDF</span>
            <strong className="summary-card__val text-success">{filteredData.length}</strong>
            <span className="summary-card__sub">Đã định dạng chuẩn PDF</span>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="summary-card is-purple" styles={{ body: { padding: "18px 20px" } }}>
            <span className="summary-card__label">Định dạng kết xuất</span>
            <strong className="summary-card__val text-purple">Phiếu biên nhận PDF</strong>
            <span className="summary-card__sub">Hỗ trợ in / xem trực tiếp</span>
          </Card>
        </Col>
      </Row>

      {/* Filter Section */}
      <div className="documents-filter-bar">
        <Input
          prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
          placeholder="Tìm theo mã ký gửi, tên khách hàng, số điện thoại..."
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
          rowKey={(r) => r.orderId || r.id || r.consignmentCode || r.trackingCode}
          loading={loading}
          scroll={{ y: 480 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total) => `Tổng cộng ${total} chứng từ ký gửi`,
          }}
          locale={{ emptyText: <Empty description="Chưa có giấy tờ ký gửi nào trong hệ thống" /> }}
        />
      </Card>

      {/* PDF Preview Modal */}
      <Modal
        open={previewModalOpen}
        title={
          <div className="preview-modal-title">
            <PrinterOutlined style={{ color: "#2563eb", marginRight: 8 }} />
            {previewTitle}
          </div>
        }
        onCancel={handleClosePreview}
        footer={[
          <Button key="close" onClick={handleClosePreview}>
            Đóng cửa sổ
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              if (previewPdfUrl) {
                const link = document.createElement("a");
                link.href = previewPdfUrl;
                link.download = `${previewTitle}.pdf`;
                link.click();
              }
            }}
          >
            Tải về file PDF
          </Button>,
        ]}
        width={960}
        centered
        destroyOnClose
        className="vcl-pdf-preview-modal"
      >
        {previewPdfUrl ? (
          <iframe
            src={previewPdfUrl}
            title="Xem trước phiếu biên nhận"
            style={{ width: "100%", height: "640px", border: "none", borderRadius: "12px", background: "#f8fafc" }}
          />
        ) : (
          <div style={{ padding: 60, textAlign: "center" }}>
            <Spin tip="Đang kết xuất phiếu PDF từ máy chủ..." size="large" />
          </div>
        )}
      </Modal>
    </div>
  );
}
