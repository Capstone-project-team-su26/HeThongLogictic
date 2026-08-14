import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Typography,
  Upload,
} from "antd";
import {
  DeleteOutlined,
  EyeOutlined,
  FilePdfOutlined,
  InboxOutlined,
  LinkOutlined,
} from "@ant-design/icons";

import {
  getOperationsApiError,
  listCarriers,
  listShippingMethods,
  listShippingRoutes,
  updateWroShippingRoute,
} from "../../../api/OperationsAPI/consolidationWorkflowService";
import { uploadImage, uploadImages } from "../../../api/Upload/UploadImage";
import AuthNotify from "../../../utils/Common/AuthNotify";

export default function WroShippingRouteModal({ open, wro, onClose, onUpdated }) {
  const [form] = Form.useForm();
  const [carriers, setCarriers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [shippingMethods, setShippingMethods] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [docUrls, setDocUrls] = useState([]);
  const [manualUrl, setManualUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    // Fetch Carriers, Shipping Routes & Active Shipping Methods from API
    Promise.all([
      listCarriers().catch(() => []),
      listShippingRoutes().catch(() => []),
      listShippingMethods().catch(() => []),
    ]).then(([crList, rtList, smList]) => {
      setCarriers(Array.isArray(crList) ? crList : []);
      setRoutes(Array.isArray(rtList) ? rtList : []);
      setShippingMethods(Array.isArray(smList) ? smList : []);
    });

    if (wro) {
      const defaultRoute =
        wro.shippingRoute ||
        wro.raw?.shippingRoute ||
        wro.orderRoute ||
        wro.raw?.orderRoute ||
        wro.shippingRouteName ||
        "";

      const wroCode = wro.code || wro.wroCode || wro.exportBarcode || wro.id || "";
      const defaultTrackingNumber =
        wro.trackingNumber ||
        wro.raw?.trackingNumber ||
        wro.raw?.TrackingNumber ||
        wroCode;

      form.setFieldsValue({
        carrierId: wro.carrierId || wro.raw?.carrierId || "",
        shippingMethodId: wro.shippingMethodId || wro.raw?.shippingMethodId || "",
        shippingRoute: defaultRoute,
        shippingRouteId: wro.shippingRouteId || wro.raw?.shippingRouteId || "",
        estimatedDeliveryDays: wro.estimatedDeliveryDays || wro.raw?.estimatedDeliveryDays || 3,
        vehicleNumber: wro.vehicleNumber || wro.raw?.vehicleNumber || "",
        driverName: wro.driverName || wro.raw?.driverName || "",
        driverPhone: wro.driverPhone || wro.raw?.driverPhone || "",
        trackingNumber: defaultTrackingNumber,
        handoverNotes: wro.handoverNotes || wro.raw?.handoverNotes || "",
        note: wro.note || wro.raw?.note || "",
      });

      setDocUrls([...(wro.customsDocumentUrls || wro.raw?.customsDocumentUrls || [])]);
    }
  }, [open, wro, form]);

  // When carrier changes, auto-fill driver name & phone from carrier contact info
  const handleCarrierChange = (carrierId) => {
    const matched = carriers.find((c) => c.id === carrierId || c.code === carrierId);
    if (matched) {
      if (matched.contactPerson) {
        form.setFieldValue("driverName", matched.contactPerson);
      }
      if (matched.contactPhone) {
        form.setFieldValue("driverPhone", matched.contactPhone);
      }
    }
  };

  // When shipping method changes, auto-calculate estimated days
  const handleMethodChange = (methodId) => {
    const matched = shippingMethods.find((m) => m.id === methodId || m.code === methodId);
    if (matched?.estimatedTransitTime) {
      const numbers = matched.estimatedTransitTime.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        const lastNum = Number(numbers[numbers.length - 1]);
        if (!isNaN(lastNum) && lastNum > 0) {
          form.setFieldValue("estimatedDeliveryDays", lastNum);
        }
      }
    }
  };

  const handleCustomUpload = async ({ file, onSuccess, onError }) => {
    setUploading(true);
    setUploadProgress(10);
    setError("");
    try {
      let uploadedUrl = "";
      const isImg = file.type?.startsWith("image/");

      if (isImg) {
        const res = await uploadImage(file, (percent) => setUploadProgress(percent));
        uploadedUrl =
          typeof res === "string"
            ? res
            : res?.data?.url || res?.url || res?.fileUrl || res?.path;
      } else {
        const res = await uploadImages([file], (percent) => setUploadProgress(percent));
        uploadedUrl =
          Array.isArray(res?.data)
            ? res.data[0]?.url || res.data[0]
            : res?.url || res?.fileUrl || res?.path || (typeof res === "string" ? res : "");
      }

      if (uploadedUrl) {
        setDocUrls((prev) => [...new Set([...prev, uploadedUrl])]);
        AuthNotify.success("Tải file thành công", file.name);
        onSuccess?.(uploadedUrl);
      } else {
        throw new Error("Không nhận được URL từ phản hồi API upload.");
      }
    } catch (err) {
      const msg = getOperationsApiError(err, `Không tải lên được file ${file.name}`);
      AuthNotify.error("Upload thất bại", msg);
      setError(msg);
      onError?.(err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAddManualUrl = () => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    setDocUrls((prev) => [...new Set([...prev, trimmed])]);
    setManualUrl("");
  };

  const handleRemoveUrl = (targetUrl) => {
    setDocUrls((prev) => prev.filter((u) => u !== targetUrl));
  };

  const handleSubmit = async (values) => {
    if (!wro?.id) return;
    if (!docUrls.length) {
      const msg = "Vui lòng tải lên hoặc dán ít nhất 1 file chứng từ hải quan.";
      AuthNotify.warning("Cảnh báo", msg);
      setError(msg);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const payload = {
        ...values,
        customsDocumentUrls: docUrls,
      };

      await updateWroShippingRoute(wro.id, payload);
      const wroCode = wro.code || wro.wroCode || wro.id;
      const msg = `Đã cập nhật tuyến vận chuyển & chứng từ cho WRO ${wroCode}.`;

      AuthNotify.success("Cập nhật vận chuyển", msg);
      onUpdated?.();
      onClose();
    } catch (err) {
      const errMsg = getOperationsApiError(
        err,
        "Không thể cập nhật tuyến vận chuyển."
      );
      AuthNotify.error("Cập nhật thất bại", errMsg);
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Build Route Select Options dynamically from API & WRO Order data
  const routeOptions = useMemo(() => {
    const map = new Map();

    const currentRoute =
      wro?.shippingRoute ||
      wro?.raw?.shippingRoute ||
      wro?.orderRoute ||
      wro?.raw?.orderRoute;

    if (currentRoute) {
      map.set(currentRoute, {
        value: currentRoute,
        label: `Tuyến từ đơn hàng: ${currentRoute}`,
      });
    }

    routes.forEach((r) => {
      const val = r.name || r.routeName || r.code || r.id;
      if (val && !map.has(val)) {
        const originStr = r.originWarehouseName || r.originWarehouse || "Kho đi";
        const destStr = r.destinationWarehouseName || r.destinationWarehouse || "Kho đến";
        map.set(val, {
          value: val,
          label: `${val} (${originStr} → ${destStr})`,
        });
      }
    });

    return Array.from(map.values());
  }, [routes, wro]);

  return (
    <Modal
      open={open}
      centered
      width={760}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 6 }}>
          <Typography.Title level={4} style={{ margin: 0, color: "#0f172a", fontSize: 18, fontWeight: 800 }}>
            Tuyến Vận Chuyển & Chứng Từ WRO
          </Typography.Title>
          <Typography.Text code style={{ fontSize: 14, fontWeight: 700, color: "#2563eb", background: "#eff6ff", padding: "2px 8px", borderRadius: 6 }}>
            {wro?.code || wro?.wroCode || wro?.id || "—"}
          </Typography.Text>
        </div>
      }
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose} style={{ borderRadius: 8 }}>
          Hủy
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          onClick={() => form.submit()}
          style={{ borderRadius: 8, fontWeight: 650, paddingInline: 24 }}
        >
          Lưu tuyến VC & Chứng từ
        </Button>,
      ]}
    >
      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      ) : null}

      <Form form={form} layout="vertical" requiredMark={false} onFinish={handleSubmit} style={{ marginTop: 8 }}>
        {/* Section 1: Thông tin Phương Thức, Tuyến Đường & Vận Đơn */}
        <div style={{ background: "#f8fafc", padding: "14px 18px", borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 16 }}>
          <Typography.Text style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 10 }}>
            THÔNG TIN PHƯƠNG THỨC, TUYẾN ĐƯỜNG VẬN CHUYỂN & VẬN ĐƠN
          </Typography.Text>

          <Form.Item
            name="shippingMethodId"
            label={
              <span>
                Phương thức vận chuyển (Tự động lấy thời gian dự kiến) <span style={{ color: "#ff4d4f" }}>*</span>
              </span>
            }
            rules={[{ required: true, message: "Vui lòng chọn phương thức vận chuyển" }]}
            style={{ marginBottom: 12 }}
          >
            <Select
              allowClear
              placeholder="Chọn phương thức vận chuyển"
              onChange={handleMethodChange}
              options={[
                ...shippingMethods.map((m) => ({
                  value: m.id || m.code,
                  label: `${m.name || m.code}${m.estimatedTransitTime ? ` (${m.estimatedTransitTime})` : ""}`,
                })),
              ]}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item
              name="shippingRoute"
              label={
                <span>
                  Tuyến đường vận chuyển <span style={{ color: "#ff4d4f" }}>*</span>
                </span>
              }
              rules={[{ required: true, message: "Vui lòng chọn hoặc nhập tuyến đường vận chuyển" }]}
              style={{ marginBottom: 12 }}
            >
              <Select
                showSearch
                allowClear
                placeholder="Chọn hoặc nhập tuyến đường vận chuyển"
                options={routeOptions}
                notFoundContent="Không có sẵn tuyến đường nào. Bạn có thể tự nhập tuyến mới."
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item
              name="vehicleNumber"
              label={
                <span>
                  Số hiệu chuyến / Biển số xe <span style={{ color: "#ff4d4f" }}>*</span>
                </span>
              }
              rules={[{ required: true, message: "Vui lòng nhập số hiệu chuyến hoặc biển số xe" }]}
              style={{ marginBottom: 12 }}
            >
              <Input placeholder="Ví dụ: VN-1234, 29C-888.99..." style={{ borderRadius: 8 }} />
            </Form.Item>

            <Form.Item name="trackingNumber" label="Mã vận đơn / Tracking" style={{ marginBottom: 12 }}>
              <Input placeholder="Ví dụ: TRK-99201923" style={{ borderRadius: 8 }} />
            </Form.Item>

            <Form.Item name="handoverNotes" label="Ghi chú bàn giao hàng" style={{ marginBottom: 12 }}>
              <Input placeholder="Ví dụ: Bàn giao đủ số kiện tại kho..." style={{ borderRadius: 8 }} />
            </Form.Item>
          </div>
        </div>

        {/* Section 2: Thông tin Hãng VC, Lái Xe & Dự Kiến Giao hàng */}
        <div style={{ background: "#ffffff", padding: "14px 18px", borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 16 }}>
          <Typography.Text style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 10 }}>
            THÔNG TIN HÃNG VẬN CHUYỂN, LÁI XE & DỰ KIẾN GIAO HÀNG
          </Typography.Text>

          <Form.Item
            name="carrierId"
            label={
              <span>
                Hãng vận chuyển <span style={{ color: "#ff4d4f" }}>*</span>
              </span>
            }
            rules={[{ required: true, message: "Vui lòng chọn hãng vận chuyển" }]}
            style={{ marginBottom: 12 }}
          >
            <Select
              allowClear
              placeholder="Chọn hãng vận chuyển"
              onChange={handleCarrierChange}
              options={[
                ...carriers.map((c) => ({
                  value: c.id || c.carrierId,
                  label: c.name || c.carrierName || c.code,
                })),
              ]}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 14px" }}>
            <Form.Item name="driverName" label="Tên tài xế" style={{ marginBottom: 0 }}>
              <Input placeholder="Ví dụ: Nguyễn Văn A" style={{ borderRadius: 8 }} />
            </Form.Item>

            <Form.Item name="driverPhone" label="Số điện thoại tài xế" style={{ marginBottom: 0 }}>
              <Input placeholder="Ví dụ: 0988888888" style={{ borderRadius: 8 }} />
            </Form.Item>

            <Form.Item name="estimatedDeliveryDays" label="Số ngày giao dự kiến" style={{ marginBottom: 0 }}>
              <InputNumber min={1} max={60} style={{ width: "100%", borderRadius: 8 }} placeholder="Ví dụ: 3" />
            </Form.Item>
          </div>
        </div>

        {/* Section 3: Upload Drag-and-Drop Image & PDF Zone */}
        <div style={{ background: "#f8fafc", padding: "16px 18px", borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 16 }}>
          <Typography.Text style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 8 }}>
            CHỨNG TỪ HẢI QUAN / THÔNG QUAN ĐÍNH KÈM <span style={{ color: "#ff4d4f" }}>*</span>
          </Typography.Text>

          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Upload.Dragger
              customRequest={handleCustomUpload}
              showUploadList={false}
              multiple
              accept="image/*,.pdf"
              style={{
                borderRadius: 12,
                background: "#ffffff",
                border: "2px dashed #cbd5e1",
                padding: "16px 0",
              }}
            >
              <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
                <InboxOutlined style={{ color: "#2563eb", fontSize: 36 }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
                Kéo thả hoặc nhấp vào đây để tải ảnh / chứng từ hải quan
              </p>
              <p className="ant-upload-hint" style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                Hỗ trợ định dạng JPG, PNG, WEBP, PDF (Tự động tải lên API hệ thống)
              </p>
            </Upload.Dragger>

            {uploading ? (
              <Progress percent={uploadProgress} status="active" strokeColor={{ "0%": "#10b981", "100%": "#2563eb" }} />
            ) : null}

            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="Hoặc dán URL link chứng từ tại đây..."
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                style={{ borderRadius: "8px 0 0 8px" }}
              />
              <Button type="primary" icon={<LinkOutlined />} onClick={handleAddManualUrl} style={{ borderRadius: "0 8px 8px 0", fontWeight: 600 }}>
                Thêm Link
              </Button>
            </Space.Compact>

            {/* Document Thumbnail Gallery */}
            {docUrls.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginTop: 4 }}>
                {docUrls.map((url, idx) => {
                  const isImg = /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(url);
                  return (
                    <div
                      key={`${url}-${idx}`}
                      style={{
                        position: "relative",
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                        background: "#ffffff",
                        padding: 8,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justify: "center",
                        gap: 6,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                      }}
                    >
                      {isImg ? (
                        <Image
                          src={url}
                          alt={`Chứng từ ${idx + 1}`}
                          style={{ width: "100%", height: 75, objectFit: "cover", borderRadius: 6 }}
                          preview={{ mask: <EyeOutlined /> }}
                        />
                      ) : (
                        <div style={{ padding: "14px 0", textAlign: "center" }}>
                          <FilePdfOutlined style={{ fontSize: 32, color: "#dc2626" }} />
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", justifyBetween: "space-between", width: "100%" }}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}
                        >
                          {isImg ? `Ảnh ${idx + 1}` : `PDF ${idx + 1}`}
                        </a>

                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveUrl(url)}
                          style={{ padding: "0 4px", height: "auto" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>Chưa có chứng từ nào được đính kèm (bắt buộc).</span>
            )}
          </Space>
        </div>
      </Form>
    </Modal>
  );
}
