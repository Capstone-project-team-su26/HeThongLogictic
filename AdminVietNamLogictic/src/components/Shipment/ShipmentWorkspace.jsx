import { useCallback, useEffect, useMemo, useState } from "react";
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
  Tabs,
  Tag,
  Typography,
} from "antd";
import { LinkOutlined, ReloadOutlined } from "@ant-design/icons";

import {
  getNextShipmentStatuses,
  getOperationsApiError,
  getShipmentActionMeta,
  getShipmentDetail,
  listShipments,
  SHIPMENT_STATUS_META,
  SHIPMENT_STATUS_TABS,
  updateShipmentStatus,
} from "../../api/OperationsAPI/consolidationWorkflowService";
import AuthNotify from "../../utils/Common/AuthNotify";
import ShipmentJourneySteps from "./ShipmentJourneySteps";

const { Text, Title } = Typography;

/**
 * Màn theo dõi & điều khiển lô vận chuyển, dùng chung cho Sale, OM và Admin.
 *
 * Mỗi vai chỉ khác nhau ở chỗ được bấm mốc nào (`allowedActors`), còn phần nhìn thì giống hệt —
 * ai mở ra cũng thấy cùng một hành trình, đỡ cảnh hai bên mô tả cùng một lô bằng hai thứ tiếng.
 * Mốc không thuộc vai mình vẫn hiện nhưng khoá lại, kèm chú thích ai mới bấm được.
 */

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("vi-VN") : "—";
};

function UrlList({ urls, empty }) {
  if (!urls?.length) return <Text type="secondary">{empty}</Text>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {urls.map((url) => (
        <li key={url}>
          <a href={url} target="_blank" rel="noreferrer">
            <LinkOutlined /> {url.split("/").pop() || url}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function ShipmentWorkspace({
  eyebrow = "VẬN CHUYỂN QUỐC TẾ",
  title = "Lô Vận Chuyển",
  subtitle = "Theo dõi lô từ lúc gom hàng ở kho nước ngoài tới lúc về kho Việt Nam.",
  /** Vai được phép bấm: "warehouse", "sale" hoặc cả hai. "any" luôn được (HOLD/ISSUE). */
  allowedActors = ["sale"],
  defaultTab = "",
}) {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusTab, setStatusTab] = useState(defaultTab);
  const [keyword, setKeyword] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [note, setNote] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      // listShipments trả bọc phân trang { items, totalCount, … }, không phải mảng trần.
      const result = await listShipments({
        statusTab: statusTab || undefined,
        search: keyword.trim() || undefined,
      });
      setRows(Array.isArray(result?.items) ? result.items : []);
      setTotalCount(Number(result?.totalCount) || 0);
    } catch (error) {
      setErrorMessage(getOperationsApiError(error, "Không tải được danh sách lô vận chuyển."));
    } finally {
      setLoading(false);
    }
  }, [statusTab, keyword]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openDetail = useCallback(async (row) => {
    setDetail(row);
    setDetailLoading(true);
    try {
      const full = await getShipmentDetail(row.id);
      if (full) setDetail(full);
    } catch (error) {
      AuthNotify.error("Lỗi tải lô", getOperationsApiError(error, "Không tải được chi tiết lô."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const canAct = useCallback(
    (actor) => actor === "any" || allowedActors.includes(actor),
    [allowedActors],
  );

  const runUpdate = useCallback(async () => {
    if (!confirmTarget) return;
    const { shipment, status } = confirmTarget;
    setSubmitting(true);
    try {
      await updateShipmentStatus(shipment.id, status, note.trim(), trackingCode.trim());
      const meta = SHIPMENT_STATUS_META[status];
      AuthNotify.success(
        "Cập nhật lô thành công",
        `Lô ${shipment.code} → ${meta?.label || status}`,
      );
      setConfirmTarget(null);
      setNote("");
      setTrackingCode("");
      await fetchRows();
      if (detail?.id === shipment.id) {
        const refreshed = await getShipmentDetail(shipment.id);
        setDetail(refreshed);
      }
    } catch (error) {
      AuthNotify.error(
        "Cập nhật thất bại",
        getOperationsApiError(error, "Không cập nhật được trạng thái lô."),
      );
    } finally {
      setSubmitting(false);
    }
  }, [confirmTarget, note, trackingCode, fetchRows, detail?.id]);

  /** Nút hành động của một lô — dùng ở cả bảng lẫn drawer. */
  const renderActions = useCallback(
    (shipment, { size = "small" } = {}) => {
      const options = getNextShipmentStatuses(shipment?.status);
      if (!options.length) {
        return <Text type="secondary">Lô đã đi hết hành trình</Text>;
      }

      return (
        <Space wrap size={6}>
          {options.map((status, index) => {
            const action = getShipmentActionMeta(status);
            const allowed = canAct(action.actor);
            const isDanger = status === "HOLD" || status === "ISSUE";

            return (
              <Button
                key={status}
                size={size}
                type={index === 0 && !isDanger ? "primary" : "default"}
                danger={isDanger}
                disabled={!allowed}
                title={
                  allowed
                    ? action.hint
                    : `Mốc này do ${action.actor === "warehouse" ? "nhân viên kho" : "sale"} bấm.`
                }
                onClick={() => {
                  setConfirmTarget({ shipment, status });
                  setNote("");
                  setTrackingCode(shipment?.raw?.carrierTrackingCode || "");
                }}
              >
                {action.button}
              </Button>
            );
          })}
        </Space>
      );
    },
    [canAct],
  );

  const columns = useMemo(
    () => [
      {
        title: "Mã lô",
        dataIndex: "code",
        width: 190,
        render: (value, row) => (
          <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(row)}>
            {value || "—"}
          </Button>
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 180,
        render: (value) => {
          const meta = SHIPMENT_STATUS_META[value] || { label: value, tone: "default" };
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "Tuyến",
        key: "route",
        render: (_, row) => (
          <div>
            <div>{row.shippingRouteName || "—"}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.originWarehouseName || "—"} → {row.destinationWarehouseName || "—"}
            </Text>
          </div>
        ),
      },
      {
        title: "Kiện / KG",
        key: "volume",
        align: "center",
        width: 120,
        render: (_, row) =>
          `${formatNumber(row.totalPackages)} / ${formatNumber(row.totalWeight)}`,
      },
      { title: "Rời kho", dataIndex: "shippedAt", width: 150, render: formatDateTime },
      { title: "Về kho VN", dataIndex: "deliveredAt", width: 150, render: formatDateTime },
      {
        title: "Việc tiếp theo",
        key: "actions",
        width: 320,
        fixed: "right",
        render: (_, row) => renderActions(row),
      },
    ],
    [openDetail, renderActions],
  );

  const confirmAction = confirmTarget ? getShipmentActionMeta(confirmTarget.status) : null;

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Đang hiển thị</small>
            <strong>
              {rows.length}
              {totalCount > rows.length ? `/${totalCount}` : ""} lô
            </strong>
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

      <Tabs
        activeKey={statusTab}
        onChange={setStatusTab}
        items={[
          { key: "", label: "Tất cả" },
          ...SHIPMENT_STATUS_TABS.map((tab) => ({ key: tab.key, label: tab.label })),
        ]}
      />

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Tìm theo mã lô"
          style={{ width: 300 }}
          onSearch={(value) => setKeyword(value)}
          onChange={(event) => {
            if (!event.target.value) setKeyword("");
          }}
        />
      </Space>

      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1300 }}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="Chưa có lô nào ở nhóm này." /> }}
      />

      <Drawer
        open={!!detail}
        width={960}
        onClose={() => setDetail(null)}
        title={detail ? `Lô ${detail.code}` : "Chi tiết lô vận chuyển"}
        loading={detailLoading}
      >
        {detail ? (
          <>
            <ShipmentJourneySteps status={detail.status} />

            <div style={{ margin: "20px 0" }}>
              <Title level={5}>Việc tiếp theo</Title>
              {renderActions(detail, { size: "middle" })}
            </div>

            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Tuyến">
                {detail.shippingRouteName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Phương thức">
                {detail.shippingMethod || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Kho đi">
                {detail.originWarehouseName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Kho đến">
                {detail.destinationWarehouseName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Đơn vị vận chuyển">
                {detail.carrierName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Mã vận đơn đối tác">
                {detail.raw?.carrierTrackingCode || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Rời kho lúc">
                {formatDateTime(detail.shippedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Về kho VN lúc">
                {formatDateTime(detail.deliveredAt)}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 20 }}>
              Chứng từ thông quan
            </Title>
            <UrlList
              urls={detail.customsDocUrls}
              empty="Chưa đính chứng từ. Chứng từ được đính lúc OM duyệt phiếu xuất kho."
            />

            <Title level={5} style={{ marginTop: 20 }}>
              Phiếu xuất kho trong lô ({detail.wroRequests?.length || 0})
            </Title>
            <Table
              rowKey={(row) => row.wroRequestId || row.wroCode}
              size="small"
              pagination={false}
              dataSource={detail.wroRequests || []}
              columns={[
                {
                  title: "Mã WRO",
                  dataIndex: "wroCode",
                  render: (value) => <Text code>{value || "—"}</Text>,
                },
              ]}
              locale={{ emptyText: "Lô chưa gắn phiếu xuất kho nào." }}
            />

            <Title level={5} style={{ marginTop: 20 }}>
              Kiện trong lô ({detail.parcels?.length || 0})
            </Title>
            <Table
              rowKey={(row) => row.parcelId || row.packageCode}
              size="small"
              pagination={{ pageSize: 8, showSizeChanger: false }}
              dataSource={detail.parcels || []}
              columns={[
                {
                  title: "Mã kiện",
                  dataIndex: "packageCode",
                  render: (value) => <Text code>{value || "—"}</Text>,
                },
                {
                  title: "Đơn",
                  dataIndex: "orderCode",
                  render: (value) => value || "—",
                },
                { title: "Khách", dataIndex: "customerName", render: (v) => v || "—" },
                {
                  title: "KG",
                  dataIndex: "weight",
                  align: "right",
                  width: 90,
                  render: formatNumber,
                },
              ]}
              locale={{ emptyText: "Lô chưa có kiện nào." }}
            />
          </>
        ) : null}
      </Drawer>

      <Modal
        open={!!confirmTarget}
        title={confirmAction ? confirmAction.button : "Cập nhật lô"}
        okText="Xác nhận"
        cancelText="Huỷ"
        confirmLoading={submitting}
        onOk={runUpdate}
        onCancel={() => {
          setConfirmTarget(null);
          setNote("");
        }}
      >
        {confirmTarget ? (
          <>
            <Alert
              type={confirmTarget.status === "ISSUE" ? "warning" : "info"}
              showIcon
              style={{ marginBottom: 12 }}
              message={`Lô ${confirmTarget.shipment.code}`}
              description={confirmAction?.hint}
            />
            {confirmTarget.status === "IN_TRANSIT" ? (
              <div style={{ marginBottom: 12 }}>
                <label>Mã vận đơn / số container của đối tác</label>
                <Input
                  value={trackingCode}
                  onChange={(event) => setTrackingCode(event.target.value)}
                  placeholder="Bỏ trống thì giữ nguyên mã đã nhập trước đó"
                />
              </div>
            ) : null}
            <label>Ghi chú (tuỳ chọn)</label>
            <Input.TextArea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ví dụ: xe container 51C-123.45 đã rời kho lúc 14h."
            />
          </>
        ) : null}
      </Modal>
    </div>
  );
}
