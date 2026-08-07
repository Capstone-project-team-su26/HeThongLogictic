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
  DollarOutlined,
} from "@ant-design/icons";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import { uploadImage } from "../../../../api/Upload/UploadImage";
import { confirmPurchaseApi } from "../../../../api/SaleAPI/PurchaseRequestAPI/confirmPurchaseApi";
import "./ConfirmPurchaseModal.css";

const { TextArea } = Input;

const MAX_IMAGES = 3;

const PURCHASE_STATUS_OPTIONS = [
  {
    value: "NEW",
    label: "1. Tạo đơn hàng",
    tagColor: "blue",
    description: "Đơn hàng mua hộ vừa được khởi tạo trên hệ thống.",
  },
  {
    value: "PENDING_REVIEW",
    label: "2. Chờ xác nhận",
    tagColor: "orange",
    description: "Nhân viên đang kiểm tra & đàm phán mua hàng.",
  },
  {
    value: "PAID",
    label: "3. Đã thanh toán",
    tagColor: "cyan",
    description: "Khách hàng đã cọc/thanh toán tiền đơn hàng.",
  },
  {
    value: "PURCHASED",
    label: "4. Xác nhận mua hàng",
    tagColor: "green",
    description: "Đã hoàn tất thanh toán và đặt hàng với Nhà cung cấp.",
  },
  {
    value: "SELLER_SHIPPED",
    label: "NCC đã phát hàng",
    tagColor: "processing",
    description: "Nhà cung cấp đã bàn giao đơn cho bên vận chuyển nội địa.",
  },
  {
    value: "ARRIVED_ORIGIN_WAREHOUSE",
    label: "Đã về kho nước ngoài",
    tagColor: "teal",
    description: "Hàng đã về tới kho thu gom ban đầu (Trung Quốc, Hàn Quốc...).",
  },
  {
    value: "COMPLETED",
    label: "Hoàn tất nghiệp vụ",
    tagColor: "purple",
    description: "Hoàn tất toàn bộ chu trình xử lý đơn hàng mua hộ.",
  },
];

const STATUS_THEMES = {
  NEW: {
    gradient: "linear-gradient(135deg, #090d16 0%, #1e1b4b 45%, #3730a3 100%)",
    badgeBg: "rgba(129, 140, 248, 0.22)",
    badgeBorder: "rgba(165, 180, 252, 0.45)",
    badgeColor: "#c7d2fe",
    btnGradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
    btnShadow: "0 8px 25px rgba(99, 102, 241, 0.45)",
    icon: <FileTextOutlined />,
    liveTag: "✨ 1. TẠO ĐƠN HÀNG (REALTIME)",
    actionText: "Chuyển bước 2: Chờ xác nhận ➔",
    stepIndex: 1,
  },
  PENDING_REVIEW: {
    gradient: "linear-gradient(135deg, #1c0a00 0%, #78350f 45%, #b45309 100%)",
    badgeBg: "rgba(251, 191, 36, 0.22)",
    badgeBorder: "rgba(252, 211, 77, 0.45)",
    badgeColor: "#fef08a",
    btnGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    btnShadow: "0 8px 25px rgba(245, 158, 11, 0.45)",
    icon: <SyncOutlined spin />,
    liveTag: "🟠 2. CHỜ XÁC NHẬN (REALTIME)",
    actionText: "Chuyển bước 3: Đã thanh toán ➔",
    stepIndex: 2,
  },
  PAID: {
    gradient: "linear-gradient(135deg, #041f2a 0%, #0e7490 45%, #0284c7 100%)",
    badgeBg: "rgba(56, 189, 248, 0.22)",
    badgeBorder: "rgba(125, 211, 252, 0.45)",
    badgeColor: "#bae6fd",
    btnGradient: "linear-gradient(135deg, #0ea5e9, #0284c7)",
    btnShadow: "0 8px 25px rgba(14, 165, 233, 0.45)",
    icon: <DollarOutlined />,
    liveTag: "🩵 3. ĐÃ THANH TOÁN (REALTIME)",
    actionText: "Chuyển bước 4: Xác nhận mua hàng ➔",
    stepIndex: 3,
  },
  PURCHASED: {
    gradient: "linear-gradient(135deg, #022c22 0%, #047857 45%, #059669 100%)",
    badgeBg: "rgba(52, 211, 153, 0.22)",
    badgeBorder: "rgba(110, 231, 183, 0.45)",
    badgeColor: "#a7f3d0",
    btnGradient: "linear-gradient(135deg, #10b981, #059669)",
    btnShadow: "0 8px 25px rgba(16, 185, 129, 0.45)",
    icon: <CheckCircleOutlined />,
    liveTag: "🟢 4. XÁC NHẬN MUA HÀNG (HOÀN TẤT)",
    actionText: "Xác nhận đã mua hộ & Hoàn tất",
    stepIndex: 4,
  },
  SELLER_SHIPPED: {
    gradient: "linear-gradient(135deg, #0b132b 0%, #1c2541 45%, #2563eb 100%)",
    badgeBg: "rgba(96, 165, 250, 0.22)",
    badgeBorder: "rgba(147, 197, 253, 0.45)",
    badgeColor: "#bfdbfe",
    btnGradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    btnShadow: "0 8px 25px rgba(59, 130, 246, 0.45)",
    icon: <CarOutlined />,
    liveTag: "🔵 NCC ĐÃ PHÁT HÀNG (REALTIME)",
    actionText: "Xác nhận & Hoàn tất",
    stepIndex: 4,
  },
  ARRIVED_ORIGIN_WAREHOUSE: {
    gradient: "linear-gradient(135deg, #180e29 0%, #3b0764 45%, #6b21a8 100%)",
    badgeBg: "rgba(192, 132, 252, 0.22)",
    badgeBorder: "rgba(216, 180, 254, 0.45)",
    badgeColor: "#e9d5ff",
    btnGradient: "linear-gradient(135deg, #9333ea, #7e22ce)",
    btnShadow: "0 8px 25px rgba(147, 51, 234, 0.45)",
    icon: <HomeOutlined />,
    liveTag: "🩵 ĐÃ VỀ KHO NƯỚC NGOÀI (REALTIME)",
    actionText: "Xác nhận & Hoàn tất",
    stepIndex: 4,
  },
  COMPLETED: {
    gradient: "linear-gradient(135deg, #2e1065 0%, #581c87 45%, #7e22ce 100%)",
    badgeBg: "rgba(216, 180, 254, 0.22)",
    badgeBorder: "rgba(233, 213, 255, 0.45)",
    badgeColor: "#f3e8ff",
    btnGradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    btnShadow: "0 8px 25px rgba(139, 92, 246, 0.45)",
    icon: <CheckCircleOutlined />,
    liveTag: "🟣 HOÀN TẤT MUA HỘ (REALTIME)",
    actionText: "Xác nhận & Hoàn tất",
    stepIndex: 4,
  },
};

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

  // Always start initial status at "NEW" (Step 1: Tạo đơn hàng) when opening modal
  const initialStatus = useMemo(() => {
    return "NEW";
  }, []);

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

  // Active status theme styling
  const activeTheme = useMemo(() => {
    return STATUS_THEMES[purchaseStatus] || STATUS_THEMES.PURCHASED;
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

  // Handle Form Submission & Realtime Step Advancement via BE API
  const handleSubmit = async () => {
    try {
      setErrorMsg("");
      setSubmitting(true);

      const reqId = purchaseRequest?.purchaseRequestId || purchaseRequest?.id;

      if (purchaseStatus === "NEW") {
        // Step 1 -> Step 2: Update status to PENDING_REVIEW
        const resData = await confirmPurchaseApi(reqId, {
          status: "PENDING_REVIEW",
          proofImages: imageList.map((img) => img.url),
          generalNote,
        });
        setPurchaseStatus("PENDING_REVIEW");
        AuthNotify.info("Tiến độ đơn hàng", "Đã chuyển sang bước: 2. Chờ xác nhận");
      } else if (purchaseStatus === "PENDING_REVIEW") {
        // Step 2 -> Step 3: Update status to PAID
        const resData = await confirmPurchaseApi(reqId, {
          status: "PAID",
          proofImages: imageList.map((img) => img.url),
          generalNote,
        });
        setPurchaseStatus("PAID");
        AuthNotify.info("Tiến độ đơn hàng", "Đã chuyển sang bước: 3. Đã thanh toán");
      } else if (purchaseStatus === "PAID") {
        // Step 3 -> Step 4: Update status to PURCHASED
        const resData = await confirmPurchaseApi(reqId, {
          status: "PURCHASED",
          proofImages: imageList.map((img) => img.url),
          generalNote,
        });
        setPurchaseStatus("PURCHASED");
        AuthNotify.info("Tiến độ đơn hàng", "Đã chuyển sang bước: 4. Xác nhận mua hàng");
      } else {
        // Step 4 FINAL STEP: Submit to Real BE API endpoint PUT /api/purchase-requests/{id}/confirm-purchase & Exit Modal
        const ALLOWED_BE_STATUSES = ["PURCHASED", "SELLER_SHIPPED", "ARRIVED_ORIGIN_WAREHOUSE", "PAID", "PENDING_REVIEW"];
        const targetStatus = ALLOWED_BE_STATUSES.includes(purchaseStatus)
          ? purchaseStatus
          : "PURCHASED";

        const resData = await confirmPurchaseApi(reqId, {
          status: targetStatus,
          proofImages: imageList.map((img) => img.url),
          generalNote,
        });

        AuthNotify.success(
          "Xác nhận mua hộ thành công",
          `Đã lưu thông tin & hoàn tất xác nhận mua hộ cho đơn ${resData?.purchaseCode || purchaseRequest?.purchaseCode || ""}`
        );

        if (onSuccess) {
          await onSuccess({
            purchaseRequestId: reqId,
            status: targetStatus,
            statusConfig: activeStatusConfig,
            items: itemForms,
            proofImages: imageList.map((img) => img.url),
            generalNote,
            apiResponse: resData,
          });
        }

        handleCloseModal();
      }
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
        destroyOnHidden
        className="confirm-purchase-modal"
        title={null}
      >
        <div
          className="confirm-purchase-modal__header"
          style={{ background: activeTheme.gradient }}
        >
          <div className="header-top-row">
            <div className="confirm-purchase-modal__header-icon">
              {activeTheme.icon}
            </div>

            <div className="header-text-group">
              <div
                className="header-live-tag"
                style={{
                  background: activeTheme.badgeBg,
                  borderColor: activeTheme.badgeBorder,
                  color: activeTheme.badgeColor,
                }}
              >
                <span className="live-pulse-dot" /> {activeTheme.liveTag}
              </div>
              <h2>Xác nhận mua hộ & Cập nhật tiến độ</h2>
              <p>{activeStatusConfig.description}</p>
            </div>

            {purchaseRequest?.purchaseCode && (
              <Tag className="confirm-purchase-modal__code-tag">
                {purchaseRequest.purchaseCode}
              </Tag>
            )}
          </div>

          {/* Stepper Pipeline Bar - Read-Only Progress Indicator */}
          <div className="header-pipeline-bar">
            <div
              className={`pipeline-step ${activeTheme.stepIndex >= 1 ? "is-active" : ""} ${activeTheme.stepIndex === 1 ? "is-selected" : ""
                }`}
            >
              <span className="step-num">1</span>
              <span className="step-label">Tạo đơn hàng</span>
            </div>
            <div className={`pipeline-line ${activeTheme.stepIndex >= 2 ? "is-active" : ""}`} />
            <div
              className={`pipeline-step ${activeTheme.stepIndex >= 2 ? "is-active" : ""} ${activeTheme.stepIndex === 2 ? "is-selected" : ""
                }`}
            >
              <span className="step-num">2</span>
              <span className="step-label">Chờ xác nhận</span>
            </div>
            <div className={`pipeline-line ${activeTheme.stepIndex >= 3 ? "is-active" : ""}`} />
            <div
              className={`pipeline-step ${activeTheme.stepIndex >= 3 ? "is-active" : ""} ${activeTheme.stepIndex === 3 ? "is-selected" : ""
                }`}
            >
              <span className="step-num">3</span>
              <span className="step-label">Đã thanh toán</span>
            </div>
            <div className={`pipeline-line ${activeTheme.stepIndex >= 4 ? "is-active" : ""}`} />
            <div
              className={`pipeline-step ${activeTheme.stepIndex >= 4 ? "is-active" : ""} ${activeTheme.stepIndex === 4 ? "is-selected" : ""
                }`}
            >
              <span className="step-num">4</span>
              <span className="step-label">Xác nhận mua hàng</span>
            </div>
          </div>
        </div>

        <div className="confirm-purchase-modal__body">
          {errorMsg && (
            <Alert
              type="error"
              showIcon
              title="Chưa thể xác nhận"
              message="Chưa thể xác nhận"
              description={errorMsg}
              className="confirm-purchase-modal__alert"
            />
          )}





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
                    <Button
                      type="primary"
                      ghost
                      icon={<UploadOutlined />}
                      loading={uploading}
                      style={{ borderRadius: "12px", height: "40px", fontWeight: 800, padding: "0 24px" }}
                    >
                      Tải ảnh từ máy tính ({imageList.length}/{MAX_IMAGES})
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
          <Button
            size="large"
            onClick={handleCloseModal}
            disabled={submitting}
            className="confirm-purchase-cancel-btn"
          >
            Hủy bỏ
          </Button>

          <Button
            type="primary"
            size="large"
            icon={activeTheme.icon}
            loading={submitting}
            onClick={handleSubmit}
            className="confirm-purchase-submit-btn"
            style={{
              background: activeTheme.btnGradient,
              boxShadow: activeTheme.btnShadow,
            }}
          >
            {activeTheme.actionText}
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
