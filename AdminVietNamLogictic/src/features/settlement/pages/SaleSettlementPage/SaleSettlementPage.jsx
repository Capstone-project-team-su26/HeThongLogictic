/**
 * Hàng chờ tất toán — việc của Sale ngay sau khi kho chốt kiểm.
 *
 * Mở một đơn ra là thấy đủ ba thứ cần để gọi khách: khách là ai, hàng gồm những gì và kho có
 * ghi nhận lệch không. Chốt phí cuối tại đây, hệ thống phát hành mã cho khách tự trả.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  CreditCardOutlined,
  DeleteOutlined,
  DollarOutlined,
  PlusOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  createFinalPayment,
  getOrderPayments,
  getSettlementApiError,
  getSettlementPreview,
  listAwaitingSettlement,
  needsSaleSettlement,
  SETTLEMENT_BLOCKER_HINTS,
} from "@features/settlement/api/settlementService";
/* Đi thẳng file store (như Sidebar): barrel "@features/workspace" kéo bảng tab → vòng import về trang này. */
import { useSaleBadges } from "@features/workspace/context/saleBadgeStore";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import ActionErrorAlert from "@shared/components/ActionErrorAlert/ActionErrorAlert";
import ProductTypeLabel from "@shared/components/ProductTypeLabel/ProductTypeLabel";
import {
  createLoadSequencer,
  createRowActionRunner,
  httpStatusOf,
} from "@shared/utils/rowActionGuard";
import SubmitReview, {
  ReviewFacts,
  ReviewItemsTable,
  ReviewMoney,
} from "@shared/components/SubmitReview/SubmitReview";
import { REVIEW_MODAL_PROPS } from "@shared/components/SubmitReview/submitReviewFormat";
import useSubmitReviewData from "@shared/components/SubmitReview/useSubmitReviewData";
/* Hàng khách khai (ký gửi) / sản phẩm (mua hộ) cho hộp xác nhận chốt phí — API thật. */
import { OrderReviewPanel, useOrderReview } from "@features/consignment";
/*
 * Cố ý đi đường sâu, KHÔNG qua barrel "@features/purchase": barrel đó kéo theo các trang mua
 * hộ + CSS của chúng vào sớm hơn thứ tự gốc. Đã đo bằng build: import barrel làm đổi thứ tự
 * rule trong file CSS gộp (xem ARCHITECTURE.md mục thứ tự nạp CSS); module api thì không.
 */
import { getPurchaseRequestDetailApi } from "@features/purchase/api/purchaseRequestService";
import { AttachmentThumbnails } from "@features/attachments";
import "./SaleSettlementPage.css";
import { getInstallmentTypeLabel, getPaymentMethodLabel, getRouteLabel } from "@shared/utils/statusLabel";
import { getPaymentStatusMeta } from "@shared/utils/paymentStatus";
import { subTablePagination, tablePagination } from "@shared/utils/tablePagination";

const { Title, Text } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const formatNumber = (value, digits = 2) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("vi-VN", { maximumFractionDigits: digits })
    : "—";
};

/* Điều chỉnh âm = giảm tiền cho khách → xanh; dương = thu thêm → cam. */
const signedMoney = (value) => {
  const number = Number(value) || 0;
  if (number === 0) return <Text type="secondary">0đ</Text>;
  return (
    <Text strong style={{ color: number < 0 ? "#389e0d" : "#d46b08" }}>
      {number > 0 ? "+" : ""}
      {formatMoney(number)}
    </Text>
  );
};

/** Sản phẩm của yêu cầu mua hộ (GET /api/purchase-requests/{id} → items[]). */
const PURCHASE_ITEM_COLUMNS = [
  {
    title: "Sản phẩm",
    dataIndex: "productName",
    render: (value, item) => (
      <Space direction="vertical" size={0}>
        <Text strong>{value || "—"}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {/* productType có thể là Id loại hàng — tra tên, không in GUID. */}
          <ProductTypeLabel item={item} />
          {item?.sourceWebsite ? ` · ${item.sourceWebsite}` : null}
        </Text>
      </Space>
    ),
  },
  { title: "SL", dataIndex: "quantity", width: 70, align: "center", render: (v) => v ?? "—" },
  { title: "Thuộc tính", dataIndex: "attributes", width: 200, render: (v) => v || "—" },
  { title: "Ghi chú", dataIndex: "note", width: 200, render: (v) => v || "—" },
];

const emptyFee = () => ({ key: `${Date.now()}-${Math.round(performance.now())}`, name: "", amount: null, note: "" });

const sameOrder = (a, b) => {
  const left = String(a ?? "").trim().toLowerCase();
  return left !== "" && left === String(b ?? "").trim().toLowerCase();
};

export default function SaleSettlementPage() {
  const navigate = useNavigate();
  /* Chốt xong thì đếm lại badge NGAY (không chờ nhịp 60 giây / chặn 20 giây). */
  const { forceRefresh: refreshBadges } = useSaleBadges();

  /*
   * CHỐNG BẤM LẠI. Trước đây bấm chốt xong dòng vẫn còn nguyên nút "Chốt tất toán" (bảng chỉ đổi
   * sau khi tải lại, mà backend cũ còn trả cả dòng đã chốt) nên Sale bấm lại được mãi.
   *  - runSettle: mỗi đơn chỉ một lời gọi đang bay — bấm đúp / Enter + chuột không gọi API lần hai.
   *  - busyId: đơn đang gửi → nút trên dòng quay + khoá.
   *  - loadSeq: chỉ lần tải mới nhất được ghi vào bảng; lần tải cũ về muộn không làm dòng sống lại.
   */
  const [runSettle] = useState(createRowActionRunner);
  const [loadSeq] = useState(createLoadSequencer);
  const [busyId, setBusyId] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyword, setKeyword] = useState("");

  const [target, setTarget] = useState(null);
  const [fees, setFees] = useState([]);
  /*
   * Hệ thống chỉ cấu hình SePay (chuyển khoản QR). Vẫn giữ biến này vì payload gửi lên
   * bắt buộc có phương thức: không gửi thì backend mặc định PayOS và trả lỗi
   * "Chưa cấu hình payOS". Không còn ô cho người dùng đổi — xem chú thích ở phần hiển thị.
   */
  const [paymentMethod] = useState("SEPAY");
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState(null);

  /*
   * Hộp xác nhận cuối trước khi phát hành đợt tất toán. Trước đây bấm nút là gửi ngay, và
   * không chỗ nào cộng "dự kiến theo cân VN" với phí phát sinh Sale vừa nhập — Sale chốt tiền
   * mà không thấy khách sẽ phải trả tổng bao nhiêu. Giờ hộp gom đủ: đơn, khách, hàng, kiện
   * theo cân VN, từng khoản tiền, phí phát sinh và tổng dự kiến, rồi mới cho gửi.
   */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isPurchase = target?.orderType === "PURCHASE";
  const orderReview = useOrderReview(confirmOpen && !isPurchase ? target?.orderId : "", {
    withPayments: false,
  });
  const purchaseReview = useSubmitReviewData(
    confirmOpen && isPurchase ? target?.purchaseRequestId : "",
    () => getPurchaseRequestDetailApi(target.purchaseRequestId),
  );
  const confirmLoading = orderReview.loading || purchaseReview.loading;

  /*
   * Xem trước tất toán theo cân đo VN + các khoản đã thu — CẢ ký gửi lẫn mua hộ. Đơn mua hộ trong
   * hàng chờ có `orderId` là đơn kho PUR; backend (VnSettlementService.PreviewAsync) tính cùng
   * một đường với lúc phát hành: hoá đơn chặng quốc tế (cước tạm tính + VAT cước + thuế NK) lập
   * khi đặt NCC, cước tính lại theo cân đo VN, và thêm `importTaxAdjustment` (≤ 0) cho phần hàng
   * không tới tay khách (kiện DISPOSED / thất lạc, NCC giao thiếu).
   */
  const [preview, setPreview] = useState(null);
  const [payments, setPayments] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const load = useCallback(async () => {
    const seq = loadSeq.next();
    setLoading(true);
    setErrorMessage("");
    try {
      const next = await listAwaitingSettlement();
      if (!loadSeq.isLatest(seq)) return;
      setRows(next);
    } catch (error) {
      if (!loadSeq.isLatest(seq)) return;
      setErrorMessage(getSettlementApiError(error, "Không tải được danh sách hàng chờ tất toán."));
    } finally {
      if (loadSeq.isLatest(seq)) setLoading(false);
    }
  }, [loadSeq]);

  useEffect(() => {
    load();
  }, [load]);

  /*
   * Bảng chỉ bày dòng còn là việc của Sale — CÙNG hàm lọc với badge tab "Chờ tất toán". Dòng đã
   * chốt phí cuối (đang chờ khách trả) không còn nút chốt; chỉ đếm để Sale biết còn bao nhiêu đơn
   * đang chờ khách.
   */
  const actionable = useMemo(() => rows.filter(needsSaleSettlement), [rows]);
  const waitingCustomerCount = rows.length - actionable.length;

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return actionable;
    return actionable.filter((row) =>
      [row.orderCode, row.customerName, row.customerPhone, row.receiverName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [actionable, keyword]);

  const loadPreview = useCallback(async (row) => {
    setPreview(null);
    setPayments(null);
    setPreviewError("");
    if (!row) return;

    setPreviewLoading(true);
    const [previewResult, paymentResult] = await Promise.allSettled([
      getSettlementPreview(row.orderId),
      getOrderPayments(row.orderId),
    ]);
    if (previewResult.status === "fulfilled") setPreview(previewResult.value);
    else setPreviewError(getSettlementApiError(previewResult.reason, "Không tải được xem trước tất toán."));
    if (paymentResult.status === "fulfilled") setPayments(paymentResult.value);
    setPreviewLoading(false);
  }, []);

  const openOrder = useCallback(
    (row) => {
      /* Đơn đang gửi chốt thì không mở lại (dòng cũng đang khoá). */
      if (runSettle.isBusy(row?.orderId)) return;

      setTarget(row);
      setConfirmOpen(false);
      setSubmitError("");
      setFees([]);
      /* Không cần đặt lại phương thức: chỉ còn SePay, biến giữ cố định "SEPAY". */
      setIssued(null);
      loadPreview(row);
    },
    [loadPreview, runSettle],
  );

  const feesTotal = useMemo(
    () => fees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0),
    [fees],
  );

  const cleanFees = useCallback(
    () =>
      fees
        .map((fee) => ({ name: fee.name.trim(), amount: Number(fee.amount) || 0, note: fee.note }))
        .filter((fee) => fee.name && fee.amount > 0),
    [fees],
  );

  /** Bấm nút chốt → kiểm dòng phí rồi mở hộp xác nhận (chưa gửi gì). */
  const openConfirm = useCallback(() => {
    if (!target) return;

    // Dòng phí điền dở làm số tiền chốt cho khách sai, nên chặn tại đây thay vì lặng lẽ bỏ qua.
    if (fees.length > 0 && cleanFees().length !== fees.length) {
      AuthNotify.error("Phí phát sinh chưa hợp lệ", "Mỗi dòng phí phải có tên và số tiền lớn hơn 0.");
      return;
    }

    setSubmitError("");
    setConfirmOpen(true);
  }, [target, fees, cleanFees]);

  /**
   * Gửi chốt phí cuối ĐÚNG MỘT LẦN cho một đơn.
   *  - Lần bấm thứ hai khi lần đầu chưa xong: bỏ qua, không gọi API.
   *  - Lỗi: hộp xác nhận GIỮ NGUYÊN, câu lỗi hiện ngay chân hộp (không đóng hộp rồi bắn toast).
   *    409 = đơn đã được chốt (tab khác / người khác) → tải lại để dòng rời bảng.
   *  - Thành công: bỏ dòng khỏi bảng ngay, báo thành công, rồi tải lại bảng + badge một lần.
   */
  const submit = useCallback(async () => {
    if (!target) return;

    const orderId = target.orderId;
    if (runSettle.isBusy(orderId)) return;

    const cleaned = cleanFees();

    // Dòng phí điền dở làm số tiền chốt cho khách sai, nên chặn tại đây thay vì lặng lẽ bỏ qua.
    if (fees.length > 0 && cleaned.length !== fees.length) {
      setSubmitError("Mỗi dòng phí phải có tên và số tiền lớn hơn 0.");
      return;
    }

    setSubmitError("");
    setSubmitting(true);
    setBusyId(orderId);

    // Đơn mua hộ cũng tất toán trên đơn kho PUR (`target.orderId`), cùng đường với ký gửi.
    const outcome = await runSettle(orderId, () => createFinalPayment(orderId, cleaned, paymentMethod));

    if (outcome.skipped) return;

    try {
      if (!outcome.ok) {
        setSubmitError(getSettlementApiError(outcome.error, "Không chốt được phí cuối. Vui lòng thử lại."));

        if (httpStatusOf(outcome.error) === 409) {
          load();
          refreshBadges();
        }
        return;
      }

      const result = outcome.result;

      setIssued(result);
      setConfirmOpen(false);
      setRows((current) => current.filter((row) => !sameOrder(row.orderId, orderId)));
      AuthNotify.success(
        "Đã chốt phí cuối",
        `Khách có thể tất toán ${formatMoney(result?.finalAmount ?? result?.amount)} cho đơn ${target.orderCode}.`,
      );
      loadPreview(target);
      load();
      refreshBadges();
    } finally {
      setSubmitting(false);
      setBusyId((current) => (sameOrder(current, orderId) ? "" : current));
    }
  }, [target, fees, cleanFees, paymentMethod, load, loadPreview, refreshBadges, runSettle]);

  const columns = useMemo(
    () => [
      {
        title: "Mã đơn",
        dataIndex: "orderCode",
        width: 210,
        render: (value, row) => (
          <Space direction="vertical" size={2}>
            <Text strong>{value || "—"}</Text>
            <Tag color={row.orderType === "PURCHASE" ? "purple" : "blue"}>
              {row.orderType === "PURCHASE" ? "Mua hộ" : "Ký gửi"}
            </Tag>
          </Space>
        ),
      },
      {
        title: "Khách hàng",
        dataIndex: "customerName",
        render: (value, row) => (
          <Space direction="vertical" size={2}>
            <Text strong>{value || "—"}</Text>
            <Text type="secondary">{row.customerPhone || "Chưa có số điện thoại"}</Text>
          </Space>
        ),
      },
      {
        title: "Hàng đã về kho",
        align: "center",
        width: 150,
        render: (_, row) => (
          <Space direction="vertical" size={2}>
            <Text>{row.parcelCount} kiện</Text>
            <Text type="secondary">{Number(row.totalWeight || 0).toLocaleString("vi-VN")} kg</Text>
          </Space>
        ),
      },
      {
        title: "Kiểm đếm",
        align: "center",
        width: 150,
        render: (_, row) =>
          row.discrepancyParcelCount > 0 ? (
            <Tag color="error" icon={<WarningOutlined />}>
              {row.discrepancyParcelCount} kiện lệch
            </Tag>
          ) : (
            <Tag color="success">Khớp khai báo</Tag>
          ),
      },
      { title: "Về kho lúc", dataIndex: "arrivedAt", width: 170, render: formatDateTime },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 160,
        render: (_, row) => {
          const busy = sameOrder(busyId, row.orderId);
          return (
            <Button
              type="primary"
              icon={<DollarOutlined />}
              loading={busy}
              disabled={busy}
              onClick={() => openOrder(row)}
            >
              {busy ? "Đang chốt…" : "Chốt tất toán"}
            </Button>
          );
        },
      },
    ],
    [openOrder, busyId],
  );

  return (
    <div className="sale-settlement-page">
      <div className="sale-settlement-page__head">
        <div>
          <Title level={4}>Hàng chờ tất toán</Title>
          <Text type="secondary">
            Đơn kho đã kiểm đếm xong, chờ Sale chốt phí cuối để khách tất toán.
          </Text>
          {waitingCustomerCount > 0 && (
            <Text type="secondary" style={{ display: "block" }}>
              {waitingCustomerCount} đơn đã chốt phí cuối, đang chờ khách thanh toán — không cần thao tác thêm.
            </Text>
          )}
        </div>

        <Space>
          <Input.Search
            allowClear
            placeholder="Tìm mã đơn, tên hoặc số điện thoại khách"
            style={{ width: 300 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Tải lại
          </Button>
        </Space>
      </div>

      {errorMessage && (
        <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} />
      )}

      <Table
        rowKey={(row) => row.orderId}
        columns={columns}
        dataSource={filtered}
        loading={loading}
        rowClassName={(row) => (sameOrder(busyId, row.orderId) ? "sale-queue-row--busy" : "")}
        scroll={{ x: 1080 }}
        pagination={tablePagination({ unit: "đơn" })}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có đơn nào chờ tất toán."
            />
          ),
        }}
      />

      <Drawer
        open={Boolean(target)}
        onClose={() => {
          /* Đang gửi chốt thì giữ ngăn mở tới khi có kết quả (thành công / lỗi đều hiện ở đây). */
          if (submitting) return;
          setTarget(null);
          setConfirmOpen(false);
        }}
        width={720}
        title={`Chốt tất toán · ${target?.orderCode || ""}`}
      >
        {target && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Khách hàng">{target.customerName || "—"}</Descriptions.Item>
              <Descriptions.Item label="Điện thoại">{target.customerPhone || "—"}</Descriptions.Item>
              <Descriptions.Item label="Loại đơn">
                {target.orderType === "PURCHASE" ? "Mua hộ" : "Ký gửi"}
              </Descriptions.Item>
              <Descriptions.Item label="Tuyến">{getRouteLabel(target.route, "—")}</Descriptions.Item>
              <Descriptions.Item label="Hàng về kho">
                {target.parcelCount} kiện · {Number(target.totalWeight || 0).toLocaleString("vi-VN")} kg
              </Descriptions.Item>
              <Descriptions.Item label="Về kho lúc">{formatDateTime(target.arrivedAt)}</Descriptions.Item>
              <Descriptions.Item label="Người nhận" span={2}>
                {target.receiverName || "—"} · {target.receiverPhone || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao" span={2}>
                {target.receiverAddress || "—"}
              </Descriptions.Item>
            </Descriptions>

            {target.discrepancyParcelCount > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={`${target.discrepancyParcelCount} kiện bị kho ghi nhận lệch`}
                description="Nên thống nhất với khách cách xử lý trước khi chốt số tiền cuối."
                action={
                  <Button
                    size="small"
                    onClick={() =>
                      navigate(
                        target.orderType === "PURCHASE" && target.purchaseRequestId
                          ? `/sale/purchase-requests/${target.purchaseRequestId}`
                          : `/sale/consignments/${target.orderId}`,
                      )
                    }
                  >
                    Xem chi tiết
                  </Button>
                }
              />
            )}

            <Spin spinning={previewLoading}>
              <Title level={5} style={{ marginTop: 4 }}>
                Xem trước tất toán theo cân đo tại kho VN
              </Title>

              {isPurchase && (
                <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
                  Đơn mua hộ: chỉ tính phần chặng quốc tế (cước theo cân VN, VAT cước, thuế NK). Tiền hàng
                  và phí mua hộ khách đã trả trước, không nằm trong hoá đơn này.
                </Text>
              )}

              {previewError && (
                <Alert type="error" showIcon message={previewError} style={{ marginBottom: 12 }} />
              )}

              {preview && Array.isArray(preview.blockers) && preview.blockers.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Chưa phát hành được đợt tất toán"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {preview.blockers.map((blocker) => (
                        <li key={blocker.code}>
                          {blocker.message || SETTLEMENT_BLOCKER_HINTS[blocker.code] || blocker.code}
                        </li>
                      ))}
                    </ul>
                  }
                />
              )}

              {preview && (
                <>
                  <Table
                    size="small"
                    rowKey="parcelId"
                    pagination={subTablePagination("kiện")}
                    dataSource={preview.parcels || []}
                    style={{ marginBottom: 12 }}
                    columns={[
                      {
                        title: "Kiện",
                        dataIndex: "packageCode",
                        render: (value, row) => (
                          <Space direction="vertical" size={0}>
                            <Text code>{value}</Text>
                            {row.isDisposed ? <Tag>Đã huỷ — không tính cước</Tag> : null}
                          </Space>
                        ),
                      },
                      { title: "Cân kho gốc", dataIndex: "originWeight", align: "right", render: (v) => `${formatNumber(v)} kg` },
                      { title: "Cân VN", dataIndex: "vnWeight", align: "right", render: (v) => `${formatNumber(v)} kg` },
                      {
                        title: "Kích thước VN (cm)",
                        key: "dims",
                        render: (_, row) =>
                          `${formatNumber(row.vnLength, 0)}×${formatNumber(row.vnWidth, 0)}×${formatNumber(row.vnHeight, 0)}`,
                      },
                      { title: "Cân quy đổi", dataIndex: "volumetricWeight", align: "right", render: (v) => `${formatNumber(v)} kg` },
                      { title: "Cân tính cước", dataIndex: "chargeableWeight", align: "right", render: (v) => <Text strong>{formatNumber(v)} kg</Text> },
                      /* Ảnh kho VN chụp lúc tiếp nhận — căn cứ cho số cân đo VN. Backend cũ không trả → "—". */
                      {
                        title: "Ảnh nhận VN",
                        key: "arrivalPhotos",
                        width: 112,
                        render: (_, row) => (
                          <AttachmentThumbnails items={row.arrivalPhotos} size={34} emptyText="—" />
                        ),
                      },
                    ]}
                  />

                  <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="Đơn giá cước (theo báo giá)">
                      {formatMoney(preview.freightRate)}/kg
                    </Descriptions.Item>
                    <Descriptions.Item label="Cân tính cước VN">
                      {formatNumber(preview.vnChargeableWeight)} kg (tối thiểu {formatNumber(preview.minimumWeight)} kg,
                      hệ số quy đổi {formatNumber(preview.volumetricDivisor, 0)})
                    </Descriptions.Item>
                    <Descriptions.Item label="Cước đã báo">{formatMoney(preview.quotedFreight)}</Descriptions.Item>
                    <Descriptions.Item label="Cước theo cân VN">{formatMoney(preview.vnFreight)}</Descriptions.Item>
                    <Descriptions.Item label="Điều chỉnh cước">{signedMoney(preview.freightAdjustment)}</Descriptions.Item>
                    <Descriptions.Item label={`Điều chỉnh VAT (${formatNumber(preview.vatRatePercent)}%)`}>
                      {signedMoney(preview.vatAdjustment)}
                    </Descriptions.Item>
                    {/*
                      Mua hộ: thuế NK KHÔNG thu của phần hàng không tới tay khách (kiện huỷ / thất
                      lạc, NCC giao thiếu) — luôn ≤ 0, server ghi dòng TAX_ADJUSTMENT khi phát hành
                      và đã gồm trong "Dự kiến khách trả". Backend cũ không có trường → ẩn.
                    */}
                    {Number(preview.importTaxAdjustment) ? (
                      <Descriptions.Item label="Điều chỉnh thuế NK" span={2}>
                        {signedMoney(preview.importTaxAdjustment)}
                        {preview.importTaxAdjustmentNote ? (
                          <Text type="secondary"> — {preview.importTaxAdjustmentNote}</Text>
                        ) : null}
                      </Descriptions.Item>
                    ) : null}
                    <Descriptions.Item label="Phí lưu kho">{formatMoney(preview.storageFee)}</Descriptions.Item>
                    <Descriptions.Item
                      label={
                        isPurchase
                          ? "Hoá đơn chặng quốc tế trước điều chỉnh"
                          : "Hoá đơn trước điều chỉnh"
                      }
                    >
                      {formatMoney(preview.invoiceTotalBefore)}
                    </Descriptions.Item>
                    <Descriptions.Item label={isPurchase ? "Đã cọc (hoá đơn chặng quốc tế)" : "Đã cọc"}>
                      {formatMoney(preview.depositPaid)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Dự kiến khách trả">
                      <Text strong>{formatMoney(preview.estimatedFinalAmount)}</Text>
                      <Text type="secondary"> (chưa gồm phí phát sinh bên dưới)</Text>
                    </Descriptions.Item>
                    {preview.adjustmentNote ? (
                      <Descriptions.Item label="Không tính lại cước" span={2}>
                        {preview.adjustmentNote}
                      </Descriptions.Item>
                    ) : null}
                  </Descriptions>
                </>
              )}

              {payments && Array.isArray(payments.payments) && payments.payments.length > 0 && (
                <>
                  <Text strong>Các khoản thanh toán của đơn</Text>
                  <Table
                    size="small"
                    rowKey={(row) => row.paymentId}
                    pagination={false}
                    dataSource={payments.payments}
                    style={{ margin: "8px 0 16px" }}
                    columns={[
                      {
                        title: "Loại",
                        dataIndex: "installmentType",
                        render: (v) => getInstallmentTypeLabel(v),
                      },
                      { title: "Số tiền", dataIndex: "amount", align: "right", render: formatMoney },
                      { title: "Phương thức", dataIndex: "paymentMethod", render: (v) => getPaymentMethodLabel(v) },
                      {
                        title: "Trạng thái",
                        dataIndex: "paymentStatus",
                        render: (v) => (
                          <Tag color={String(v).toUpperCase() === "PAID" ? "success" : "default"}>
                            {getPaymentStatusMeta(v).label}
                          </Tag>
                        ),
                      },
                      { title: "Trả lúc", dataIndex: "paidAt", render: formatDateTime },
                    ]}
                  />
                </>
              )}
            </Spin>

            <div className="sale-settlement-fees">
              <div className="sale-settlement-fees__head">
                <Text strong>Phí phát sinh cộng thêm</Text>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setFees((current) => [...current, emptyFee()])}
                >
                  Thêm dòng
                </Button>
              </div>

              {fees.length === 0 ? (
                <Text type="secondary">
                  Không có phí phát sinh thì bấm chốt luôn — khách trả nốt phần còn lại của báo giá.
                </Text>
              ) : (
                fees.map((fee, index) => (
                  <div key={fee.key} className="sale-settlement-fees__row">
                    <Input
                      placeholder="Tên khoản phí"
                      value={fee.name}
                      onChange={(event) =>
                        setFees((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, name: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <InputNumber
                      placeholder="Số tiền"
                      min={0}
                      step={1000}
                      style={{ width: 160 }}
                      value={fee.amount}
                      formatter={(value) =>
                        value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""
                      }
                      parser={(value) => value.replace(/\./g, "")}
                      onChange={(value) =>
                        setFees((current) =>
                          current.map((item, i) => (i === index ? { ...item, amount: value } : item)),
                        )
                      }
                    />
                    <Input
                      placeholder="Ghi chú"
                      value={fee.note}
                      onChange={(event) =>
                        setFees((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, note: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => setFees((current) => current.filter((_, i) => i !== index))}
                    />
                  </div>
                ))
              )}

              {fees.length > 0 && (
                <div className="sale-settlement-fees__total">
                  Cộng phí phát sinh: <strong>{formatMoney(feesTotal)}</strong>
                </div>
              )}
            </div>

            {issued ? (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 16 }}
                message="Đã phát hành đợt thanh toán cuối"
                description={
                  <>
                    Khách cần trả <strong>{formatMoney(issued.finalAmount ?? issued.amount)}</strong>
                    {Number(issued.freightAdjustmentDelta) ? (
                      <> (đã gồm điều chỉnh cước theo cân VN {formatMoney(issued.freightAdjustmentDelta)})</>
                    ) : null}
                    .
                    Đơn sẽ chuyển sang mục <strong>Đơn hàng cần xử lý</strong> ngay khi khách trả xong.
                  </>
                }
              />
            ) : (
              <>
              <div style={{ marginTop: 16 }}>
                <Text strong>Khách thanh toán qua</Text>
                {/*
                  Chỉ còn SePay. Bỏ lựa chọn PayOS vì hệ thống KHÔNG cấu hình cổng đó:
                  chọn vào là backend trả "Chưa cấu hình payOS" và Sale kẹt giữa chừng
                  với khách. Thà không có nút còn hơn có nút bấm vào thì lỗi.

                  Nhãn PAYOS vẫn còn trong bảng dịch tên phương thức, để các khoản thu cũ
                  đã ghi PAYOS hiện đúng tên khi xem lại lịch sử.
                */}
                <div className="settlement-payment-method">
                  <CreditCardOutlined />
                  <span>
                    <b>Chuyển khoản SePay (QR)</b>
                    <small>
                      Hệ thống mở trang mã QR, khách quét bằng app ngân hàng và tự động
                      ghi nhận khi tiền về.
                    </small>
                  </span>
                </div>
              </div>
              <Button
                type="primary"
                size="large"
                block
                icon={<DollarOutlined />}
                loading={submitting}
                disabled={Boolean(previewLoading || (preview && !preview.canIssue))}
                onClick={openConfirm}
                style={{ marginTop: 16 }}
              >
                Xem lại và chốt phí cuối
              </Button>
              </>
            )}
          </>
        )}
      </Drawer>

      {/*
        XÁC NHẬN CHỐT PHÍ CUỐI. Đang tải hàng của đơn thì khoá nút gửi. Tải lỗi không chặn: số
        tiền (phần quan trọng nhất) đã có từ xem trước tất toán, và server tự tính lại cước theo
        cân VN khi phát hành — phần hàng chỉ để Sale đối chiếu.
      */}
      <Modal
        {...REVIEW_MODAL_PROPS}
        open={Boolean(confirmOpen && target)}
        title={`Xác nhận chốt phí cuối · ${target?.orderCode || ""}`}
        okText={confirmLoading ? "Đang tải thông tin…" : "Chốt phí và gửi khách tất toán"}
        cancelText="Xem lại"
        confirmLoading={submitting}
        okButtonProps={{ disabled: confirmLoading }}
        cancelButtonProps={{ disabled: submitting }}
        closable={!submitting}
        maskClosable={!submitting}
        keyboard={!submitting}
        onOk={submit}
        onCancel={() => {
          if (!submitting) setConfirmOpen(false);
        }}
        footer={(origin) => (
          <>
            <ActionErrorAlert error={submitError} title="Chưa chốt được phí cuối" />
            {origin}
          </>
        )}
      >
        {target && (
          <>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 14 }}
              message="Gửi xong hệ thống phát hành ngay đợt thanh toán cuối và gửi mã QR cho khách."
              description="Số tiền cuối do server tính lại theo cân đo VN lúc phát hành; con số dưới đây là dự kiến từ bản xem trước cộng phí phát sinh bạn nhập."
            />

            <ReviewFacts
              items={[
                { label: "Mã đơn", value: <Text strong>{target.orderCode}</Text> },
                { label: "Loại đơn", value: isPurchase ? "Mua hộ" : "Ký gửi" },
                { label: "Khách hàng", value: target.customerName },
                { label: "SĐT khách", value: target.customerPhone },
                { label: "Tuyến", value: target.route },
                {
                  label: "Hàng về kho",
                  value: `${target.parcelCount} kiện · ${formatNumber(target.totalWeight)} kg · ${formatDateTime(target.arrivedAt)}`,
                },
                {
                  label: "Người nhận",
                  value: [target.receiverName, target.receiverPhone].filter(Boolean).join(" · "),
                },
                {
                  label: "Kiểm đếm",
                  value:
                    target.discrepancyParcelCount > 0 ? (
                      <Text type="danger">{target.discrepancyParcelCount} kiện lệch</Text>
                    ) : (
                      "Khớp khai báo"
                    ),
                },
                { label: "Địa chỉ giao", value: target.receiverAddress, span: 2 },
                { label: "Thanh toán qua", value: "Chuyển khoản SePay (QR)", span: 2 },
              ]}
            />

            <div style={{ height: 14 }} />

            {preview && (
              <ReviewItemsTable
                title="Kiện tính cước theo cân đo VN"
                items={preview.parcels || []}
                rowKey={(row, index) => row?.parcelId || index}
                extra={`Cân tính cước ${formatNumber(preview.vnChargeableWeight)} kg · ${formatMoney(preview.freightRate)}/kg`}
                columns={[
                  {
                    title: "Kiện",
                    dataIndex: "packageCode",
                    render: (value, row) => (
                      <Space direction="vertical" size={0}>
                        <Text code>{value}</Text>
                        {row.isDisposed ? <Tag>Đã huỷ — không tính cước</Tag> : null}
                      </Space>
                    ),
                  },
                  { title: "Cân kho gốc", dataIndex: "originWeight", align: "right", render: (v) => `${formatNumber(v)} kg` },
                  { title: "Cân VN", dataIndex: "vnWeight", align: "right", render: (v) => `${formatNumber(v)} kg` },
                  {
                    title: "Kích thước VN (cm)",
                    key: "dims",
                    render: (_, row) =>
                      `${formatNumber(row.vnLength, 0)}×${formatNumber(row.vnWidth, 0)}×${formatNumber(row.vnHeight, 0)}`,
                  },
                  { title: "Cân quy đổi", dataIndex: "volumetricWeight", align: "right", render: (v) => `${formatNumber(v)} kg` },
                  { title: "Cân tính cước", dataIndex: "chargeableWeight", align: "right", render: (v) => <Text strong>{formatNumber(v)} kg</Text> },
                ]}
              />
            )}

            {!isPurchase && (
              <OrderReviewPanel
                review={orderReview}
                fallback={target}
                showFacts={false}
                showMoney={false}
                errorHint="Phần tiền bên dưới không bị ảnh hưởng."
              />
            )}

            {isPurchase && (
              <SubmitReview
                loading={purchaseReview.loading}
                loadingText="Đang tải sản phẩm của yêu cầu mua hộ…"
                error={purchaseReview.error}
                errorHint="Phần tiền bên dưới không bị ảnh hưởng."
              >
                <ReviewItemsTable
                  title="Sản phẩm của yêu cầu mua hộ"
                  items={purchaseReview.data?.items || []}
                  columns={PURCHASE_ITEM_COLUMNS}
                  rowKey={(item, index) => item?.itemId || index}
                  extra={`${(purchaseReview.data?.items || []).length} sản phẩm`}
                />
              </SubmitReview>
            )}

            <ReviewMoney
              title="Tiền khách sẽ tất toán"
              lines={[
                ...(preview
                  ? [
                      {
                        label: "Hoá đơn trước điều chỉnh",
                        value: preview.invoiceTotalBefore,
                        hint: isPurchase ? "chặng quốc tế: cước tạm tính + VAT cước + thuế NK" : "",
                      },
                      {
                        label: "Điều chỉnh cước theo cân VN",
                        value: signedMoney(preview.freightAdjustment),
                        hint: `Cước đã báo ${formatMoney(preview.quotedFreight)} → theo cân VN ${formatMoney(preview.vnFreight)}`,
                      },
                      {
                        label: `Điều chỉnh VAT (${formatNumber(preview.vatRatePercent)}%)`,
                        value: signedMoney(preview.vatAdjustment),
                      },
                      {
                        label: "Điều chỉnh thuế NK (hàng không tới tay khách)",
                        value: signedMoney(preview.importTaxAdjustment),
                        hint: preview.importTaxAdjustmentNote || "",
                        hidden: !Number(preview.importTaxAdjustment),
                      },
                      { label: "Phí lưu kho", value: preview.storageFee },
                      {
                        label: "Đã cọc",
                        value: preview.depositPaid,
                        tone: "success",
                        hint: isPurchase ? "tiền hàng + phí mua hộ đã trả trước, không thuộc hoá đơn này" : "",
                      },
                      {
                        label: "Dự kiến theo cân VN",
                        value: preview.estimatedFinalAmount,
                        hint: "chưa gồm phí phát sinh",
                      },
                    ]
                  : []),
                ...cleanFees().map((fee, index) => ({
                  key: `fee-${index}`,
                  label: `Phí phát sinh: ${fee.name}`,
                  hint: fee.note || "",
                  value: signedMoney(fee.amount),
                })),
                ...(fees.length === 0
                  ? [{ label: "Phí phát sinh", value: "Không có" }]
                  : [{ label: "Cộng phí phát sinh", value: feesTotal }]),
                preview
                  ? {
                      label: "Tổng dự kiến khách trả",
                      value: (Number(preview.estimatedFinalAmount) || 0) + feesTotal,
                      strong: true,
                      hint: "server tính lại chính xác khi phát hành",
                    }
                  : {
                      label: "Tổng khách trả",
                      value: "Chưa có bản xem trước — hệ thống tính khi phát hành",
                      strong: true,
                    },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
