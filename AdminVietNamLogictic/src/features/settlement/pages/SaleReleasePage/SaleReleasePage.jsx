/**
 * Đơn hàng cần xử lý — việc của Sale ngay sau khi khách tất toán.
 *
 * Mỗi dòng là MỘT VIỆC chứ không phải một đơn: đơn vừa có kiện giao thẳng vừa có kiện gửi lại
 * kho ra hai dòng, hai nút, rụng độc lập. Nhờ vậy Sale nhìn bảng là biết còn phải bấm gì, không
 * phải mở từng đơn ra dò.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ExportOutlined,
  FileAddOutlined,
  HomeOutlined,
  InboxOutlined,
  NotificationOutlined,
  ReloadOutlined,
  SendOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  createDeliveryRequest,
  getSettlementApiError,
  notifyWarehouse,
} from "@features/settlement/api/settlementService";
/* Hàng đợi + lập phiếu tiếp nhận ở actionQueueService; giao hàng / báo kho ở settlementService — đều là API thật. */
import {
  createReceivingNote,
  listActionQueue,
} from "@features/settlement/api/actionQueueService";
/*
 * Tóm tắt đầy đủ đơn cho ba hộp xác nhận của trang (lập phiếu nhập kho, báo kho, yêu cầu
 * giao): khách + mã khách, hàng từng dòng, kiện, báo giá, tiền đã cọc — đều từ API thật.
 */
import { OrderReviewPanel, useOrderReview } from "@features/consignment";
/* Đi thẳng file store (như Sidebar): barrel "@features/workspace" kéo bảng tab → vòng import về trang này. */
import { useSaleBadges } from "@features/workspace/context/saleBadgeStore";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import ActionErrorAlert from "@shared/components/ActionErrorAlert/ActionErrorAlert";
import { createLoadSequencer, createRowActionRunner } from "@shared/utils/rowActionGuard";
import DeliveryAddressPicker from "@shared/components/AddressSelect/DeliveryAddressPicker";
import {
  isDeliveryAddressComplete,
  splitVietnamAddress,
} from "@shared/api/vietnamAddressService";
import { REVIEW_MODAL_PROPS } from "@shared/components/SubmitReview/submitReviewFormat";
import { tablePagination } from "@shared/utils/tablePagination";
import "@features/settlement/pages/SaleSettlementPage/SaleSettlementPage.css";

const { Title, Text } = Typography;

const DIRECT_DELIVERY = "DIRECT_DELIVERY";
const STORE_AT_VN = "STORE_AT_VN";

/**
 * Việc ĐẦU chặng: khách trả cọc xong, Sale lập phiếu cho kho gốc nhận hàng. Khác hẳn hai nhóm
 * dưới — lúc này đơn chưa có kiện nào, kiện chỉ sinh ra sau khi kho quét phiếu và xác nhận nhận.
 */
const RECEIVING_NOTE = "RECEIVING_NOTE";

/** Màu nhãn tiến độ — việc bấm được thì nổi, việc đang chờ người khác thì chìm. */
const STATE_TONE = {
  AWAITING_RECEIVING_NOTE: "processing",
  RECEIVING_NOTE_PENDING_APPROVAL: "default",
  RECEIVING_NOTE_REJECTED: "error",
  AWAITING_DELIVERY_REQUEST: "processing",
  AWAITING_WAREHOUSE_NOTICE: "warning",
  NOTIFIED_AWAITING_INBOUND: "default",
  INBOUND_PENDING_APPROVAL: "default",
  INBOUND_REJECTED: "error",
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

/*
 * Địa chỉ trên đơn là một chuỗi liền "số nhà, phường, quận, tỉnh"; phiếu giao cần tách tỉnh /
 * quận / phường → splitVietnamAddress, rồi DeliveryAddressPicker dò mã GoShip theo tên.
 */

/** Câu hiện ở cột Thao tác khi dòng vừa xử lý xong, trong lúc chờ bảng tải lại từ server. */
const JUST_DONE_TEXT = {
  RECEIVING_NOTE: "Đã lập phiếu — chờ quản lý kho duyệt",
  NOTIFY: "Đã báo kho — chờ kho lập phiếu nhập",
  DELIVERY: "Đã gửi yêu cầu giao — chờ OM duyệt",
};

export default function SaleReleasePage() {
  const navigate = useNavigate();
  /* Làm xong một việc thì đếm lại badge ngay. */
  const { forceRefresh: refreshBadges } = useSaleBadges();

  /*
   * CHỐNG BẤM LẠI (cùng khuôn với hàng chờ tất toán): mỗi dòng chỉ một lời gọi đang bay, dòng đang
   * gửi khoá nút, gửi xong dòng tắt nút ngay (canAct = false) trong lúc chờ bảng tải lại, và chỉ lần
   * tải mới nhất được ghi vào bảng. Lỗi hiện ngay trong hộp / ngăn đang mở, hộp không đóng.
   */
  const [runAction] = useState(createRowActionRunner);
  const [loadSeq] = useState(createLoadSequencer);
  const [busyKey, setBusyKey] = useState("");
  const [actionError, setActionError] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyword, setKeyword] = useState("");

  const [target, setTarget] = useState(null);
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState(null);

  const [notifyTarget, setNotifyTarget] = useState(null);
  const [notifyNote, setNotifyNote] = useState("");

  const [receivingTarget, setReceivingTarget] = useState(null);
  const [receivingNote, setReceivingNote] = useState("");

  /*
   * ĐẦY ĐỦ THÔNG TIN TRƯỚC KHI GHI.
   *
   * Hàng đợi việc chỉ trả phần đầu đơn (mã đơn, khách, kho, tuyến) — không có kiện, không có
   * tiền. Mà người bấm "Lập phiếu nhập kho" / "Thông báo cho kho" / "Gửi yêu cầu giao" phải
   * thấy mình đang bàn giao CÁI GÌ: khách nào (kèm mã khách), bao nhiêu dòng hàng, nặng bao
   * nhiêu, kích thước, khai giá, thùng gỗ / dịch vụ kèm, báo giá và tiền đã cọc. Chỉ một hộp
   * mở tại một thời điểm, nên một hook nạp chi tiết cho đúng đơn của hộp đang mở.
   */
  const reviewOrderId = receivingTarget?.orderId || notifyTarget?.orderId || target?.orderId || "";
  const review = useOrderReview(reviewOrderId, { enabled: Boolean(reviewOrderId) });

  const load = useCallback(async () => {
    const seq = loadSeq.next();
    setLoading(true);
    setErrorMessage("");
    try {
      const next = await listActionQueue();
      if (!loadSeq.isLatest(seq)) return;
      setRows(next);
    } catch (error) {
      if (!loadSeq.isLatest(seq)) return;
      setErrorMessage(getSettlementApiError(error, "Không tải được danh sách đơn cần xử lý."));
    } finally {
      if (loadSeq.isLatest(seq)) setLoading(false);
    }
  }, [loadSeq]);

  /**
   * Chạy MỘT thao tác ghi của một dòng. Bấm lần hai khi lần đầu chưa xong → bỏ qua (không gọi API).
   * Thành công: dòng tắt nút ngay, rồi tải lại bảng + badge một lần. Lỗi: trả câu lỗi cho hộp đang
   * mở hiện tại chỗ.
   *
   * @returns {Promise<{ ok: boolean, skipped?: boolean, result?: any }>}
   */
  const performRowAction = useCallback(
    async (row, action, doneText) => {
      const key = row?.rowKey;
      if (!key || runAction.isBusy(key)) return { ok: false, skipped: true };

      setActionError("");
      setSubmitting(true);
      setBusyKey(key);

      const outcome = await runAction(key, action);

      if (outcome.skipped) return outcome;

      try {
        if (!outcome.ok) {
          setActionError(getSettlementApiError(outcome.error, "Vui lòng thử lại."));
          return outcome;
        }

        setRows((current) =>
          current.map((item) =>
            item.rowKey === key ? { ...item, canAct: false, blockedReason: doneText } : item,
          ),
        );
        load();
        refreshBadges();
        return outcome;
      } finally {
        setSubmitting(false);
        setBusyKey((current) => (current === key ? "" : current));
      }
    },
    [runAction, load, refreshBadges],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.orderCode, row.customerName, row.customerPhone, row.receiverName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [rows, keyword]);

  const openDelivery = useCallback((row) => {
    setTarget(row);
    setIssued(null);
    setActionError("");
    setForm({
      receiverName: row.receiverName || row.customerName || "",
      receiverPhone: row.receiverPhone || row.customerPhone || "",
      note: "",
      ...splitVietnamAddress(row.receiverAddress),
      provinceCode: "",
      districtCode: "",
      wardCode: "",
    });
  }, []);

  const submitDelivery = useCallback(async () => {
    if (!target || !form) return;

    const missing = ["receiverName", "receiverPhone", "addressDetail"]
      .filter((field) => !String(form[field] || "").trim());

    /* Tỉnh/quận/phường phải CHỌN từ danh mục GoShip (có mã) — tên gõ tay/tên cũ chưa khớp thì chặn. */
    if (missing.length > 0 || !isDeliveryAddressComplete(form)) {
      AuthNotify.error(
        "Thiếu thông tin giao hàng",
        "Điền đủ người nhận, số điện thoại, số nhà và CHỌN đủ tỉnh/quận/phường từ danh sách rồi mới gửi được.",
      );
      return;
    }

    /* Gửi đúng các kiện của nhóm "giao ngay" server đã tách sẵn — kiện gửi kho không lẫn vào. */
    const outcome = await performRowAction(
      target,
      () =>
        createDeliveryRequest({
          orderId: target.orderId,
          parcelIds: target.parcelIds,
          ...form,
        }),
      JUST_DONE_TEXT.DELIVERY,
    );
    if (!outcome.ok) return;

    const result = outcome.result;
    setIssued(result);
    AuthNotify.success(
      "Đã gửi yêu cầu giao hàng",
      `Phiếu ${result?.deliveryCode || ""} đang chờ Operations Manager duyệt.`,
    );
  }, [target, form, performRowAction]);

  const submitNotify = useCallback(async () => {
    if (!notifyTarget) return;

    const outcome = await performRowAction(
      notifyTarget,
      () => notifyWarehouse(notifyTarget.orderId, notifyNote),
      JUST_DONE_TEXT.NOTIFY,
    );
    if (!outcome.ok) return;

    const result = outcome.result;
    AuthNotify.success(
      result?.alreadyNotified ? "Đơn này đã báo cho kho từ trước" : "Đã thông báo cho kho",
      `Kho sẽ lập phiếu nhập cho ${result?.storeAtVnParcelCount || 0} kiện của đơn ${notifyTarget.orderCode}.`,
    );
    setNotifyTarget(null);
    setNotifyNote("");
  }, [notifyTarget, notifyNote, performRowAction]);

  const submitReceivingNote = useCallback(async () => {
    if (!receivingTarget) return;

    if (!receivingTarget.receivingWarehouseId) {
      AuthNotify.error(
        "Đơn chưa gắn kho gốc",
        "Báo giá của đơn này chưa chọn kho tiếp nhận, nên chưa lập được phiếu.",
      );
      return;
    }

    const outcome = await performRowAction(
      receivingTarget,
      () =>
        createReceivingNote({
          orderId: receivingTarget.orderId,
          warehouseId: receivingTarget.receivingWarehouseId,
          note: receivingNote,
        }),
      JUST_DONE_TEXT.RECEIVING_NOTE,
    );
    if (!outcome.ok) return;

    const result = outcome.result;
    AuthNotify.success(
      "Đã lập phiếu nhập kho",
      `Phiếu ${result?.receivingNoteCode || ""} (${result?.warehouseName || receivingTarget.receivingWarehouseName || "kho gốc"}) đang chờ quản lý kho duyệt. Duyệt xong khách nhận PDF để mang hàng tới.`,
    );
    setReceivingTarget(null);
    setReceivingNote("");
  }, [receivingTarget, receivingNote, performRowAction]);

  const columns = useMemo(
    () => [
      {
        title: "Mã đơn",
        dataIndex: "orderCode",
        width: 200,
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
        title: "Nhóm hàng",
        dataIndex: "handlingGroup",
        width: 200,
        render: (value, row) => {
          // Dòng lập phiếu tiếp nhận chưa có kiện nào, nên thay số kiện bằng kho sẽ nhận hàng.
          if (value === RECEIVING_NOTE) {
            return (
              <Space direction="vertical" size={2}>
                <Tag color="green" icon={<InboxOutlined />}>
                  {row.handlingGroupText}
                </Tag>
                <Text type="secondary">{row.receivingWarehouseName || "Chưa gắn kho"}</Text>
              </Space>
            );
          }

          return (
            <Space direction="vertical" size={2}>
              <Tag
                color={value === STORE_AT_VN ? "gold" : "cyan"}
                icon={value === STORE_AT_VN ? <HomeOutlined /> : <ExportOutlined />}
              >
                {row.handlingGroupText}
              </Tag>
              <Text type="secondary">{row.groupParcelCount} kiện</Text>
            </Space>
          );
        },
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
        title: "Tiến độ",
        dataIndex: "actionState",
        width: 220,
        render: (value, row) => (
          <Space direction="vertical" size={2}>
            {/* Tag của antd không xuống dòng — nhãn dài tràn sang cột "Mốc chờ từ". */}
            <Tag
              color={STATE_TONE[value] || "default"}
              style={{ whiteSpace: "normal", maxWidth: "100%", lineHeight: 1.4, paddingBlock: 2 }}
            >
              {row.actionStateText}
            </Tag>

            {row.inboundCode && <Text type="secondary">Phiếu {row.inboundCode}</Text>}

            {row.inboundRejectionReason && (
              <Text type="danger">Lý do: {row.inboundRejectionReason}</Text>
            )}

            {row.discrepancyParcelCount > 0 && (
              <Tag color="error" icon={<WarningOutlined />}>
                {row.discrepancyParcelCount} kiện lệch
              </Tag>
            )}
          </Space>
        ),
      },
      {
        // Cùng một cột nhưng hai nghĩa: việc đầu chặng đo từ lúc khách trả tiền, việc chặng cuối
        // đo từ lúc hàng về kho VN. Ghi rõ mốc dưới ngày để Sale khỏi đọc nhầm.
        title: "Mốc chờ từ",
        dataIndex: "arrivedAt",
        width: 175,
        render: (value, row) => (
          <Space direction="vertical" size={0}>
            <Text>{formatDateTime(value)}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.handlingGroup === RECEIVING_NOTE ? "khách trả cọc" : "hàng về kho"}
            </Text>
          </Space>
        ),
      },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 210,
        render: (_, row) => {
          if (!row.canAct) {
            return <Text type="secondary">{row.blockedReason || "Đang chờ bộ phận khác"}</Text>;
          }

          /* Dòng đang gửi thao tác: khoá nút tới khi có kết quả. */
          if (busyKey && busyKey === row.rowKey) {
            return (
              <Button type="primary" loading disabled>
                Đang gửi…
              </Button>
            );
          }

          if (row.handlingGroup === RECEIVING_NOTE) {
            return (
              <Button
                type="primary"
                icon={<FileAddOutlined />}
                onClick={() => {
                  setReceivingTarget(row);
                  setReceivingNote("");
                  setActionError("");
                }}
              >
                Lập phiếu tiếp nhận kho
              </Button>
            );
          }

          if (row.handlingGroup === DIRECT_DELIVERY) {
            return (
              <Button type="primary" icon={<ExportOutlined />} onClick={() => openDelivery(row)}>
                Tạo yêu cầu giao hàng
              </Button>
            );
          }

          return (
            <Button
              type="primary"
              icon={<NotificationOutlined />}
              danger={row.actionState === "INBOUND_REJECTED"}
              onClick={() => {
                setNotifyTarget(row);
                setNotifyNote("");
                setActionError("");
              }}
            >
              {row.actionState === "INBOUND_REJECTED" ? "Báo lại cho kho" : "Thông báo cho kho"}
            </Button>
          );
        },
      },
    ],
    [openDelivery, busyKey],
  );

  return (
    <div className="sale-settlement-page">
      <div className="sale-settlement-page__head">
        <div>
          <Title level={4}>Đơn hàng cần xử lý</Title>
          <Text type="secondary">
            Khách trả cọc xong thì lập phiếu tiếp nhận cho kho gốc. Đến chặng cuối, hàng giao ngay
            thì lập yêu cầu giao; hàng khách gửi lại kho thì thông báo cho kho vào lập phiếu nhập.
          </Text>
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
        rowKey={(row) => row.rowKey}
        columns={columns}
        dataSource={filtered}
        loading={loading}
        rowClassName={(row) => (busyKey && busyKey === row.rowKey ? "sale-queue-row--busy" : "")}
        scroll={{ x: 1180 }}
        pagination={tablePagination({ unit: "đơn" })}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có đơn nào cần xử lý."
            />
          ),
        }}
      />

      {/* ============ Đầu chặng: lập phiếu tiếp nhận cho kho gốc ============ */}
      {/*
        Hộp này ghi ra một phiếu nhập kho mà quản lý kho sẽ duyệt và khách cầm tới kho, nên
        người lập phải thấy ĐỦ: khách (tên, mã, SĐT), kho nhận, người nhận / địa chỉ giao, từng
        dòng hàng (tên, loại, SL, cân, D×R×C, khai giá, thùng gỗ + dịch vụ), tổng, báo giá và
        tiền đã cọc.

        Đang tải chi tiết → khoá nút lập phiếu (không cho ký khi chưa nhìn thấy hàng).
        Tải lỗi → báo rõ nhưng KHÔNG chặn: backend chỉ cần mã đơn + kho để lập phiếu, và phiếu
        chờ quản lý kho duyệt nên còn một lượt người xem lại trước khi khách mang hàng tới.
      */}
      <Modal
        {...REVIEW_MODAL_PROPS}
        open={Boolean(receivingTarget)}
        onCancel={() => {
          if (!submitting) setReceivingTarget(null);
        }}
        onOk={submitReceivingNote}
        confirmLoading={submitting}
        okButtonProps={{ disabled: review.loading }}
        cancelButtonProps={{ disabled: submitting }}
        closable={!submitting}
        maskClosable={!submitting}
        keyboard={!submitting}
        footer={(origin) => (
          <>
            <ActionErrorAlert error={actionError} title="Không lập được phiếu tiếp nhận" />
            {origin}
          </>
        )}
        okText={review.loading ? "Đang tải thông tin…" : "Lập phiếu nhập kho"}
        cancelText="Để sau"
        title={`Lập phiếu tiếp nhận kho · ${receivingTarget?.orderCode || ""}`}
      >
        {receivingTarget && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 14 }}
              message="Khách đã trả cọc — lập phiếu nhập kho để quản lý kho duyệt"
              description="Phiếu chờ quản lý kho của kho nhận duyệt (bạn không tự duyệt được phiếu mình lập). Duyệt xong phiếu có mã WRN- và PDF, khách nhận thông báo để mang hàng tới; kho quét mã đó để nhận hàng và đối chiếu với đúng các dòng hàng bên dưới."
            />

            {!receivingTarget.receivingWarehouseId && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 14 }}
                message="Đơn chưa gắn kho tiếp nhận"
                description="Báo giá của đơn này chưa chọn kho gốc nên chưa lập được phiếu — kiểm tra lại báo giá."
              />
            )}

            <OrderReviewPanel
              review={review}
              fallback={receivingTarget}
              errorHint="Bạn vẫn lập được phiếu (chỉ cần mã đơn và kho); quản lý kho sẽ xem đủ chi tiết khi duyệt."
              extraFacts={[
                {
                  label: "Kho tiếp nhận",
                  value: receivingTarget.receivingWarehouseName ? (
                    <span>
                      <Text strong>{receivingTarget.receivingWarehouseName}</Text>
                      {review.detail?.quotation?.warehouseCode
                        ? ` · ${review.detail.quotation.warehouseCode}`
                        : ""}
                    </span>
                  ) : (
                    <Text type="danger">Chưa gắn kho</Text>
                  ),
                },
                {
                  label: "Địa chỉ kho",
                  value: review.detail?.quotation?.warehouseAddress,
                  hidden: !review.detail?.quotation?.warehouseAddress,
                },
                {
                  label: "Khách trả cọc lúc",
                  value: formatDateTime(receivingTarget.arrivedAt),
                },
              ]}
            />

            <Input.TextArea
              rows={3}
              placeholder="Ghi chú cho kho (không bắt buộc) — ví dụ hàng dễ vỡ, hẹn ngày khách mang tới"
              value={receivingNote}
              onChange={(event) => setReceivingNote(event.target.value)}
            />
          </>
        )}
      </Modal>

      {/* ============ Nhánh gửi lại kho: thông báo cho kho ============ */}
      {/*
        Báo kho = cam kết với kho rằng đúng các kiện này của khách được nhập kệ VN. Hiện đủ
        khách, từng kiện (mã, cân, lô, kết quả kiểm đếm) và tiền để Sale soát trước khi báo.
        Đang tải thì khoá nút; tải lỗi không chặn (kho sẽ tự lập phiếu nhập và OM duyệt lại).
      */}
      <Modal
        {...REVIEW_MODAL_PROPS}
        open={Boolean(notifyTarget)}
        onCancel={() => {
          if (!submitting) setNotifyTarget(null);
        }}
        onOk={submitNotify}
        confirmLoading={submitting}
        okButtonProps={{ disabled: review.loading }}
        cancelButtonProps={{ disabled: submitting }}
        closable={!submitting}
        maskClosable={!submitting}
        keyboard={!submitting}
        footer={(origin) => (
          <>
            <ActionErrorAlert error={actionError} title="Không thông báo được cho kho" />
            {origin}
          </>
        )}
        okText={review.loading ? "Đang tải thông tin…" : "Thông báo cho kho"}
        cancelText="Để sau"
        title={`Thông báo cho kho · ${notifyTarget?.orderCode || ""}`}
      >
        {notifyTarget && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 14 }}
              message={`${notifyTarget.groupParcelCount} kiện khách xin gửi lại kho VN`}
              description="Kho sẽ thấy đơn này ở mục Đơn hàng cần xử lý và lập phiếu nhập kho gửi OM duyệt."
            />

            <OrderReviewPanel
              review={review}
              fallback={notifyTarget}
              parcelIds={notifyTarget.parcelIds}
              parcelTitle="Kiện khách gửi lại kho VN"
              errorHint="Bạn vẫn báo kho được; kho lập phiếu nhập và OM duyệt lại từng kiện."
              extraFacts={[
                {
                  label: "Nhóm hàng",
                  value: `${notifyTarget.handlingGroupText || "Gửi lại kho"} · ${
                    notifyTarget.groupParcelCount
                  } kiện · ${Number(notifyTarget.groupTotalWeight || 0).toLocaleString("vi-VN")} kg`,
                },
                {
                  label: "Hàng về kho lúc",
                  value: formatDateTime(notifyTarget.arrivedAt),
                },
                {
                  label: "Kiện lệch khi kiểm đếm",
                  value: notifyTarget.discrepancyParcelCount ? (
                    <Text type="danger">{notifyTarget.discrepancyParcelCount} kiện</Text>
                  ) : (
                    "Không"
                  ),
                },
                {
                  label: "Lý do kho từ chối lần trước",
                  value: <Text type="danger">{notifyTarget.inboundRejectionReason}</Text>,
                  hidden: !notifyTarget.inboundRejectionReason,
                  span: 2,
                },
              ]}
            />

            <Input.TextArea
              rows={3}
              placeholder="Ghi chú cho kho (không bắt buộc) — ví dụ điều kiện đã thoả thuận với khách"
              value={notifyNote}
              onChange={(event) => setNotifyNote(event.target.value)}
            />
          </>
        )}
      </Modal>

      {/* ============ Nhánh giao ngay: lập yêu cầu giao hàng ============ */}
      {/*
        Yêu cầu giao = lệnh kho nhặt đúng các kiện này và book xe tới địa chỉ bên dưới. Trước khi
        gửi OM duyệt, Sale phải thấy đủ: khách, từng kiện sẽ giao (mã, cân, lô, kết quả kiểm
        đếm), hàng khai trên đơn và tiền (đã tất toán chưa). Form địa chỉ ở dưới chính là dữ
        liệu sẽ ghi. Đang tải thì khoá nút gửi; tải lỗi không chặn vì OM còn duyệt lại.
      */}
      <Drawer
        open={Boolean(target)}
        onClose={() => {
          if (!submitting) setTarget(null);
        }}
        width={980}
        title={`Tạo yêu cầu giao hàng · ${target?.orderCode || ""}`}
      >
        {target && form && (
          <>
            <div className="sale-release-summary">
              <span>
                Khách: <strong>{target.customerName || "—"}</strong>
              </span>
              <span>
                Hàng giao ngay: <strong>{target.groupParcelCount}</strong> kiện ·{" "}
                <strong>{Number(target.groupTotalWeight || 0).toLocaleString("vi-VN")}</strong> kg
              </span>
              <span>
                Loại đơn: <strong>{target.orderType === "PURCHASE" ? "Mua hộ" : "Ký gửi"}</strong>
              </span>
            </div>

            <OrderReviewPanel
              review={review}
              fallback={target}
              parcelIds={target.parcelIds}
              parcelTitle="Kiện sẽ giao"
              errorHint="Bạn vẫn gửi được yêu cầu; OM sẽ xem đủ kiện khi duyệt."
            />

            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              <Input
                addonBefore="Người nhận"
                value={form.receiverName}
                onChange={(e) => setForm((f) => ({ ...f, receiverName: e.target.value }))}
              />
              <Input
                addonBefore="Điện thoại"
                value={form.receiverPhone}
                onChange={(e) => setForm((f) => ({ ...f, receiverPhone: e.target.value }))}
              />
              <DeliveryAddressPicker
                key={target.orderId}
                value={form}
                savedText={target.receiverAddress}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              />
              <Input.TextArea
                rows={2}
                placeholder="Ghi chú cho kho (không bắt buộc)"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </Space>

            {issued ? (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 16 }}
                message={`Đã gửi phiếu ${issued.deliveryCode || ""}`}
                description="Operations Manager duyệt xong thì kho sẽ nhận việc và đặt đơn vị giao hàng."
                action={
                  <Button size="small" onClick={() => navigate(`/sale/consignments/${target.orderId}`)}>
                    Xem đơn
                  </Button>
                }
              />
            ) : (
              <>
              <ActionErrorAlert
                error={actionError}
                title="Không lập được yêu cầu giao hàng"
                style={{ marginTop: 16, marginBottom: 0 }}
              />
              <Button
                type="primary"
                size="large"
                block
                icon={<SendOutlined />}
                loading={submitting}
                disabled={review.loading || !isDeliveryAddressComplete(form)}
                onClick={submitDelivery}
                style={{ marginTop: 16 }}
              >
                {review.loading ? "Đang tải thông tin đơn…" : "Gửi yêu cầu giao hàng cho OM duyệt"}
              </Button>
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
