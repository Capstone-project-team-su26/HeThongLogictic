import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Button,
  Collapse,
  Empty,
  Input,
  Select,
  Spin,
  Tooltip,
} from "antd";
import {
  CloseOutlined,
  ReloadOutlined,
  RobotOutlined,
} from "@ant-design/icons";

import {
  buildCustomerReply,
  buildWarnings,
  getSalesAiError,
  querySalesOrderStatus,
} from "../../../../api/SaleAPI/AiAPI/saleAiService";
import { getConsignmentsApi } from "../../../../api/SaleAPI/ConsignmentAPI/consignmentService";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import "./SalesAiAssistantPanel.css";

const normalizeText = (value) => String(value ?? "").trim();

const QUICK_ACTIONS = [
  {
    key: "status",
    label: "Kiểm tra trạng thái đơn",
    buildMessage: (code) =>
      code
        ? `Kiểm tra trạng thái đơn ${code}: thanh toán, kho, vận chuyển quốc tế.`
        : "Kiểm tra trạng thái đơn liên quan của khách hàng hiện tại.",
  },
  {
    key: "reply",
    label: "Soạn câu trả lời cho khách",
    buildMessage: (code) =>
      code
        ? `Soạn câu trả lời lịch sự bằng tiếng Việt cho khách về trạng thái đơn ${code}. Không dùng mã kỹ thuật tiếng Anh.`
        : "Soạn câu trả lời lịch sự bằng tiếng Việt cho khách về trạng thái đơn hiện tại. Không dùng mã kỹ thuật tiếng Anh.",
  },
  {
    key: "issues",
    label: "Kiểm tra vấn đề cần xử lý",
    buildMessage: (code) =>
      code
        ? `Đơn ${code} còn vấn đề gì cần Sales xử lý trước khi cập nhật cho khách?`
        : "Đơn hiện tại còn vấn đề gì cần Sales xử lý trước khi cập nhật cho khách?",
  },
  {
    key: "summary",
    label: "Tóm tắt tình trạng",
    buildMessage: (code) =>
      code
        ? `Tóm tắt ngắn gọn tình trạng đơn ${code} để Sales nắm nhanh.`
        : "Tóm tắt ngắn gọn tình trạng đơn liên quan để Sales nắm nhanh.",
  },
];

const toOrderOption = (item) => {
  const code =
    normalizeText(item?.orderCode) ||
    normalizeText(item?.consignmentCode) ||
    normalizeText(item?.code);
  const id =
    normalizeText(item?.orderId) ||
    normalizeText(item?.id) ||
    normalizeText(item?.relatedId);
  if (!code && !id) return null;
  return {
    value: code || id,
    label: code || id,
    orderId: id || undefined,
    orderCode: code || undefined,
    orderType: item?.orderType || item?.consignmentType || "CONSIGNMENT",
    customerName: item?.customerName || "",
    status: item?.status || "",
  };
};

export default function SalesAiAssistantPanel({
  context = null,
  prefill = null,
  customerName = "",
  onInsertText,
  onClose,
}) {
  const seedCode =
    normalizeText(prefill?.orderCode) || normalizeText(context?.orderCode);
  const seedId =
    normalizeText(prefill?.relatedId) || normalizeText(context?.relatedId);
  const seedType =
    normalizeText(prefill?.relatedType) ||
    normalizeText(context?.relatedType) ||
    "CONSIGNMENT";
  const seedCustomerId =
    normalizeText(prefill?.customerId) ||
    normalizeText(context?.customerId) ||
    "";

  const resolvedCustomerName = useMemo(
    () =>
      normalizeText(customerName) ||
      normalizeText(context?.customerName) ||
      normalizeText(prefill?.customerName) ||
      "Khách hàng",
    [context?.customerName, customerName, prefill?.customerName]
  );

  const [orderOptions, setOrderOptions] = useState(() => {
    if (!seedCode && !seedId) return [];
    const option = toOrderOption({
      orderCode: seedCode,
      orderId: seedId,
      orderType: seedType,
      customerName: resolvedCustomerName,
    });
    return option ? [option] : [];
  });
  const [selectedOrderCode, setSelectedOrderCode] = useState(
    () => seedCode || seedId || ""
  );
  const [manualOrderCode, setManualOrderCode] = useState("");
  const [extraQuestion, setExtraQuestion] = useState("");
  const [customerReply, setCustomerReply] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState("");
  const loadedContextRef = useRef("");
  const autoCheckedRef = useRef("");
  const runAiRef = useRef(null);

  const contextPayload = useMemo(
    () => ({
      customerId: seedCustomerId || undefined,
      relatedType: seedType || undefined,
      relatedId: seedId || undefined,
    }),
    [seedCustomerId, seedId, seedType]
  );

  const selectedOrder = useMemo(
    () =>
      orderOptions.find((item) => item.value === selectedOrderCode) || null,
    [orderOptions, selectedOrderCode]
  );

  const effectiveOrderCode = useMemo(
    () =>
      normalizeText(selectedOrder?.orderCode) ||
      normalizeText(selectedOrderCode) ||
      normalizeText(manualOrderCode) ||
      seedCode,
    [manualOrderCode, seedCode, selectedOrder, selectedOrderCode]
  );

  const mergeOrderOptions = useCallback((items = []) => {
    setOrderOptions((current) => {
      const map = new Map();
      [...current, ...items.map(toOrderOption).filter(Boolean)].forEach(
        (item) => {
          const key = item.orderCode || item.orderId || item.value;
          if (!key) return;
          map.set(key, { ...map.get(key), ...item, value: key });
        }
      );
      return [...map.values()];
    });
  }, []);

  useEffect(() => {
    const contextKey = [
      seedCustomerId,
      seedId,
      seedCode,
      resolvedCustomerName,
    ].join("|");

    if (loadedContextRef.current === contextKey) return;
    loadedContextRef.current = contextKey;

    if (seedCode || seedId) {
      mergeOrderOptions([
        {
          orderCode: seedCode,
          orderId: seedId,
          orderType: seedType,
          customerName: resolvedCustomerName,
        },
      ]);
      setSelectedOrderCode((current) => current || seedCode || seedId);
    }

    let cancelled = false;

    (async () => {
      try {
        const listResult = await getConsignmentsApi({
          pageNumber: 1,
          pageSize: 50,
        });
        if (cancelled) return;

        const items = Array.isArray(listResult?.items)
          ? listResult.items
          : Array.isArray(listResult)
            ? listResult
            : [];

        const nameKey = resolvedCustomerName.toLowerCase();
        const filtered = items.filter((item) => {
          if (seedCustomerId) {
            const itemCustomerId = normalizeText(
              item?.customerId ||
                item?.customer?.id ||
                item?.customer?.customerId
            );
            if (itemCustomerId && itemCustomerId === seedCustomerId) {
              return true;
            }
          }
          if (nameKey && nameKey !== "khách hàng") {
            const itemName = normalizeText(item?.customerName).toLowerCase();
            if (itemName && itemName === nameKey) return true;
          }
          return false;
        });

        if (filtered.length) {
          mergeOrderOptions(filtered);
          setSelectedOrderCode(
            (current) =>
              current ||
              filtered[0]?.consignmentCode ||
              filtered[0]?.orderId ||
              ""
          );
        }
      } catch {
        // Keep seeded options if list fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    mergeOrderOptions,
    resolvedCustomerName,
    seedCode,
    seedCustomerId,
    seedId,
    seedType,
  ]);

  const runAi = useCallback(
    async ({ actionKey, message }) => {
      const question = normalizeText(message);
      if (!question) {
        AuthNotify.warning("Thiếu nội dung", "Nhập câu hỏi cho AI.");
        return;
      }

      const orderCode = effectiveOrderCode;
      if (!orderCode && !contextPayload.relatedId && !contextPayload.customerId) {
        AuthNotify.warning(
          "Chưa có đơn liên quan",
          "Chọn khách hàng hoặc nhập mã đơn để kiểm tra thủ công."
        );
        return;
      }

      setLoadingAi(true);
      setError("");
      setActiveAction(actionKey || "");

      try {
        const data = await querySalesOrderStatus({
          message: question,
          orderCode: orderCode || undefined,
          relatedType:
            selectedOrder?.orderType ||
            contextPayload.relatedType ||
            "CONSIGNMENT",
          relatedId: selectedOrder?.orderId || contextPayload.relatedId,
          customerId: contextPayload.customerId,
        });

        setResult(data);
        if (data.relatedOrders?.length) {
          mergeOrderOptions(data.relatedOrders);
        }

        const reply = buildCustomerReply({
          orderCode: orderCode || data.relatedOrders?.[0]?.orderCode,
          result: data,
          tone: "default",
        });
        setCustomerReply(reply);
      } catch (err) {
        const messageText = getSalesAiError(err);
        setError(messageText);
        setResult(null);
        AuthNotify.error("Hỏi AI thất bại", messageText);
      } finally {
        setLoadingAi(false);
        setActiveAction("");
      }
    },
    [
      contextPayload.customerId,
      contextPayload.relatedId,
      contextPayload.relatedType,
      effectiveOrderCode,
      mergeOrderOptions,
      selectedOrder,
    ]
  );

  useEffect(() => {
    runAiRef.current = runAi;
  }, [runAi]);

  useEffect(() => {
    const key = `${effectiveOrderCode || ""}|${contextPayload.relatedId || ""}`;
    if (!key || key === "|" || autoCheckedRef.current === key) return;
    if (!effectiveOrderCode && !contextPayload.relatedId) return;

    autoCheckedRef.current = key;
    const action = QUICK_ACTIONS.find((item) => item.key === "status");
    runAiRef.current?.({
      actionKey: action.key,
      message: action.buildMessage(effectiveOrderCode),
    });
  }, [contextPayload.relatedId, effectiveOrderCode]);

  const warnings = useMemo(() => buildWarnings(result), [result]);

  const handleQuickAction = (action) => {
    runAi({
      actionKey: action.key,
      message: action.buildMessage(effectiveOrderCode),
    });
  };

  const handleRewrite = (tone) => {
    if (!result) return;
    setCustomerReply(
      buildCustomerReply({
        orderCode: effectiveOrderCode,
        result,
        tone,
      })
    );
  };

  const handleInsert = () => {
    const text = normalizeText(customerReply);
    if (!text) {
      AuthNotify.warning("Chưa có gợi ý", "Hãy tạo câu trả lời trước khi chèn.");
      return;
    }
    if (typeof onInsertText === "function") {
      onInsertText(text);
    }
  };

  const hasRelatedOrder = Boolean(effectiveOrderCode || orderOptions.length);

  return (
    <aside className="sale-ai-panel" aria-label="Trợ lý AI chăm sóc khách hàng">
      <header className="sale-ai-panel__header">
        <div className="sale-ai-panel__title">
          <span className="sale-ai-panel__icon">
            <RobotOutlined />
          </span>
          <div>
            <strong>Trợ lý AI chăm sóc khách hàng</strong>
            <small>
              Hỗ trợ tra cứu và soạn phản hồi. Nhân viên cần kiểm tra trước khi gửi.
            </small>
          </div>
        </div>
        {typeof onClose === "function" && (
          <Button
            type="text"
            shape="circle"
            icon={<CloseOutlined />}
            onClick={onClose}
            aria-label="Đóng trợ lý AI"
          />
        )}
      </header>

      <section className="sale-ai-panel__block">
        <h3>Thông tin nhanh</h3>
        <div className="sale-ai-panel__info-grid">
          <div>
            <span>Khách hàng</span>
            <strong>{resolvedCustomerName}</strong>
          </div>
          <div>
            <span>Đơn liên quan</span>
            {orderOptions.length > 1 ? (
              <Select
                className="sale-ai-panel__order-select"
                value={selectedOrderCode || undefined}
                options={orderOptions.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
                placeholder="Chọn đơn"
                onChange={(value) => {
                  autoCheckedRef.current = "";
                  setSelectedOrderCode(value);
                }}
              />
            ) : (
              <strong>{effectiveOrderCode || "Chưa xác định"}</strong>
            )}
          </div>
        </div>

        {!hasRelatedOrder && (
          <Alert
            className="sale-ai-panel__alert"
            type="info"
            showIcon
            message="Chưa tìm thấy đơn liên quan đến cuộc hội thoại này. Vui lòng chọn khách hàng hoặc nhập mã đơn để kiểm tra thủ công."
          />
        )}

        {!hasRelatedOrder && (
          <Input
            value={manualOrderCode}
            onChange={(event) => setManualOrderCode(event.target.value)}
            placeholder="Nhập mã đơn thủ công, ví dụ VCL-..."
            allowClear
          />
        )}

        <div className="sale-ai-panel__status-cards">
          <div className="sale-ai-status-card">
            <span>Trạng thái đơn</span>
            <strong>
              {result?.labels?.currentStatus ||
                selectedOrder?.status ||
                "—"}
            </strong>
          </div>
          <div className="sale-ai-status-card">
            <span>Thanh toán</span>
            <strong>{result?.labels?.paymentStatus || "—"}</strong>
          </div>
          <div className="sale-ai-status-card">
            <span>Vận chuyển</span>
            <strong>{result?.labels?.shipmentStatus || "—"}</strong>
          </div>
        </div>

        {warnings.map((warning) => (
          <Alert
            key={warning}
            className="sale-ai-panel__alert sale-ai-panel__alert--soft"
            type="warning"
            showIcon
            message={`Cần xử lý: ${warning}`}
          />
        ))}
      </section>

      <section className="sale-ai-panel__block">
        <h3>Hành động nhanh</h3>
        <div className="sale-ai-panel__actions">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.key}
              onClick={() => handleQuickAction(action)}
              loading={loadingAi && activeAction === action.key}
              disabled={loadingAi}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="sale-ai-panel__block sale-ai-panel__block--reply">
        <div className="sale-ai-panel__block-head">
          <h3>Gợi ý trả lời khách</h3>
          {loadingAi && <Spin size="small" />}
        </div>

        {error && (
          <Alert
            className="sale-ai-panel__alert"
            type="error"
            showIcon
            message={error}
          />
        )}

        {!loadingAi && !customerReply && !error && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chọn hành động nhanh để AI soạn gợi ý trả lời."
          />
        )}

        {(customerReply || loadingAi) && (
          <Input.TextArea
            className="sale-ai-panel__reply"
            value={customerReply}
            onChange={(event) => setCustomerReply(event.target.value)}
            autoSize={{ minRows: 5, maxRows: 10 }}
            disabled={loadingAi}
            placeholder="Nội dung gợi ý trả lời khách sẽ hiện ở đây..."
          />
        )}

        <div className="sale-ai-panel__reply-actions">
          <Button
            type="primary"
            onClick={handleInsert}
            disabled={!customerReply || typeof onInsertText !== "function"}
          >
            Chèn vào tin nhắn
          </Button>
          <Button disabled={!result || loadingAi} onClick={() => handleRewrite("short")}>
            Viết lại ngắn hơn
          </Button>
          <Button
            disabled={!result || loadingAi}
            onClick={() => handleRewrite("friendly")}
          >
            Viết lại thân thiện hơn
          </Button>
          <Tooltip title="Tạo lại câu trả lời từ dữ liệu hiện tại">
            <Button
              icon={<ReloadOutlined />}
              disabled={!result || loadingAi}
              onClick={() => handleQuickAction(QUICK_ACTIONS[1])}
            >
              Tạo lại
            </Button>
          </Tooltip>
        </div>
      </section>

      <section className="sale-ai-panel__block sale-ai-panel__block--extra">
        <h3>Hỏi thêm AI</h3>
        <Input.TextArea
          value={extraQuestion}
          onChange={(event) => setExtraQuestion(event.target.value)}
          autoSize={{ minRows: 2, maxRows: 4 }}
          maxLength={1000}
          placeholder="Câu hỏi bổ sung (không bắt buộc)..."
          disabled={loadingAi}
        />
        <Button
          block
          disabled={!normalizeText(extraQuestion) || loadingAi}
          loading={loadingAi && activeAction === "extra"}
          onClick={() =>
            runAi({
              actionKey: "extra",
              message: extraQuestion,
            })
          }
        >
          Hỏi AI
        </Button>
      </section>

      <Collapse
        ghost
        className="sale-ai-panel__internal"
        items={[
          {
            key: "internal",
            label: "Xem dữ liệu nội bộ",
            children: result ? (
              <div className="sale-ai-panel__internal-body">
                <p>
                  <span>Order code</span>
                  <strong>{effectiveOrderCode || "—"}</strong>
                </p>
                <p>
                  <span>Order status</span>
                  <strong>{result.currentStatus || "—"}</strong>
                </p>
                <p>
                  <span>Payment status</span>
                  <strong>{result.paymentStatus || "—"}</strong>
                </p>
                <p>
                  <span>Warehouse / WRO</span>
                  <strong>{result.warehouseStatus || "—"}</strong>
                </p>
                <p>
                  <span>Shipment</span>
                  <strong>{result.shipmentStatus || "—"}</strong>
                </p>
                {result.relatedParcels.map((parcel) => (
                  <p key={parcel.parcelId || parcel.packageCode}>
                    <span>Parcel</span>
                    <strong>
                      {parcel.packageCode || "—"} · {parcel.status || "—"}
                    </strong>
                  </p>
                ))}
                {result.dataSources?.length > 0 && (
                  <p>
                    <span>Data sources</span>
                    <strong>{result.dataSources.join(", ")}</strong>
                  </p>
                )}
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có dữ liệu nội bộ."
              />
            ),
          },
        ]}
      />
    </aside>
  );
}
