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
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import { getConsignmentsApi } from "@features/consignment/api/consignmentService.mock";
import { getConsignmentReceiptApi } from "@features/consignment/api/consignmentReceiptService.mock";
import { formatVietnamDateTime } from "@shared/utils/timeUtc";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_ORDER,
  normalizeOrderStatus,
} from "@features/consignment";
import "./ConsignmentDocumentsList.css";

const { Option } = Select;

/* =========================================================
   STATUS CONFIGURATION (100% VIETNAMESE)
========================================================= */
/* Màu chip theo mã đơn đích; nhãn lấy từ module trạng thái đơn dùng chung. */
const CONSIGNMENT_STATUS_STYLES = {
  PENDING_REVIEW: { color: "gold", bg: "#fefce8", border: "#fef08a", text: "#854d0e" },
  NEED_MORE_INFO: { color: "gold", bg: "#fefce8", border: "#fef08a", text: "#854d0e" },
  REJECTED: { color: "red", bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
  QUOTATION_SENT: { color: "cyan", bg: "#ecfeff", border: "#a5f3fc", text: "#0891b2" },
  QUOTATION_REJECTED: { color: "red", bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
  WAITING_DEPOSIT: { color: "orange", bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
  DEPOSIT_PAID: { color: "teal", bg: "#f0fdfa", border: "#99f6e4", text: "#0f766e" },
  APPROVED: { color: "blue", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  CHECKED_IN: { color: "geekblue", bg: "#f0f5ff", border: "#adc6ff", text: "#1d39c4" },
  IN_TRANSIT: { color: "indigo", bg: "#eef2ff", border: "#c7d2fe", text: "#4338ca" },
  ARRIVED_VN: { color: "purple", bg: "#faf5ff", border: "#e9d5ff", text: "#6b21a8" },
  ARRIVED_DESTINATION: { color: "purple", bg: "#faf5ff", border: "#e9d5ff", text: "#6b21a8" },
  WAITING_PAYMENT: { color: "orange", bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
  PAID: { color: "blue", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  STORED_AT_VN: { color: "amber", bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  DELIVERING: { color: "indigo", bg: "#eef2ff", border: "#c7d2fe", text: "#4338ca" },
  DELIVERED: { color: "green", bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  COMPLETED: { color: "emerald", bg: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
  CANCELLED: { color: "red", bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
};

const CONSIGNMENT_STATUS_MAP = Object.fromEntries(
  ORDER_STATUS_ORDER.map((code) => [
    code,
    { label: ORDER_STATUS_LABELS[code], ...CONSIGNMENT_STATUS_STYLES[code] },
  ])
);

const getStatusBadge = (statusKey, statusDisplayName) => {
  const code = String(normalizeOrderStatus(statusKey) || "").toUpperCase();
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
        "CHECKED_IN",
        "ARRIVED_DESTINATION",
        "STORED_AT_VN",
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
      const code = String(
        normalizeOrderStatus(item.consignmentStatus || item.status) || ""
      ).toUpperCase();
      return code && ALLOWED_DOCUMENT_STATUSES.has(code);
    });
  }, [items, ALLOWED_DOCUMENT_STATUSES]);

  // Dynamic available status options
  const availableStatusOptions = useMemo(() => {
    const statusMap = new Map();

    documentItems.forEach((item) => {
      const code = String(
        normalizeOrderStatus(item.status || item.consignmentStatus) || ""
      ).toUpperCase();
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
        String(
          normalizeOrderStatus(item.consignmentStatus || item.status) || ""
        ).toUpperCase() === selectedStatus;

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
      render: (record) => {
        const name = record.receiverName || record.customer?.fullName || record.customerName || "—";
        const phone = record.receiverPhone || record.customer?.phone || record.phone;
        const address = record.receiverAddress || record.address || record.customer?.address;

        return (
          <div className="customer-info-box">
            <div className="customer-avatar">
              <UserOutlined />
            </div>
            <div>
              <strong className="customer-name">{name}</strong>
              <div className="customer-sub-info">
                <span>📞 {phone || "—"}</span>
                {address && (
                  <span className="customer-address" title={address}>
                    📍 {address}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
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
