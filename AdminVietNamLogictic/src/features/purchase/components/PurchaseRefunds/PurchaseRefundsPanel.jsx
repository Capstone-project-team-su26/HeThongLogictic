/**
 * SỔ HOÀN TIỀN của một yêu cầu mua hộ — cho Sale / Admin.
 *
 * GET /api/purchase-requests/{id}/refunds → tổng đã thu / đã hoàn / chờ hoàn / còn có thể hoàn và
 * MỌI khoản hoàn (không chỉ khoản mới nhất như cặp trường `refundAmount` cũ của đơn mua). Mỗi khoản
 * chờ có nút "Đã chuyển tiền hoàn" gọi endpoint của YÊU CẦU (đóng được cả khoản "không mua được"
 * không gắn đơn mua nào), gửi đúng `refundId` trên URL + `amount` + mã giao dịch.
 *
 * Backend mới chỉ có trên env test: production trả 404 → khối nói rõ "máy chủ chưa hỗ trợ" thay vì
 * báo lỗi đỏ, để màn chi tiết vẫn dùng bình thường.
 */

import { useEffect, useState } from "react";
import { Alert, Button, Space, Spin, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import {
  completePurchaseRequestRefund,
  getPurchaseOrderApiError,
  getPurchaseRequestRefunds,
} from "@features/purchase/api/purchaseOrderService";

import CompleteRefundModal from "./CompleteRefundModal";
import { RefundSummaryMoney, RefundsTable } from "./PurchaseRefundViews";

const { Text } = Typography;

export default function PurchaseRefundsPanel({
  purchaseRequestId,
  purchaseCode = "",
  canComplete = false,
  reloadKey = 0,
  extra = null,
  onChanged,
}) {
  const [state, setState] = useState({ key: "", summary: null, error: "", unsupported: false });
  const [localReload, setLocalReload] = useState(0);
  const [target, setTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadKey = `${purchaseRequestId || ""}:${reloadKey}:${localReload}`;

  /* Chỉ đặt state trong callback của promise (luật react-hooks/set-state-in-effect). */
  useEffect(() => {
    if (!purchaseRequestId) return undefined;

    let alive = true;

    getPurchaseRequestRefunds(purchaseRequestId).then(
      (summary) => {
        if (alive) setState({ key: loadKey, summary, error: "", unsupported: false });
      },
      (error) => {
        if (!alive) return;
        const unsupported = error?.response?.status === 404 || error?.response?.status === 405;
        setState({
          key: loadKey,
          summary: null,
          unsupported,
          error: unsupported ? "" : getPurchaseOrderApiError(error, "Không tải được sổ hoàn tiền."),
        });
      }
    );

    return () => {
      alive = false;
    };
  }, [purchaseRequestId, loadKey]);

  const loading = Boolean(purchaseRequestId) && state.key !== loadKey;
  const summary = state.summary;

  const submitComplete = async ({ transactionCode, amount }) => {
    if (!target) return;
    setSubmitting(true);

    try {
      await completePurchaseRequestRefund(purchaseRequestId, target.refundId, {
        transactionCode,
        amount,
      });
      AuthNotify.success("Đã ghi nhận", "Khoản hoàn đã chuyển trả khách, khách nhận được thông báo.");
      setTarget(null);
      setLocalReload((value) => value + 1);
      onChanged?.();
    } catch (error) {
      AuthNotify.error("Không ghi nhận được", getPurchaseOrderApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Space size={[8, 8]} wrap style={{ justifyContent: "space-between", width: "100%" }}>
        <Text type="secondary">
          Mọi khoản trả lại khách của yêu cầu: chênh giá, phần không mua được, NCC giao thiếu, huỷ
          đơn. Mở từng khoản để xem từng dòng và công thức.
        </Text>
        <Space size={8} wrap>
          {extra}
          <Button icon={<ReloadOutlined />} onClick={() => setLocalReload((value) => value + 1)}>
            Tải lại
          </Button>
        </Space>
      </Space>

      <Spin spinning={loading}>
        {state.unsupported ? (
          <Alert
            type="info"
            showIcon
            message="Máy chủ đang chạy chưa có sổ hoàn tiền mua hộ"
            description="Tính năng này cần bản backend mới (hiện chỉ có trên môi trường test)."
          />
        ) : null}

        {state.error ? <Alert type="error" showIcon message={state.error} /> : null}

        {summary ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <RefundSummaryMoney summary={summary} />
            <RefundsTable
              refunds={summary.refunds}
              canComplete={canComplete}
              busyRefundId={submitting ? target?.refundId : ""}
              onComplete={(refund) => setTarget(refund)}
              emptyText="Yêu cầu này chưa có khoản hoàn nào."
            />
          </div>
        ) : null}
      </Spin>

      <CompleteRefundModal
        key={target?.refundId || "none"}
        open={Boolean(target)}
        refund={target}
        contextLabel={[purchaseCode || summary?.purchaseCode, target?.purchaseOrderCode].filter(Boolean).join(" · ")}
        submitting={submitting}
        onCancel={() => setTarget(null)}
        onSubmit={submitComplete}
      />
    </div>
  );
}
