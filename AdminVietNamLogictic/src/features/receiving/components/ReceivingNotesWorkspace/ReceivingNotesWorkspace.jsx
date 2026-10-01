import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Modal,
  Segmented,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  approveReceivingNote,
  AWAITING_TAB_KEY,
  canRejectAtStage,
  getApprovalStageMeta,
  getReceivingApiError,
  getReceivingNoteDetail,
  getReceivingStatusMeta,
  getReceivingSummary,
  isDiscrepancyStage,
  isPurchaseReceivingNote,
  listReceivingNotes,
  RECEIVING_ORDER_TYPES,
  RECEIVING_STATUS_TABS,
  rejectReceivingNote,
} from "@features/receiving/api/receivingNoteService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import SubmitReview, {
  ReviewFacts,
  ReviewItemsTable,
} from "@shared/components/SubmitReview/SubmitReview";
import {
  formatReviewDimensions,
  formatReviewKg,
  formatReviewNumber,
  REVIEW_MODAL_PROPS,
} from "@shared/components/SubmitReview/submitReviewFormat";
import useSubmitReviewData from "@shared/components/SubmitReview/useSubmitReviewData";
import { toPublicReceiptUrl } from "@shared/utils/receiptUrl";
/* Hàng đủ D×R×C + báo giá + tiền đã cọc của đơn gốc — phiếu nhập kho không mang mấy số này. */
import { OrderReviewPanel, useOrderReview } from "@features/consignment";
import OrderTypeTag from "@shared/components/OrderTypeTag/OrderTypeTag";
import { getParcelStatusLabel, getRouteLabel, textOr } from "@shared/utils/statusLabel";
import { tablePagination } from "@shared/utils/tablePagination";

const { Text, Title } = Typography;

/**
 * Màn phiếu nhập kho gốc — dùng chung cho quản lý kho / OM (hàng đợi duyệt) và Admin (tra cứu).
 *
 * Mỗi phiếu chờ quyết định ở một trong ba giai đoạn (`approvalStage`):
 *   - RECEIVE: Sale vừa lập, duyệt thì phiếu ACTIVE + có PDF để khách mang hàng tới;
 *   - DISCREPANCY: kho kiểm đếm lệch số lượng, chấp nhận thì chốt biên bản cho xếp kệ;
 *   - DISCREPANCY_ACK: đủ số lượng nhưng lệch cân — phiếu đã tự chốt (xếp kệ được), quản lý
 *     kho chỉ còn CHẤP NHẬN số thực tế (BE không cho từ chối ở bước này).
 *
 * Khác nhau giữa các màn truyền bằng prop:
 *   - `defaultStatus`: OM mở thẳng tab "Cần quyết định", Admin mở tab "Tất cả"
 *   - `canApprove`: có hiện nút duyệt / từ chối không (quyền thật nằm ở BE)
 *   - `requireApproveReason`: Admin duyệt thay quản lý kho → bắt buộc ghi lý do
 */

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("vi-VN") : "—";
};

/** Chênh lệch tô màu: âm là thiếu, dương là thừa, 0 thì im lặng cho đỡ rối mắt. */
function DiffCell({ value, suffix = "" }) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) {
    return <Text type="secondary">—</Text>;
  }
  const isShort = number < 0;
  return (
    <Text strong style={{ color: isShort ? "#cf1322" : "#d46b08" }}>
      {number > 0 ? "+" : ""}
      {formatNumber(number)}
      {suffix}
    </Text>
  );
}

const stageOf = (row) => String(row?.approvalStage || "").toUpperCase();

/** "NCC: … · Mã đơn NCC: …" — để khớp kiện NCC giao với phiếu. */
const describeSupplier = (note) =>
  [
    note?.supplierName ? `NCC: ${note.supplierName}` : "",
    note?.supplierOrderCode ? `Mã đơn NCC: ${note.supplierOrderCode}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

const describeDomesticTracking = (note) =>
  note?.domesticTrackingCode
    ? `${note.domesticCarrier ? `${note.domesticCarrier} · ` : ""}${note.domesticTrackingCode}`
    : "";

/** Chữ trên nút / tiêu đề hộp quyết định theo giai đoạn. */
const approveLabelOf = (row) => (isDiscrepancyStage(stageOf(row)) ? "Chấp nhận số thực tế" : "Duyệt phiếu");

/** Hệ quả của nút duyệt, hiện trong hộp xác nhận. */
const APPROVE_CONSEQUENCE = {
  RECEIVE: "Duyệt nhận hàng: phiếu có PDF mã WRN-, khách nhận thông báo để mang hàng tới kho.",
  DISCREPANCY:
    "Chấp nhận số thực tế: biên bản lệch số lượng được chốt, kho xếp kiện lên kệ theo số đã kiểm đếm. Sale lập phiếu và khách nhận thông báo kèm các dòng lệch; phí tính theo số thực tế.",
  DISCREPANCY_ACK:
    "Chấp nhận số thực tế: phiếu đã tự chốt vì đủ số lượng (kiện xếp kệ được) nhưng cân lệch khai báo. Bấm để ghi nhận quyết định của bạn — Sale lập phiếu và khách nhận thông báo kèm các dòng lệch; phí tính theo số thực tế. Quyết một lần, không sửa lại được.",
};

/** Các dòng lệch khai báo ↔ thực tế, gom thành câu cho hộp xác nhận. */
function describeDifferences(items = []) {
  return items
    .filter(
      (row) =>
        Number(row?.quantityDifference) !== 0 ||
        (row?.weightDifference !== null &&
          row?.weightDifference !== undefined &&
          Number(row.weightDifference) !== 0),
    )
    .map((row) => {
      const parts = [];
      if (Number(row.quantityDifference) !== 0) {
        parts.push(`SL khai ${formatNumber(row.declaredQuantity)} → thực ${formatNumber(row.actualQuantity)}`);
      }
      if (row.weightDifference !== null && row.weightDifference !== undefined && Number(row.weightDifference) !== 0) {
        parts.push(`cân khai ${formatReviewKg(row.declaredWeight)} → thực ${formatReviewKg(row.actualWeight)}`);
      }
      return `${row.productName || "(không tên)"}: ${parts.join(", ")}`;
    });
}

/** Kiện thật kho đã cân đo lúc nhận (chỉ có sau kiểm đếm). */
const ACTUAL_PARCEL_COLUMNS = [
  {
    title: "Mã kiện",
    dataIndex: "packageCode",
    width: 170,
    render: (value) => <Text code>{value || "—"}</Text>,
  },
  {
    title: "Cân thực",
    dataIndex: "actualWeight",
    width: 110,
    align: "right",
    render: (value) => formatReviewKg(value),
  },
  {
    title: "D × R × C",
    key: "dimensions",
    width: 160,
    render: (_, row) => formatReviewDimensions(row?.length, row?.width, row?.height),
  },
  {
    title: "Thể tích",
    dataIndex: "volume",
    width: 120,
    align: "right",
    render: (value) => (value ? `${formatReviewNumber(value, 0)} cm³` : "—"),
  },
  {
    title: "Trạng thái",
    key: "status",
    render: (_, row) => textOr(row?.packageStatusText, getParcelStatusLabel(row?.packageStatus)),
  },
  { title: "Ô kệ", dataIndex: "binCode", width: 110, render: (value) => value || "Chưa xếp" },
];

/**
 * Toàn bộ thông tin một phiếu tiếp nhận, hiện trong hộp duyệt / từ chối.
 *
 * Người duyệt trước đây chỉ thấy một câu mô tả hệ quả, không thấy phiếu có gì — nhất là khi
 * bấm "Duyệt" thẳng từ dòng bảng. Giờ hộp nạp lại chi tiết phiếu (GET phiếu) + chi tiết đơn
 * gốc (hàng đủ kích thước, thùng / dịch vụ, báo giá, tiền đã cọc) rồi mới cho bấm.
 */
function ReceivingDecisionReview({ target, noteReview, orderReview, compareColumns }) {
  const note = { ...target, ...(noteReview.data || {}) };
  const stage = String(note.approvalStage || "").toUpperCase();
  const compareItems = Array.isArray(note.items) ? note.items : [];
  const parcels = Array.isArray(note.parcels) ? note.parcels : [];
  const expectedItems = Array.isArray(note.expectedItems) ? note.expectedItems : [];
  const differences = isDiscrepancyStage(stage) ? describeDifferences(compareItems) : [];

  return (
    <SubmitReview
      loading={noteReview.loading}
      loadingText="Đang tải đầy đủ thông tin phiếu…"
      error={noteReview.error}
      errorHint="Bên dưới chỉ còn thông tin trên dòng bảng — nên mở phiếu xem lại trước khi quyết định."
    >
      <ReviewFacts
        items={[
          { label: "Mã phiếu", value: <Text strong>{note.receivingNoteCode}</Text> },
          {
            label: "Đang chờ",
            value: getApprovalStageMeta(stage)?.label || textOr(note.statusText, getReceivingStatusMeta(note.status).label),
          },
          {
            label: isPurchaseReceivingNote(note) ? "Đơn mua hộ" : "Đơn ký gửi",
            value: <Text code>{note.consignmentCode || "—"}</Text>,
          },
          { label: "NCC", value: note.supplierName, hidden: !isPurchaseReceivingNote(note) },
          { label: "Mã đơn NCC", value: note.supplierOrderCode, hidden: !isPurchaseReceivingNote(note) },
          {
            label: "Vận đơn nội địa",
            value: describeDomesticTracking(note),
            hidden: !isPurchaseReceivingNote(note) || !note.domesticTrackingCode,
          },
          { label: "Tuyến", value: note.route },
          { label: "Khách hàng", value: note.customerName },
          { label: "Mã khách hàng", value: note.customerCode },
          { label: "SĐT khách", value: note.customerPhone },
          { label: "Kho tiếp nhận", value: note.warehouseName },
          {
            label: "Người lập phiếu",
            value: note.createdByName
              ? `${note.createdByName} · ${formatDateTime(note.createdAt)}`
              : formatDateTime(note.createdAt),
          },
          {
            label: "Người kiểm đếm",
            value: note.receivedByName
              ? `${note.receivedByName} · ${formatDateTime(note.receivedAt)}`
              : "Chưa kiểm đếm",
          },
          {
            label: "Đối chiếu",
            value: `${formatNumber(note.checkedItemCount)} / ${formatNumber(
              note.declaredItemCount,
            )} dòng đã cân đếm${note.hasDiscrepancy ? " · CÓ CHÊNH LỆCH" : ""}`,
            hidden: note.declaredItemCount === undefined,
          },
          {
            label: "Chốt nhận hàng",
            value: note.approvedByName
              ? `${note.approvedByName} · ${formatDateTime(note.approvedAt)}`
              : String(note.status || "").toUpperCase() === "APPROVED"
                ? `Hệ thống tự chốt · ${formatDateTime(note.approvedAt)} (chưa ai quyết định lệch)`
                : "",
          },
          { label: "Ghi chú duyệt", value: note.approvalNote, span: 2 },
          { label: "Ghi chú cho kho", value: note.warehouseNote, span: 2 },
        ]}
      />

      {differences.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 12 }}
          message={`${differences.length} dòng lệch khai báo — sẽ chốt theo số thực tế`}
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {differences.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          }
        />
      )}

      {compareItems.length > 0 && (
        <ReviewItemsTable
          title="Biên bản đối chiếu khai báo với thực tế"
          items={compareItems}
          columns={compareColumns}
          extra={note.hasDiscrepancy ? "Có dòng lệch — xem cột Lệch SL / Lệch KG" : "Khớp khai báo"}
          scrollX={900}
        />
      )}

      {parcels.length > 0 && (
        <ReviewItemsTable
          title="Kiện thật kho đã nhận"
          items={parcels}
          columns={ACTUAL_PARCEL_COLUMNS}
          rowKey={(row, index) => row?.parcelId || index}
          extra={`${parcels.length} kiện · ${formatReviewKg(
            parcels.reduce((sum, row) => sum + (Number(row?.actualWeight) || 0), 0),
          )}`}
        />
      )}

      {/* Hàng khai đủ kích thước + tiền lấy từ đơn gốc; lỗi thì lùi về danh sách hàng trên phiếu. */}
      <OrderReviewPanel
        review={orderReview}
        fallback={note}
        showFacts={false}
        errorHint={
          expectedItems.length ? "Bên dưới là hàng khai theo phiếu (không có kích thước)." : ""
        }
      />

      {orderReview.detailError && expectedItems.length > 0 && stage !== "DISCREPANCY" ? (
        <ReviewItemsTable title="Hàng khách khai (theo phiếu)" items={expectedItems} />
      ) : null}
    </SubmitReview>
  );
}

export default function ReceivingNotesWorkspace({
  title = "Phiếu tiếp nhận kho gốc",
  subtitle = "Sale lập phiếu sau khi khách đặt cọc. Quản lý kho duyệt để khách mang hàng tới, và xem biên bản khi kho kiểm đếm bị lệch.",
  eyebrow = "BỘ PHẬN VẬN HÀNH (OPS)",
  defaultStatus = AWAITING_TAB_KEY,
  canApprove = true,
  requireApproveReason = false,
}) {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusTab, setStatusTab] = useState(defaultStatus);
  const [summary, setSummary] = useState({ awaiting: 0, discrepancyAwaiting: 0, discrepancy: 0 });
  const [keyword, setKeyword] = useState("");
  const [orderType, setOrderType] = useState("");

  /*
   * Phân trang PHÍA SERVER cho các tab trạng thái thật (trước đây chỉ đọc trang đầu 200 phiếu —
   * trần pageSize backend — nên phiếu thứ 201 trở đi không bao giờ hiện). Tab "Cần quyết định"
   * là bộ lọc tại chỗ (backend không có status này) nên vẫn phân trang phía client.
   * Đổi tab / ô tìm / loại đơn → về trang 1 (khoá `filterKey`, không cần effect).
   */
  const isAwaitingTab = statusTab === AWAITING_TAB_KEY;
  const filterKey = `${statusTab}|${keyword.trim()}|${orderType}`;
  const [pageState, setPageState] = useState({ key: filterKey, pageNumber: 1, pageSize: 20 });
  const pageNumber = pageState.key === filterKey ? pageState.pageNumber : 1;
  const { pageSize } = pageState;

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const [approveTarget, setApproveTarget] = useState(null);
  const [approveReason, setApproveReason] = useState("");

  /* Hộp duyệt hoặc từ chối đang mở (mỗi lúc chỉ một) → nạp đủ phiếu + đơn gốc để hiện. */
  const decisionTarget = approveTarget || rejectTarget;
  const noteReview = useSubmitReviewData(decisionTarget?.id, () =>
    getReceivingNoteDetail(decisionTarget.id),
  );
  const orderReview = useOrderReview(decisionTarget?.consignmentOrderId, {
    enabled: Boolean(decisionTarget),
  });
  const decisionLoading = noteReview.loading || orderReview.loading;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      /* Số đếm đầu trang tính trên mọi phiếu, không theo tab — tab "Cần quyết định" rỗng không được kéo chip về 0. */
      const [result, counts] = await Promise.all([
        listReceivingNotes({
          status: statusTab,
          search: keyword.trim(),
          orderType,
          ...(isAwaitingTab ? {} : { pageNumber, pageSize }),
        }),
        getReceivingSummary({ search: keyword.trim() }).catch(() => null),
      ]);
      setRows(result.items);
      setTotalCount(result.totalCount);
      if (counts) setSummary(counts);
    } catch (error) {
      setErrorMessage(getReceivingApiError(error, "Không tải được danh sách phiếu tiếp nhận."));
    } finally {
      setLoading(false);
    }
  }, [statusTab, keyword, orderType, isAwaitingTab, pageNumber, pageSize]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);


  const openDetail = useCallback(async (row) => {
    setDetail({ ...row, items: [], expectedItems: [] });
    setDetailLoading(true);
    try {
      const full = await getReceivingNoteDetail(row.id);
      if (full) setDetail({ ...row, ...full });
    } catch (error) {
      AuthNotify.error(
        "Lỗi tải phiếu",
        getReceivingApiError(error, "Không tải được chi tiết phiếu tiếp nhận."),
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openApprove = useCallback((row) => {
    setApproveTarget(row);
    setApproveReason("");
  }, []);

  const handleApprove = useCallback(
    async () => {
      const row = approveTarget;
      if (!row) return;
      setSubmitting(true);
      try {
        const updated = await approveReceivingNote(row.id, approveReason);
        const isReceiveStage =
          stageOf(row) === "RECEIVE" || String(updated?.status || "").toUpperCase() === "ACTIVE";
        AuthNotify.success(
          isReceiveStage ? "Đã duyệt phiếu" : "Đã chấp nhận số thực tế",
          isReceiveStage
            ? `Phiếu ${row.receivingNoteCode} đã duyệt, khách nhận được PDF để mang hàng tới kho.`
            : stageOf(row) === "DISCREPANCY_ACK"
              ? `Đã ghi nhận quyết định lệch của phiếu ${row.receivingNoteCode}. Sale và khách đã được báo.`
              : `Đã chốt biên bản phiếu ${row.receivingNoteCode}. Kho xếp kiện lên kệ được rồi; Sale và khách đã được báo.`,
        );
        setApproveTarget(null);
        setApproveReason("");
        setDetail(null);
        await fetchRows();
      } catch (error) {
        AuthNotify.error(
          "Duyệt thất bại",
          getReceivingApiError(error, "Không duyệt được phiếu tiếp nhận."),
        );
        /* 409: người khác vừa quyết rồi — tải lại để phiếu rời hàng đợi. */
        if (error?.response?.status === 409) {
          setApproveTarget(null);
          setDetail(null);
          fetchRows();
        }
      } finally {
        setSubmitting(false);
      }
    },
    [approveTarget, approveReason, fetchRows],
  );

  const handleReject = useCallback(async () => {
    if (!rejectTarget) return;
    setSubmitting(true);
    try {
      await rejectReceivingNote(rejectTarget.id, rejectReason);
      AuthNotify.success(
        "Đã từ chối phiếu",
        `Phiếu ${rejectTarget.receivingNoteCode} bị từ chối, người liên quan đã nhận thông báo.`,
      );
      setRejectTarget(null);
      setRejectReason("");
      setDetail(null);
      await fetchRows();
    } catch (error) {
      AuthNotify.error(
        "Từ chối thất bại",
        getReceivingApiError(error, "Không từ chối được phiếu tiếp nhận."),
      );
    } finally {
      setSubmitting(false);
    }
  }, [rejectTarget, rejectReason, fetchRows]);

  const columns = useMemo(
    () => [
      {
        title: "Mã phiếu",
        dataIndex: "receivingNoteCode",
        width: 160,
        render: (value, row) => (
          <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(row)}>
            {value || "—"}
          </Button>
        ),
      },
      {
        title: "Đơn",
        dataIndex: "consignmentCode",
        width: 240,
        render: (value, row) => (
          <Space direction="vertical" size={2}>
            <Space size={6} wrap>
              <Text code>{value || "—"}</Text>
              <OrderTypeTag record={row} showCode={false} />
            </Space>
            {isPurchaseReceivingNote(row) && describeSupplier(row) ? (
              <Text style={{ fontSize: 12, color: "#531dab" }}>{describeSupplier(row)}</Text>
            ) : null}
            {isPurchaseReceivingNote(row) && row.domesticTrackingCode ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Vận đơn nội địa: {describeDomesticTracking(row)}
              </Text>
            ) : null}
          </Space>
        ),
      },
      {
        title: "Khách hàng",
        dataIndex: "customerName",
        render: (value, row) => (
          <div>
            <div>{value || "—"}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.customerPhone || ""}
            </Text>
          </div>
        ),
      },
      { title: "Kho tiếp nhận", dataIndex: "warehouseName", render: (v) => v || "—" },
      {
        title: "Đối chiếu",
        key: "checked",
        align: "center",
        width: 130,
        render: (_, row) => (
          <Tooltip title="Số dòng kho đã cân đếm / số dòng khách khai">
            <Text>
              {formatNumber(row.checkedItemCount)} / {formatNumber(row.declaredItemCount)}
            </Text>
          </Tooltip>
        ),
      },
      {
        title: "Kiện",
        dataIndex: "parcelCount",
        align: "center",
        width: 80,
        render: (v) => formatNumber(v),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 190,
        render: (value, row) => {
          const meta = getReceivingStatusMeta(value);
          return (
            <Space direction="vertical" size={2}>
              <Tag color={meta.tone}>{textOr(row.statusText, meta.label)}</Tag>
              {row.awaitingApproval && getApprovalStageMeta(row.approvalStage) ? (
                <Tag color={getApprovalStageMeta(row.approvalStage).color}>
                  Chờ: {getApprovalStageMeta(row.approvalStage).label}
                </Tag>
              ) : null}
              {row.hasDiscrepancy ? (
                <Tag color="error" icon={<WarningOutlined />}>
                  Có chênh lệch
                </Tag>
              ) : null}
            </Space>
          );
        },
      },
      { title: "Tạo lúc", dataIndex: "createdAt", width: 160, render: formatDateTime },
      ...(canApprove
        ? [
            {
              title: "Thao tác",
              key: "actions",
              width: 230,
              fixed: "right",
              render: (_, row) => {
                if (!row.awaitingApproval) {
                  return row.approvedByName ? (
                    <Text type="secondary">{row.approvedByName}</Text>
                  ) : (
                    <Text type="secondary">—</Text>
                  );
                }
                return (
                  <Space wrap>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => openApprove(row)}
                    >
                      {isDiscrepancyStage(stageOf(row)) ? "Chấp nhận số thực tế" : "Duyệt"}
                    </Button>
                    {canRejectAtStage(stageOf(row)) ? (
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
                    ) : null}
                  </Space>
                );
              },
            },
          ]
        : []),
    ],
    [openDetail, openApprove, canApprove],
  );

  const compareColumns = useMemo(
    () => [
      { title: "Tên hàng", dataIndex: "productName", render: (v) => v || "—" },
      { title: "Loại", dataIndex: "productType", width: 120, render: (v) => v || "—" },
      {
        title: "SL khai",
        dataIndex: "declaredQuantity",
        align: "right",
        width: 90,
        render: formatNumber,
      },
      {
        title: "SL thực",
        dataIndex: "actualQuantity",
        align: "right",
        width: 90,
        render: formatNumber,
      },
      {
        title: "Lệch SL",
        dataIndex: "quantityDifference",
        align: "right",
        width: 100,
        render: (value) => <DiffCell value={value} />,
      },
      {
        title: "KG khai",
        dataIndex: "declaredWeight",
        align: "right",
        width: 90,
        render: formatNumber,
      },
      {
        title: "KG thực",
        dataIndex: "actualWeight",
        align: "right",
        width: 90,
        render: formatNumber,
      },
      {
        title: "Lệch KG",
        dataIndex: "weightDifference",
        align: "right",
        width: 100,
        render: (value) => <DiffCell value={value} suffix=" kg" />,
      },
      { title: "Ghi chú kho", dataIndex: "note", render: (v) => v || "—" },
    ],
    [],
  );

  const detailStatusMeta = getReceivingStatusMeta(detail?.status);

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Chờ duyệt</small>
            <strong>{summary.awaiting} phiếu</strong>
          </div>
          <div className="ops-page__weight-chip">
            <small>Lệch chờ quyết định</small>
            <strong>{summary.discrepancyAwaiting} phiếu</strong>
          </div>
          <div className="ops-page__weight-chip">
            <small>Có chênh lệch</small>
            <strong>{summary.discrepancy} phiếu</strong>
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

      <Tabs
        activeKey={statusTab}
        onChange={setStatusTab}
        items={RECEIVING_STATUS_TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
      />

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Tìm mã phiếu, mã đơn, mã đơn NCC, tên hoặc SĐT khách"
          style={{ width: 380 }}
          onSearch={(value) => setKeyword(value)}
          onChange={(event) => {
            if (!event.target.value) setKeyword("");
          }}
        />
        <Segmented
          value={orderType}
          onChange={(value) => setOrderType(value)}
          options={RECEIVING_ORDER_TYPES.map((type) => ({ value: type.value, label: type.label }))}
        />
        <Text type="secondary">
          {totalCount ? `${formatNumber(totalCount)} phiếu` : ""}
        </Text>
      </Space>

      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1200 }}
        pagination={
          isAwaitingTab
            ? tablePagination({ unit: "phiếu" })
            : tablePagination({
                unit: "phiếu",
                current: pageNumber,
                pageSize,
                total: totalCount,
                onChange: (page, size) =>
                  setPageState({
                    key: filterKey,
                    pageNumber: size !== pageSize ? 1 : page,
                    pageSize: size,
                  }),
              })
        }
        locale={{
          emptyText: (
            <Empty
              description={
                statusTab === AWAITING_TAB_KEY
                  ? "Không có phiếu nào đang chờ quyết định."
                  : "Chưa có phiếu nào ở trạng thái này."
              }
            />
          ),
        }}
      />

      <Drawer
        open={!!detail}
        width={980}
        onClose={() => setDetail(null)}
        title={
          detail ? (
            <Space size={8}>
              <span>Phiếu {detail.receivingNoteCode}</span>
              <OrderTypeTag record={detail} showCode={false} />
            </Space>
          ) : (
            "Chi tiết phiếu tiếp nhận"
          )
        }
        extra={
          canApprove && detail?.awaitingApproval ? (
            <Space>
              {canRejectAtStage(stageOf(detail)) ? (
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
              ) : null}
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => openApprove(detail)}
              >
                {approveLabelOf(detail)}
              </Button>
            </Space>
          ) : null
        }
      >
        {detail ? (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={detailStatusMeta.tone}>{textOr(detail.statusText, detailStatusMeta.label)}</Tag>
              {detail.awaitingApproval && getApprovalStageMeta(detail.approvalStage) ? (
                <Tag color={getApprovalStageMeta(detail.approvalStage).color}>
                  Chờ: {getApprovalStageMeta(detail.approvalStage).label}
                </Tag>
              ) : null}
              {toPublicReceiptUrl(detail.receiptPdfUrl) ? (
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  href={toPublicReceiptUrl(detail.receiptPdfUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PDF phiếu nhập kho
                </Button>
              ) : null}
              {detail.hasDiscrepancy ? (
                <Tag color="error" icon={<WarningOutlined />}>
                  Số thực tế lệch khai báo
                </Tag>
              ) : null}
            </Space>

            {detail.awaitingApproval && stageOf(detail) === "DISCREPANCY_ACK" ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="Chờ quản lý kho quyết định lệch"
                description="Kho đếm đủ số lượng nên phiếu đã tự chốt và kiện xếp kệ được, nhưng cân thực tế lệch khai báo. Xem bảng đối chiếu bên dưới rồi bấm “Chấp nhận số thực tế”. Hàng hư hỏng / sai lệch cần xử lý thêm thì mở sự cố cho kiện."
              />
            ) : null}

            {isPurchaseReceivingNote(detail) ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12, background: "#f9f0ff", borderColor: "#d3adf7" }}
                message={`Hàng mua hộ — kho đối chiếu với đơn NCC ${detail.supplierOrderCode || "(chưa có mã)"}`}
                description="NCC giao hàng tới kho (không phải khách mang tới). Phiếu tự mở khi Sale đặt NCC, không qua bước duyệt nhận hàng."
              />
            ) : null}

            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label={isPurchaseReceivingNote(detail) ? "Đơn mua hộ (kho)" : "Đơn ký gửi"}>
                <Text code>{detail.consignmentCode || "—"}</Text>
              </Descriptions.Item>
              {isPurchaseReceivingNote(detail) ? (
                <>
                  <Descriptions.Item label="Yêu cầu mua hộ">
                    {detail.purchaseCode ? <Text code>{detail.purchaseCode}</Text> : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Đơn mua NCC">
                    {detail.purchaseOrderCode ? <Text code>{detail.purchaseOrderCode}</Text> : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="NCC">{detail.supplierName || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Mã đơn NCC">
                    {detail.supplierOrderCode ? <Text code copyable>{detail.supplierOrderCode}</Text> : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Vận đơn nội địa">
                    {describeDomesticTracking(detail) || "NCC chưa phát hàng"}
                  </Descriptions.Item>
                </>
              ) : null}
              <Descriptions.Item label="Tuyến">{getRouteLabel(detail.route, "—")}</Descriptions.Item>
              <Descriptions.Item label="Khách hàng">
                {detail.customerName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Điện thoại">
                {detail.customerPhone || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Kho tiếp nhận">
                {detail.warehouseName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Tạo lúc">
                {formatDateTime(detail.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label={isPurchaseReceivingNote(detail) ? "Sale đặt NCC" : "Người lập phiếu"}>
                {detail.createdByName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label={isPurchaseReceivingNote(detail) ? "Mở phiếu" : "Duyệt nhận hàng"}>
                {detail.receiveApprovedByName
                  ? `${detail.receiveApprovedByName} · ${formatDateTime(detail.receiveApprovedAt)}`
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Người kiểm đếm">
                {detail.receivedByName
                  ? `${detail.receivedByName} · ${formatDateTime(detail.receivedAt)}`
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Chốt nhận hàng">
                {detail.approvedByName
                  ? `${detail.approvedByName} · ${formatDateTime(detail.approvedAt)}`
                  : String(detail.status || "").toUpperCase() === "APPROVED"
                    ? `Hệ thống tự chốt · ${formatDateTime(detail.approvedAt)}`
                    : "—"}
              </Descriptions.Item>
              {detail.approvalNote ? (
                <Descriptions.Item label="Ghi chú duyệt" span={2}>
                  {detail.approvalNote}
                </Descriptions.Item>
              ) : null}
              {detail.rejectionReason ? (
                <Descriptions.Item label="Lý do từ chối" span={2}>
                  <Text type="danger">{detail.rejectionReason}</Text>
                </Descriptions.Item>
              ) : null}
              {detail.warehouseNote ? (
                <Descriptions.Item label="Ghi chú cho kho" span={2}>
                  {detail.warehouseNote}
                </Descriptions.Item>
              ) : null}
            </Descriptions>

            <Title level={5} style={{ marginTop: 20 }}>
              Đối chiếu khai báo với thực tế
            </Title>
            {detail.items?.length ? (
              <Table
                rowKey={(row) => row.id || row.productName}
                size="small"
                columns={compareColumns}
                dataSource={detail.items}
                pagination={false}
                loading={detailLoading}
                scroll={{ x: 900 }}
              />
            ) : (
              <Alert
                type="info"
                showIcon
                message="Kho chưa kiểm đếm"
                description="Biên bản đối chiếu chỉ có sau khi kho nhận hàng. Bên dưới là hàng khách khai trên đơn, kèm thùng gỗ và dịch vụ kho phải làm cho từng kiện."
              />
            )}

            <Title level={5} style={{ marginTop: 20 }}>
              {isPurchaseReceivingNote(detail) ? "Hàng đã đặt NCC" : "Hàng khách khai trên đơn"}
            </Title>
            <Table
              rowKey={(row) => row.orderItemId || row.productName}
              size="small"
              pagination={false}
              dataSource={detail.expectedItems || []}
              columns={[
                { title: "Tên hàng", dataIndex: "productName", render: (v) => v || "—" },
                { title: "Loại", dataIndex: "productType", render: (v) => v || "—" },
                {
                  title: "Số lượng",
                  dataIndex: "quantity",
                  align: "right",
                  width: 100,
                  render: formatNumber,
                },
                {
                  title: "Giá trị khai",
                  dataIndex: "declaredValue",
                  align: "right",
                  width: 140,
                  render: (value) =>
                    value ? `${formatNumber(value)} đ` : "—",
                },
                {
                  title: "Thùng gỗ",
                  key: "packageConfiguration",
                  width: 150,
                  render: (_, row) =>
                    row.packageConfiguration?.configName ||
                    row.packageConfiguration?.configCode ||
                    "—",
                },
                {
                  title: "Dịch vụ kèm kiện",
                  key: "services",
                  render: (_, row) =>
                    Array.isArray(row.services) && row.services.length ? (
                      <Space size={[4, 4]} wrap>
                        {row.services.map((service) => (
                          <Tag key={service.pricingRuleId || service.code}>
                            {service.name || service.code}
                          </Tag>
                        ))}
                      </Space>
                    ) : (
                      "—"
                    ),
                },
              ]}
              locale={{ emptyText: "Đơn không có dòng hàng khai báo." }}
            />
          </>
        ) : null}
      </Drawer>

      {/*
        Hộp duyệt hiện TOÀN BỘ phiếu (khách + mã khách, kho, người lập, hàng khai đủ kích thước,
        thùng / dịch vụ, biên bản lệch, kiện thật, báo giá, tiền đã cọc). Đang tải thì khoá nút
        duyệt. Tải lỗi không chặn cứng (quyền và điều kiện thật do server xét lại), nhưng hộp nói
        rõ phần nào đang thiếu để người duyệt tự quyết có mở phiếu xem trước hay không.
      */}
      <Modal
        {...REVIEW_MODAL_PROPS}
        open={!!approveTarget}
        title={`${approveLabelOf(approveTarget)} — phiếu ${approveTarget?.receivingNoteCode || ""}`}
        okText={decisionLoading ? "Đang tải thông tin…" : approveLabelOf(approveTarget)}
        okButtonProps={{
          loading: submitting,
          disabled: decisionLoading || (requireApproveReason && !approveReason.trim()),
        }}
        cancelText="Huỷ"
        onOk={handleApprove}
        onCancel={() => {
          setApproveTarget(null);
          setApproveReason("");
        }}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={APPROVE_CONSEQUENCE[stageOf(approveTarget)] || APPROVE_CONSEQUENCE.RECEIVE}
        />
        {approveTarget ? (
          <ReceivingDecisionReview
            target={approveTarget}
            noteReview={noteReview}
            orderReview={orderReview}
            compareColumns={compareColumns}
          />
        ) : null}
        <Input.TextArea
          rows={3}
          value={approveReason}
          onChange={(event) => setApproveReason(event.target.value)}
          placeholder={
            requireApproveReason
              ? "Bắt buộc khi Admin duyệt thay quản lý kho. Ví dụ: quản lý kho nghỉ phép, đã xác nhận qua điện thoại."
              : isDiscrepancyStage(stageOf(approveTarget))
                ? "Ghi chú quyết định (không bắt buộc, lưu vào phiếu). Ví dụ: đã gọi khách xác nhận cân thực tế."
                : "Ghi chú (không bắt buộc). Ví dụ: đã hẹn khách sáng thứ 6."
          }
        />
      </Modal>

      <Modal
        {...REVIEW_MODAL_PROPS}
        open={!!rejectTarget}
        title={`Từ chối phiếu ${rejectTarget?.receivingNoteCode || ""}`}
        okText={decisionLoading ? "Đang tải thông tin…" : "Từ chối phiếu"}
        okButtonProps={{
          danger: true,
          loading: submitting,
          disabled: decisionLoading || !rejectReason.trim(),
        }}
        cancelText="Huỷ"
        onOk={handleReject}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
      >
        <Alert
          type="warning"
          showIcon
          icon={<FileTextOutlined />}
          style={{ marginBottom: 12 }}
          message={
            stageOf(rejectTarget) === "DISCREPANCY"
              ? "Kho nhận thông báo kèm lý do; kiện của phiếu sẽ không được xếp kệ."
              : "Người lập phiếu nhận thông báo kèm lý do và lập lại phiếu khác."
          }
        />
        {rejectTarget ? (
          <ReceivingDecisionReview
            target={rejectTarget}
            noteReview={noteReview}
            orderReview={orderReview}
            compareColumns={compareColumns}
          />
        ) : null}
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder="Ví dụ: thiếu 2 thùng so với khai báo, cần cân đếm lại trước khi nhập kho."
        />
      </Modal>
    </div>
  );
}
