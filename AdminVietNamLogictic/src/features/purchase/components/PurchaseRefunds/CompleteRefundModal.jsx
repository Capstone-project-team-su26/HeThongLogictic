/**
 * Hộp "ĐÃ CHUYỂN TIỀN HOÀN" cho MỘT khoản hoàn.
 *
 * Vì sao hiện đủ khoản (loại, từng dòng, công thức, số tiền) chứ không chỉ ô mã giao dịch: một đơn /
 * yêu cầu có thể có nhiều khoản chờ cùng lúc (chênh giá + NCC giao thiếu + huỷ). Người bấm phải thấy
 * mình đang đóng ĐÚNG khoản nào, số bao nhiêu. Màn cha gửi kèm `refundId` + `amount` của khoản này —
 * backend đối chiếu số tiền, lệch là từ chối.
 *
 * Tách là component có state riêng (thay vì Modal.confirm + biến đóng gói) để nút gửi khoá được khi
 * chưa nhập mã giao dịch. Màn cha đặt `key={refund.refundId}` để mỗi lần mở là một ô trống mới.
 */

import { useState } from "react";
import { Alert, Input, Modal, Typography } from "antd";

import SubmitReview from "@shared/components/SubmitReview/SubmitReview";
import {
  REVIEW_MODAL_PROPS,
  formatReviewMoney,
} from "@shared/components/SubmitReview/submitReviewFormat";

import { RefundDetail } from "./PurchaseRefundViews";

const { Text } = Typography;

export default function CompleteRefundModal({
  open,
  refund,
  contextLabel = "",
  submitting = false,
  onCancel,
  onSubmit,
}) {
  const [transactionCode, setTransactionCode] = useState("");
  const code = transactionCode.trim();

  return (
    <Modal
      {...REVIEW_MODAL_PROPS}
      open={Boolean(open && refund)}
      title={`Xác nhận đã chuyển tiền hoàn${contextLabel ? ` — ${contextLabel}` : ""}`}
      okText={`Đã chuyển ${refund ? formatReviewMoney(refund.amount) : ""}`}
      cancelText="Đóng"
      confirmLoading={submitting}
      okButtonProps={{ disabled: !code }}
      onOk={() => onSubmit?.({ transactionCode: code, amount: refund?.amount, refundId: refund?.refundId })}
      onCancel={onCancel}
      destroyOnHidden
    >
      {refund ? (
        <SubmitReview>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={`Chuyển trả khách đúng ${formatReviewMoney(refund.amount)} rồi mới bấm.`}
            description="Hệ thống gửi kèm mã khoản và số tiền này để đối chiếu — số không khớp khoản sẽ bị từ chối. Bấm xong khoản chuyển sang Đã chuyển trả và khách nhận thông báo; không hoàn lại lần hai được."
          />

          <RefundDetail refund={refund} />

          <div style={{ marginTop: 12 }}>
            <Text strong>Mã giao dịch chuyển khoản</Text>
            <Input
              autoFocus
              style={{ marginTop: 6 }}
              placeholder="Mã giao dịch ngân hàng (bắt buộc)"
              value={transactionCode}
              onChange={(event) => setTransactionCode(event.target.value)}
              onPressEnter={() => {
                if (code && !submitting) {
                  onSubmit?.({ transactionCode: code, amount: refund.amount, refundId: refund.refundId });
                }
              }}
            />
          </div>
        </SubmitReview>
      ) : null}
    </Modal>
  );
}
