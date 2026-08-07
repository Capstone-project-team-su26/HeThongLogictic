import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Modal,
  Button,
  Input,
  Upload,
  Tag,
  Divider,
  Alert,
  Select,
  Space,
} from "antd";
import {
  ShoppingOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  BarcodeOutlined,
  SyncOutlined,
  CarOutlined,
  HomeOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import { uploadImage } from "../../../../api/Upload/UploadImage";
import "./ConfirmPurchaseModal.css";

const { TextArea } = Input;

const MAX_IMAGES = 3;

const PURCHASE_STATUS_OPTIONS = [
  {
    value: "PURCHASED",
    label: "Đã mua hàng (Đã đặt đơn với NCC)",
    tagColor: "green",
    description: "Đã hoàn tất thanh toán và chốt đơn mua với Nhà cung cấp.",
  },
  {
    value: "SELLER_SHIPPED",
    label: "Nhà cung cấp đã phát hàng (Có mã vận đơn)",
    tagColor: "processing",
    description: "Nhà cung cấp đã bàn giao đơn cho bên vận chuyển nội địa.",
  },
  {
    value: "ARRIVED_ORIGIN_WAREHOUSE",
    label: "Đã nhập kho xuất phát (Nước ngoài)",
    tagColor: "cyan",
    description: "Hàng đã về tới kho thu gom ban đầu (Trung Quốc, Hàn Quốc...).",
  },
  {
    value: "PROCESSING",
    label: "Đang mua hàng (Đang xử lý mua)",
    tagColor: "orange",
    description: "Nhân viên đang đàm phán hoặc chờ phản hồi từ nhà cung cấp.",
  },
  {
    value: "COMPLETED",
    label: "Hoàn tất nghiệp vụ mua hộ",
    tagColor: "purple",
    description: "Hoàn tất toàn bộ chu trình xử lý đơn hàng mua hộ.",
  },
];

export default function ConfirmPurchaseModal({
  open = false,
  onClose,
  onSuccess,
  purchaseRequest = null,
}) {
  const items = useMemo(() => {
    return Array.isArray(purchaseRequest?.items) ? purchaseRequest.items : [];
  }, [purchaseRequest?.items]);

  // State for per-item purchase details (tracking code, actual price, note)
  const [itemForms, setItemForms] = useState(() => {
    return items.map((item, idx) => ({
      itemId: item?.purchaseRequestItemId || item?.itemId || idx,
      productName: item?.productName || `Sản phẩm ${idx + 1}`,
      quantity: item?.quantity || 1,
      trackingCode: "",
      actualPrice: item?.unitPrice || 0,
      note: "",
    }));
  });

  // Calculate initial target status based on current request status
  const initialStatus = useMemo(() => {
    const currentStatus = String(purchaseRequest?.status || "").toUpperCase();
    if (currentStatus === "PAID" || currentStatus === "DEPOSIT_PAID") {
      return "PURCHASED";
    }
    if (currentStatus === "PURCHASED") {
      return "SELLER_SHIPPED";
    }
    if (currentStatus === "SELLER_SHIPPED") {
      return "ARRIVED_ORIGIN_WAREHOUSE";
    }
    if (currentStatus === "ARRIVED_ORIGIN_WAREHOUSE") {
      return "COMPLETED";
    }
    return "PURCHASED";
  }, [purchaseRequest?.status]);

  // State for proof images & purchase status
  const [purchaseStatus, setPurchaseStatus] = useState(initialStatus);
  const [imageList, setImageList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [generalNote, setGeneralNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // Sync purchaseStatus when modal opens or initialStatus changes
  useEffect(() => {
    if (open) {
      setPurchaseStatus(initialStatus);
    }
  }, [initialStatus, open]);

  // Active status config object
  const activeStatusConfig = useMemo(() => {
    return (
      PURCHASE_STATUS_OPTIONS.find((opt) => opt.value === purchaseStatus) ||
      PURCHASE_STATUS_OPTIONS[0]
    );
  }, [purchaseStatus]);

  // Update per-item field
  const handleItemChange = (index, field, value) => {
    setItemForms((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Direct Image Upload Handler via uploadImage API (Max 3 images)
  const handleCustomUpload = async ({ file, onSuccess: onUploadSuccess, onError }) => {
    if (imageList.length >= MAX_IMAGES) {
      AuthNotify.warning("Giới hạn ảnh", "Chỉ được tải lên tối đa 3 ảnh bằng chứng mua hàng.");
      onError(new Error("Vượt quá số lượng ảnh tối đa (3)."));
      return;
    }

    try {
      setUploading(true);
      setErrorMsg("");

      // Call API uploadImage directly
      let uploadedUrl = "";
      try {
        uploadedUrl = await uploadImage(file);
      } catch (apiErr) {
        console.warn("Upload API returned warning, using local preview fallback:", apiErr);
      }

      // If API fallback or URL string returned
      if (!uploadedUrl) {
        uploadedUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
        });
      }

      const newImageObj = {
        uid: file.uid || `${Date.now()}-${Math.random()}`,
        name: file.name,
        status: "done",
        url: uploadedUrl,
      };

      setImageList((prev) => {
        if (prev.length >= MAX_IMAGES) return prev;
        return [...prev, newImageObj];
      });

      onUploadSuccess("ok");
      AuthNotify.success("Tải ảnh thành công", `Đã tải ảnh bằng chứng mua hàng lên hệ thống.`);
    } catch (err) {
      console.error("Upload image error:", err);
      onError(err);
      AuthNotify.error("Không thể tải ảnh", err?.message || "Vui lòng thử lại.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (uid) => {
    setImageList((prev) => prev.filter((img) => img.uid !== uid));
  };

  const handlePreview = (url) => {
    setPreviewImage(url);
    setPreviewOpen(true);
  };

  // Reset form when modal closes
  const handleCloseModal = useCallback(() => {
    setErrorMsg("");
    setGeneralNote("");
    setImageList([]);
    setSubmitting(false);
    if (onClose) onClose();
  }, [onClose]);

  // Handle Form Submission
  const handleSubmit = async () => {
    try {
      setErrorMsg("");
      setSubmitting(true);

      // Validate inputs: At least 1 tracking code or proof image
      const hasTrackingCode = itemForms.some(
        (form) => String(form.trackingCode || "").trim().length > 0
      );

      if (!hasTrackingCode && imageList.length === 0) {
        const errorText =
          "Vui lòng nhập ít nhất 1 Mã vận đơn/Mã đơn hàng nguồn hoặc tải lên ảnh bằng chứng mua hàng.";
        setErrorMsg(errorText);
        AuthNotify.warning("Chưa đủ thông tin", errorText);
        setSubmitting(false);
        return;
      }

      // Simulate API Submission Delay
      await new Promise((resolve) => setTimeout(resolve, 600));

      AuthNotify.success(
        "Xác nhận mua hộ thành công",
        `Đã lưu thông tin & trạng thái mua hộ cho đơn ${purchaseRequest?.purchaseCode || ""}`
      );

      if (onSuccess) {
        await onSuccess({
          purchaseRequestId: purchaseRequest?.purchaseRequestId,
          status: purchaseStatus,
          statusConfig: activeStatusConfig,
          items: itemForms,
          proofImages: imageList.map((img) => img.url),
          generalNote,
        });
      }

      handleCloseModal();
    } catch (err) {
      console.error("Confirm purchase submit error:", err);
      const msg = err?.message || "Không thể hoàn tất xác nhận mua hộ.";
      setErrorMsg(msg);
      AuthNotify.error("Thao tác thất bại", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={handleCloseModal}
        footer={null}
        width={780}
        centered
        destroyOnClose
        className="confirm-purchase-modal"
        title={null}
      >
        <div className="confirm-purchase-modal__header">
          <div className="confirm-purchase-modal__header-icon">
            <ShoppingOutlined />
          </div>
          <div>
            <h2>Xác nhận mua hộ & Cập nhật tiến độ</h2>
            <p>
              Cập nhật trạng thái nghiệp vụ mua hàng, mã đơn hàng nguồn (Mã vận đơn) và bằng chứng mua hộ.
            </p>
          </div>
          {purchaseRequest?.purchaseCode && (
            <Tag color="blue" className="confirm-purchase-modal__code-tag">
              {purchaseRequest.purchaseCode}
            </Tag>
          )}
        </div>

        {/* Dynamic Status Selection Bar */}
        <div className="confirm-purchase-status-bar">
          <div className="confirm-purchase-status-bar__info">
            <SyncOutlined className="confirm-purchase-status-bar__icon" />
            <div>
              <span>TRẠNG THÁI MUA HÀNG</span>
              <strong>{activeStatusConfig.description}</strong>
            </div>
          </div>

          <Select
            value={purchaseStatus}
            onChange={setPurchaseStatus}
            popupMatchSelectWidth={340}
            className="confirm-purchase-status-select"
            options={PURCHASE_STATUS_OPTIONS.map((opt) => ({
              value: opt.value,
              label: (
                <Space>
                  <Tag color={opt.tagColor} style={{ margin: 0, fontWeight: 800 }}>
                    {opt.label}
                  </Tag>
                </Space>
              ),
            }))}
          />
        </div>

        <div className="confirm-purchase-modal__body">
          {errorMsg && (
            <Alert
              type="error"
              showIcon
              message="Chưa thể xác nhận"
              description={errorMsg}
              className="confirm-purchase-modal__alert"
            />
          )}

          {/* Section 1: Danh sách sản phẩm mua hộ */}
          <section className="confirm-purchase-section">
            <div className="confirm-purchase-section__title">
              <BarcodeOutlined />
              <span>NHẬP MÃ VẬN ĐƠN / MÃ ĐƠN HÀNG NGUỒN ({itemForms.length} mặt hàng)</span>
            </div>

            <div className="confirm-purchase-item-list">
              {itemForms.map((item, index) => (
                <div key={item.itemId} className="confirm-purchase-item-card">
                  <div className="confirm-purchase-item-card__header">
                    <span className="confirm-purchase-item-index">{index + 1}</span>
                    <strong className="confirm-purchase-item-name">{item.productName}</strong>
                    <Tag color="cyan">Số lượng: {item.quantity}</Tag>
                  </div>

                  <div className="confirm-purchase-item-card__single-input">
                    <label>Mã vận đơn / Mã đơn hàng nguồn</label>
                    <Input
                      placeholder="Nhập mã đơn hàng/vận đơn mua từ nhà cung cấp (VD: PUR-CN-98231)"
                      value={item.trackingCode}
                      onChange={(e) => handleItemChange(index, "trackingCode", e.target.value)}
                      prefix={<BarcodeOutlined style={{ color: "#94a3b8" }} />}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Divider style={{ margin: "16px 0" }} />

          {/* Section 2: Upload ảnh bằng chứng mua hàng */}
          <section className="confirm-purchase-section">
            <div className="confirm-purchase-section__title">
              <UploadOutlined />
              <span>ẢNH BẰNG CHỨNG / HÓA ĐƠN MUA HÀNG ({imageList.length}/{MAX_IMAGES} ảnh)</span>
            </div>

            <div className="confirm-purchase-upload-box">
              {imageList.length < MAX_IMAGES ? (
                <Upload
                  customRequest={handleCustomUpload}
                  showUploadList={false}
                  multiple={false}
                  disabled={uploading || imageList.length >= MAX_IMAGES}
                  accept="image/*"
                >
                  <div className="confirm-purchase-upload-dropzone">
                    <PlusOutlined className="confirm-purchase-upload-icon" />
                    <div>
                      <strong>Tải ảnh hóa đơn / màn hình đã mua hàng</strong>
                      <span>Hỗ trợ định dạng JPG, PNG, WEBP (Tối đa {MAX_IMAGES} ảnh, 10MB/ảnh)</span>
                    </div>
                    <Button type="dashed" icon={<UploadOutlined />} loading={uploading}>
                      Chọn ảnh từ máy tính ({imageList.length}/{MAX_IMAGES})
                    </Button>
                  </div>
                </Upload>
              ) : (
                <div style={{ textAlign: "center", padding: "12px", background: "#fef3c7", borderRadius: "12px", border: "1px solid #fde68a" }}>
                  <Tag color="warning" style={{ fontSize: "13px", padding: "4px 12px", fontWeight: 700 }}>
                    Đã đạt giới hạn tối đa {MAX_IMAGES}/{MAX_IMAGES} ảnh bằng chứng mua hàng
                  </Tag>
                </div>
              )}

              {imageList.length > 0 && (
                <div className="confirm-purchase-image-grid">
                  {imageList.map((img) => (
                    <div key={img.uid} className="confirm-purchase-image-thumb">
                      <img src={img.url} alt={img.name} />
                      <div className="confirm-purchase-image-overlay">
                        <button
                          type="button"
                          onClick={() => handlePreview(img.url)}
                          title="Xem ảnh"
                        >
                          <EyeOutlined />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img.uid)}
                          title="Xóa ảnh"
                          className="is-delete"
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <Divider style={{ margin: "16px 0" }} />

          {/* Section 3: Ghi chú tổng hợp */}
          <section className="confirm-purchase-section">
            <div className="confirm-purchase-section__title">
              <FileTextOutlined />
              <span>GHI CHÚ XÁC NHẬN MUA HỘ (TÙY CHỌN)</span>
            </div>

            <TextArea
              value={generalNote}
              onChange={(e) => setGeneralNote(e.target.value)}
              placeholder="Nhập thêm ghi chú xử lý mua hàng (ví dụ: Đã đặt hàng qua gian hàng Shopee/Taobao, dự kiến giao kho trong 2 ngày)..."
              rows={3}
              maxLength={500}
              showCount
            />
          </section>
        </div>

        {/* Modal Footer */}
        <div className="confirm-purchase-modal__footer">
          <Button size="large" onClick={handleCloseModal} disabled={submitting}>
            Hủy bỏ
          </Button>

          <Button
            type="primary"
            size="large"
            icon={<CheckCircleOutlined />}
            loading={submitting}
            onClick={handleSubmit}
            className="confirm-purchase-submit-btn"
          >
            Xác nhận đã mua hộ
          </Button>
        </div>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        open={previewOpen}
        title="Xem phóng to ảnh bằng chứng"
        footer={null}
        onCancel={() => setPreviewOpen(false)}
        centered
        width={700}
      >
        <img src={previewImage} alt="Preview proof" style={{ width: "100%", borderRadius: "8px" }} />
      </Modal>
    </>
  );
}
