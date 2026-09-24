/**
 * ĐƠN MUA NHÀ CUNG CẤP — màn chính của luồng mua hộ chuẩn (API thật).
 *
 * Một màn cho cả Sale lẫn Admin: cùng một bảng, chỉ khác bộ nút hiện ra theo vai trò
 * (`getAvailableActions`). Làm vậy để hai bên nhìn cùng một trạng thái, không ai phải hỏi
 * "đơn của tôi giờ đang nằm ở đâu".
 *
 * Màn cũ (popup 5 nấc `ConfirmPurchaseModal`) chạy dữ liệu giả và cho Sale tự bấm tiến độ;
 * màn này thay thế nó: mỗi bước là một lời gọi API thật, có người chịu trách nhiệm rõ ràng.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";

import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import {
  PURCHASE_ORDER_STATUS,
  cancelPurchaseOrder,
  createPurchaseOrder,
  decidePurchaseOrder,
  getPurchaseOrderApiError,
  listPurchaseOrders,
  listPurchaseOrdersOfRequest,
  placePurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderProgress,
} from "@features/purchase/api/purchaseOrderService";
import {
  getPurchaseRequestDetail,
  listActiveWarehouses,
  listPurchaseRequests,
  listSuppliers,
} from "@features/purchase/api/purchaseCatalogService";
import "@features/operations/styles/OperationsPage.css";

import PurchaseOrderFormModal from "./PurchaseOrderFormModal";
import {
  formatDateTime,
  formatVnd,
  getAvailableActions,
  getNextProgressStep,
} from "./SupplierOrdersPage.helpers";

const { Text } = Typography;

/* Bộ lọc nhanh — mỗi lựa chọn trả lời "việc đang nằm ở ai". */
const FILTERS = [
  { value: "", label: "Tất cả" },
  { value: PURCHASE_ORDER_STATUS.DRAFT, label: "Nháp" },
  { value: PURCHASE_ORDER_STATUS.AWAITING_CUSTOMER, label: "Chờ khách" },
  { value: PURCHASE_ORDER_STATUS.PENDING_APPROVAL, label: "Chờ duyệt" },
  { value: PURCHASE_ORDER_STATUS.APPROVED, label: "Chờ đặt NCC" },
  { value: PURCHASE_ORDER_STATUS.ORDERED, label: "Đã đặt" },
  { value: PURCHASE_ORDER_STATUS.SUPPLIER_SHIPPED, label: "NCC đã phát hàng" },
];

const normalizeRole = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export default function SupplierOrdersPage() {
  const role = normalizeRole(sessionStorage.getItem("role"));

  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  /* Dữ liệu cho modal lập đơn */
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [formLoading, setFormLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState(null);
  const [requestOrders, setRequestOrders] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  /* Chọn yêu cầu để lập đơn mới */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerRows, setPickerRows] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      setOrders(await listPurchaseOrders({ status: statusFilter }));
    } catch (error) {
      setErrorMessage(getPurchaseOrderApiError(error, "Không tải được danh sách đơn mua."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  /* Danh mục chỉ cần tải một lần cho cả phiên làm việc. */
  useEffect(() => {
    Promise.allSettled([listSuppliers(), listActiveWarehouses()]).then(([s, w]) => {
      if (s.status === "fulfilled") setSuppliers(s.value);
      if (w.status === "fulfilled") setWarehouses(w.value);
    });
  }, []);

  const visible = useMemo(() => {
    const term = keyword.trim().toUpperCase();

    if (!term) return orders;

    return orders.filter((order) =>
      [order.purchaseOrderCode, order.purchaseCode, order.supplierName, order.customerName]
        .filter(Boolean)
        .some((field) => String(field).toUpperCase().includes(term))
    );
  }, [orders, keyword]);

  /** Chạy một thao tác, hiện lỗi backend nguyên văn rồi tải lại bảng. */
  const run = async (orderId, action, successMessage) => {
    setBusyId(orderId);

    try {
      await action();
      AuthNotify.success("Đã cập nhật", successMessage);
      await load();
    } catch (error) {
      AuthNotify.error("Không thực hiện được", getPurchaseOrderApiError(error));
    } finally {
      setBusyId("");
    }
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setPickerLoading(true);

    try {
      /* Chỉ yêu cầu đã trả trước mới lập được đơn mua; PURCHASING là đang mua tiếp NCC khác. */
      const [paid, purchasing] = await Promise.all([
        listPurchaseRequests({ status: "PAID" }),
        listPurchaseRequests({ status: "PURCHASING" }),
      ]);

      setPickerRows([...paid, ...purchasing]);
    } catch (error) {
      AuthNotify.error("Không tải được", getPurchaseOrderApiError(error));
    } finally {
      setPickerLoading(false);
    }
  };

  const openFormFor = async (purchaseRequestId, order = null) => {
    setFormMode(order ? "edit" : "create");
    setEditingOrder(order);
    setFormOpen(true);
    setFormLoading(true);

    try {
      const [detail, existing] = await Promise.all([
        getPurchaseRequestDetail(purchaseRequestId),
        listPurchaseOrdersOfRequest(purchaseRequestId),
      ]);

      setRequest(detail);
      setRequestOrders(existing);
    } catch (error) {
      AuthNotify.error("Không tải được yêu cầu", getPurchaseOrderApiError(error));
      setFormOpen(false);
    } finally {
      setFormLoading(false);
    }
  };

  const handleSaveOrder = async (payload) => {
    setSubmitting(true);

    try {
      if (formMode === "edit" && editingOrder) {
        await updatePurchaseOrder(editingOrder.purchaseOrderId, payload);
      } else {
        await createPurchaseOrder(request.purchaseRequestId || request.id, payload);
      }

      AuthNotify.success("Đã lưu", "Đơn mua đã lưu ở trạng thái nháp, gửi duyệt khi sẵn sàng.");
      setFormOpen(false);
      await load();
    } catch (error) {
      AuthNotify.error("Không lưu được", getPurchaseOrderApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const askPlace = (order) => {
    let code = "";
    let note = "";

    Modal.confirm({
      title: `Đặt hàng nhà cung cấp — ${order.purchaseOrderCode}`,
      width: 520,
      content: (
        <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
          <Text type="secondary">
            Nhập mã đơn bên nhà cung cấp. Đặt xong hệ thống tự sinh đơn kho và phiếu tiếp nhận
            cho kho nguồn.
          </Text>
          <Input
            placeholder="Mã đơn bên NCC"
            onChange={(event) => {
              code = event.target.value;
            }}
          />
          <Input.TextArea
            rows={2}
            placeholder="Ghi chú (không bắt buộc)"
            onChange={(event) => {
              note = event.target.value;
            }}
          />
        </Space>
      ),
      okText: "Đã đặt NCC",
      cancelText: "Huỷ",
      onOk: () =>
        run(
          order.purchaseOrderId,
          () => placePurchaseOrder(order.purchaseOrderId, { supplierOrderCode: code, note }),
          "Đã ghi nhận đặt hàng và bàn giao việc cho kho nguồn."
        ),
    });
  };

  const askProgress = (order) => {
    const step = getNextProgressStep(order.status);

    if (!step) return;

    let tracking = "";
    let carrier = "";

    Modal.confirm({
      title: `${step.label} — ${order.purchaseOrderCode}`,
      width: 520,
      content: step.needsTracking ? (
        <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
          <Text type="secondary">Mã vận đơn nội địa là bắt buộc để khách theo dõi được.</Text>
          <Input
            placeholder="Mã vận đơn nội địa"
            onChange={(event) => {
              tracking = event.target.value;
            }}
          />
          <Input
            placeholder="Hãng vận chuyển nội địa (không bắt buộc)"
            onChange={(event) => {
              carrier = event.target.value;
            }}
          />
        </Space>
      ) : (
        <Text type="secondary">Ghi nhận nhà cung cấp đã xác nhận đơn.</Text>
      ),
      okText: step.label,
      cancelText: "Huỷ",
      onOk: () =>
        run(
          order.purchaseOrderId,
          () =>
            updatePurchaseOrderProgress(order.purchaseOrderId, {
              status: step.status,
              domesticTrackingCode: tracking,
              domesticCarrier: carrier,
            }),
          "Đã cập nhật tiến độ và báo cho khách."
        ),
    });
  };

  const askDecide = (order, approve) => {
    let note = "";

    Modal.confirm({
      title: approve
        ? `Duyệt ngân sách — ${order.purchaseOrderCode}`
        : `Từ chối đơn mua — ${order.purchaseOrderCode}`,
      width: 520,
      content: (
        <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
          <Text type="secondary">
            {approve
              ? `Công ty sẽ chi ${formatVnd(order.totalAmount)} cho ${order.supplierName || "nhà cung cấp"}.`
              : "Ghi rõ lý do để Sale sửa lại đơn."}
          </Text>
          <Input.TextArea
            rows={3}
            placeholder={approve ? "Ghi chú (không bắt buộc)" : "Lý do từ chối (bắt buộc)"}
            onChange={(event) => {
              note = event.target.value;
            }}
          />
        </Space>
      ),
      okText: approve ? "Duyệt" : "Từ chối",
      okButtonProps: { danger: !approve },
      cancelText: "Đóng",
      onOk: () =>
        run(
          order.purchaseOrderId,
          () => decidePurchaseOrder(order.purchaseOrderId, { approve, note }),
          approve ? "Đã duyệt ngân sách." : "Đã từ chối, Sale sửa lại rồi gửi lần nữa."
        ),
    });
  };

  const askCancel = (order) => {
    let reason = "";

    Modal.confirm({
      title: `Huỷ đơn mua ${order.purchaseOrderCode}`,
      width: 520,
      content: (
        <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
          <Text type="secondary">
            Chỉ huỷ được khi kho chưa nhận kiện nào của đơn. Tiền đã chi cho NCC xử lý ngoài
            hệ thống.
          </Text>
          <Input.TextArea
            rows={3}
            placeholder="Lý do huỷ (bắt buộc)"
            onChange={(event) => {
              reason = event.target.value;
            }}
          />
        </Space>
      ),
      okText: "Huỷ đơn mua",
      okButtonProps: { danger: true },
      cancelText: "Đóng",
      onOk: () =>
        run(order.purchaseOrderId, () => cancelPurchaseOrder(order.purchaseOrderId, { reason }), "Đã huỷ đơn mua."),
    });
  };

  const columns = [
    {
      title: "Đơn mua",
      dataIndex: "purchaseOrderCode",
      width: 190,
      render: (value, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.purchaseCode} · {row.customerName || "—"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Nhà cung cấp",
      dataIndex: "supplierName",
      render: (value, row) => (
        <Space direction="vertical" size={0}>
          <Text>{value || "Chưa chọn"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.warehouseName ? `Về ${row.warehouseName}` : "Chưa gắn kho"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Tiền hàng",
      dataIndex: "totalAmount",
      width: 175,
      render: (value, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{formatVnd(value)}</Text>
          {row.priceDifferenceAmount > 0 && (
            <Text type="danger" style={{ fontSize: 12 }}>
              Chênh {formatVnd(row.priceDifferenceAmount)}
            </Text>
          )}
          {row.currency && row.currency !== "VND" && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.currency} · tỷ giá {Number(row.exchangeRate || 0).toLocaleString("vi-VN")}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 210,
      render: (value, row) => (
        <Space direction="vertical" size={2}>
          <Tag color={row.statusMeta.tone} style={{ whiteSpace: "normal" }}>
            {row.statusText || row.statusMeta.label}
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Đang chờ: {row.statusMeta.waiting}
          </Text>
        </Space>
      ),
    },
    {
      title: "Đơn kho",
      dataIndex: "warehouseOrderCode",
      width: 160,
      render: (value, row) =>
        value ? (
          <Space direction="vertical" size={0}>
            <Text>{value}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.warehouseOrderStatus || ""}
            </Text>
          </Space>
        ) : (
          <Text type="secondary">Sinh khi đặt NCC</Text>
        ),
    },
    {
      title: "Mốc gần nhất",
      key: "time",
      width: 170,
      render: (_, row) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatDateTime(
            row.supplierShippedAt ||
              row.supplierConfirmedAt ||
              row.orderedAt ||
              row.decidedAt ||
              row.submittedAt
          )}
        </Text>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: 230,
      render: (_, row) => {
        const can = getAvailableActions(row, role);
        const busy = busyId === row.purchaseOrderId;
        const step = getNextProgressStep(row.status);

        return (
          <Space size={[6, 6]} wrap>
            {can.edit && (
              <Button
                size="small"
                icon={<EditOutlined />}
                disabled={busy}
                onClick={() => openFormFor(row.purchaseRequestId, row)}
              >
                Sửa
              </Button>
            )}

            {can.submit && (
              <Button
                size="small"
                type="primary"
                icon={<SendOutlined />}
                loading={busy}
                onClick={() =>
                  run(
                    row.purchaseOrderId,
                    () => submitPurchaseOrder(row.purchaseOrderId),
                    "Đã gửi duyệt."
                  )
                }
              >
                Gửi duyệt
              </Button>
            )}

            {can.decide && (
              <>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={busy}
                  onClick={() => askDecide(row, true)}
                >
                  Duyệt
                </Button>
                <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => askDecide(row, false)}>
                  Từ chối
                </Button>
              </>
            )}

            {can.place && (
              <Button
                size="small"
                type="primary"
                icon={<ShoppingCartOutlined />}
                loading={busy}
                onClick={() => askPlace(row)}
              >
                Đã đặt NCC
              </Button>
            )}

            {can.progress && step && (
              <Button size="small" type="primary" loading={busy} onClick={() => askProgress(row)}>
                {step.label}
              </Button>
            )}

            {can.cancel && (
              <Tooltip title="Chỉ huỷ được khi kho chưa nhận kiện">
                <Button size="small" danger onClick={() => askCancel(row)}>
                  Huỷ
                </Button>
              </Tooltip>
            )}

            {!can.edit && !can.submit && !can.decide && !can.place && !can.progress && !can.cancel && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Đang chờ bộ phận khác
              </Text>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>{role === "admin" ? "QUẢN TRỊ" : "KINH DOANH (SALE)"}</span>
          <h1>Đơn Mua Nhà Cung Cấp</h1>
          <p>
            Mỗi đơn mua là một lần công ty chi tiền: Sale lập và đặt hàng, Admin duyệt ngân sách.
            Đặt xong, hệ thống tự sinh đơn kho và phiếu tiếp nhận cho kho nguồn — không ai phải
            bấm tay tiến độ nữa.
          </p>
        </div>

        <div className="ops-page__hero-actions">
          {role === "sale" && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openPicker}>
              Lập đơn mua
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={load}>
            Tải lại
          </Button>
        </div>
      </section>

      {errorMessage && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message={errorMessage} />
      )}

      <Space size={[10, 10]} wrap style={{ marginBottom: 12 }}>
        <Segmented
          value={statusFilter}
          options={FILTERS}
          onChange={(value) => setStatusFilter(value)}
        />
        <Input.Search
          allowClear
          placeholder="Mã đơn mua, mã yêu cầu, NCC hoặc khách"
          style={{ width: 320 }}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </Space>

      <Spin spinning={loading}>
        <Table
          rowKey="purchaseOrderId"
          size="middle"
          columns={columns}
          dataSource={visible}
          scroll={{ x: 1180 }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{
            emptyText: (
              <Empty
                description={
                  statusFilter
                    ? "Không có đơn mua nào ở trạng thái này"
                    : "Chưa có đơn mua nào. Sale lập đơn từ yêu cầu khách đã trả trước."
                }
              />
            ),
          }}
        />
      </Spin>

      <Modal
        open={pickerOpen}
        title="Chọn yêu cầu mua hộ để lập đơn"
        width={760}
        footer={null}
        onCancel={() => setPickerOpen(false)}
      >
        <Spin spinning={pickerLoading}>
          <Table
            rowKey={(row) => row.purchaseRequestId || row.id}
            size="small"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            dataSource={pickerRows}
            locale={{
              emptyText: <Empty description="Chưa có yêu cầu nào đã trả trước" />,
            }}
            columns={[
              { title: "Mã", dataIndex: "purchaseCode", width: 170 },
              { title: "Khách", dataIndex: "customerName" },
              { title: "Trạng thái", dataIndex: "status", width: 140 },
              {
                title: "",
                key: "pick",
                width: 110,
                render: (_, row) => (
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      setPickerOpen(false);
                      openFormFor(row.purchaseRequestId || row.id);
                    }}
                  >
                    Chọn
                  </Button>
                ),
              },
            ]}
          />
        </Spin>
      </Modal>

      <PurchaseOrderFormModal
        open={formOpen}
        mode={formMode}
        request={request}
        existingOrders={requestOrders}
        editingOrder={editingOrder}
        suppliers={suppliers}
        warehouses={warehouses}
        loading={formLoading}
        submitting={submitting}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSaveOrder}
      />
    </div>
  );
}
