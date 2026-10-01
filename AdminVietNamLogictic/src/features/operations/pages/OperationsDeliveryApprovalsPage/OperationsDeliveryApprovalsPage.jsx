import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  InboxOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";

import {
  approveDeliveryRequest,
  getApprovalApiError,
  getDeliveryRequestDetail,
  getDeliveryStatusMeta,
  listDeliveryRequests,
  rejectDeliveryRequest,
} from "@features/operations/api/destinationApprovalService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import SubmitReview, {
  ReviewFacts,
  ReviewItemsTable,
} from "@shared/components/SubmitReview/SubmitReview";
import {
  formatReviewMoney,
  REVIEW_MODAL_PROPS,
} from "@shared/components/SubmitReview/submitReviewFormat";
import useSubmitReviewData from "@shared/components/SubmitReview/useSubmitReviewData";
import { getPaymentStatusMeta } from "@shared/utils/paymentStatus";
/* Cân từng kiện, hàng khai trên đơn, tiền đã trả — phiếu giao không mang các số này. */
import { OrderReviewPanel, useOrderReview } from "@features/consignment";
import "@features/operations/styles/OperationsPage.css";
// Thẻ KPI dùng class wro-kpi-* khai bên trang WRO. Import thẳng thay vì trông chờ trang khác
// đã kéo file này vào bundle giúp.
import "@features/operations/styles/OperationsWroPage.css";
import { getParcelStatusLabel, textOr } from "@shared/utils/statusLabel";
import { subTablePagination, tablePagination } from "@shared/utils/tablePagination";

const { Title, Text } = Typography;

const STATUS_FILTERS = [
  { value: "DELIVERY_PENDING", label: "Chờ duyệt" },
  { value: "", label: "Tất cả" },
  { value: "DELIVERY_APPROVED", label: "Đã duyệt" },
  { value: "DELIVERY_DISPATCHED", label: "Đã đặt giao" },
  { value: "DELIVERY_REJECTED", label: "Từ chối" },
  { value: "DELIVERY_RETURNED", label: "Hàng hoàn về" },
];

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

/** Cột kiện của phiếu giao — dùng chung cho drawer chi tiết và hộp duyệt / từ chối. */
const DELIVERY_PARCEL_COLUMNS = [
  { title: "Mã kiện", dataIndex: "packageCode" },
  {
    title: "Trạng thái",
    dataIndex: "packageStatus",
    render: (v, row) => textOr(row.packageStatusText, getParcelStatusLabel(v)),
  },
  {
    /*
     * Khách khai muốn gửi lại kho mà lại có yêu cầu giao — có thể khách gọi đổi ý,
     * cũng có thể nhầm đơn. Tô cảnh báo để OM xác nhận trước khi duyệt cho book xe.
     */
    title: "Ý khách",
    dataIndex: "customerIntent",
    render: (value, row) => {
      if (!value) return <Tag>Chưa chọn</Tag>;

      return value === "STORE_AT_VN" ? (
        <Tag color="warning" title={row.customerIntentText}>
          Muốn gửi kho
        </Tag>
      ) : (
        <Tag color="success" title={row.customerIntentText}>
          Muốn giao ngay
        </Tag>
      );
    },
  },
  {
    title: "Lấy từ",
    dataIndex: "pickSource",
    render: (value) =>
      value === "FROM_SHELF" ? <Tag color="processing">Trên kệ</Tag> : <Tag>Khu tạm</Tag>,
  },
  { title: "Ô kệ", dataIndex: "binCode", render: (v) => v || "—" },
];

/**
 * Đủ thông tin một yêu cầu giao hàng trong hộp duyệt / từ chối: người nhận, địa chỉ, hẹn giao,
 * phí giao lại, từng kiện (mã, trạng thái, ý khách, lấy từ đâu, ô kệ) + cân từng kiện, hàng
 * khai và tiền của đơn (khách đã tất toán chưa) lấy từ chi tiết đơn.
 */
function DeliveryDecisionReview({ target, review, orderReview }) {
  const data = { ...target, ...(review.data || {}) };
  const parcels = Array.isArray(data.parcels) ? data.parcels : [];
  const conflicting = parcels.filter((row) => row.customerIntent === "STORE_AT_VN").length;

  return (
    <SubmitReview
      loading={review.loading}
      loadingText="Đang tải đầy đủ yêu cầu giao hàng…"
      error={review.error}
      errorHint="Chưa xem được danh sách kiện — nên mở phiếu kiểm tra trước khi quyết định."
    >
      <ReviewFacts
        items={[
          { label: "Mã phiếu", value: <Text strong>{data.deliveryCode}</Text> },
          { label: "Đơn", value: data.orderCode },
          { label: "Khách hàng", value: data.customerName },
          {
            label: "Người nhận",
            value: [data.receiverName, data.receiverPhone].filter(Boolean).join(" · "),
          },
          {
            label: "Địa chỉ giao",
            value:
              data.fullAddress ||
              [data.addressDetail, data.ward, data.district, data.province]
                .filter(Boolean)
                .join(", "),
            span: 2,
          },
          {
            label: "Ngày khách hẹn",
            value: data.scheduledDate ? formatDateTime(data.scheduledDate) : "Không hẹn",
          },
          {
            label: "Lấy hàng từ",
            value: data.hasShelfPick ? "Có kiện phải xuống kệ nhặt" : "Khu tạm",
          },
          {
            label: "Người lập",
            value: `${data.createdByName || "—"} · ${formatDateTime(data.createdAt)}`,
          },
          {
            label: "Phí giao lại",
            value: data.redeliveryFee
              ? `${formatReviewMoney(data.redeliveryFee)}${
                  data.redeliveryFeePaymentStatus
                    ? ` · ${getPaymentStatusMeta(data.redeliveryFeePaymentStatus).label}`
                    : ""
                }`
              : null,
            hidden: !data.redeliveryFee,
          },
          { label: "Ghi chú", value: data.note, span: 2 },
        ]}
      />
      {conflicting > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${conflicting} kiện có khách yêu cầu gửi lại kho VN`}
          description="Những kiện này đang được đề nghị giao, ngược với nguyện vọng khách khai lúc đặt đơn."
        />
      )}
      <ReviewItemsTable
        title="Kiện đem giao"
        items={parcels}
        columns={DELIVERY_PARCEL_COLUMNS}
        rowKey={(row, index) => row?.parcelId || index}
        extra={`${data.totalParcels ?? parcels.length} kiện`}
        emptyText={review.error ? "Chưa đọc được danh sách kiện." : "Phiếu chưa có kiện nào."}
      />
      {data.orderId ? (
        <OrderReviewPanel
          review={orderReview}
          fallback={data}
          showFacts={false}
          parcelIds={parcels.map((row) => row.parcelId)}
          parcelTitle="Cân và kết quả kiểm đếm của các kiện này (theo đơn)"
        />
      ) : null}
    </SubmitReview>
  );
}

export default function OperationsDeliveryApprovalsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("DELIVERY_PENDING");
  const [keyword, setKeyword] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveTarget, setApproveTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  /*
   * Trước đây nút "Duyệt" trên dòng bảng gửi lệnh ngay. Duyệt giao = cho kho book xe, nên giờ
   * cả duyệt lẫn từ chối đều qua hộp xác nhận nạp lại chi tiết phiếu + chi tiết đơn để hiện đủ.
   */
  const decisionTarget = approveTarget || rejectTarget;
  const decisionId = decisionTarget ? decisionTarget.deliveryRequestId || decisionTarget.id : "";
  const decisionReview = useSubmitReviewData(decisionId, () =>
    getDeliveryRequestDetail(decisionId),
  );
  const decisionOrderId = decisionReview.data?.orderId || decisionTarget?.orderId || "";
  const orderReview = useOrderReview(decisionOrderId, { enabled: Boolean(decisionTarget) });
  const decisionLoading = decisionReview.loading || orderReview.loading;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const items = await listDeliveryRequests({ status: statusFilter });
      setRows(Array.isArray(items) ? items : []);
    } catch (error) {
      setErrorMessage(getApprovalApiError(error, "Không tải được danh sách yêu cầu giao hàng."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const visibleRows = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.deliveryCode, row.orderCode, row.customerName, row.receiverName, row.receiverPhone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    );
  }, [rows, keyword]);

  const pendingRows = useMemo(
    () => rows.filter((row) => String(row.status).toUpperCase() === "DELIVERY_PENDING"),
    [rows],
  );
  const pendingCount = pendingRows.length;

  // Phiếu phải xuống kệ nhặt hàng thì kho cần bố trí người, khác hẳn phiếu lấy ở khu tạm.
  const shelfPickCount = useMemo(
    () => pendingRows.filter((row) => row.hasShelfPick).length,
    [pendingRows],
  );

  const openDetail = useCallback(async (row) => {
    setDetail(row);
    setDetailLoading(true);
    try {
      const full = await getDeliveryRequestDetail(row.deliveryRequestId || row.id);
      if (full) setDetail(full);
    } catch (error) {
      AuthNotify.error(getApprovalApiError(error, "Không tải được chi tiết yêu cầu giao hàng."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleApprove = useCallback(
    async (row) => {
      setSubmitting(true);
      try {
        await approveDeliveryRequest(row.deliveryRequestId || row.id);
        AuthNotify.success(`Đã duyệt phiếu ${row.deliveryCode}. Kho có thể đặt đơn vị giao.`);
        setApproveTarget(null);
        setDetail(null);
        await fetchRows();
      } catch (error) {
        AuthNotify.error(getApprovalApiError(error, "Không duyệt được yêu cầu giao hàng."));
      } finally {
        setSubmitting(false);
      }
    },
    [fetchRows],
  );

  const handleReject = useCallback(async () => {
    if (!rejectTarget) return;
    setSubmitting(true);
    try {
      await rejectDeliveryRequest(rejectTarget.deliveryRequestId || rejectTarget.id, rejectReason);
      AuthNotify.success(`Đã từ chối phiếu ${rejectTarget.deliveryCode}.`);
      setRejectTarget(null);
      setRejectReason("");
      setDetail(null);
      await fetchRows();
    } catch (error) {
      AuthNotify.error(getApprovalApiError(error, "Không từ chối được yêu cầu giao hàng."));
    } finally {
      setSubmitting(false);
    }
  }, [rejectTarget, rejectReason, fetchRows]);

  const columns = useMemo(
    () => [
      {
        title: "Mã phiếu",
        dataIndex: "deliveryCode",
        render: (value, row) => (
          <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(row)}>
            {value || "—"}
          </Button>
        ),
      },
      { title: "Đơn ký gửi", dataIndex: "orderCode", render: (v) => v || "—" },
      { title: "Khách", dataIndex: "customerName", render: (v) => v || "—" },
      {
        title: "Người nhận",
        key: "receiver",
        render: (_, row) => (
          <div>
            <div>{row.receiverName || "—"}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.receiverPhone || "—"}
            </Text>
          </div>
        ),
      },
      {
        title: "Số kiện",
        dataIndex: "totalParcels",
        align: "center",
        render: (v) => v ?? 0,
      },
      {
        title: "Lấy từ kệ",
        dataIndex: "hasShelfPick",
        align: "center",
        render: (value) =>
          value ? <Tag color="processing">Có</Tag> : <Tag>Khu tạm</Tag>,
      },
      { title: "Lập lúc", dataIndex: "createdAt", render: formatDateTime },
      {
        title: "Trạng thái",
        dataIndex: "status",
        render: (value, row) => {
          const meta = getDeliveryStatusMeta(value);
          return <Tag color={meta.tone}>{textOr(row.statusText, meta.label)}</Tag>;
        },
      },
      {
        title: "Thao tác",
        key: "actions",
        render: (_, row) => {
          const isPending = String(row.status).toUpperCase() === "DELIVERY_PENDING";
          if (!isPending) return <Text type="secondary">—</Text>;
          return (
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => setApproveTarget(row)}
              >
                Duyệt
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => {
                  setRejectTarget(row);
                  setRejectReason("");
                }}
              >
                Từ chối
              </Button>
            </Space>
          );
        },
      },
    ],
    [openDetail],
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>BỘ PHẬN VẬN HÀNH (OPS)</span>
          <h1>Duyệt Yêu Cầu Giao Hàng</h1>
          <p>
            Sale lập phiếu sau khi khách tất toán. Duyệt xong kho mới đặt được đơn vị giao.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Chờ duyệt</small>
            <strong>{pendingCount} phiếu</strong>
          </div>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={loading} />}
            disabled={loading}
            onClick={fetchRows}
          >
            Làm mới
          </Button>
        </div>
      </section>

      {!!errorMessage && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={errorMessage}
          action={
            <Button size="small" onClick={fetchRows}>
              Thử lại
            </Button>
          }
        />
      )}

      <section className="wro-kpi-grid-enhanced" aria-label="Chỉ số yêu cầu giao hàng">
        <div className="ops-kpi-card wro-kpi-card--blue">
          <div className="wro-kpi-card__icon-box">
            <SendOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Tổng yêu cầu giao</p>
            <p className="ops-kpi-card__value">{loading ? "…" : rows.length}</p>
            <div className="ops-kpi-card__meta">
              <p>Theo bộ lọc hiện tại</p>
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--amber">
          <div className="wro-kpi-card__icon-box">
            <ClockCircleOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Đang chờ duyệt</p>
            <p className="ops-kpi-card__value">{loading ? "…" : pendingCount}</p>
            <div className="ops-kpi-card__meta">
              <p>Khách đã tất toán, chờ OM</p>
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--purple">
          <div className="wro-kpi-card__icon-box">
            <InboxOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Cần nhặt trên kệ</p>
            <p className="ops-kpi-card__value">{loading ? "…" : shelfPickCount}</p>
            <div className="ops-kpi-card__meta">
              <p>Kho phải bố trí người xuống kệ</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ops-page__filters" aria-label="Bộ lọc yêu cầu giao hàng">
        <div>
          <label htmlFor="delivery-f-status">Trạng thái phiếu</label>
          <Select
            id="delivery-f-status"
            style={{ width: "100%" }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS}
          />
        </div>
        <div>
          <label htmlFor="delivery-f-search">Tìm kiếm nhanh</label>
          <Input.Search
            id="delivery-f-search"
            allowClear
            placeholder="Tìm theo mã phiếu, đơn ký gửi, khách, số điện thoại..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
      </section>

      <div className="ops-table-card">
        <div className="ops-table-card__head">
          <h3>Danh sách yêu cầu giao hàng</h3>
          <span>{visibleRows.length} phiếu</span>
        </div>
        <Table
          rowKey={(row) => row.deliveryRequestId || row.id}
          size="middle"
          columns={columns}
          dataSource={visibleRows}
          loading={loading}
          sticky={{ offsetHeader: 0 }}
          scroll={{ x: 1400, y: "calc(100vh - 460px)" }}
          pagination={tablePagination({ unit: "phiếu" })}
          locale={{ emptyText: "Không có yêu cầu giao hàng nào." }}
        />
      </div>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={680}
        title={detail?.deliveryCode || "Chi tiết yêu cầu giao hàng"}
        loading={detailLoading}
      >
        {detail && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Đơn ký gửi">{detail.orderCode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Khách hàng">{detail.customerName || "—"}</Descriptions.Item>
              <Descriptions.Item label="Người nhận">
                {detail.receiverName || "—"} · {detail.receiverPhone || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao">
                {detail.fullAddress || detail.addressDetail || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày khách hẹn">
                {detail.scheduledDate ? formatDateTime(detail.scheduledDate) : "Không hẹn"}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={getDeliveryStatusMeta(detail.status).tone}>
                  {textOr(detail.statusText, getDeliveryStatusMeta(detail.status).label)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Người lập">
                {detail.createdByName || "—"} · {formatDateTime(detail.createdAt)}
              </Descriptions.Item>
              {!!detail.approvedByName && (
                <Descriptions.Item label="Người duyệt">
                  {detail.approvedByName} · {formatDateTime(detail.approvedAt)}
                </Descriptions.Item>
              )}
              {!!detail.carrierTrackingCode && (
                <Descriptions.Item label="Mã vận đơn">
                  {detail.carrierTrackingCode} · đặt lúc {formatDateTime(detail.dispatchedAt)}
                </Descriptions.Item>
              )}
              {!!detail.rejectionReason && (
                <Descriptions.Item label="Lý do từ chối">{detail.rejectionReason}</Descriptions.Item>
              )}
              <Descriptions.Item label="Ghi chú">{detail.note || "—"}</Descriptions.Item>
            </Descriptions>

            {/*
              Khách khai muốn gửi lại kho mà phiếu này lại đem giao. Nêu lên đầu để OM gọi xác
              nhận trước khi duyệt cho book xe — giao nhầm thì tốn cả chiều đi lẫn chiều về.
            */}
            {(() => {
              const conflicting = (detail.parcels || []).filter(
                (row) => row.customerIntent === "STORE_AT_VN"
              );

              if (conflicting.length === 0) return null;

              return (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginTop: 20 }}
                  message={`${conflicting.length} kiện có khách yêu cầu gửi lại kho VN`}
                  description="Những kiện này đang được đề nghị giao, ngược với nguyện vọng khách khai lúc đặt đơn. Xác nhận lại với khách hoặc Sale trước khi duyệt."
                />
              );
            })()}

            <Title level={5} style={{ marginTop: 20 }}>
              Kiện đem giao ({detail.totalParcels ?? (detail.parcels || []).length})
            </Title>
            <Table
              rowKey={(row) => row.parcelId}
              size="small"
              pagination={subTablePagination("kiện")}
              dataSource={detail.parcels || []}
              columns={DELIVERY_PARCEL_COLUMNS}
              locale={{ emptyText: "Phiếu chưa có kiện nào." }}
            />

            {String(detail.status).toUpperCase() === "DELIVERY_PENDING" && (
              <Space style={{ marginTop: 20 }}>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => setApproveTarget(detail)}
                >
                  Duyệt yêu cầu
                </Button>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => {
                    setRejectTarget(detail);
                    setRejectReason("");
                  }}
                >
                  Từ chối
                </Button>
              </Space>
            )}
          </>
        )}
      </Drawer>

      <Modal
        {...REVIEW_MODAL_PROPS}
        open={Boolean(approveTarget)}
        title={`Duyệt yêu cầu giao hàng ${approveTarget?.deliveryCode || ""}`}
        okText={decisionLoading ? "Đang tải thông tin…" : "Duyệt yêu cầu"}
        cancelText="Huỷ"
        okButtonProps={{ loading: submitting, disabled: decisionLoading }}
        onOk={() => handleApprove(approveTarget)}
        onCancel={() => setApproveTarget(null)}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Duyệt xong kho nhặt đúng các kiện dưới đây và đặt đơn vị giao tới địa chỉ này."
        />
        {approveTarget ? (
          <DeliveryDecisionReview
            target={approveTarget}
            review={decisionReview}
            orderReview={orderReview}
          />
        ) : null}
      </Modal>

      <Modal
        {...REVIEW_MODAL_PROPS}
        open={Boolean(rejectTarget)}
        title={`Từ chối phiếu ${rejectTarget?.deliveryCode || ""}`}
        okText={decisionLoading ? "Đang tải thông tin…" : "Xác nhận từ chối"}
        cancelText="Huỷ"
        okButtonProps={{ danger: true, loading: submitting, disabled: decisionLoading }}
        onOk={handleReject}
        onCancel={() => setRejectTarget(null)}
      >
        {rejectTarget ? (
          <DeliveryDecisionReview
            target={rejectTarget}
            review={decisionReview}
            orderReview={orderReview}
          />
        ) : null}
        <Text type="secondary">Lý do sẽ hiển thị cho sale để họ báo lại khách.</Text>
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder="Ví dụ: địa chỉ giao chưa đủ 3 cấp, cần bổ sung phường/xã"
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  );
}
