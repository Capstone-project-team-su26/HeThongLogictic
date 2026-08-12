import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  Space,
  Typography,
  Upload,
} from "antd";
import { LinkOutlined, UploadOutlined } from "@ant-design/icons";

import {
  approveWro,
  getOperationsApiError,
} from "../../../api/OperationsAPI/consolidationWorkflowService";
import { uploadImages } from "../../../api/Upload/UploadImage";
import AuthNotify from "../../../utils/Common/AuthNotify";

function collectUrls(value, bag = []) {
  if (!value) return bag;
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    bag.push(value);
    return bag;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUrls(item, bag));
    return bag;
  }
  if (typeof value === "object") {
    ["url", "secureUrl", "secure_url", "path", "fileUrl"].forEach((key) => {
      if (value[key]) collectUrls(value[key], bag);
    });
    if (value.data) collectUrls(value.data, bag);
    if (value.urls) collectUrls(value.urls, bag);
    if (value.items) collectUrls(value.items, bag);
  }
  return bag;
}

export default function WroApproveModal({ open, wro, onClose, onApproved }) {
  const [flightNumber, setFlightNumber] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [note, setNote] = useState("");
  const [docUrls, setDocUrls] = useState([]);
  const [manualUrl, setManualUrl] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      setFlightNumber(wro?.vehicleNumber || "");
      setTrackingNumber(wro?.trackingNumber || "");
      setNote("");
      setDocUrls([...(wro?.customsDocumentUrls || [])]);
      setManualUrl("");
      setError("");
      setUploading(false);
      setSubmitting(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, wro]);

  async function handleUpload({ file, onSuccess, onError }) {
    setUploading(true);
    setError("");
    try {
      const response = await uploadImages([file]);
      const urls = [...new Set(collectUrls(response))];
      if (!urls.length) throw new Error("Upload không trả về URL.");
      setDocUrls((current) => [...new Set([...current, ...urls])]);
      onSuccess?.(response);
    } catch (err) {
      onError?.(err);
      setError(getOperationsApiError(err, "Upload giấy tờ thất bại."));
    } finally {
      setUploading(false);
    }
  }

  function addManualUrl() {
    const url = String(manualUrl || "").trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setError("URL chứng từ phải bắt đầu bằng http:// hoặc https://");
      return;
    }
    setDocUrls((current) => [...new Set([...current, url])]);
    setManualUrl("");
    setError("");
  }

  async function handleSubmit() {
    if (submitting || !wro?.id) return;
    setError("");
    if (!flightNumber.trim()) {
      const msg = "Vui lòng nhập mã chuyến bay / số hiệu chuyến.";
      AuthNotify.warning("Cảnh báo", msg);
      setError(msg);
      return;
    }
    if (!docUrls.length) {
      const msg = "Vui lòng upload hoặc dán ít nhất một giấy tờ thông quan.";
      AuthNotify.warning("Cảnh báo", msg);
      setError(msg);
      return;
    }

    setSubmitting(true);
    try {
      await approveWro(wro.id, {
        vehicleNumber: flightNumber.trim(),
        trackingNumber: trackingNumber.trim(),
        customsDocumentUrls: docUrls,
        note: note.trim(),
      });
      AuthNotify.success("Duyệt WRO", `Đã duyệt và lưu chứng từ cho WRO ${wro.code || wro.id}`);
      onApproved?.(wro);
    } catch (err) {
      const errMsg = getOperationsApiError(err, "Không duyệt được phiếu WRO.");
      AuthNotify.error("Duyệt WRO thất bại", errMsg);
      setError(errMsg);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      centered
      title={wro ? `Duyệt WRO ${wro.code}` : "Duyệt phiếu xuất kho"}
      onCancel={onClose}
      width={640}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="primary" loading={submitting} onClick={handleSubmit}>
            Duyệt & lưu chứng từ
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="OM bắt buộc nhập mã chuyến bay và giấy tờ thông quan trước khi duyệt (RELEASE_APPROVED)."
      />

      {wro ? (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Người nhận: {wro.receiverName || wro.customerName || "—"} ·{" "}
          {wro.receiverPhone || "—"} · {wro.deliveryAddress || "—"}
        </Typography.Paragraph>
      ) : null}

      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
      ) : null}

      <div className="ops-form-grid">
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Mã chuyến bay / số hiệu chuyến *</label>
          <Input
            placeholder="VD: VN781, CZ3088, chuyến bay / mã chuyến"
            value={flightNumber}
            onChange={(event) => setFlightNumber(event.target.value)}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Mã vận đơn / AWB (tuỳ chọn)</label>
          <Input
            placeholder="Tracking / AWB nếu có"
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Giấy tờ thông quan *</label>
          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            <Upload
              customRequest={handleUpload}
              showUploadList={false}
              accept="image/jpeg,image/png,image/webp"
              multiple
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                Upload ảnh chứng từ (JPG/PNG/WEBP)
              </Button>
            </Upload>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="Hoặc dán URL chứng từ (PDF/ảnh đã host)"
                value={manualUrl}
                onChange={(event) => setManualUrl(event.target.value)}
                onPressEnter={addManualUrl}
              />
              <Button onClick={addManualUrl}>Thêm URL</Button>
            </Space.Compact>
            {docUrls.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {docUrls.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      <LinkOutlined /> {url.split("/").pop() || url}
                    </a>{" "}
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={() =>
                        setDocUrls((current) => current.filter((item) => item !== url))
                      }
                    >
                      Xóa
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <Typography.Text type="secondary">Chưa có chứng từ.</Typography.Text>
            )}
          </Space>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Ghi chú duyệt (tuỳ chọn)</label>
          <Input.TextArea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ghi chú OM khi duyệt"
          />
        </div>
      </div>
    </Modal>
  );
}
