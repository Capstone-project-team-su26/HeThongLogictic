import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import { LinkOutlined, UploadOutlined } from "@ant-design/icons";

import {
  getNextShipmentStatuses,
  getOperationsApiError,
  getShipmentActionMeta,
  getShipmentDetail,
  SHIPMENT_STATUS_META,
  updateShipmentStatus,
} from "../../../api/OperationsAPI/consolidationWorkflowService";
import ShipmentJourneySteps from "../../../components/Shipment/ShipmentJourneySteps";
import { uploadImages } from "../../../api/Upload/UploadImage";
import AuthNotify from "../../../utils/Common/AuthNotify";

function UrlList({ urls, empty }) {
  if (!urls?.length) {
    return <Typography.Text type="secondary">{empty}</Typography.Text>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {urls.map((url) => (
        <li key={url}>
          <a href={url} target="_blank" rel="noreferrer">
            <LinkOutlined /> {url.split("/").pop() || url}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function ShipmentDetailModal({ open, shipmentId, onClose, onChanged }) {
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [note, setNote] = useState("");
  const [extraDocUrls, setExtraDocUrls] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open || !shipmentId) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const detail = await getShipmentDetail(shipmentId);
        if (!cancelled) {
          setShipment(detail);
          const next = getNextShipmentStatuses(detail.status);
          setNextStatus(next[0] || "");
          setNote("");
          setExtraDocUrls([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getOperationsApiError(err, "Không tải được chi tiết lô."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, shipmentId]);

  const nextOptions = useMemo(
    () => getNextShipmentStatuses(shipment?.status),
    [shipment?.status]
  );

  const statusMeta = SHIPMENT_STATUS_META[shipment?.status] || {
    label: shipment?.status || "—",
    tone: "default",
  };

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

  async function handleUpload({ file, onSuccess, onError }) {
    setUploading(true);
    try {
      const response = await uploadImages([file]);
      const flat = [...new Set(collectUrls(response))];
      if (!flat.length) throw new Error("Upload không trả về URL.");
      setExtraDocUrls((current) => [...current, ...flat]);
      onSuccess?.(response);
    } catch (err) {
      onError?.(err);
      setError(getOperationsApiError(err, "Upload chứng từ thất bại."));
    } finally {
      setUploading(false);
    }
  }

  async function handleUpdateStatus() {
    if (!shipment?.id || !nextStatus) return;
    setSaving(true);
    setError("");
    try {
      const noteParts = [note.trim()];
      if (extraDocUrls.length) {
        noteParts.push(`Chứng từ/ảnh đính kèm: ${extraDocUrls.join(" | ")}`);
      }
      await updateShipmentStatus(shipment.id, nextStatus, noteParts.filter(Boolean).join("\n"));
      const detail = await getShipmentDetail(shipment.id);
      setShipment(detail);
      setNote("");
      setExtraDocUrls([]);
      setNextStatus(getNextShipmentStatuses(detail.status)[0] || "");
      const msg = `Đã cập nhật lô ${detail.code} → ${SHIPMENT_STATUS_META[detail.status]?.label || detail.status}`;
      AuthNotify.success("Cập nhật lô hàng", msg);
      onChanged?.(msg);
    } catch (err) {
      const errMsg = getOperationsApiError(err, "Không cập nhật được trạng thái lô.");
      AuthNotify.error("Lỗi cập nhật lô", errMsg);
      setError(errMsg);
    } finally {
      setSaving(false);
    }
  }

  const wroColumns = [
    {
      title: "Mã WRO",
      dataIndex: "wroCode",
      render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
    },
    { title: "ID", dataIndex: "wroRequestId", ellipsis: true },
  ];

  const parcelColumns = [
    {
      title: "Mã kiện",
      dataIndex: "packageCode",
      render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
    },
    {
      title: "KG",
      dataIndex: "weight",
      align: "right",
      render: (value) =>
        value == null ? "—" : Number(value).toLocaleString("vi-VN"),
    },
  ];

  return (
    <Modal
      open={open}
      title={shipment ? `Lô ${shipment.code}` : "Chi tiết lô vận chuyển"}
      onCancel={onClose}
      width={880}
      destroyOnHidden
      footer={<Button onClick={onClose}>Đóng</Button>}
    >
      {loading ? <Typography.Text>Đang tải…</Typography.Text> : null}
      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
      ) : null}
      {shipment ? (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Tag color={statusMeta.tone}>{statusMeta.label}</Tag>
            <Tag>{shipment.statusTab || "—"}</Tag>
            <Typography.Text type="secondary">
              {shipment.originWarehouseName || "—"} →{" "}
              {shipment.destinationWarehouseName || "—"}
            </Typography.Text>
            <Typography.Text type="secondary">
              {shipment.shippingRouteName || "—"} · {shipment.totalPackages} kiện ·{" "}
              {Number(shipment.totalWeight || 0).toLocaleString("vi-VN")} kg
            </Typography.Text>
          </Space>

          <Typography.Title level={5}>Hồ sơ PDF</Typography.Title>
          <UrlList urls={shipment.pdfUrls} empty="Chưa có PDF nhập/xuất kho." />

          <Typography.Title level={5} style={{ marginTop: 16 }}>
            Chứng từ thông quan
          </Typography.Title>
          <UrlList
            urls={shipment.customsDocUrls}
            empty="Chưa có chứng từ thông quan trên các WRO thành phần."
          />

          <Typography.Title level={5} style={{ marginTop: 16 }}>
            Ảnh xuất kho
          </Typography.Title>
          <UrlList
            urls={shipment.exportImageUrls}
            empty="BE chưa lưu cột ảnh xuất kho trên lô — có thể đính kèm URL khi cập nhật trạng thái (ghi vào ghi chú)."
          />

          <Typography.Title level={5} style={{ marginTop: 16 }}>
            Hành trình lô
          </Typography.Title>
          <ShipmentJourneySteps status={shipment.status} />

          <Typography.Title level={5} style={{ marginTop: 16 }}>
            Cập nhật trạng thái
          </Typography.Title>
          {!nextOptions.length ? (
            <Alert type="info" showIcon message="Lô không còn bước chuyển trạng thái tiếp theo." />
          ) : (
            <div className="ops-form-grid">
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Mốc tiếp theo</label>
                {/* Nút thay vì dropdown: mỗi mốc nói rõ bấm vào thì chuyện gì xảy ra, và mốc
                    đang chọn được tô đậm. OM không phải nhớ ý nghĩa của chuỗi viết hoa. */}
                <Space wrap style={{ display: "flex", marginTop: 4 }}>
                  {nextOptions.map((value) => {
                    const action = getShipmentActionMeta(value);
                    const isDanger = value === "HOLD" || value === "ISSUE";
                    return (
                      <Button
                        key={value}
                        danger={isDanger}
                        type={nextStatus === value ? "primary" : "default"}
                        onClick={() => setNextStatus(value)}
                      >
                        {action.button}
                      </Button>
                    );
                  })}
                </Space>
                {nextStatus ? (
                  <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                    {getShipmentActionMeta(nextStatus).hint}
                  </Typography.Paragraph>
                ) : null}
              </div>
              <div>
                <label>Upload ảnh / chứng từ (tuỳ chọn)</label>
                <Upload
                  customRequest={handleUpload}
                  showUploadList={false}
                  accept="image/*,.pdf"
                  multiple
                >
                  <Button icon={<UploadOutlined />} loading={uploading}>
                    Upload
                  </Button>
                </Upload>
                {extraDocUrls.length ? (
                  <div style={{ marginTop: 8 }}>
                    <UrlList urls={extraDocUrls} empty="" />
                  </div>
                ) : null}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Ghi chú</label>
                <Input.TextArea
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ghi chú vận chuyển / thông quan"
                />
              </div>
              <div>
                <Button type="primary" loading={saving} onClick={handleUpdateStatus}>
                  Xác nhận mốc này
                </Button>
              </div>
            </div>
          )}

          <Typography.Title level={5} style={{ marginTop: 16 }}>
            WRO trong lô ({shipment.wroRequests?.length || 0})
          </Typography.Title>
          <Table
            rowKey={(row) => row.wroRequestId || row.wroCode}
            size="small"
            columns={wroColumns}
            dataSource={shipment.wroRequests}
            pagination={false}
          />

          <Typography.Title level={5} style={{ marginTop: 16 }}>
            Kiện ({shipment.parcels?.length || 0})
          </Typography.Title>
          <Table
            rowKey={(row) => row.parcelId || row.packageCode}
            size="small"
            columns={parcelColumns}
            dataSource={shipment.parcels}
            pagination={false}
          />
        </>
      ) : null}
    </Modal>
  );
}
