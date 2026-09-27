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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Radio,
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
  PURCHASE_CANCEL_CAUSE,
  PURCHASE_CANCEL_CAUSE_META,
  PURCHASE_ORDER_STATUS,
  cancelPurchaseOrder,
  completePurchaseRefund,
  getRefundTypeLabel,
  createPurchaseOrder,
  decidePurchaseOrder,
  getPendingRefunds,
  getPurchaseOrderApiError,
  getPurchaseRequestRefunds,
  listPurchaseOrders,
  listPurchaseOrdersOfRequest,
  placePurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderProgress,
} from "@features/purchase/api/purchaseOrderService";
import {
  getCustomerDirectory,
  getPurchaseRequestDetail,
  listActiveWarehouses,
  listPurchaseRequests,
  listSuppliers,
} from "@features/purchase/api/purchaseCatalogService";
import "@features/operations/styles/OperationsPage.css";

import CloseUnfulfilledModal from "@features/purchase/components/PurchaseRefunds/CloseUnfulfilledModal";
import OrderRefundsModal from "@features/purchase/components/PurchaseRefunds/OrderRefundsModal";

import PlacePurchaseOrderModal from "./PlacePurchaseOrderModal";
import PurchaseOrderFormModal from "./PurchaseOrderFormModal";
/*
 * Mọi hộp xác nhận của màn hiện ĐỦ đơn mua (hàng từng dòng, giá mua / giá đã báo, NCC, kho,
 * tiền, chênh lệch) chứ không chỉ mã đơn — dữ liệu có sẵn trên dòng bảng, không gọi thêm.
 */
import PurchaseOrderReview, { PurchaseOrderReviewScroll } from "./PurchaseOrderReview";
import {
  buildPickerRow,
  formatDateTime,
  PLACED_STATUSES,
  formatVnd,
  getAvailableActions,
  getNextProgressStep,
  getWarehouseOrderStatusLabel,
  toSearchText,
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

/* Trạng thái yêu cầu được lập đơn mua ở màn này (backend nhận thêm vài trạng thái đời cũ). */
const PICKER_REQUEST_STATUSES = ["PAID", "PURCHASING"];

const MAIN_PAGE_SIZE = 20;

/** Chạy `worker` cho từng phần tử, tối đa `limit` lời gọi cùng lúc — giữ đúng thứ tự kết quả. */
const mapWithLimit = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);

  return results;
};

const toTime = (value) => {
  const time = value ? new Date(value).getTime() : 0;

  return Number.isFinite(time) ? time : 0;
};

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
  const [requestRefunds, setRequestRefunds] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  /* Chọn yêu cầu để lập đơn mới */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerRows, setPickerRows] = useState([]);
  const [pickerKeyword, setPickerKeyword] = useState("");
  const [pickerNotes, setPickerNotes] = useState([]);

  /* Đơn mua vừa tạo / vừa sửa — tô sáng và cuộn tới trong bảng chính. */
  const [highlightId, setHighlightId] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const tableWrapRef = useRef(null);

  /* Hộp "Đã đặt NCC" (có tải chứng từ bắt buộc). */
  const [placeTarget, setPlaceTarget] = useState(null);

  /*
   * Tiền hoàn: giữ MÃ đơn chứ không giữ bản sao dòng — bảng tải lại sau mỗi thao tác thì hộp
   * đang mở tự đọc dòng mới (khoản vừa đóng hiện ngay "Đã chuyển trả").
   */
  const [refundOrderId, setRefundOrderId] = useState("");
  const [shortageTarget, setShortageTarget] = useState(null);
  const [shortageSeq, setShortageSeq] = useState(0);

  /* Đơn cần đưa ra trước mắt ở lần tải tới (vừa tạo / vừa sửa). */
  const pendingFocusRef = useRef("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const rows = await listPurchaseOrders({ status: statusFilter });

      setOrders(rows);

      /* Nhảy tới trang có đơn vừa lưu (bảng sắp theo lần cập nhật gần nhất nên thường ở trang 1). */
      if (pendingFocusRef.current) {
        const index = rows.findIndex((row) => row.purchaseOrderId === pendingFocusRef.current);

        setTablePage(index >= 0 ? Math.floor(index / MAIN_PAGE_SIZE) + 1 : 1);
        pendingFocusRef.current = "";
      }
    } catch (error) {
      setErrorMessage(getPurchaseOrderApiError(error, "Không tải được danh sách đơn mua."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  /* Cuộn tới dòng đang tô sáng, rồi tắt tô sáng sau vài giây. */
  useEffect(() => {
    if (!highlightId) return undefined;

    const scrollTimer = setTimeout(() => {
      tableWrapRef.current
        ?.querySelector(`[data-row-key="${highlightId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    const clearTimer = setTimeout(() => setHighlightId(""), 8000);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightId, orders, tablePage]);

  /* Danh mục chỉ cần tải một lần cho cả phiên làm việc. */
  useEffect(() => {
    Promise.allSettled([listSuppliers(), listActiveWarehouses()]).then(([s, w]) => {
      if (s.status === "fulfilled") setSuppliers(s.value);
      if (w.status === "fulfilled") setWarehouses(w.value);
    });
  }, []);

  const refundOrder = useMemo(
    () => orders.find((order) => order.purchaseOrderId === refundOrderId) || null,
    [orders, refundOrderId]
  );

  const openShortage = (order) => {
    setRefundOrderId("");
    setShortageSeq((value) => value + 1);
    setShortageTarget({
      purchaseRequestId: order.purchaseRequestId,
      purchaseOrderId: order.purchaseOrderId,
    });
  };

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
      return true;
    } catch (error) {
      AuthNotify.error("Không thực hiện được", getPurchaseOrderApiError(error));
      return false;
    } finally {
      setBusyId("");
    }
  };

  /*
   * Hộp chọn yêu cầu để lập đơn.
   *
   * GET /api/purchase-requests (`PurchaseRequestListItemDto`) nay trả sẵn tên / mã / SĐT khách và
   * số liệu lập đơn (`openLineCount`, `openQuantity`, `closedQuantity`, `activePurchaseOrderCount`,
   * `prepaidAmount`) → một lượt đọc danh sách là đủ.
   *
   * DỰ PHÒNG backend cũ (dòng thiếu các trường đó — xem `hasCustomerInfo` / `hasLineInfo` trong
   * purchaseCatalogService): tên khách ghép từ danh bạ GET /api/customers (một lời gọi cho cả danh
   * sách), số dòng còn lập đơn được thì đọc đơn mua của từng yêu cầu ứng viên, như trước.
   *
   * Chỉ hiện yêu cầu còn sản phẩm lập đơn mua được: backend chỉ cho mỗi sản phẩm nằm trong MỘT
   * đơn mua chưa huỷ, nên yêu cầu đã lập đơn cho mọi sản phẩm không lập thêm được.
   */
  const openPicker = async () => {
    setPickerOpen(true);
    setPickerLoading(true);
    setPickerKeyword("");
    setPickerNotes([]);

    try {
      const requestLists = await Promise.all(
        PICKER_REQUEST_STATUSES.map((status) => listPurchaseRequests({ status }))
      );

      const seen = new Set();
      const requests = requestLists.flat().filter((row) => {
        const id = String(row.purchaseRequestId || "").toLowerCase();

        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      const needsDirectory = requests.some((row) => !row.hasCustomerInfo);
      const legacyLineRequests = requests.filter((row) => !row.hasLineInfo);

      const [directoryResult, legacyOrders] = await Promise.all([
        needsDirectory
          ? getCustomerDirectory().then(
            (value) => ({ ok: true, value }),
            () => ({ ok: false, value: new Map() })
          )
          : Promise.resolve({ ok: true, value: new Map() }),
        mapWithLimit(legacyLineRequests, 6, (row) =>
          listPurchaseOrdersOfRequest(row.purchaseRequestId).catch(() => null)
        ),
      ]);

      const ordersById = new Map(
        legacyLineRequests.map((row, index) => [row.purchaseRequestId, legacyOrders[index]])
      );

      const built = requests.map((row) =>
        buildPickerRow(row, {
          customer: row.hasCustomerInfo
            ? null
            : directoryResult.value.get(String(row.customerId || "").toLowerCase()) || null,
          orders: row.hasLineInfo ? null : ordersById.get(row.purchaseRequestId) ?? null,
        })
      );

      const rows = built
        .filter((row) => row.openLines === null || row.openLines > 0)
        .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));

      const notes = [];
      const hidden = built.length - rows.length;

      if (hidden > 0) {
        notes.push(
          `Đã ẩn ${hidden} yêu cầu không còn sản phẩm nào lập đơn mua được (đã nằm trong đơn mua còn hiệu lực hoặc đã đóng "không mua được").`
        );
      }
      if (!directoryResult.ok) {
        notes.push("Không tải được danh bạ khách hàng — cột Khách tạm hiện người nhận hàng.");
      }
      if (legacyOrders.some((orders) => orders === null)) {
        notes.push("Một số yêu cầu chưa đọc được đơn mua đã có — hộp lập đơn sẽ kiểm lại khi chọn.");
      }

      setPickerRows(rows);
      setPickerNotes(notes);
    } catch (error) {
      AuthNotify.error("Không tải được", getPurchaseOrderApiError(error));
    } finally {
      setPickerLoading(false);
    }
  };

  const visiblePickerRows = useMemo(() => {
    const term = toSearchText(pickerKeyword.trim());

    if (!term) return pickerRows;

    return pickerRows.filter((row) => row.searchText.includes(term));
  }, [pickerRows, pickerKeyword]);

  const openFormFor = async (purchaseRequestId, order = null) => {
    setFormMode(order ? "edit" : "create");
    setEditingOrder(order);
    setFormOpen(true);
    setFormLoading(true);

    try {
      setRequestRefunds([]);

      const [detail, existing, refundSummary] = await Promise.all([
        getPurchaseRequestDetail(purchaseRequestId),
        listPurchaseOrdersOfRequest(purchaseRequestId),
        /* Phần đã đóng "không mua được" — thiếu cũng không chặn lập đơn, backend vẫn kiểm lại. */
        getPurchaseRequestRefunds(purchaseRequestId).catch(() => null),
      ]);

      setRequest(detail);
      setRequestOrders(existing);
      setRequestRefunds(refundSummary?.refunds || []);
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
      const saved =
        formMode === "edit" && editingOrder
          ? await updatePurchaseOrder(editingOrder.purchaseOrderId, payload)
          : await createPurchaseOrder(request.purchaseRequestId || request.id, payload);

      AuthNotify.success(
        "Đã lưu",
        `Đơn mua ${saved?.purchaseOrderCode || ""} đã lưu ở trạng thái nháp, gửi duyệt khi sẵn sàng.`
      );
      setFormOpen(false);
      setPickerOpen(false);
      setPickerRows([]);

      /* Đưa đơn vừa lưu ra trước mắt: bỏ lọc đang che mất nó rồi tô sáng. */
      const savedId = saved?.purchaseOrderId || editingOrder?.purchaseOrderId || "";
      const savedStatus = String(saved?.status || PURCHASE_ORDER_STATUS.DRAFT).toUpperCase();

      pendingFocusRef.current = savedId;
      setHighlightId(savedId);
      setKeyword("");

      if (statusFilter && statusFilter !== savedStatus) {
        setStatusFilter("");
      } else {
        await load();
      }
    } catch (error) {
      AuthNotify.error("Không lưu được", getPurchaseOrderApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  /*
   * Gửi duyệt trước đây bấm là gửi ngay. Giờ qua hộp xác nhận hiện đủ đơn: gửi xong đơn khoá
   * sửa và chuyển sang bước khách / Admin xác nhận (server quyết theo chênh lệch giá).
   */
  const askSubmit = (order) => {
    Modal.confirm({
      title: `Gửi duyệt đơn mua — ${order.purchaseOrderCode}`,
      width: 1000,
      content: (
        <PurchaseOrderReviewScroll>
          <PurchaseOrderReview order={order} />
          <Text type="secondary">
            Gửi xong đơn không sửa được nữa. Hệ thống so giá mua với giá đã báo khách: lệch quá
            ngưỡng thì chờ khách đồng ý, còn lại chờ Admin duyệt ngân sách.
          </Text>
        </PurchaseOrderReviewScroll>
      ),
      okText: "Gửi duyệt",
      cancelText: "Đóng",
      onOk: () =>
        run(
          order.purchaseOrderId,
          () => submitPurchaseOrder(order.purchaseOrderId),
          "Đã gửi duyệt."
        ),
    });
  };

  /*
   * "Đã đặt NCC": hộp riêng vì backend bắt buộc chứng từ PURCHASE_PROOF + mã đơn thật của NCC —
   * Modal.confirm cũ không tải được ảnh nên lần nào bấm cũng ăn lỗi 400.
   */
  const askPlace = (order) => setPlaceTarget(order);

  const confirmPlace = async ({ supplierOrderCode, note }) => {
    if (!placeTarget) return;

    const ok = await run(
      placeTarget.purchaseOrderId,
      () => placePurchaseOrder(placeTarget.purchaseOrderId, { supplierOrderCode, note }),
      "Đã ghi nhận đặt hàng và bàn giao việc cho kho nguồn."
    );

    if (ok) setPlaceTarget(null);
  };

  const askProgress = (order) => {
    const step = getNextProgressStep(order.status);

    if (!step) return;

    let tracking = "";
    let carrier = "";

    Modal.confirm({
      title: `${step.label} — ${order.purchaseOrderCode}`,
      width: 1000,
      content: (
        <PurchaseOrderReviewScroll>
          <PurchaseOrderReview order={order} />
          {step.needsTracking ? (
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
          )}
        </PurchaseOrderReviewScroll>
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
      width: 1000,
      content: (
        <PurchaseOrderReviewScroll>
          <PurchaseOrderReview order={order} />
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
        </PurchaseOrderReviewScroll>
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

  /*
   * Huỷ đơn mua. Với đơn ĐÃ đặt NCC phải chọn NGUYÊN NHÂN (`cause`) vì hai nguyên nhân cho ra hai
   * con số hoàn khác hẳn nhau — giải thích ngay trong hộp để Admin không phải nhớ chính sách.
   * Đơn chưa đặt NCC thì nguyên nhân không đổi gì về tiền (tiền trả trước vẫn ở yêu cầu), nên ẩn.
   */
  const askCancel = (order) => {
    let reason = "";
    let cause = PURCHASE_CANCEL_CAUSE.CUSTOMER;
    const placed = PLACED_STATUSES.includes(String(order.status || "").toUpperCase());

    Modal.confirm({
      title: `Huỷ đơn mua ${order.purchaseOrderCode}`,
      width: 1000,
      content: (
        <PurchaseOrderReviewScroll>
          <PurchaseOrderReview order={order} />
          <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
            <Text type="secondary">
              Chỉ huỷ được khi kho chưa nhận kiện nào của đơn. Huỷ xong, đơn kho + hoá đơn chặng VN
              của đơn này huỷ theo.
            </Text>

            {placed ? (
              <>
                <Text strong>Nguyên nhân huỷ — quyết định số tiền hoàn cho khách</Text>
                <Radio.Group
                  defaultValue={PURCHASE_CANCEL_CAUSE.CUSTOMER}
                  onChange={(event) => {
                    cause = event.target.value;
                  }}
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {Object.values(PURCHASE_CANCEL_CAUSE).map((value) => (
                    <Radio key={value} value={value}>
                      <Text strong>{PURCHASE_CANCEL_CAUSE_META[value].label}</Text>
                      <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                        {PURCHASE_CANCEL_CAUSE_META[value].refundRule}
                        {value === PURCHASE_CANCEL_CAUSE.CUSTOMER
                          ? ` Phí huỷ đang cấu hình: ${order.cancelFeeRate}% tiền hàng khách thực trả.`
                          : ""}
                      </Text>
                    </Radio>
                  ))}
                </Radio.Group>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Số tiền hoàn do server tính và lập thành khoản chờ chuyển; tổng hoàn vượt số khách đã
                  trả thì server từ chối và đơn giữ nguyên.
                </Text>
              </>
            ) : (
              <Text type="secondary">
                Đơn chưa đặt NCC: chưa có đồng nào ra khỏi công ty, tiền trả trước vẫn nằm ở yêu cầu
                cho đơn mua kế tiếp — không hoàn, không phí. Riêng phần chênh giá khách đã trả thêm
                cho đơn này (nếu có) được trả lại.
              </Text>
            )}

            <Input.TextArea
              rows={3}
              placeholder="Lý do huỷ (bắt buộc)"
              onChange={(event) => {
                reason = event.target.value;
              }}
            />
          </Space>
        </PurchaseOrderReviewScroll>
      ),
      okText: "Huỷ đơn mua",
      okButtonProps: { danger: true },
      cancelText: "Đóng",
      onOk: () =>
        run(
          order.purchaseOrderId,
          () => cancelPurchaseOrder(order.purchaseOrderId, { reason, cause }),
          placed
            ? `Đã huỷ đơn mua — nguyên nhân: ${PURCHASE_CANCEL_CAUSE_META[cause].label}. Xem khoản hoàn ở nút Khoản hoàn.`
            : "Đã huỷ đơn mua."
        ),
    });
  };

  /*
   * Xác nhận đã hoàn tiền — ĐƯỜNG CŨ, chỉ dùng khi backend chưa trả `refunds[]` (production):
   * khi đó đơn chỉ có một khoản nên không cần `refundId`. Backend mới đi qua `OrderRefundsModal`.
   *
   * Không gộp vào nút "Huỷ": tiền ra khỏi tài khoản là một việc riêng, xảy ra SAU,
   * do kế toán làm, và cần mã giao dịch làm bằng chứng. Gộp lại thì người bấm huỷ
   * sẽ vô tình đóng luôn sổ tiền mà chưa chuyển đồng nào.
   */
  const askCompleteRefund = (order) => {
    let transactionCode = "";

    Modal.confirm({
      title: `Xác nhận đã hoàn tiền — ${order.purchaseOrderCode}`,
      width: 1000,
      content: (
        <PurchaseOrderReviewScroll>
          <PurchaseOrderReview order={order} />
          <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
            <Text>
              Số tiền phải trả lại khách: <Text strong>{formatVnd(order.refundAmount)}</Text>
            </Text>
            <Text type="secondary">Lý do: {getRefundTypeLabel(order.refundType)}</Text>

            {order.cancelFeeAmount > 0 && (
              <Text type="secondary">
                Đã trừ phí huỷ {formatVnd(order.cancelFeeAmount)} ({order.cancelFeeRate}% tiền hàng
                đã báo).
              </Text>
            )}

            <Text type="secondary">
              Chỉ bấm sau khi tiền đã thực sự chuyển đi. Bấm xong không hoàn lại lần hai được.
            </Text>

            <Input
              placeholder="Mã giao dịch chuyển khoản (bắt buộc)"
              onChange={(event) => {
                transactionCode = event.target.value;
              }}
            />
          </Space>
        </PurchaseOrderReviewScroll>
      ),
      okText: "Đã chuyển trả khách",
      cancelText: "Đóng",
      onOk: () =>
        run(
          order.purchaseOrderId,
          () => completePurchaseRefund(order.purchaseOrderId, { transactionCode }),
          "Đã ghi nhận hoàn tiền."
        ),
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
          {/* Tiền đi NGƯỢC — để cạnh tiền hàng cho Sale thấy cùng một chỗ. */}
          {row.refunds.length > 0 ? (
            <Text style={{ fontSize: 12, color: getPendingRefunds(row).length ? "#b45309" : "#0f766e" }}>
              Hoàn {formatVnd(row.totalRefundAmount)} · {row.refunds.length} khoản
              {getPendingRefunds(row).length ? `, ${getPendingRefunds(row).length} chờ chuyển` : ""}
            </Text>
          ) : row.refundAmount > 0 && (
            <Text
              style={{
                fontSize: 12,
                color: row.refundStatus === "REFUNDED" ? "#0f766e" : "#b45309",
              }}
            >
              {row.refundStatus === "REFUNDED" ? "Đã hoàn " : "Phải hoàn "}
              {formatVnd(row.refundAmount)}
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
              {row.warehouseOrderStatus ? getWarehouseOrderStatusLabel(row.warehouseOrderStatus) : ""}
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
                onClick={() => askSubmit(row)}
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
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => askDecide(row, false)}
                >
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

            {/* Backend mới: mọi khoản hoàn của đơn, đóng từng khoản theo refundId. */}
            {can.viewRefunds && row.refunds.length > 0 && (
              <Button
                size="small"
                type={getPendingRefunds(row).length ? "primary" : "default"}
                ghost={getPendingRefunds(row).length > 0}
                onClick={() => setRefundOrderId(row.purchaseOrderId)}
              >
                Khoản hoàn ({row.refunds.length})
              </Button>
            )}

            {can.closeShortage && (
              <Tooltip title="NCC giao thiếu, hoặc đóng phần sản phẩm không mua được — lập khoản hoàn">
                <Button size="small" onClick={() => openShortage(row)}>
                  NCC giao thiếu
                </Button>
              </Tooltip>
            )}

            {/* Backend cũ (production): chỉ có một khoản, đóng theo đường cũ không refundId. */}
            {can.completeRefund && row.refunds.length === 0 && (
              <Tooltip title={getRefundTypeLabel(row.refundType)}>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  loading={busy}
                  onClick={() => askCompleteRefund(row)}
                >
                  Hoàn tiền
                </Button>
              </Tooltip>
            )}

            {!can.edit &&
              !can.submit &&
              !can.decide &&
              !can.place &&
              !can.progress &&
              !can.cancel &&
              !can.completeRefund &&
              !can.viewRefunds &&
              !can.closeShortage && (
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
            Đặt xong, hệ thống tự sinh đơn kho và phiếu tiếp nhận cho kho nguồn — không ai phải bấm
            tay tiến độ nữa.
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
          onChange={(value) => {
            setStatusFilter(value);
            setTablePage(1);
          }}
        />
        <Input.Search
          allowClear
          placeholder="Mã đơn mua, mã yêu cầu, NCC hoặc khách"
          style={{ width: 320 }}
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setTablePage(1);
          }}
        />
      </Space>

      <Spin spinning={loading}>
        <div ref={tableWrapRef}>
        <Table
          rowKey="purchaseOrderId"
          size="middle"
          columns={columns}
          dataSource={visible}
          scroll={{ x: 1180 }}
          onRow={(row) =>
            row.purchaseOrderId === highlightId
              ? { style: { background: "#fffbe6", boxShadow: "inset 3px 0 0 #faad14" } }
              : {}
          }
          pagination={{
            current: tablePage,
            pageSize: MAIN_PAGE_SIZE,
            showSizeChanger: false,
            showTotal: (total) => `${total} đơn mua`,
            onChange: (page) => setTablePage(page),
          }}
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
        </div>
      </Spin>

      <Modal
        open={pickerOpen}
        title="Chọn yêu cầu mua hộ để lập đơn"
        width={1080}
        footer={null}
        onCancel={() => setPickerOpen(false)}
      >
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <Text type="secondary">
            Yêu cầu khách đã trả trước (Đã trả trước, chờ đặt mua) hoặc đang mua dở, còn sản phẩm
            chưa nằm trong đơn mua nào. Mới nhất ở trên.
          </Text>

          <Input.Search
            allowClear
            placeholder="Tìm mã yêu cầu, tên khách, mã khách hoặc SĐT"
            value={pickerKeyword}
            onChange={(event) => setPickerKeyword(event.target.value)}
          />

          {pickerNotes.map((note) => (
            <Alert key={note} type="info" showIcon message={note} />
          ))}

          <Spin spinning={pickerLoading}>
            <Table
              rowKey={(row) => row.purchaseRequestId || row.id}
              size="small"
              scroll={{ x: 980 }}
              pagination={{
                pageSize: 8,
                showSizeChanger: false,
                hideOnSinglePage: true,
                showTotal: (total) => `${total} yêu cầu`,
              }}
              dataSource={visiblePickerRows}
              locale={{
                emptyText: (
                  <Empty
                    description={
                      pickerKeyword.trim()
                        ? "Không có yêu cầu nào khớp từ khoá"
                        : "Không còn yêu cầu nào đã trả trước cần lập đơn mua"
                    }
                  />
                ),
              }}
              columns={[
                {
                  title: "Mã yêu cầu",
                  dataIndex: "purchaseCode",
                  width: 230,
                  render: (value) => (
                    <Text
                      strong
                      copyable={value ? { text: value } : false}
                      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, whiteSpace: "nowrap" }}
                    >
                      {value || "—"}
                    </Text>
                  ),
                },
                {
                  title: "Khách",
                  key: "customer",
                  render: (_, row) =>
                    row.customerName ? (
                      <Space direction="vertical" size={0}>
                        <Text strong>{row.customerName}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {[row.customerCode, row.customerPhone].filter(Boolean).join(" · ") || "—"}
                        </Text>
                      </Space>
                    ) : (
                      <Space direction="vertical" size={0}>
                        <Text>{row.receiverName || "—"}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {row.receiverName ? "người nhận hàng" : "chưa rõ khách"}
                        </Text>
                      </Space>
                    ),
                },
                {
                  title: "Sản phẩm",
                  key: "items",
                  width: 170,
                  render: (_, row) => (
                    <Space direction="vertical" size={0}>
                      <Text>
                        {row.itemCount} sản phẩm · SL {row.totalQuantity}
                      </Text>
                      {row.hasLineInfo ? (
                        <Text
                          type={row.activeOrderCount > 0 || row.closedQuantity > 0 ? "warning" : "secondary"}
                          style={{ fontSize: 12 }}
                        >
                          {[
                            `Còn ${row.openLines}/${row.itemCount} dòng mua được`,
                            row.openQuantity !== null ? `SL ${row.openQuantity}` : "",
                            row.activeOrderCount > 0
                              ? `${row.activeOrderCount} đơn mua`
                              : "chưa có đơn mua",
                            row.closedQuantity > 0 ? `đã đóng ${row.closedQuantity} không mua được` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      ) : row.openLines !== null && row.activeOrderCount > 0 ? (
                        <Text type="warning" style={{ fontSize: 12 }}>
                          Còn {row.openLines}/{row.itemCount} chưa lập đơn · {row.activeOrderCount} đơn mua
                        </Text>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Chưa có đơn mua
                        </Text>
                      )}
                    </Space>
                  ),
                },
                {
                  title: "Trạng thái",
                  key: "status",
                  width: 190,
                  render: (_, row) => (
                    <Space direction="vertical" size={2}>
                      <Tag color={row.statusView.color} style={{ whiteSpace: "normal" }}>
                        {row.statusView.label}
                      </Tag>
                      {row.prepaidAmount !== null && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Đã thu trước: <Text strong style={{ fontSize: 12 }}>{formatVnd(row.prepaidAmount)}</Text>
                        </Text>
                      )}
                    </Space>
                  ),
                },
                {
                  title: "Ngày tạo / cập nhật",
                  key: "time",
                  width: 170,
                  render: (_, row) => (
                    <Space direction="vertical" size={0}>
                      <Text style={{ fontSize: 12 }}>{formatDateTime(row.createdAt)}</Text>
                      {row.statusUpdatedAt && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {row.status === "PAID" ? "Trả trước: " : "Cập nhật: "}
                          {formatDateTime(row.statusUpdatedAt)}
                        </Text>
                      )}
                    </Space>
                  ),
                },
                {
                  title: "",
                  key: "pick",
                  width: 90,
                  fixed: "right",
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
        </Space>
      </Modal>

      {placeTarget && (
        <PlacePurchaseOrderModal
          key={placeTarget.purchaseOrderId}
          open
          order={placeTarget}
          submitting={busyId === placeTarget.purchaseOrderId}
          onCancel={() => setPlaceTarget(null)}
          onConfirm={confirmPlace}
        />
      )}

      <OrderRefundsModal
        open={Boolean(refundOrder)}
        order={refundOrder}
        canComplete={role === "sale" || role === "admin"}
        canCloseShortage={Boolean(refundOrder && getAvailableActions(refundOrder, role).closeShortage)}
        onClose={() => setRefundOrderId("")}
        onChanged={load}
        onCloseShortage={openShortage}
      />

      {/* key mới mỗi lần mở → ô nhập luôn trắng, dữ liệu yêu cầu luôn nạp lại. */}
      <CloseUnfulfilledModal
        key={shortageSeq}
        open={Boolean(shortageTarget)}
        purchaseRequestId={shortageTarget?.purchaseRequestId}
        focusOrderId={shortageTarget?.purchaseOrderId}
        onClose={() => setShortageTarget(null)}
        onDone={load}
      />

      <PurchaseOrderFormModal
        open={formOpen}
        mode={formMode}
        request={request}
        existingOrders={requestOrders}
        refunds={requestRefunds}
        toleranceRate={(editingOrder || requestOrders[0] || orders[0])?.priceToleranceRate}
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
