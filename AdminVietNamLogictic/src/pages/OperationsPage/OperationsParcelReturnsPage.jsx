import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  FEE_BEARER_OPTIONS,
  RESOLUTION_OPTIONS,
  getParcelReturnApiError,
  getParcelReturnDetail,
  getReturnReasonMeta,
  getReturnStatusMeta,
  listParcelReturns,
  resolveParcelReturn,
} from "../../api/OperationsAPI/parcelReturnService";
import AuthNotify from "../../utils/Common/AuthNotify";
import "./OperationsPage.css";
// Thẻ KPI dùng class wro-kpi-* khai bên trang WRO.
import "./OperationsWroPage/OperationsWroPage.css";

const { Title, Text } = Typography;

const STATUS_FILTERS = [
  { value: "RECEIVED_AT_WAREHOUSE", label: "Chờ quyết định" },
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING_RETURN", label: "Chờ hàng quay về" },
  { value: "IN_TRANSIT_BACK", label: "Đang về kho" },
  { value: "LOST", label: "Hàng thất lạc" },
  { value: "RESOLVED", label: "Đã chốt xử lý" },
];

/** Hồ sơ mở quá ngần này ngày mà chưa chốt thì tô đỏ, khớp ngưỡng BE dùng để đếm. */
const OVERDUE_DAYS = 3;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

export default function OperationsParcelReturnsPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    awaitingReturn: 0,
    awaitingDecision: 0,
    lost: 0,
    overdue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("RECEIVED_AT_WAREHOUSE");
  const [keyword, setKeyword] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolution, setResolution] = useState("");
  const [feeBearer, setFeeBearer] = useState("");
  const [waiveStorageFee, setWaiveStorageFee] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await listParcelReturns({ status: statusFilter });
      setRows(result.items);
      setSummary(result.summary);
    } catch (error) {
      setErrorMessage(getParcelReturnApiError(error, "Không tải được danh sách hàng hoàn."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const visibleRows = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.returnCode, row.packageCode, row.orderCode, row.customerName, row.receiverPhone, row.trackingCode]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    );
  }, [rows, keyword]);

  const openDetail = useCallback(async (row) => {
    setDetail(row);
    setDetailLoading(true);
    try {
      const full = await getParcelReturnDetail(row.returnId);
      if (full) setDetail(full);
    } catch (error) {
      AuthNotify.error(getParcelReturnApiError(error, "Không tải được chi tiết hồ sơ hàng hoàn."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openResolveModal = useCallback((row) => {
    setResolveTarget(row);
    // Hàng mất thì chỉ còn một đường là bồi thường — chọn sẵn để OM khỏi phải mò.
    setResolution(String(row.status).toUpperCase() === "LOST" ? "COMPENSATE" : "");
    setFeeBearer("");
    setWaiveStorageFee(false);
    setResolutionNote("");
  }, []);

  const closeResolveModal = useCallback(() => {
    setResolveTarget(null);
    setResolution("");
    setFeeBearer("");
    setWaiveStorageFee(false);
    setResolutionNote("");
  }, []);

  const handleResolve = useCallback(async () => {
    if (!resolveTarget) return;
    setSubmitting(true);
    try {
      await resolveParcelReturn(resolveTarget.returnId, {
        resolution,
        feeBearer,
        waiveStorageFee,
        resolutionNote,
      });
      AuthNotify.success(`Đã chốt xử lý hồ sơ ${resolveTarget.returnCode}.`);
      closeResolveModal();
      setDetail(null);
      await fetchRows();
    } catch (error) {
      AuthNotify.error(getParcelReturnApiError(error, "Không chốt được hướng xử lý."));
    } finally {
      setSubmitting(false);
    }
  }, [resolveTarget, resolution, feeBearer, waiveStorageFee, resolutionNote, closeResolveModal, fetchRows]);

  const isLost = String(resolveTarget?.status || "").toUpperCase() === "LOST";

  const columns = useMemo(
    () => [
      {
        title: "Mã hồ sơ",
        dataIndex: "returnCode",
        fixed: "left",
        width: 170,
        render: (value, row) => (
          <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(row)}>
            {value}
          </Button>
        ),
      },
      { title: "Mã kiện", dataIndex: "packageCode", width: 190 },
      {
        title: "Đơn ký gửi",
        dataIndex: "orderCode",
        width: 200,
        render: (value, row) => (
          <Space direction="vertical" size={0}>
            <Text>{value || "—"}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.customerName || "—"}
            </Text>
          </Space>
        ),
      },
      {
        title: "Lý do",
        dataIndex: "reason",
        width: 180,
        render: (value) => {
          const meta = getReturnReasonMeta(value);
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 190,
        render: (value) => {
          const meta = getReturnStatusMeta(value);
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        /*
         * Hồ sơ nằm càng lâu càng dễ bị bỏ quên, mà hàng thì vẫn chiếm kệ. Tô đỏ mốc quá hạn
         * để OM nhìn cột này là biết nên xử cái nào trước.
         */
        title: "Mở được",
        dataIndex: "daysOpen",
        width: 120,
        align: "center",
        sorter: (a, b) => (a.daysOpen || 0) - (b.daysOpen || 0),
        render: (value, row) => {
          const done = String(row.status).toUpperCase() === "RESOLVED";
          if (done) return <Text type="secondary">—</Text>;
          return value > OVERDUE_DAYS ? (
            <Tag color="error">{value} ngày</Tag>
          ) : (
            <Text>{value} ngày</Text>
          );
        },
      },
      { title: "Kho giữ hàng", dataIndex: "warehouseName", width: 190, render: (v) => v || "—" },
      {
        title: "Hướng xử lý",
        dataIndex: "resolutionText",
        width: 200,
        render: (value, row) =>
          value ? (
            <Space direction="vertical" size={0}>
              <Tag color="success">{value}</Tag>
              {!!row.feeBearerText && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {row.feeBearerText}
                </Text>
              )}
            </Space>
          ) : (
            <Text type="secondary">Chưa chốt</Text>
          ),
      },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 190,
        render: (_, row) => {
          const status = String(row.status).toUpperCase();
          const canResolve = status === "RECEIVED_AT_WAREHOUSE" || status === "LOST";

          return (
            <Space>
              <Button size="small" onClick={() => openDetail(row)}>
                Chi tiết
              </Button>
              {canResolve && (
                <Button
                  size="small"
                  type="primary"
                  disabled={submitting}
                  onClick={() => openResolveModal(row)}
                >
                  Chốt xử lý
                </Button>
              )}
            </Space>
          );
        },
      },
    ],
    [openDetail, openResolveModal, submitting],
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>BỘ PHẬN VẬN HÀNH (OPS)</span>
          <h1>Xử Lý Hàng Hoàn Về</h1>
          <p>
            Hãng vận chuyển báo giao hỏng là hệ thống tự mở hồ sơ. Kho xác nhận đã nhận lại hàng,
            OM chốt giao lại hay xử lý cách khác.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Chờ quyết định</small>
            <strong>{summary.awaitingDecision} hồ sơ</strong>
          </div>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={loading} />}
            disabled={loading}
            onClick={fetchRows}
          >
            Làm mới
          </Button>
        </div>
      </section>

      {!!errorMessage && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={errorMessage}
          action={
            <Button size="small" onClick={fetchRows}>
              Thử lại
            </Button>
          }
        />
      )}

      {summary.overdue > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${summary.overdue} hồ sơ đã mở quá ${OVERDUE_DAYS} ngày mà chưa chốt xong`}
          description="Hàng vẫn đang chiếm chỗ kệ và khách vẫn đang chờ. Ưu tiên xử lý những hồ sơ này trước."
        />
      )}

      <section className="wro-kpi-grid-enhanced" aria-label="Chỉ số hàng hoàn">
        <div className="ops-kpi-card wro-kpi-card--blue">
          <div className="wro-kpi-card__icon-box">
            <RollbackOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Tổng hồ sơ hàng hoàn</p>
            <p className="ops-kpi-card__value">{loading ? "…" : summary.total}</p>
            <div className="ops-kpi-card__meta">
              <p>Tính cả hồ sơ đã chốt xong</p>
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--amber">
          <div className="wro-kpi-card__icon-box">
            <ClockCircleOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Chờ hàng quay về</p>
            <p className="ops-kpi-card__value">{loading ? "…" : summary.awaitingReturn}</p>
            <div className="ops-kpi-card__meta">
              <p>Hãng đã báo, hàng chưa tới kho</p>
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--purple">
          <div className="wro-kpi-card__icon-box">
            <ExclamationCircleOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Chờ OM quyết định</p>
            <p className="ops-kpi-card__value">{loading ? "…" : summary.awaitingDecision}</p>
            <div className="ops-kpi-card__meta">
              <p>Hàng đã về kho, đang chiếm kệ</p>
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--amber">
          <div className="wro-kpi-card__icon-box">
            <WarningOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Hàng thất lạc</p>
            <p className="ops-kpi-card__value">{loading ? "…" : summary.lost}</p>
            <div className="ops-kpi-card__meta">
              <p>Phải xử lý bồi thường cho khách</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ops-page__filters" aria-label="Bộ lọc hàng hoàn">
        <div>
          <label htmlFor="return-f-status">Trạng thái hồ sơ</label>
          <Select
            id="return-f-status"
            style={{ width: "100%" }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS}
          />
        </div>
        <div>
          <label htmlFor="return-f-search">Tìm kiếm nhanh</label>
          <Input.Search
            id="return-f-search"
            allowClear
            placeholder="Tìm theo mã hồ sơ, mã kiện, đơn ký gửi, khách, mã vận đơn..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
      </section>

      <div className="ops-table-card">
        <div className="ops-table-card__head">
          <h3>Danh sách hồ sơ hàng hoàn</h3>
          <span>{visibleRows.length} hồ sơ</span>
        </div>
        <Table
          rowKey={(row) => row.returnId}
          size="middle"
          columns={columns}
          dataSource={visibleRows}
          loading={loading}
          sticky={{ offsetHeader: 0 }}
          scroll={{ x: 1500, y: "calc(100vh - 520px)" }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50"],
            showTotal: (total) => `Tổng ${total} hồ sơ`,
          }}
          locale={{ emptyText: "Không có hồ sơ hàng hoàn nào." }}
        />
      </div>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={680}
        title={detail?.returnCode || "Chi tiết hồ sơ hàng hoàn"}
        loading={detailLoading}
      >
        {detail && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Mã kiện">{detail.packageCode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Đơn ký gửi">{detail.orderCode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Khách hàng">
                {detail.customerName || "—"}
                {detail.customerPhone ? ` · ${detail.customerPhone}` : ""}
              </Descriptions.Item>
              <Descriptions.Item label="Lý do hoàn">
                <Tag color={getReturnReasonMeta(detail.reason).tone}>
                  {getReturnReasonMeta(detail.reason).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Hãng vận chuyển báo">
                {detail.carrierStatusText || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Mã vận đơn">{detail.trackingCode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Phiếu giao">{detail.deliveryCode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Đã giao tới">
                {detail.deliveryAddress || "—"}
                {detail.receiverName ? ` (${detail.receiverName}${detail.receiverPhone ? " · " + detail.receiverPhone : ""})` : ""}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={getReturnStatusMeta(detail.status).tone}>
                  {getReturnStatusMeta(detail.status).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Mở hồ sơ lúc">{formatDateTime(detail.openedAt)}</Descriptions.Item>
              <Descriptions.Item label="Kho nhận lại">
                {detail.warehouseName || "—"}
                {detail.binCode ? ` · ô kệ ${detail.binCode}` : ""}
              </Descriptions.Item>
              <Descriptions.Item label="Nhận lại lúc">
                {detail.receivedAt ? `${formatDateTime(detail.receivedAt)} · ${detail.receivedByName || "—"}` : "Chưa nhận lại"}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú kho">{detail.note || "—"}</Descriptions.Item>
              {!!detail.resolution && (
                <>
                  <Descriptions.Item label="Hướng xử lý">
                    <Space direction="vertical" size={2}>
                      <Tag color="success">{detail.resolutionText}</Tag>
                      {!!detail.feeBearerText && <Text>{detail.feeBearerText}</Text>}
                      {detail.waiveStorageFee && <Tag color="blue">Đã miễn phí lưu kho</Tag>}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Lý do chốt">{detail.resolutionNote || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Chốt lúc">
                    {formatDateTime(detail.resolvedAt)} · {detail.resolvedByName || "—"}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>

            {["RECEIVED_AT_WAREHOUSE", "LOST"].includes(String(detail.status).toUpperCase()) && (
              <Space style={{ marginTop: 20 }}>
                <Button type="primary" onClick={() => openResolveModal(detail)} disabled={submitting}>
                  Chốt hướng xử lý
                </Button>
              </Space>
            )}

            {["PENDING_RETURN", "IN_TRANSIT_BACK"].includes(String(detail.status).toUpperCase()) && (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 20 }}
                message="Chờ kho xác nhận đã nhận lại hàng"
                description="Kho VN bấm xác nhận trên app kho thì hồ sơ mới chuyển sang chờ OM quyết định."
              />
            )}
          </>
        )}
      </Drawer>

      <Modal
        open={Boolean(resolveTarget)}
        title={`Chốt xử lý — ${resolveTarget?.returnCode || ""}`}
        okText="Xác nhận chốt"
        cancelText="Huỷ"
        confirmLoading={submitting}
        onOk={handleResolve}
        onCancel={closeResolveModal}
        width={620}
      >
        {isLost && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="Hàng đã thất lạc"
            description="Không còn hàng để giao lại, chỉ chốt được hướng bồi thường cho khách."
          />
        )}

        <Title level={5} style={{ marginTop: 0 }}>
          Hướng xử lý
        </Title>
        <Radio.Group
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
          style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}
        >
          {RESOLUTION_OPTIONS.map((option) => (
            <Radio
              key={option.value}
              value={option.value}
              disabled={isLost && option.value !== "COMPENSATE"}
              style={{ alignItems: "flex-start" }}
            >
              <Space direction="vertical" size={0}>
                <Text strong>{option.label}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {option.hint}
                </Text>
              </Space>
            </Radio>
          ))}
        </Radio.Group>

        {resolution === "REDELIVER" && (
          <>
            <Title level={5}>Ai chịu cước giao lại</Title>
            <Radio.Group
              value={feeBearer}
              onChange={(event) => setFeeBearer(event.target.value)}
              options={FEE_BEARER_OPTIONS}
              optionType="button"
              buttonStyle="solid"
            />
          </>
        )}

        <div style={{ marginTop: 20 }}>
          <Checkbox
            checked={waiveStorageFee}
            onChange={(event) => setWaiveStorageFee(event.target.checked)}
          >
            Miễn phí lưu kho cho những ngày hàng nằm chờ sau khi hoàn về
          </Checkbox>
          <div style={{ marginLeft: 24, marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Tick khi giao hỏng không phải lỗi khách. Phí lưu kho sẽ bỏ qua quãng kể từ lúc kho
              nhận lại hàng.
            </Text>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <Title level={5}>Lý do chốt</Title>
          <Input.TextArea
            rows={3}
            maxLength={500}
            showCount
            placeholder="Ví dụ: khách báo sai số nhà, đã liên hệ xác nhận địa chỉ mới, giao lại và khách chịu cước."
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
