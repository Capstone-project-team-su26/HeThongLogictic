import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";

import {
  approveWro,
  createShipmentFromApprovedWro,
  getOperationsApiError,
  getWroDetail,
  getWroStatusMeta,
  notifyWroCustomer,
  rejectWro,
  TRANSPORT_MODES,
  wroNeedsApproval,
} from "../../../api/OperationsAPI/consolidationWorkflowService";
import AuthNotify from "../../../utils/Common/AuthNotify";

const EMPTY_FINALIZE = {
  originWarehouseId: "",
  destinationWarehouseId: "",
  transportMode: "",
  carrierId: "",
  shippingRoute: "",
  estimatedDeliveryDays: null,
  note: "",
};

export default function WroDetailModal({
  open,
  wroId,
  warehouses = [],
  carriers = [],
  shippingRoutes = [],
  onClose,
  onChanged,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalize, setFinalize] = useState(EMPTY_FINALIZE);

  const load = useCallback(async () => {
    if (!wroId) return;
    setLoading(true);
    setError("");
    try {
      setDetail(await getWroDetail(wroId));
    } catch (err) {
      const errMsg = getOperationsApiError(err, "Không thể tải chi tiết WRO.");
      AuthNotify.error("Lỗi tải chi tiết WRO", errMsg);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [wroId]);

  useEffect(() => {
    if (!open) return;
    setDetail(null);
    setFinalizeOpen(false);
    setFinalize(EMPTY_FINALIZE);
    setRejectOpen(false);
    setRejectReason("");
    load();
  }, [open, load]);

  const carrierById = useMemo(
    () => new Map(carriers.map((row) => [row.id, row])),
    [carriers]
  );
  const originOptions = useMemo(
    () =>
      warehouses.filter(
        (row) => row.role === "ORIGIN" || row.role === "BOTH" || !row.role
      ),
    [warehouses]
  );
  const destinationOptions = useMemo(
    () =>
      warehouses.filter(
        (row) => row.role === "DESTINATION" || row.role === "BOTH" || !row.role
      ),
    [warehouses]
  );

  const statusMeta = getWroStatusMeta(detail?.status);
  const canReview = wroNeedsApproval(detail?.status);
  const canFinalize = detail?.status === "RELEASE_APPROVED";

  async function runAction(action, successMessage) {
    if (acting) return;
    setActing(true);
    setError("");
    try {
      await action();
      AuthNotify.success("Thành công", successMessage);
      onChanged?.(successMessage);
    } catch (err) {
      const errMsg = getOperationsApiError(err, "Thao tác thất bại.");
      AuthNotify.error("Thao tác thất bại", errMsg);
      setError(errMsg);
      setActing(false);
    }
  }

  function handleReject() {
    const reason = rejectReason.trim();
    if (!reason) {
      setError("Cần nhập lý do từ chối.");
      return;
    }
    runAction(() => rejectWro(detail.id, reason), `Đã từ chối WRO ${detail.code || ""}.`);
  }

  function handleFinalize() {
    if (!finalize.originWarehouseId) return setError("Cần chọn kho xuất.");
    if (!finalize.destinationWarehouseId) return setError("Cần chọn kho đích.");
    if (!finalize.transportMode) {
      return setError("Cần chọn phương thức vận chuyển (AIR / SEA / ROAD / RAIL).");
    }
    runAction(
      () =>
        createShipmentFromApprovedWro(detail.id, {
          ...finalize,
          shippingMethod: finalize.transportMode,
        }),
      `Đã hoàn tất xuất kho và tạo shipment từ WRO ${detail.code || ""}.`
    );
    return undefined;
  }

  const setFinalizeField = (key) => (value) =>
    setFinalize((current) => ({ ...current, [key]: value ?? "" }));

  return (
    <Modal
      open={open}
      title={
        <>
          Yêu cầu xuất kho{" "}
          <Typography.Text code>{detail?.code || wroId || "—"}</Typography.Text>
        </>
      }
      onCancel={onClose}
      width={860}
      destroyOnHidden
      footer={
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Space wrap>
            {canReview ? (
              <>
                <Popconfirm
                  title={`Duyệt xuất kho ${detail?.code || ""}?`}
                  okText="Duyệt"
                  cancelText="Hủy"
                  onConfirm={() =>
                    runAction(
                      () => approveWro(detail.id),
                      `Đã duyệt xuất kho ${detail.code || ""}.`
                    )
                  }
                >
                  <Button type="primary" loading={acting}>
                    Duyệt xuất kho
                  </Button>
                </Popconfirm>
                <Button danger disabled={acting} onClick={() => setRejectOpen(true)}>
                  Từ chối
                </Button>
              </>
            ) : null}
            {canFinalize ? (
              <Button
                type="primary"
                disabled={acting}
                onClick={() => setFinalizeOpen((value) => !value)}
              >
                Hoàn tất xuất kho + tạo shipment
              </Button>
            ) : null}
          </Space>
          <Button onClick={onClose}>Đóng</Button>
        </Space>
      }
    >
      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
      ) : null}

      <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
        <Descriptions.Item label="Mã WRO">{detail?.code || "—"}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái">
          <Tag color={statusMeta.tone}>{statusMeta.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Người gửi">
          {detail?.createdByName
            ? `${detail.createdByName}${
                detail.createdByUserRole ? ` (${detail.createdByUserRole})` : ""
              }`
            : "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Kho">{detail?.warehouseName || "—"}</Descriptions.Item>
        <Descriptions.Item label="Khách hàng">{detail?.customerName || "—"}</Descriptions.Item>
        <Descriptions.Item label="Người nhận">{detail?.receiverName || "—"}</Descriptions.Item>
        <Descriptions.Item label="Lý do xuất">
          {detail?.exportReason || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Hãng vận chuyển">
          {detail?.carrierName || carrierById.get(detail?.carrierId)?.name || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Kệ / shelf">{detail?.shelfCode || "—"}</Descriptions.Item>
        <Descriptions.Item label="Ngày tạo">
          {detail?.createdAt ? new Date(detail.createdAt).toLocaleString("vi-VN") : "—"}
        </Descriptions.Item>
        {detail?.rejectionReason ? (
          <Descriptions.Item label="Lý do từ chối" span={2}>
            {detail.rejectionReason}
          </Descriptions.Item>
        ) : null}
      </Descriptions>

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        Kiện trong yêu cầu ({detail?.itemCount ?? 0})
      </Typography.Title>
      <Table
        rowKey={(row) => row.inventoryId || row.parcelId || row.parcelCode}
        size="small"
        loading={loading}
        dataSource={detail?.items ?? []}
        pagination={false}
        columns={[
          {
            title: "Mã kiện",
            render: (_, row) => (
              <Typography.Text code>
                {row.parcelCode || row.parcelId || row.inventoryId}
              </Typography.Text>
            ),
          },
          { title: "Số lượng", dataIndex: "quantity", align: "right", width: 100 },
        ]}
        locale={{ emptyText: "Không có item." }}
      />

      {finalizeOpen && canFinalize ? (
        <div style={{ marginTop: 16 }}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="WRO đã duyệt. Hoàn tất: picking → đóng gói → xuất kho (RELEASED) → tạo shipment quốc tế."
          />
          <div className="ops-form-grid">
            <div>
              <label>Kho xuất *</label>
              <Select
                style={{ width: "100%" }}
                placeholder="Chọn kho xuất"
                value={finalize.originWarehouseId || undefined}
                options={originOptions.map((row) => ({
                  value: row.id,
                  label: `${row.code} — ${row.name}`,
                }))}
                onChange={setFinalizeField("originWarehouseId")}
              />
            </div>
            <div>
              <label>Kho đích *</label>
              <Select
                style={{ width: "100%" }}
                placeholder="Chọn kho đích"
                value={finalize.destinationWarehouseId || undefined}
                options={destinationOptions.map((row) => ({
                  value: row.id,
                  label: `${row.code} — ${row.name}`,
                }))}
                onChange={setFinalizeField("destinationWarehouseId")}
              />
            </div>
            <div>
              <label>Phương thức vận chuyển *</label>
              <Select
                style={{ width: "100%" }}
                placeholder="AIR / SEA / ROAD / RAIL"
                value={finalize.transportMode || undefined}
                options={TRANSPORT_MODES}
                onChange={setFinalizeField("transportMode")}
              />
            </div>
            <div>
              <label>Hãng vận chuyển</label>
              <Select
                style={{ width: "100%" }}
                allowClear
                placeholder="Tuỳ chọn"
                value={finalize.carrierId || undefined}
                options={carriers.map((row) => ({ value: row.id, label: row.name }))}
                onChange={setFinalizeField("carrierId")}
              />
            </div>
            <div>
              <label>Tuyến vận chuyển</label>
              <Select
                style={{ width: "100%" }}
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Tuỳ chọn"
                value={finalize.shippingRoute || undefined}
                options={shippingRoutes
                  .filter((row) => row.isActive !== false)
                  .map((row) => ({
                    value: row.code,
                    label: `${row.code} — ${row.name}`,
                  }))}
                onChange={setFinalizeField("shippingRoute")}
              />
            </div>
            <div>
              <label>Số ngày dự kiến</label>
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                max={365}
                value={finalize.estimatedDeliveryDays}
                onChange={(value) =>
                  setFinalize((current) => ({ ...current, estimatedDeliveryDays: value }))
                }
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Ghi chú</label>
              <Input.TextArea
                rows={2}
                value={finalize.note}
                onChange={(event) =>
                  setFinalize((current) => ({ ...current, note: event.target.value }))
                }
              />
            </div>
          </div>
          <Space style={{ marginTop: 12 }}>
            <Button type="primary" loading={acting} onClick={handleFinalize}>
              Xác nhận hoàn tất + tạo shipment
            </Button>
            <Button disabled={acting} onClick={() => setFinalizeOpen(false)}>
              Để sau
            </Button>
          </Space>
        </div>
      ) : null}

      <Modal
        open={rejectOpen}
        title={`Từ chối WRO ${detail?.code || ""}`}
        okText="Từ chối"
        okButtonProps={{ danger: true, loading: acting }}
        cancelText="Hủy"
        onCancel={() => setRejectOpen(false)}
        onOk={handleReject}
        width={480}
      >
        <Typography.Text type="secondary">
          Lý do từ chối sẽ được lưu lại trên yêu cầu xuất kho.
        </Typography.Text>
        <Input.TextArea
          rows={3}
          style={{ marginTop: 8 }}
          placeholder="Nhập lý do từ chối..."
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
        />
      </Modal>
    </Modal>
  );
}
