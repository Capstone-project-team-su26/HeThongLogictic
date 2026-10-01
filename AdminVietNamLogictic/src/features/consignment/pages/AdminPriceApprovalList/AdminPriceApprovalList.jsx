/**
 * DUYỆT GIÁ NGOẠI LỆ (Admin) — /admin/price-approvals
 *
 * Khi Sale báo giá với khoản khác bảng giá, backend đặt báo giá ở trạng thái
 * `PENDING_PRICE_APPROVAL`: khách CHƯA nhìn thấy, phải chờ Admin quyết.
 *
 * ⚠ BACKEND CHƯA CÓ ENDPOINT LIỆT KÊ báo giá chờ duyệt giá. Màn này DỰNG LẠI hàng
 * đợi ở phía giao diện: liệt kê các đơn ký gửi gần đây ở những trạng thái còn có
 * thể treo báo giá, rồi đọc báo giá của từng đơn và giữ lại bản đang chờ duyệt.
 * Hệ quả (được nói thẳng trên giao diện):
 *   - chỉ phủ vài trang đầu mỗi trạng thái, đơn rất cũ có thể lọt;
 *   - mỗi lần mở màn gọi nhiều request nhỏ (giới hạn 5 request chạy song song).
 *
 * Admin KHÔNG tự duyệt báo giá do chính mình lập — backend trả 403, câu lỗi
 * hiển thị nguyên cho người dùng.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Empty, Input, Modal, Skeleton, Table, Tag } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

import { getConsignmentsApi } from "@features/consignment/api/consignmentService";
import {
  PRICE_APPROVAL_DECISION,
  decideQuotationPriceApprovalApi,
  getPendingPriceApprovalQueueApi,
  groupFeesByOrderItem,
} from "@features/consignment/api/quotationService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import { tablePagination } from "@shared/utils/tablePagination";
import {
  ReviewFacts,
  ReviewItemsTable,
  ReviewMoney,
} from "@shared/components/SubmitReview/SubmitReview";
import { REVIEW_MODAL_PROPS } from "@shared/components/SubmitReview/submitReviewFormat";
import { ADMIN } from "@app/router/paths";
/* Cùng feature nên đi đường nội bộ (barrel chỉ dành cho feature khác gọi vào). */
import OrderReviewPanel from "@features/consignment/components/OrderReviewPanel/OrderReviewPanel";
import useOrderReview from "@features/consignment/hooks/useOrderReview";

import "./AdminPriceApprovalList.css";
import { getRouteLabel } from "@shared/utils/statusLabel";

const formatCurrency = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(number);
};

/** Mọi dòng phí của báo giá — phí theo kiện và phí cả đơn — để Admin thấy mình đang duyệt gì. */
const FEE_COLUMNS = [
  {
    title: "Áp cho",
    key: "scope",
    width: 170,
    render: (_value, fee) =>
      fee.orderItemId ? fee.itemName || "Một kiện" : <Tag>Cả đơn</Tag>,
  },
  { title: "Khoản phí", dataIndex: "label", render: (value) => value || "—" },
  {
    title: "Cách tính",
    key: "calc",
    width: 190,
    render: (_value, fee) =>
      fee.unitPrice !== undefined && fee.unitPrice !== null
        ? `${formatCurrency(fee.unitPrice)}${fee.quantity ? ` × ${fee.quantity}${fee.unitNoun ? ` ${fee.unitNoun}` : ""}` : ""}`
        : fee.calculationType || "—",
  },
  {
    title: "Thành tiền",
    dataIndex: "amount",
    width: 140,
    align: "right",
    render: (value) => <strong>{formatCurrency(value)}</strong>,
  },
  { title: "Ghi chú", dataIndex: "note", width: 200, render: (value) => value || "—" },
];

const formatDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function AdminPriceApprovalList() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    scannedOrders: 0,
    failedOrders: 0,
    truncated: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [decisionRow, setDecisionRow] = useState(null);
  const [decision, setDecision] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitLockRef = useRef(false);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await getPendingPriceApprovalQueueApi({
        fetchOrders: getConsignmentsApi,
      });

      setRows(result.rows);
      setSummary({
        scannedOrders: result.scannedOrders,
        failedOrders: result.failedOrders,
        truncated: result.truncated,
      });
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        requestError?.message ||
        "Không tải được danh sách báo giá chờ duyệt giá.";

      setError(message);
      AuthNotify.error("Tải hàng đợi thất bại", message);
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * Hoãn một nhịp trước khi gọi: loadQueue setState ngay trong thân effect sẽ
   * kích hoạt chuỗi render thừa (react-hooks/set-state-in-effect). Cùng cách mà
   * màn lập báo giá đang dùng.
   */
  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      loadQueue();
    }, 0);

    return () => globalThis.clearTimeout(timer);
  }, [loadQueue]);

  const openDecision = useCallback(
    (row, nextDecision) => {
      if (submitting || submitLockRef.current) return;

      setDecisionRow(row);
      setDecision(nextDecision);
      setNote("");
    },
    [submitting],
  );

  const closeDecision = () => {
    if (submitting || submitLockRef.current) return;

    setDecisionRow(null);
    setDecision("");
    setNote("");
  };

  const rejecting = decision === PRICE_APPROVAL_DECISION.REJECTED;

  /*
   * Hộp duyệt trước đây chỉ có mã đơn, tổng tiền và lý do — Admin duyệt một con số mà không
   * thấy nó gồm những khoản nào, cho hàng gì. Giờ hộp hiện đủ tách chi phí, từng dòng phí
   * (theo kiện / cả đơn), cân tính cước, và hàng của đơn (nạp từ chi tiết đơn).
   */
  const orderReview = useOrderReview(decisionRow?.order?.orderId, { withPayments: false });

  const handleSubmitDecision = async () => {
    if (!decisionRow || submitting || submitLockRef.current) return;

    /* Từ chối bắt buộc có lý do — backend cũng chặn, chặn trước cho đỡ mất một vòng. */
    if (rejecting && note.trim().length < 3) {
      AuthNotify.warning(
        "Thiếu lý do từ chối",
        "Vui lòng ghi lý do từ chối ít nhất 3 ký tự để Sale biết phải sửa gì.",
      );
      return;
    }

    try {
      submitLockRef.current = true;
      setSubmitting(true);

      const result = await decideQuotationPriceApprovalApi(
        decisionRow.quotation.quotationId,
        { decision, note: note.trim() },
      );

      AuthNotify.success(
        rejecting ? "Đã từ chối giá ngoại lệ" : "Đã duyệt giá ngoại lệ",
        result?.message ||
          (rejecting
            ? "Sale cần lập báo giá khác."
            : "Báo giá đã được gửi tới khách hàng."),
      );

      setDecisionRow(null);
      setDecision("");
      setNote("");

      await loadQueue();
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        requestError?.message ||
        "Không thực hiện được quyết định duyệt giá.";

      AuthNotify.error("Duyệt giá thất bại", message);
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const columns = useMemo(
    () => [
      {
        title: "Đơn ký gửi",
        key: "order",
        render: (_value, row) => (
          <div className="price-approval-order">
            <Link to={ADMIN.consignmentDetail(row.order?.orderId)}>
              <strong>{row.order?.consignmentCode || "—"}</strong>
            </Link>
            <small>{row.order?.customerName || "Khách hàng"}</small>
            <small>{getRouteLabel(row.order?.route, "—")}</small>
          </div>
        ),
      },
      {
        title: "Tổng báo giá",
        key: "total",
        align: "right",
        render: (_value, row) => (
          <div className="price-approval-total">
            <strong>
              {formatCurrency(row.quotation?.totalEstimatedCost)}
            </strong>
            <small>
              Cước {formatCurrency(row.quotation?.estimatedFreightCharge)} · Dịch
              vụ {formatCurrency(row.quotation?.serviceFee)} · Thuế{" "}
              {formatCurrency(row.quotation?.taxAndDuty)}
            </small>
          </div>
        ),
      },
      {
        title: "Khoản ngoài bảng giá + lý do",
        key: "override",
        render: (_value, row) => (
          <div className="price-approval-override">
            <p>{row.quotation?.overrideReason || "Không ghi lý do"}</p>

            {row.quotation?.salesNote ? (
              <small>Ghi chú Sale: {row.quotation.salesNote}</small>
            ) : null}

            <small>Lập lúc {formatDateTime(row.quotation?.createdAt)}</small>
          </div>
        ),
      },
      {
        title: "Phí theo kiện",
        key: "fees",
        render: (_value, row) => {
          const groups = groupFeesByOrderItem(row.quotation?.additionalFees);

          if (groups.length === 0) {
            return <span className="price-approval-empty">Không có</span>;
          }

          return (
            <div className="price-approval-fees">
              {groups.map((group) => (
                <div key={group.orderItemId}>
                  <strong>{group.itemName || "Kiện hàng"}</strong>
                  {group.fees.map((fee) => (
                    <span key={fee.id || `${group.orderItemId}-${fee.code}`}>
                      {fee.label}: {formatCurrency(fee.amount)}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          );
        },
      },
      {
        title: "Quyết định",
        key: "actions",
        align: "right",
        render: (_value, row) => (
          <div className="price-approval-actions">
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={submitting}
              onClick={() =>
                openDecision(row, PRICE_APPROVAL_DECISION.APPROVED)
              }
            >
              Duyệt
            </Button>

            <Button
              danger
              icon={<CloseCircleOutlined />}
              disabled={submitting}
              onClick={() =>
                openDecision(row, PRICE_APPROVAL_DECISION.REJECTED)
              }
            >
              Từ chối
            </Button>
          </div>
        ),
      },
    ],
    [submitting, openDecision],
  );

  return (
    <main className="price-approval-page">
      <header className="price-approval-header">
        <div>
          <h1>Duyệt giá ngoại lệ</h1>
          <p>
            Báo giá có khoản khác bảng giá đang chờ bạn quyết. Khách hàng chưa
            nhìn thấy những báo giá này.
          </p>
        </div>

        <Button
          icon={<ReloadOutlined />}
          onClick={loadQueue}
          loading={loading}
        >
          Tải lại
        </Button>
      </header>

      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="Danh sách này được dựng lại từ danh sách đơn"
        description={
          <>
            Hệ thống chưa có API liệt kê báo giá chờ duyệt giá. Màn này quét các
            đơn ký gửi gần đây (chờ duyệt, cần bổ sung thông tin, đã gửi báo giá,
            khách từ chối báo giá, đã duyệt) rồi đọc báo giá của từng đơn, nên chỉ
            phủ vài trang đầu mỗi trạng thái — đơn rất cũ có thể không hiện ra.
            {summary.scannedOrders > 0
              ? ` Lần tải gần nhất đã quét ${summary.scannedOrders} đơn.`
              : ""}
            {summary.failedOrders > 0
              ? ` ${summary.failedOrders} đơn không đọc được báo giá.`
              : ""}
            {summary.truncated
              ? " Còn đơn chưa quét tới vì vượt giới hạn số trang."
              : ""}
          </>
        }
        className="price-approval-notice"
      />

      {error ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được hàng đợi"
          description={error}
          className="price-approval-notice"
        />
      ) : null}

      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : rows.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Không có báo giá nào đang chờ duyệt giá."
        />
      ) : (
        <Table
          rowKey={(row) => row.quotation?.quotationId}
          dataSource={rows}
          columns={columns}
          pagination={tablePagination({ unit: "báo giá", defaultPageSize: 10 })}
          className="price-approval-table"
        />
      )}

      {/*
        Đang tải hàng của đơn thì khoá nút. Tải lỗi không chặn: phần quyết định (các khoản tiền
        và lý do) đã có đủ từ báo giá, hàng của đơn chỉ là căn cứ tham khảo.
      */}
      <Modal
        {...REVIEW_MODAL_PROPS}
        open={Boolean(decisionRow)}
        title={`${rejecting ? "Từ chối giá ngoại lệ" : "Duyệt giá ngoại lệ"} · ${
          decisionRow?.order?.consignmentCode || ""
        }`}
        okText={
          orderReview.loading
            ? "Đang tải thông tin…"
            : rejecting
              ? "Xác nhận từ chối"
              : "Xác nhận duyệt"
        }
        cancelText="Quay lại"
        okButtonProps={{
          danger: rejecting,
          loading: submitting,
          disabled:
            submitting || orderReview.loading || (rejecting && note.trim().length < 3),
        }}
        cancelButtonProps={{ disabled: submitting }}
        onOk={handleSubmitDecision}
        onCancel={closeDecision}
        destroyOnHidden
      >
        <div className="price-approval-modal">
          <div className="price-approval-modal__order">
            <span>Đơn</span>
            <strong>
              {decisionRow?.order?.consignmentCode || "—"}
            </strong>
          </div>

          <div className="price-approval-modal__order">
            <span>Tổng báo giá</span>
            <strong>
              {formatCurrency(
                decisionRow?.quotation?.totalEstimatedCost,
              )}
            </strong>
          </div>

          <p className="price-approval-modal__reason">
            {decisionRow?.quotation?.overrideReason || "Không ghi lý do"}
          </p>

          {decisionRow ? (
            <>
              <ReviewFacts
                items={[
                  { label: "Khách hàng", value: decisionRow.order?.customerName },
                  { label: "Tuyến", value: decisionRow.order?.route },
                  {
                    label: "Báo giá lập lúc",
                    value: formatDateTime(decisionRow.quotation?.createdAt),
                  },
                  {
                    label: "Hết hạn",
                    value: formatDateTime(decisionRow.quotation?.expiredAt),
                  },
                  {
                    label: "Cân tính cước",
                    value: `${decisionRow.quotation?.chargeableWeight ?? "—"} kg (thực ${
                      decisionRow.quotation?.totalWeight ?? "—"
                    } kg · quy đổi ${decisionRow.quotation?.volumetricWeight ?? "—"} kg)`,
                  },
                  { label: "Loại báo giá", value: decisionRow.quotation?.quoteType },
                  {
                    label: "Ghi chú Sale",
                    value: decisionRow.quotation?.salesNote,
                    span: 2,
                  },
                ]}
              />

              <ReviewMoney
                title="Tách chi phí báo giá"
                lines={[
                  { label: "Cước vận chuyển", value: decisionRow.quotation?.estimatedFreightCharge },
                  { label: "Phí vận chuyển nội địa", value: decisionRow.quotation?.domesticShippingFee },
                  { label: "Phí dịch vụ", value: decisionRow.quotation?.serviceFee },
                  { label: "VAT", value: decisionRow.quotation?.vat },
                  { label: "Thuế nhập khẩu", value: decisionRow.quotation?.importTax },
                  { label: "Thuế & phí (gộp)", value: decisionRow.quotation?.taxAndDuty },
                  {
                    label: "Tổng báo giá khách sẽ thấy",
                    value: decisionRow.quotation?.totalEstimatedCost,
                    strong: true,
                  },
                ]}
              />

              <ReviewItemsTable
                title="Các dòng phí của báo giá"
                items={decisionRow.quotation?.additionalFees || []}
                columns={FEE_COLUMNS}
                rowKey={(fee, index) => fee?.id || `${fee?.orderItemId}-${fee?.code}-${index}`}
                extra={`${(decisionRow.quotation?.additionalFees || []).length} dòng`}
                emptyText="Báo giá không có dòng phí phụ."
              />

              <OrderReviewPanel
                review={orderReview}
                fallback={decisionRow.order}
                showMoney={false}
                errorHint="Bạn vẫn quyết định được; các khoản tiền phía trên lấy từ chính báo giá."
              />
            </>
          ) : null}

          <label htmlFor="price-approval-note">
            {rejecting ? "Lý do từ chối" : "Ghi chú (tuỳ chọn)"}
            {rejecting ? <b>*</b> : null}
          </label>

          <Input.TextArea
            id="price-approval-note"
            rows={4}
            maxLength={500}
            showCount
            value={note}
            disabled={submitting}
            placeholder={
              rejecting
                ? "Ví dụ: mức giảm vượt thẩm quyền, đề nghị báo lại theo bảng giá"
                : "Ví dụ: đồng ý giảm giá cho khách quen"
            }
            onChange={(event) => setNote(event.target.value)}
          />

          <Tag className="price-approval-modal__hint">
            {rejecting
              ? "Từ chối xong, Sale phải lập báo giá khác."
              : "Duyệt xong, báo giá được gửi ngay cho khách hàng."}
          </Tag>
        </div>
      </Modal>
    </main>
  );
}
