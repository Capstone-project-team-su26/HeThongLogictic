/**
 * Hàng chờ tất toán — việc của Sale ngay sau khi kho chốt kiểm.
 *
 * Mở một đơn ra là thấy đủ ba thứ cần để gọi khách: khách là ai, hàng gồm những gì và kho có
 * ghi nhận lệch không. Chốt phí cuối tại đây, hệ thống phát hành mã cho khách tự trả.
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
  InputNumber,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  DollarOutlined,
  PlusOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  createFinalPayment,
  createPurchaseFinalPayment,
  getSettlementApiError,
  listAwaitingSettlement,
} from "../../../api/SaleAPI/SettlementAPI/settlementService";
import AuthNotify from "../../../utils/Common/AuthNotify";
import "./SaleSettlementPage.css";

const { Title, Text } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const emptyFee = () => ({ key: `${Date.now()}-${Math.round(performance.now())}`, name: "", amount: null, note: "" });

export default function SaleSettlementPage() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyword, setKeyword] = useState("");

  const [target, setTarget] = useState(null);
  const [fees, setFees] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      setRows(await listAwaitingSettlement());
    } catch (error) {
      setErrorMessage(getSettlementApiError(error, "Không tải được danh sách hàng chờ tất toán."));
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

  const openOrder = useCallback((row) => {
    setTarget(row);
    setFees([]);
    setIssued(null);
  }, []);

  const feesTotal = useMemo(
    () => fees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0),
    [fees],
  );

  const submit = useCallback(async () => {
    if (!target) return;

    const cleaned = fees
      .map((fee) => ({ name: fee.name.trim(), amount: Number(fee.amount) || 0, note: fee.note }))
      .filter((fee) => fee.name && fee.amount > 0);

    // Dòng phí điền dở làm số tiền chốt cho khách sai, nên chặn tại đây thay vì lặng lẽ bỏ qua.
    if (fees.length > 0 && cleaned.length !== fees.length) {
      AuthNotify.error("Phí phát sinh chưa hợp lệ", "Mỗi dòng phí phải có tên và số tiền lớn hơn 0.");
      return;
    }

    setSubmitting(true);
    try {
      const result =
        target.orderType === "PURCHASE" && target.purchaseRequestId
          ? await createPurchaseFinalPayment(target.purchaseRequestId, cleaned)
          : await createFinalPayment(target.orderId, cleaned);

      setIssued(result);
      AuthNotify.success(
        "Đã chốt phí cuối",
        `Khách có thể tất toán ${formatMoney(result?.finalAmount ?? result?.amount)} cho đơn ${target.orderCode}.`,
      );
      load();
    } catch (error) {
      AuthNotify.error("Không chốt được phí cuối", getSettlementApiError(error, "Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  }, [target, fees, load]);

  const columns = useMemo(
    () => [
      {
        title: "Mã đơn",
        dataIndex: "orderCode",
        width: 210,
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
        title: "Hàng đã về kho",
        align: "center",
        width: 150,
        render: (_, row) => (
          <Space direction="vertical" size={2}>
            <Text>{row.parcelCount} kiện</Text>
            <Text type="secondary">{Number(row.totalWeight || 0).toLocaleString("vi-VN")} kg</Text>
          </Space>
        ),
      },
      {
        title: "Kiểm đếm",
        align: "center",
        width: 150,
        render: (_, row) =>
          row.discrepancyParcelCount > 0 ? (
            <Tag color="error" icon={<WarningOutlined />}>
              {row.discrepancyParcelCount} kiện lệch
            </Tag>
          ) : (
            <Tag color="success">Khớp khai báo</Tag>
          ),
      },
      { title: "Về kho lúc", dataIndex: "arrivedAt", width: 170, render: formatDateTime },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 160,
        render: (_, row) => (
          <Button type="primary" icon={<DollarOutlined />} onClick={() => openOrder(row)}>
            Chốt tất toán
          </Button>
        ),
      },
    ],
    [openOrder],
  );

  return (
    <div className="sale-settlement-page">
      <div className="sale-settlement-page__head">
        <div>
          <Title level={4}>Hàng chờ tất toán</Title>
          <Text type="secondary">
            Đơn kho đã kiểm đếm xong, chờ Sale chốt phí cuối để khách tất toán.
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
        rowKey={(row) => row.orderId}
        columns={columns}
        dataSource={filtered}
        loading={loading}
        scroll={{ x: 1080 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có đơn nào chờ tất toán."
            />
          ),
        }}
      />

      <Drawer
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        width={720}
        title={`Chốt tất toán · ${target?.orderCode || ""}`}
      >
        {target && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Khách hàng">{target.customerName || "—"}</Descriptions.Item>
              <Descriptions.Item label="Điện thoại">{target.customerPhone || "—"}</Descriptions.Item>
              <Descriptions.Item label="Loại đơn">
                {target.orderType === "PURCHASE" ? "Mua hộ" : "Ký gửi"}
              </Descriptions.Item>
              <Descriptions.Item label="Tuyến">{target.route || "—"}</Descriptions.Item>
              <Descriptions.Item label="Hàng về kho">
                {target.parcelCount} kiện · {Number(target.totalWeight || 0).toLocaleString("vi-VN")} kg
              </Descriptions.Item>
              <Descriptions.Item label="Về kho lúc">{formatDateTime(target.arrivedAt)}</Descriptions.Item>
              <Descriptions.Item label="Người nhận" span={2}>
                {target.receiverName || "—"} · {target.receiverPhone || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao" span={2}>
                {target.receiverAddress || "—"}
              </Descriptions.Item>
            </Descriptions>

            {target.discrepancyParcelCount > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={`${target.discrepancyParcelCount} kiện bị kho ghi nhận lệch`}
                description="Nên thống nhất với khách cách xử lý trước khi chốt số tiền cuối."
                action={
                  <Button
                    size="small"
                    onClick={() =>
                      navigate(
                        target.orderType === "PURCHASE" && target.purchaseRequestId
                          ? `/sale/purchase-requests/${target.purchaseRequestId}`
                          : `/sale/consignments/${target.orderId}`,
                      )
                    }
                  >
                    Xem chi tiết
                  </Button>
                }
              />
            )}

            <div className="sale-settlement-fees">
              <div className="sale-settlement-fees__head">
                <Text strong>Phí phát sinh cộng thêm</Text>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setFees((current) => [...current, emptyFee()])}
                >
                  Thêm dòng
                </Button>
              </div>

              {fees.length === 0 ? (
                <Text type="secondary">
                  Không có phí phát sinh thì bấm chốt luôn — khách trả nốt phần còn lại của báo giá.
                </Text>
              ) : (
                fees.map((fee, index) => (
                  <div key={fee.key} className="sale-settlement-fees__row">
                    <Input
                      placeholder="Tên khoản phí"
                      value={fee.name}
                      onChange={(event) =>
                        setFees((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, name: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <InputNumber
                      placeholder="Số tiền"
                      min={0}
                      step={1000}
                      style={{ width: 160 }}
                      value={fee.amount}
                      formatter={(value) =>
                        value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""
                      }
                      parser={(value) => value.replace(/\./g, "")}
                      onChange={(value) =>
                        setFees((current) =>
                          current.map((item, i) => (i === index ? { ...item, amount: value } : item)),
                        )
                      }
                    />
                    <Input
                      placeholder="Ghi chú"
                      value={fee.note}
                      onChange={(event) =>
                        setFees((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, note: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => setFees((current) => current.filter((_, i) => i !== index))}
                    />
                  </div>
                ))
              )}

              {fees.length > 0 && (
                <div className="sale-settlement-fees__total">
                  Cộng phí phát sinh: <strong>{formatMoney(feesTotal)}</strong>
                </div>
              )}
            </div>

            {issued ? (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 16 }}
                message="Đã phát hành đợt thanh toán cuối"
                description={
                  <>
                    Khách cần trả <strong>{formatMoney(issued.finalAmount ?? issued.amount)}</strong>.
                    Đơn sẽ chuyển sang mục <strong>Đơn hàng cần xử lý</strong> ngay khi khách trả xong.
                  </>
                }
              />
            ) : (
              <Button
                type="primary"
                size="large"
                block
                icon={<DollarOutlined />}
                loading={submitting}
                onClick={submit}
                style={{ marginTop: 16 }}
              >
                Chốt phí cuối và gửi khách tất toán
              </Button>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
