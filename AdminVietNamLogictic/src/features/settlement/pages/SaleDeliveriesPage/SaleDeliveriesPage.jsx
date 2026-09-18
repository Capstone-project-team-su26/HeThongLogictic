/**
 * Yêu cầu giao hàng — việc của Sale sau khi đơn đã có phiếu giao (api-hang-ve-viet-nam.md D2–D4).
 *
 * Phiếu giao đầu tiên lập ở "Đơn hàng cần xử lý". Màn này theo dõi phiếu đã lập và làm hai việc
 * chặng cuối:
 *   - Hãng không báo về (giao tay): tải ảnh ký nhận DELIVERY_PROOF rồi ghi bằng chứng giao.
 *   - Giao thất bại, kho đã nhận hàng hoàn (DELIVERY_RETURNED): lập yêu cầu giao lại, có thể kèm
 *     phí giao lại — backend phát hành khoản thu và trả link cho khách trả.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { CheckCircleOutlined, CopyOutlined, ReloadOutlined, RetweetOutlined } from "@ant-design/icons";

import {
  getApprovalApiError,
  getDeliveryRequestDetail,
  getDeliveryStatusMeta,
  listDeliveryRequests,
  recordDeliveryProof,
} from "@features/operations/api/destinationApprovalService";
import { createDeliveryRequest } from "@features/settlement/api/settlementService";
import {
  ATTACHMENT_ENTITY,
  AttachmentList,
  AttachmentUploadButton,
  listAttachments,
} from "@features/attachments";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import "@features/settlement/pages/SaleSettlementPage/SaleSettlementPage.css";

const { Title, Text } = Typography;

const STATUS_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "DELIVERY_PENDING", label: "Chờ quản lý kho duyệt" },
  { value: "DELIVERY_APPROVED", label: "Đã duyệt, chờ đặt giao" },
  { value: "DELIVERY_DISPATCHED", label: "Đang giao" },
  { value: "DELIVERY_RETURNED", label: "Hàng hoàn về kho" },
  { value: "DELIVERY_REJECTED", label: "Bị từ chối" },
];

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const idOf = (row) => row?.deliveryRequestId || row?.id;

export default function SaleDeliveriesPage() {
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [detail, setDetail] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [proof, setProof] = useState({ receivedBy: "", note: "" });
  const [redelivery, setRedelivery] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      setRows(await listDeliveryRequests({ status: statusFilter }));
    } catch (error) {
      setErrorMessage(getApprovalApiError(error, "Không tải được danh sách yêu cầu giao hàng."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true);
    const [detailResult, attachmentResult] = await Promise.allSettled([
      getDeliveryRequestDetail(id),
      listAttachments({ entityType: ATTACHMENT_ENTITY.DELIVERY_REQUEST, entityId: id }),
    ]);
    if (detailResult.status === "fulfilled") setDetail(detailResult.value);
    else AuthNotify.error("Lỗi tải phiếu giao", getApprovalApiError(detailResult.reason, "Vui lòng thử lại."));
    setAttachments(attachmentResult.status === "fulfilled" ? attachmentResult.value : []);
    setDetailLoading(false);
  }, []);

  const openDetail = useCallback(
    (row) => {
      setDetail(row);
      setAttachments([]);
      setProof({ receivedBy: row.receiverName || "", note: "" });
      setRedelivery(null);
      loadDetail(idOf(row));
    },
    [loadDetail],
  );

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.deliveryCode, row.orderCode, row.customerName, row.receiverName, row.receiverPhone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [rows, keyword]);

  const hasProofPhoto = attachments.some(
    (item) => String(item.documentType).toUpperCase() === "DELIVERY_PROOF",
  );

  const submitProof = async () => {
    if (!detail) return;
    setSubmitting(true);
    try {
      await recordDeliveryProof(idOf(detail), proof);
      AuthNotify.success(
        "Đã ghi bằng chứng giao",
        `Phiếu ${detail.deliveryCode}: kiện chuyển Đã giao, khách nhận thông báo.`,
      );
      await loadDetail(idOf(detail));
      load();
    } catch (error) {
      AuthNotify.error("Không ghi được bằng chứng giao", getApprovalApiError(error, "Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  const openRedelivery = () => {
    if (!detail) return;
    /* Giao lại đúng các kiện chưa giao của phiếu cũ (kho đã nhận hàng hoàn về khu nhận). */
    const parcelIds = (detail.parcels || [])
      .filter((parcel) => String(parcel.packageStatus).toUpperCase() !== "DELIVERED")
      .map((parcel) => parcel.parcelId);
    setRedelivery({
      parcelIds,
      receiverName: detail.receiverName || "",
      receiverPhone: detail.receiverPhone || "",
      addressDetail: detail.addressDetail || "",
      ward: detail.ward || "",
      district: detail.district || "",
      province: detail.province || "",
      note: "",
      redeliveryFee: null,
    });
  };

  const submitRedelivery = async () => {
    if (!detail || !redelivery) return;
    setSubmitting(true);
    try {
      const result = await createDeliveryRequest({ orderId: detail.orderId, ...redelivery });
      AuthNotify.success(
        "Đã lập yêu cầu giao lại",
        result?.redeliveryFeeCheckoutUrl
          ? `Phiếu ${result.deliveryCode}: khách cần trả phí giao lại ${formatMoney(result.redeliveryFee)} trước khi kho đặt giao.`
          : `Phiếu ${result?.deliveryCode || ""} đang chờ quản lý kho duyệt.`,
      );
      setRedelivery(null);
      setDetail(null);
      load();
    } catch (error) {
      AuthNotify.error("Không lập được yêu cầu giao lại", getApprovalApiError(error, "Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      AuthNotify.success("Đã sao chép", "Gửi link này cho khách để trả phí giao lại.");
    } catch {
      AuthNotify.error("Không sao chép được", text);
    }
  };

  const columns = [
    {
      title: "Mã phiếu giao",
      dataIndex: "deliveryCode",
      width: 170,
      render: (value, row) => (
        <Space direction="vertical" size={0}>
          <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(row)}>
            {value || "—"}
          </Button>
          {row.sourceDeliveryRequestId ? <Tag color="purple">Giao lại</Tag> : null}
        </Space>
      ),
    },
    {
      title: "Đơn / khách",
      key: "order",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.orderCode || "—"}</Text>
          <Text type="secondary">{row.customerName || ""}</Text>
        </Space>
      ),
    },
    {
      title: "Người nhận",
      key: "receiver",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>
            {row.receiverName || "—"} · {row.receiverPhone || ""}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.fullAddress || row.addressDetail || ""}
          </Text>
        </Space>
      ),
    },
    { title: "Kiện", dataIndex: "totalParcels", align: "center", width: 80 },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 200,
      render: (value, row) => {
        const meta = getDeliveryStatusMeta(value);
        return (
          <Space direction="vertical" size={0}>
            <Tag color={meta.tone}>{row.statusText || meta.label}</Tag>
            {row.carrierTrackingCode ? <Text type="secondary">Vận đơn {row.carrierTrackingCode}</Text> : null}
            {row.proofAt ? <Text type="success">Đã ký nhận: {row.proofReceivedBy}</Text> : null}
          </Space>
        );
      },
    },
    { title: "Lập lúc", dataIndex: "createdAt", width: 165, render: formatDateTime },
  ];

  const detailStatus = String(detail?.status || "").toUpperCase();

  return (
    <div className="sale-settlement-page">
      <div className="sale-settlement-page__head">
        <div>
          <Title level={4}>Yêu cầu giao hàng</Title>
          <Text type="secondary">
            Theo dõi phiếu giao đã lập, ghi bằng chứng giao khi hãng không báo về, và lập giao lại
            khi hàng hoàn về kho.
          </Text>
        </div>
        <Space wrap>
          <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS} style={{ width: 220 }} />
          <Input.Search
            allowClear
            placeholder="Tìm mã phiếu, mã đơn, người nhận"
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Tải lại
          </Button>
        </Space>
      </div>

      {errorMessage && <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} />}

      <Table
        rowKey={(row) => idOf(row)}
        columns={columns}
        dataSource={filtered}
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 12, showSizeChanger: false }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có yêu cầu giao nào." /> }}
      />

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={820}
        title={`Phiếu giao ${detail?.deliveryCode || ""}`}
      >
        {detail && (
          <Spin spinning={detailLoading}>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={getDeliveryStatusMeta(detail.status).tone}>
                {detail.statusText || getDeliveryStatusMeta(detail.status).label}
              </Tag>
              {detail.sourceDeliveryRequestId ? <Tag color="purple">Phiếu giao lại</Tag> : null}
            </Space>

            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Đơn">{detail.orderCode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Khách">{detail.customerName || "—"}</Descriptions.Item>
              <Descriptions.Item label="Người nhận">
                {detail.receiverName || "—"} · {detail.receiverPhone || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Hẹn giao">{formatDateTime(detail.scheduledDate)}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ" span={2}>
                {detail.fullAddress || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Người lập">
                {detail.createdByName || "—"} · {formatDateTime(detail.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Duyệt">
                {detail.approvedByName ? `${detail.approvedByName} · ${formatDateTime(detail.approvedAt)}` : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Đặt giao lúc">{formatDateTime(detail.dispatchedAt)}</Descriptions.Item>
              <Descriptions.Item label="Mã vận đơn">{detail.carrierTrackingCode || "—"}</Descriptions.Item>
              {detail.rejectionReason ? (
                <Descriptions.Item label="Lý do từ chối" span={2}>
                  <Text type="danger">{detail.rejectionReason}</Text>
                </Descriptions.Item>
              ) : null}
              {detail.returnedAt ? (
                <Descriptions.Item label="Hàng hoàn về kho" span={2}>
                  {formatDateTime(detail.returnedAt)}
                </Descriptions.Item>
              ) : null}
              {detail.redeliveryFee ? (
                <Descriptions.Item label="Phí giao lại" span={2}>
                  <Space wrap>
                    <Text strong>{formatMoney(detail.redeliveryFee)}</Text>
                    <Tag>{detail.redeliveryFeePaymentStatus || "—"}</Tag>
                    {detail.redeliveryFeeCheckoutUrl ? (
                      <Button size="small" icon={<CopyOutlined />} onClick={() => copyText(detail.redeliveryFeeCheckoutUrl)}>
                        Sao chép link trả phí cho khách
                      </Button>
                    ) : null}
                  </Space>
                </Descriptions.Item>
              ) : null}
              {detail.proofAt ? (
                <Descriptions.Item label="Bằng chứng giao" span={2}>
                  {detail.proofReceivedBy} · {formatDateTime(detail.proofAt)}
                </Descriptions.Item>
              ) : null}
            </Descriptions>

            <Table
              size="small"
              rowKey="parcelId"
              pagination={false}
              dataSource={detail.parcels || []}
              style={{ marginBottom: 16 }}
              columns={[
                { title: "Kiện", dataIndex: "packageCode", render: (v) => <Text code>{v}</Text> },
                { title: "Trạng thái kiện", dataIndex: "packageStatus", render: (v) => <Tag>{v || "—"}</Tag> },
                { title: "Hướng xử lý", dataIndex: "customerIntentText", render: (v) => v || "—" },
                { title: "Ô kệ", dataIndex: "binCode", render: (v) => v || "—" },
              ]}
            />

            <Title level={5}>Ảnh ký nhận / giấy tờ</Title>
            <AttachmentList items={attachments} showThumbnails emptyText="Chưa có ảnh ký nhận." />

            {detailStatus === "DELIVERY_DISPATCHED" && !detail.proofAt && (
              <div className="sale-settlement-fees" style={{ marginTop: 16 }}>
                <Text strong>Ghi bằng chứng giao (hãng không báo về)</Text>
                <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
                  <Space>
                    <AttachmentUploadButton
                      entityType={ATTACHMENT_ENTITY.DELIVERY_REQUEST}
                      entityId={idOf(detail)}
                      documentType="DELIVERY_PROOF"
                      label="Tải ảnh ký nhận"
                      buttonProps={{ danger: !hasProofPhoto }}
                      onUploaded={() => loadDetail(idOf(detail))}
                    />
                    {hasProofPhoto ? <Tag color="success">Đã có ảnh ký nhận</Tag> : <Text type="warning">Bắt buộc có ảnh trước</Text>}
                  </Space>
                  <Input
                    addonBefore="Người nhận hàng"
                    value={proof.receivedBy}
                    onChange={(event) => setProof((p) => ({ ...p, receivedBy: event.target.value }))}
                  />
                  <Input.TextArea
                    rows={2}
                    placeholder="Ghi chú (không bắt buộc)"
                    value={proof.note}
                    onChange={(event) => setProof((p) => ({ ...p, note: event.target.value }))}
                  />
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={submitting}
                    disabled={!hasProofPhoto || !proof.receivedBy.trim()}
                    onClick={submitProof}
                  >
                    Ghi nhận đã giao
                  </Button>
                </Space>
              </div>
            )}

            {detailStatus === "DELIVERY_RETURNED" && !redelivery && (
              <Button type="primary" icon={<RetweetOutlined />} style={{ marginTop: 16 }} onClick={openRedelivery}>
                Lập yêu cầu giao lại
              </Button>
            )}

            {redelivery && (
              <div className="sale-settlement-fees" style={{ marginTop: 16 }}>
                <Text strong>Yêu cầu giao lại · {redelivery.parcelIds.length} kiện</Text>
                <Space direction="vertical" size={10} style={{ width: "100%", marginTop: 8 }}>
                  {[
                    ["receiverName", "Người nhận"],
                    ["receiverPhone", "Điện thoại"],
                    ["addressDetail", "Số nhà, đường"],
                    ["ward", "Phường/Xã"],
                    ["district", "Quận/Huyện"],
                    ["province", "Tỉnh/Thành phố"],
                  ].map(([field, label]) => (
                    <Input
                      key={field}
                      addonBefore={label}
                      value={redelivery[field]}
                      onChange={(event) => setRedelivery((r) => ({ ...r, [field]: event.target.value }))}
                    />
                  ))}
                  <InputNumber
                    min={0}
                    step={1000}
                    style={{ width: 320 }}
                    addonBefore="Phí giao lại"
                    addonAfter="đ"
                    value={redelivery.redeliveryFee}
                    formatter={(value) => (value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "")}
                    parser={(value) => String(value || "").replace(/\./g, "")}
                    onChange={(value) => setRedelivery((r) => ({ ...r, redeliveryFee: value }))}
                  />
                  <Text type="secondary">
                    Bỏ trống = giao lại miễn phí. Có phí thì hệ thống phát hành khoản thu, khách trả xong kho mới đặt giao được.
                  </Text>
                  <Input.TextArea
                    rows={2}
                    placeholder="Ghi chú cho kho (không bắt buộc)"
                    value={redelivery.note}
                    onChange={(event) => setRedelivery((r) => ({ ...r, note: event.target.value }))}
                  />
                  <Space>
                    <Button onClick={() => setRedelivery(null)}>Huỷ</Button>
                    <Button type="primary" loading={submitting} onClick={submitRedelivery}>
                      Gửi yêu cầu giao lại
                    </Button>
                  </Space>
                </Space>
              </div>
            )}
          </Spin>
        )}
      </Drawer>
    </div>
  );
}
