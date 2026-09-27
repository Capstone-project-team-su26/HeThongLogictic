/**
 * CÁC KHOẢN HOÀN CỦA MỘT ĐƠN MUA NCC — mở từ màn "Đơn mua nhà cung cấp".
 *
 * Trước đây màn chỉ biết MỘT khoản (`refundAmount` / `refundStatus` — khoản mới nhất) nên nút
 * "Hoàn tiền" đóng mù: đơn có cả khoản chênh giá lẫn khoản NCC giao thiếu thì backend mới trả 400
 * "phải chỉ rõ refundId". Hộp này liệt kê MỌI khoản của đơn (`order.refunds[]`), mở từng khoản xem
 * dòng + công thức, và nút "Đã chuyển tiền hoàn" của từng khoản gửi đúng `refundId` + `amount` + mã
 * giao dịch lên POST /api/purchase-orders/{id}/refund/complete.
 *
 * Sổ tiền (đã thu / đã hoàn / chờ hoàn / còn có thể hoàn) là của CẢ YÊU CẦU, nạp riêng và chỉ đọc —
 * lỗi ở đó không chặn việc đóng khoản.
 */

import { useState } from "react";
import { Alert, Button, Modal, Space, Typography } from "antd";

import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import SubmitReview from "@shared/components/SubmitReview/SubmitReview";
import useSubmitReviewData from "@shared/components/SubmitReview/useSubmitReviewData";
import {
  REVIEW_MODAL_PROPS,
  formatReviewMoney,
} from "@shared/components/SubmitReview/submitReviewFormat";
import {
  completePurchaseRefund,
  getPendingRefunds,
  getPurchaseOrderApiError,
  getPurchaseRequestRefunds,
} from "@features/purchase/api/purchaseOrderService";

import CompleteRefundModal from "./CompleteRefundModal";
import { RefundSummaryMoney, RefundsTable } from "./PurchaseRefundViews";

const { Text } = Typography;

export default function OrderRefundsModal({
  open,
  order,
  canComplete = false,
  canCloseShortage = false,
  onClose,
  onChanged,
  onCloseShortage,
}) {
  const [target, setTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [reloadSeq, setReloadSeq] = useState(0);

  const summary = useSubmitReviewData(
    open && order?.purchaseRequestId ? `${order.purchaseRequestId}:${reloadSeq}` : "",
    () => getPurchaseRequestRefunds(order.purchaseRequestId)
  );

  const refunds = Array.isArray(order?.refunds) ? order.refunds : [];
  const pending = getPendingRefunds(order);

  const submitComplete = async ({ transactionCode, amount, refundId }) => {
    setSubmitting(true);
    try {
      await completePurchaseRefund(order.purchaseOrderId, { transactionCode, amount, refundId });
      AuthNotify.success("Đã ghi nhận hoàn tiền", `Đã chuyển trả ${formatReviewMoney(amount)}.`);
      setTarget(null);
      setReloadSeq((value) => value + 1);
      /* Màn cha tải lại bảng → `order` mới (khoản vừa đóng thành Đã chuyển trả) chảy xuống đây. */
      onChanged?.();
    } catch (error) {
      AuthNotify.error("Không ghi nhận được", getPurchaseOrderApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        {...REVIEW_MODAL_PROPS}
        open={Boolean(open && order)}
        title={`Khoản hoàn của đơn mua ${order?.purchaseOrderCode || ""}`}
        onCancel={onClose}
        footer={[
          canCloseShortage ? (
            <Button key="short" onClick={() => onCloseShortage?.(order)}>
              Ghi NCC giao thiếu / đóng phần không mua được
            </Button>
          ) : null,
          <Button key="close" type="primary" onClick={onClose}>
            Đóng
          </Button>,
        ].filter(Boolean)}
      >
        {order ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Text type="secondary">
              {order.purchaseCode} · {order.customerName || "—"} · tổng hoàn liên quan đơn này{" "}
              <Text strong>{formatReviewMoney(order.totalRefundAmount)}</Text>
              {pending.length ? ` · ${pending.length} khoản đang chờ chuyển` : ""}
            </Text>

            <RefundsTable
              refunds={refunds}
              canComplete={canComplete}
              busyRefundId={submitting ? target?.refundId : ""}
              onComplete={(refund) => setTarget(refund)}
              emptyText="Đơn này chưa có khoản hoàn nào."
            />

            <SubmitReview
              loading={summary.loading}
              loadingText="Đang tải sổ tiền của cả yêu cầu…"
              error={summary.error}
              errorTitle="Chưa tải được sổ tiền của yêu cầu"
              errorHint="Vẫn đóng được từng khoản ở bảng trên."
            >
              {summary.data ? (
                <RefundSummaryMoney
                  summary={summary.data}
                  title={`Sổ tiền của cả yêu cầu ${order.purchaseCode || ""}`}
                />
              ) : null}
            </SubmitReview>

            {refunds.length > 0 && summary.data && summary.data.refunds.length > refunds.length ? (
              <Alert
                type="info"
                showIcon
                message="Yêu cầu còn khoản hoàn không gắn đơn mua này (ví dụ phần không mua được)."
                description="Xem và đóng các khoản đó ở màn chi tiết yêu cầu mua hộ, mục Hoàn tiền mua hộ."
              />
            ) : null}
          </Space>
        ) : null}
      </Modal>

      <CompleteRefundModal
        key={target?.refundId || "none"}
        open={Boolean(target)}
        refund={target}
        contextLabel={[order?.purchaseOrderCode, order?.purchaseCode].filter(Boolean).join(" · ")}
        submitting={submitting}
        onCancel={() => setTarget(null)}
        onSubmit={submitComplete}
      />
    </>
  );
}
