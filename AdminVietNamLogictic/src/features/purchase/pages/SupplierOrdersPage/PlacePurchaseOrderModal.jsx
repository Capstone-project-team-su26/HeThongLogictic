/**
 * Hộp "Đặt hàng nhà cung cấp" — Sale ghi nhận đã đặt đơn thật bên NCC.
 *
 * Backend (PurchaseOrderService.PlaceAsync) chặn hai thứ, nên hộp này đòi đủ cả hai trước khi
 * cho bấm, thay vì để Sale bấm rồi mới ăn lỗi 400:
 *  1. `supplierOrderCode` — MÃ ĐƠN THẬT do NCC / sàn cấp (Taobao, 1688, Shopee…) để đối soát,
 *     cột DB dài tối đa 100 ký tự, backend tự trim;
 *  2. ít nhất một chứng từ PURCHASE_PROOF gắn vào đơn mua (entityType PURCHASE_ORDER,
 *     entityId = id đơn mua) — tải qua POST /api/attachments ngay trong hộp.
 *
 * Trước đây hộp là Modal.confirm chỉ có ô mã đơn: không có chỗ tải ảnh nên lần nào bấm
 * "Đã đặt NCC" cũng bị backend từ chối.
 */
import { useEffect, useState } from "react";
import { Alert, Input, Modal, Space, Spin, Tag, Typography } from "antd";

import {
  ATTACHMENT_ENTITY,
  AttachmentList,
  AttachmentUploadButton,
  getAttachmentApiError,
  listAttachments,
} from "@features/attachments";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";

import PurchaseOrderReview, { PurchaseOrderReviewScroll } from "./PurchaseOrderReview";

const { Text } = Typography;

const PROOF_DOCUMENT_TYPE = "PURCHASE_PROOF";

/** Cột `supplier_order_code` của backend: HasMaxLength(100). */
const SUPPLIER_ORDER_CODE_MAX_LENGTH = 100;

export default function PlacePurchaseOrderModal({ open, order, submitting = false, onCancel, onConfirm }) {
  /* Trang gắn `key` theo đơn và chỉ dựng hộp khi có đơn → mỗi lần mở là state mới tinh. */
  const [code, setCode] = useState(order?.supplierOrderCode || "");
  const [codeTouched, setCodeTouched] = useState(false);
  const [note, setNote] = useState("");
  const [proofs, setProofs] = useState([]);
  const [proofsLoading, setProofsLoading] = useState(Boolean(order?.purchaseOrderId));

  const orderId = order?.purchaseOrderId || "";

  /* Nạp lại chứng từ đã tải trước đó (lần trước tải xong nhưng chưa bấm đặt vẫn còn). */
  useEffect(() => {
    if (!orderId) return undefined;

    let cancelled = false;

    listAttachments({ entityType: ATTACHMENT_ENTITY.PURCHASE_ORDER, entityId: orderId })
      .then((items) => {
        if (cancelled) return;
        setProofs(
          items.filter((item) => String(item?.documentType || "").toUpperCase() === PROOF_DOCUMENT_TYPE)
        );
      })
      .catch((error) => {
        if (cancelled) return;
        /* Không chặn hộp: Sale vẫn tải chứng từ mới được. */
        AuthNotify.warning(
          "Chưa đọc được chứng từ đã tải",
          getAttachmentApiError(error, "Hãy tải lại ảnh đặt hàng để chắc chắn.")
        );
      })
      .finally(() => {
        if (!cancelled) setProofsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const trimmedCode = code.trim();
  const codeError = !trimmedCode
    ? "Nhập mã đơn bên nhà cung cấp."
    : trimmedCode.length > SUPPLIER_ORDER_CODE_MAX_LENGTH
      ? `Mã đơn tối đa ${SUPPLIER_ORDER_CODE_MAX_LENGTH} ký tự.`
      : "";

  const blockedReason = proofsLoading
    ? "Đang đọc chứng từ đã tải…"
    : !proofs.length
      ? "Tải ít nhất một ảnh / PDF chứng từ đặt hàng."
      : codeError;

  const handleOk = () => {
    setCodeTouched(true);

    if (blockedReason) return;

    onConfirm?.({ supplierOrderCode: trimmedCode, note: note.trim() });
  };

  return (
    <Modal
      open={open}
      width={1000}
      destroyOnClose
      title={`Đặt hàng nhà cung cấp — ${order?.purchaseOrderCode || ""}`}
      okText="Đã đặt NCC"
      cancelText="Huỷ"
      okButtonProps={{ disabled: Boolean(blockedReason), loading: submitting, title: blockedReason }}
      onOk={handleOk}
      onCancel={onCancel}
    >
      <PurchaseOrderReviewScroll>
        <PurchaseOrderReview order={order} />

        <Space direction="vertical" size={12} style={{ width: "100%", marginTop: 8 }}>
          <div>
            <Space size={8} wrap>
              <Text strong>Ảnh / chứng từ đặt hàng (bắt buộc)</Text>
              <Tag color={proofs.length ? "green" : "red"}>
                {proofs.length ? `Đã có ${proofs.length} tệp` : "Chưa có"}
              </Tag>
            </Space>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Chụp màn hình xác nhận đơn / hoá đơn bên NCC (JPG, PNG, WEBP hoặc PDF, tối đa 10 MB).
                Chứng từ đã tải không xoá được — tải nhầm thì tải bổ sung bản đúng.
              </Text>
            </div>

            <Spin spinning={proofsLoading}>
              {proofs.length > 0 && <AttachmentList items={proofs} showThumbnails />}
            </Spin>

            <div style={{ marginTop: 8 }}>
              <AttachmentUploadButton
                entityType={ATTACHMENT_ENTITY.PURCHASE_ORDER}
                entityId={orderId}
                documentType={PROOF_DOCUMENT_TYPE}
                label={proofs.length ? "Tải thêm chứng từ" : "Tải ảnh / chứng từ đặt hàng"}
                onUploaded={(attachment) => setProofs((current) => [...current, attachment])}
                buttonProps={{ type: proofs.length ? "default" : "primary" }}
              />
            </div>
          </div>

          <div>
            <Text strong>Mã đơn bên nhà cung cấp (bắt buộc)</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Mã đơn THẬT do NCC / sàn cấp khi đặt hàng (ví dụ mã đơn Taobao, 1688, Shopee) — lấy từ
                trang xác nhận đơn hoặc email của NCC. Dùng để đối soát, không nhập mã tự đặt.
              </Text>
            </div>
            <Input
              value={code}
              maxLength={SUPPLIER_ORDER_CODE_MAX_LENGTH}
              showCount
              status={codeTouched && codeError ? "error" : undefined}
              placeholder="Ví dụ: 3928475610234 (mã đơn Taobao / 1688)"
              style={{ marginTop: 6 }}
              onChange={(event) => setCode(event.target.value)}
              onBlur={() => setCodeTouched(true)}
            />
            {codeTouched && codeError && (
              <Text type="danger" style={{ fontSize: 12 }}>
                {codeError}
              </Text>
            )}
          </div>

          <Input.TextArea
            rows={2}
            value={note}
            placeholder="Ghi chú (không bắt buộc)"
            onChange={(event) => setNote(event.target.value)}
          />

          {blockedReason ? (
            <Alert type="info" showIcon message={`Chưa bấm "Đã đặt NCC" được: ${blockedReason}`} />
          ) : (
            <Text type="secondary">
              Đặt xong hệ thống tự sinh đơn kho và phiếu tiếp nhận cho kho nguồn.
            </Text>
          )}
        </Space>
      </PurchaseOrderReviewScroll>
    </Modal>
  );
}
