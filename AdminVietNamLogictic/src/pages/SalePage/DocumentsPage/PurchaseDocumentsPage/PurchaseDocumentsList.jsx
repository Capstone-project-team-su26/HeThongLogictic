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
  Descriptions,
} from "antd";
import {
  EyeOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  CarOutlined,
  FilterOutlined,
  UserOutlined,
} from "@ant-design/icons";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import {
  getPurchaseRequestsApi,
  getPurchaseRequestDetailApi,
} from "../../../../api/SaleAPI/PurchaseRequestAPI/purchaseRequestService";
import { formatVietnamDateTime } from "../../../../utils/timeUtc";
import "./PurchaseDocumentsList.css";

const { Option } = Select;

/* =========================================================
   STATUS CONFIGURATION (100% VIETNAMESE)
========================================================= */
const PURCHASE_STATUS_MAP = {
  PENDING_REVIEW: { label: "Chờ xác nhận", color: "gold", bg: "#fefce8", border: "#fef08a", text: "#854d0e" },
  IN_REVIEW: { label: "Đang xem xét", color: "gold", bg: "#fefce8", border: "#fef08a", text: "#854d0e" },
  APPROVED: { label: "Đã duyệt", color: "blue", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  QUOTED: { label: "Đã báo giá", color: "cyan", bg: "#ecfeff", border: "#a5f3fc", text: "#0891b2" },
  QUOTATION_SENT: { label: "Đã báo giá", color: "cyan", bg: "#ecfeff", border: "#a5f3fc", text: "#0891b2" },
  QUOTATION_CONFIRMED: { label: "Đã xác nhận báo giá", color: "teal", bg: "#f0fdfa", border: "#99f6e4", text: "#0f766e" },
  QUOTATION_REJECTED: { label: "Từ chối báo giá", color: "red", bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
  WAITING_DEPOSIT: { label: "Chờ đặt cọc", color: "orange", bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
  DEPOSITED: { label: "Đã cọc tiền", color: "blue", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  DEPOSIT_PAID: { label: "Đã cọc tiền", color: "blue", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  WAITING_PAYMENT: { label: "Chờ thanh toán", color: "orange", bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
  PURCHASED: { label: "Xác nhận mua hàng", color: "teal", bg: "#f0fdfa", border: "#99f6e4", text: "#0f766e" },
  WAREHOUSE_RECEIVED: { label: "Kho đã nhận", color: "purple", bg: "#faf5ff", border: "#e9d5ff", text: "#6b21a8" },
  CHECKED_IN: { label: "Đã kiểm kho", color: "green", bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  STORED: { label: "Đã nhập kho", color: "purple", bg: "#faf5ff", border: "#e9d5ff", text: "#6b21a8" },
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
      <span
        className="vcl-status-chip__dot"
        style={{ backgroundColor: config.text }}
      />
      {config.label}
    </span>
  );
};

const getShippingOptionLabel = (option) => {
  if (!option) return "Tiêu chuẩn";
  const str = String(option).toUpperCase();
  if (str === "EXPRESS") return "Hỏa tốc";
  if (str === "ECONOMY") return "Tiết kiệm";
  return "Tiêu chuẩn";
};

const formatRouteText = (route) => {
  if (!route) return "VN ➔ HQ";
  const str = String(route).trim();
  const upper = str.toUpperCase();
  if (upper.includes("TRUNG QUỐC") || upper.includes("CHINA")) return "TQ ➔ VN";
  if (upper.includes("HÀN QUỐC") || upper.includes("KOREA")) {
    if (upper.startsWith("VIETNAM") || upper.startsWith("VN")) return "VN ➔ HQ";
    return "HQ ➔ VN";
  }
  if (upper.includes("NHẬT BẢN") || upper.includes("JAPAN")) {
    if (upper.startsWith("VIETNAM") || upper.startsWith("VN")) return "VN ➔ NB";
    return "NB ➔ VN";
  }
  if (upper.includes("USA") || upper.includes("MỸ")) {
    if (upper.startsWith("VIETNAM") || upper.startsWith("VN")) return "VN ➔ MỸ";
    return "MỸ ➔ VN";
  }
  return str.replace(/-->/g, " ➔ ").replace(/->/g, " ➔ ").replace(/-/g, " ➔ ");
};

export default function PurchaseDocumentsList() {
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");

  const fetchPurchaseDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPurchaseRequestsApi({ pageNumber: 1, pageSize: 1000 });
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

      const allowedSet = new Set([
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
      ]);

      const eligible = list.filter((item) => allowedSet.has(String(item.status || "").toUpperCase()));

      if (eligible.length > 0) {
        const enrichedList = await Promise.all(
          eligible.map(async (item) => {
            const id = item.purchaseRequestId || item.id;
            if (!id) return item;
            try {
              const detail = await getPurchaseRequestDetailApi(id);
              return detail ? { ...item, ...detail } : item;
            } catch {
              return item;
            }
          })
        );

        const detailMap = new Map(
          enrichedList.map((d) => [d.purchaseRequestId || d.id, d])
        );

        setItems(
          list.map((item) => detailMap.get(item.purchaseRequestId || item.id) || item)
        );
      } else {
        setItems(list);
      }
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

  const handleViewDetails = async (record) => {
    const id = record?.purchaseRequestId || record?.id;
    if (!id) return;
    try {
      setLoading(true);
      const detail = await getPurchaseRequestDetailApi(id);
      setSelectedDoc(detail || record);
    } catch {
      setSelectedDoc(record);
    } finally {
      setLoading(false);
      setModalOpen(true);
    }
  };

  const handlePreviewReceipt = async (record) => {
    const id = record?.purchaseRequestId || record?.id;
    if (!id) return;

    try {
      setDownloadingId(id);
      let pdfUrl = record?.receiptPdfUrl;
      if (!pdfUrl) {
        const detail = await getPurchaseRequestDetailApi(id);
        pdfUrl = detail?.receiptPdfUrl;
        if (detail) {
          setItems((prev) =>
            prev.map((item) => ((item.purchaseRequestId || item.id) === id ? { ...item, ...detail } : item))
          );
        }
      }

      if (pdfUrl) {
        setPreviewPdfUrl(pdfUrl);
        setPreviewTitle(`Phiếu biên nhận mua hộ — ${record?.purchaseCode || record?.orderCode || id}`);
        setPreviewModalOpen(true);
      } else {
        handleViewDetails(record);
      }
    } catch (err) {
      console.error("Preview receipt error:", err);
      AuthNotify.error("Không thể xem trước phiếu", err?.message || "Vui lòng thử lại sau.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadReceipt = async (record) => {
    const id = record?.purchaseRequestId || record?.id;
    if (!id) return;

    try {
      setDownloadingId(id);
      let pdfUrl = record?.receiptPdfUrl;

      if (!pdfUrl) {
        const detail = await getPurchaseRequestDetailApi(id);
        pdfUrl = detail?.receiptPdfUrl;
        if (detail) {
          setItems((prev) =>
            prev.map((item) => ((item.purchaseRequestId || item.id) === id ? { ...item, ...detail } : item))
          );
        }
      }

      if (pdfUrl) {
        window.open(pdfUrl, "_blank");
        AuthNotify.success(
          "Tải phiếu thành công",
          `Đã xuất file PDF phiếu biên nhận mua hộ cho đơn ${record?.purchaseCode || record?.orderCode || id}.pdf`
        );
      } else {
        AuthNotify.warning("Chưa có phiếu PDF", "Đơn hàng này chưa có liên kết file PDF biên nhận.");
      }
    } catch (err) {
      console.error("Download receipt error:", err);
      AuthNotify.error("Không thể tải phiếu biên nhận", err?.message || "Vui lòng thử lại sau.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Eligible statuses for document management
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
      const code = String(item.purchaseCode || item.orderCode || item.id || "").toLowerCase();
      const customer = String(item.customerName || item.receiverName || item.customerPhone || "").toLowerCase();
      const search = searchText.trim().toLowerCase();

      const matchesSearch = !search || code.includes(search) || customer.includes(search);
      const matchesStatus =
        selectedStatus === "ALL" ||
        String(item.status || "").toUpperCase() === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [documentItems, searchText, selectedStatus]);

  // Table Columns - Mirroring Consignment Documents layout 100%
  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 65,
      align: "center",
      render: (_, __, index) => <span className="pur-table-stt">{index + 1}</span>,
    },
    {
      title: "Mã vận đơn / Đơn mua hộ",
      key: "purchaseCode",
      render: (record) => (
        <div className="doc-code-block">
          <strong className="doc-code-text">{record.purchaseCode || record.orderCode || record.id}</strong>
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
      title: "Khách hàng & Người nhận",
      key: "customer",
      render: (record) => {
        const name = record.receiverName || record.customerName || record.createdByName || "—";
        const phone = record.receiverPhone || record.customerPhone || record.phone || record.customer?.phone;
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
          <Tag color="purple" className="doc-type-tag">
            <FileTextOutlined style={{ marginRight: 4 }} /> Phiếu biên nhận mua hộ
          </Tag>
          <span className="shipping-type-pill">
            <CarOutlined style={{ marginRight: 4 }} />
            {getShippingOptionLabel(record.shippingOption)}
          </span>
        </div>
      ),
    },
    {
      title: "Trạng thái xử lý",
      key: "status",
      render: (record) => getPurchaseStatusBadge(record.status, record.statusDisplayName),
    },
    {
      title: "Thao tác chứng từ",
      key: "actions",
      align: "center",
      width: 220,
      render: (record) => {
        const isCurrentDownloading = downloadingId === (record.purchaseRequestId || record.id);
        return (
          <Space size="small">
            <Tooltip title="Xem trước phiếu biên nhận PDF">
              <Button
                type="default"
                size="small"
                icon={<EyeOutlined />}
                loading={isCurrentDownloading}
                onClick={() => handlePreviewReceipt(record)}
                className="pur-btn-preview"
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
                className="pur-btn-download"
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
    <div className="purchase-docs-page">
      {/* Header Banner */}
      <div className="documents-header">
        <div>
          <h2 className="documents-title">
            <ShoppingOutlined style={{ marginRight: 10, color: "#9333ea" }} />
            Quản lý giấy tờ Mua hộ
          </h2>
          <p className="documents-subtitle">
            Tra cứu, xem trước và xuất file PDF phiếu biên nhận / chứng từ giao nhận đơn hàng mua hộ.
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

      {/* Summary Cards Row */}
      <Row gutter={[16, 16]} className="documents-summary-row">
        <Col xs={24} sm={8}>
          <Card className="summary-card is-primary" styles={{ body: { padding: "18px 20px" } }}>
            <span className="summary-card__label">Tổng số chứng từ mua hộ</span>
            <strong className="summary-card__val text-purple">{documentItems.length}</strong>
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
          placeholder="Tìm theo mã mua hộ, tên khách hàng, số điện thoại..."
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
          scroll={{ y: 480 }}
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
            <ShoppingOutlined style={{ color: "#9333ea", marginRight: 8 }} />
            Chi tiết chứng từ mua hộ — {selectedDoc?.purchaseCode || selectedDoc?.id}
          </div>
        }
        onCancel={() => setModalOpen(false)}
        footer={[
          selectedDoc?.receiptPdfUrl && (
            <Button
              key="pdf"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => window.open(selectedDoc.receiptPdfUrl, "_blank")}
            >
              Xuất file PDF phiếu biên nhận
            </Button>
          ),
          <Button key="close" onClick={() => setModalOpen(false)}>
            Đóng
          </Button>,
        ]}
        width={780}
        centered
      >
        {selectedDoc && (
          <div style={{ padding: "8px 0", fontSize: "13.5px", lineHeight: "1.6" }}>
            <Descriptions title="Thông tin đơn hàng mua hộ" bordered size="small" column={2}>
              <Descriptions.Item label="Mã đơn mua hộ">
                <strong style={{ color: "#9333ea" }}>{selectedDoc.purchaseCode || selectedDoc.id}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {getPurchaseStatusBadge(selectedDoc.status, selectedDoc.statusDisplayName)}
              </Descriptions.Item>
              <Descriptions.Item label="Người nhận">
                {selectedDoc.receiverName || selectedDoc.customerName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {selectedDoc.receiverPhone || selectedDoc.customerPhone || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ nhận hàng" span={2}>
                {selectedDoc.receiverAddress || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Kho lưu trữ">
                {selectedDoc.warehouseName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Tuyến vận chuyển">
                {formatRouteText(selectedDoc.route)}
              </Descriptions.Item>
            </Descriptions>

            {/* Quotation Breakdown if available */}
            {selectedDoc.quotation && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  💰 Bảng chi tiết báo giá & phí dịch vụ
                </h4>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="Tiền hàng (Subtotal)">
                    {selectedDoc.quotation.productsSubtotal ? `${new Intl.NumberFormat("vi-VN").format(selectedDoc.quotation.productsSubtotal)} ₫` : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Phí mua hộ">
                    {selectedDoc.quotation.purchaseFee ? `${new Intl.NumberFormat("vi-VN").format(selectedDoc.quotation.purchaseFee)} ₫` : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Phí vận chuyển">
                    {selectedDoc.quotation.shippingFee ? `${new Intl.NumberFormat("vi-VN").format(selectedDoc.quotation.shippingFee)} ₫` : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Thuế nhập khẩu">
                    {selectedDoc.quotation.importTax ? `${new Intl.NumberFormat("vi-VN").format(selectedDoc.quotation.importTax)} ₫` : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="VAT (8%)">
                    {selectedDoc.quotation.vat ? `${new Intl.NumberFormat("vi-VN").format(selectedDoc.quotation.vat)} ₫` : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Tổng cộng thanh toán">
                    <strong style={{ color: "#16a34a", fontSize: "15px" }}>
                      {selectedDoc.quotation.totalAmount ? `${new Intl.NumberFormat("vi-VN").format(selectedDoc.quotation.totalAmount)} ₫` : "—"}
                    </strong>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}

            {/* Additional Fees breakdown if available */}
            {Array.isArray(selectedDoc.quotation?.additionalFees) && selectedDoc.quotation.additionalFees.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  📑 Danh sách phụ phí & Thuế tính kèm ({selectedDoc.quotation.additionalFees.length})
                </h4>
                <Table
                  dataSource={selectedDoc.quotation.additionalFees}
                  rowKey={(fee, idx) => fee.id || idx}
                  pagination={false}
                  size="small"
                  columns={[
                    { title: "Tên khoản phí", dataIndex: "feeName", key: "feeName", render: (text) => <strong>{text}</strong> },
                    { title: "Cách tính", dataIndex: "calculationType", key: "calculationType", width: 110, render: (val, r) => `${val === "PERCENTAGE" ? `${r.value}%` : "Cố định"}` },
                    { title: "Thành tiền", dataIndex: "amount", key: "amount", align: "right", width: 130, render: (val) => `${new Intl.NumberFormat("vi-VN").format(val || 0)} ₫` },
                    { title: "Ghi chú", dataIndex: "note", key: "note", render: (text) => <span style={{ color: "#64748b", fontSize: "12px" }}>{text || "—"}</span> },
                  ]}
                />
              </div>
            )}

            {/* Items list */}
            {Array.isArray(selectedDoc.items) && selectedDoc.items.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  📦 Danh sách sản phẩm ({selectedDoc.items.length})
                </h4>
                <Table
                  dataSource={selectedDoc.items}
                  rowKey={(item, index) => item.itemId || index}
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: "Sản phẩm",
                      dataIndex: "productName",
                      key: "productName",
                      render: (text, record) => (
                        <div>
                          <strong>{text || "Sản phẩm"}</strong>
                          {record.sourceWebsite && (
                            <div style={{ fontSize: "11px", color: "#64748b" }}>Nguồn: {record.sourceWebsite}</div>
                          )}
                        </div>
                      ),
                    },
                    { title: "Phân loại", dataIndex: "productType", key: "productType", width: 120 },
                    { title: "Số lượng", dataIndex: "quantity", key: "quantity", align: "center", width: 90 },
                  ]}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* PDF Preview Modal */}
      <Modal
        open={previewModalOpen}
        title={
          <div className="preview-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShoppingOutlined style={{ color: "#9333ea" }} />
            <span>{previewTitle}</span>
          </div>
        }
        onCancel={() => setPreviewModalOpen(false)}
        footer={[
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            style={{ backgroundColor: "#9333ea", borderColor: "#9333ea" }}
            onClick={() => window.open(previewPdfUrl, "_blank")}
          >
            Mở file PDF cửa sổ mới / In phiếu
          </Button>,
          <Button key="close" onClick={() => setPreviewModalOpen(false)}>
            Đóng
          </Button>,
        ]}
        width={960}
        centered
        destroyOnClose
      >
        {previewPdfUrl ? (
          <div style={{ width: "100%", height: "650px", background: "#f8fafc", borderRadius: 8, overflow: "hidden" }}>
            <object
              data={previewPdfUrl}
              type="application/pdf"
              width="100%"
              height="100%"
            >
              <iframe
                src={previewPdfUrl}
                title="PDF Preview"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </object>
          </div>
        ) : (
          <Empty description="Không tìm thấy file PDF phiếu biên nhận" />
        )}
      </Modal>
    </div>
  );
}
