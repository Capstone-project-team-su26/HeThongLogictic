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
  Descriptions,
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
  createReceivingNote,
  getSettlementApiError,
  listActionQueue,
  notifyWarehouse,
} from "../../../api/SaleAPI/SettlementAPI/settlementService";
import AuthNotify from "../../../utils/Common/AuthNotify";
import "./SaleSettlementPage.css";

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

/**
 * Địa chỉ trên đơn là một chuỗi liền, mà phiếu giao cần tách tỉnh / quận / phường.
 * Tách ngược từ đuôi vì thứ tự nhập luôn là "số nhà, phường, quận, tỉnh".
 */
const splitAddress = (address) => {
  const parts = String(address || "")
    .split(",")
    .map((piece) => piece.trim())
    .filter(Boolean);

  if (parts.length < 4) {
    return { addressDetail: parts.join(", "), ward: "", district: "", province: "" };
  }

  return {
    province: parts[parts.length - 1],
    district: parts[parts.length - 2],
    ward: parts[parts.length - 3],
    addressDetail: parts.slice(0, parts.length - 3).join(", "),
  };
};

export default function SaleReleasePage() {
  const navigate = useNavigate();

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

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      setRows(await listActionQueue());
    } catch (error) {
      setErrorMessage(getSettlementApiError(error, "Không tải được danh sách đơn cần xử lý."));
    } finally {
      setLoading(false);
    }
  }, []);

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
    setForm({
      receiverName: row.receiverName || row.customerName || "",
      receiverPhone: row.receiverPhone || row.customerPhone || "",
      note: "",
      ...splitAddress(row.receiverAddress),
    });
  }, []);

  const submitDelivery = useCallback(async () => {
    if (!target || !form) return;

    const missing = ["receiverName", "receiverPhone", "addressDetail", "province", "district", "ward"]
      .filter((field) => !String(form[field] || "").trim());

    if (missing.length > 0) {
      AuthNotify.error(
        "Thiếu thông tin giao hàng",
        "Điền đủ người nhận, số điện thoại và địa chỉ (tỉnh/quận/phường) rồi mới gửi được.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await createDeliveryRequest({ orderId: target.orderId, ...form });
      setIssued(result);
      AuthNotify.success(
        "Đã gửi yêu cầu giao hàng",
        `Phiếu ${result?.deliveryCode || ""} đang chờ Operations Manager duyệt.`,
      );
      load();
    } catch (error) {
      AuthNotify.error(
        "Không lập được yêu cầu giao hàng",
        getSettlementApiError(error, "Vui lòng thử lại."),
      );
    } finally {
      setSubmitting(false);
    }
  }, [target, form, load]);

  const submitNotify = useCallback(async () => {
    if (!notifyTarget) return;

    setSubmitting(true);
    try {
      const result = await notifyWarehouse(notifyTarget.orderId, notifyNote);
      AuthNotify.success(
        result?.alreadyNotified ? "Đơn này đã báo cho kho từ trước" : "Đã thông báo cho kho",
        `Kho sẽ lập phiếu nhập cho ${result?.storeAtVnParcelCount || 0} kiện của đơn ${notifyTarget.orderCode}.`,
      );
      setNotifyTarget(null);
      setNotifyNote("");
      load();
    } catch (error) {
      AuthNotify.error("Không thông báo được", getSettlementApiError(error, "Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  }, [notifyTarget, notifyNote, load]);

  const submitReceivingNote = useCallback(async () => {
    if (!receivingTarget) return;

    if (!receivingTarget.receivingWarehouseId) {
      AuthNotify.error(
        "Đơn chưa gắn kho gốc",
        "Báo giá của đơn này chưa chọn kho tiếp nhận, nên chưa lập được phiếu.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await createReceivingNote({
        orderId: receivingTarget.orderId,
        warehouseId: receivingTarget.receivingWarehouseId,
        note: receivingNote,
      });
      AuthNotify.success(
        "Đã lập phiếu tiếp nhận kho",
        `Phiếu ${result?.receivingNoteCode || ""} đã gửi tới ${receivingTarget.receivingWarehouseName || "kho gốc"}.`,
      );
      setReceivingTarget(null);
      setReceivingNote("");
      load();
    } catch (error) {
      AuthNotify.error(
        "Không lập được phiếu tiếp nhận",
        getSettlementApiError(error, "Vui lòng thử lại."),
      );
    } finally {
      setSubmitting(false);
    }
  }, [receivingTarget, receivingNote, load]);

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
            <Tag color={STATE_TONE[value] || "default"}>{row.actionStateText}</Tag>

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

          if (row.handlingGroup === RECEIVING_NOTE) {
            return (
              <Button
                type="primary"
                icon={<FileAddOutlined />}
                onClick={() => {
                  setReceivingTarget(row);
                  setReceivingNote("");
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
              }}
            >
              {row.actionState === "INBOUND_REJECTED" ? "Báo lại cho kho" : "Thông báo cho kho"}
            </Button>
          );
        },
      },
    ],
    [openDelivery],
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
        scroll={{ x: 1180 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có đơn nào đã tất toán chờ xử lý."
            />
          ),
        }}
      />

      {/* ============ Đầu chặng: lập phiếu tiếp nhận cho kho gốc ============ */}
      <Modal
        open={Boolean(receivingTarget)}
        onCancel={() => setReceivingTarget(null)}
        onOk={submitReceivingNote}
        confirmLoading={submitting}
        okText="Lập phiếu tiếp nhận"
        cancelText="Để sau"
        title={`Lập phiếu tiếp nhận kho · ${receivingTarget?.orderCode || ""}`}
      >
        {receivingTarget && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 14 }}
              message="Khách đã trả cọc, kho gốc nhận hàng được rồi"
              description="Kho quét mã phiếu này để đối chiếu hàng khách mang tới. Kiện chỉ sinh ra sau khi kho bấm xác nhận nhận hàng, nên trước đó đơn chưa có kiện nào."
            />

            <Descriptions column={1} size="small" bordered style={{ marginBottom: 14 }}>
              <Descriptions.Item label="Khách hàng">
                {receivingTarget.customerName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Kho tiếp nhận">
                {receivingTarget.receivingWarehouseName || (
                  <Text type="danger">Đơn chưa gắn kho — kiểm tra lại báo giá</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Tuyến">{receivingTarget.route || "—"}</Descriptions.Item>
            </Descriptions>

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
      <Modal
        open={Boolean(notifyTarget)}
        onCancel={() => setNotifyTarget(null)}
        onOk={submitNotify}
        confirmLoading={submitting}
        okText="Thông báo cho kho"
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
      <Drawer
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        width={680}
        title={`Tạo yêu cầu giao hàng · ${target?.orderCode || ""}`}
      >
        {target && form && (
          <>
            <div className="sale-release-summary">
              <span>
                Khách: <strong>{target.customerName || "—"}</strong>
              </span>
              <span>
                Hàng giao ngay: <strong>{target.groupParcelCount}</strong> kiện
              </span>
              <span>
                Loại đơn: <strong>{target.orderType === "PURCHASE" ? "Mua hộ" : "Ký gửi"}</strong>
              </span>
            </div>

            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Địa chỉ trên đơn">
                {target.receiverAddress || "—"}
              </Descriptions.Item>
            </Descriptions>

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
              <Input
                addonBefore="Số nhà, đường"
                value={form.addressDetail}
                onChange={(e) => setForm((f) => ({ ...f, addressDetail: e.target.value }))}
              />
              <Input
                addonBefore="Phường/Xã"
                value={form.ward}
                onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}
              />
              <Input
                addonBefore="Quận/Huyện"
                value={form.district}
                onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
              />
              <Input
                addonBefore="Tỉnh/Thành phố"
                value={form.province}
                onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
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
              <Button
                type="primary"
                size="large"
                block
                icon={<SendOutlined />}
                loading={submitting}
                onClick={submitDelivery}
                style={{ marginTop: 16 }}
              >
                Gửi yêu cầu giao hàng cho OM duyệt
              </Button>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
