import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

import {
  createStorageLocation,
  deleteStorageLocation,
  formatWarehouseType,
  getOperationsApiError,
  groupLocations,
  listActiveWarehouses,
  listWarehouseLocations,
  updateStorageLocation,
} from "../../api/OperationsAPI/operationsWarehouseService";
import "./OperationsPage.css";

const EMPTY_FORM = {
  zoneName: "",
  shelfCode: "",
  binCode: "",
  maxVolume: null,
  maxWeight: null,
  note: "",
};

function formatVolume(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("vi-VN");
}

export default function OperationsWarehousePage() {
  const displayName =
    String(sessionStorage.getItem("fullName") || "")
      .trim()
      .split(/\s+/)
      .at(-1) || "Ops";

  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [editLoc, setEditLoc] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const tree = useMemo(() => groupLocations(locations), [locations]);
  const binCount = locations.length;
  const zoneCount = tree.length;
  const shelfCount = tree.reduce((sum, zone) => sum + zone.shelves.length, 0);

  const existingZones = useMemo(
    () =>
      tree
        .map((zone) => zone.zoneName)
        .filter((name) => name !== "Chưa có zone"),
    [tree]
  );

  const shelvesForCreateZone = useMemo(() => {
    const zone = tree.find(
      (entry) => entry.zoneName === createForm.zoneName.trim()
    );
    if (!zone) return [];
    return zone.shelves
      .map((shelf) => shelf.shelfCode)
      .filter((code) => code !== "Chưa có shelf");
  }, [tree, createForm.zoneName]);

  const loadWarehouses = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await listActiveWarehouses();
      setWarehouses(data);
      setWarehouseId((current) => current || data[0]?.id || "");
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể tải danh sách kho."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLocations = useCallback(async () => {
    if (!warehouseId) {
      setLocations([]);
      return;
    }
    setIsListLoading(true);
    setError("");
    try {
      setLocations(await listWarehouseLocations(warehouseId));
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể tải vị trí kho."));
    } finally {
      setIsListLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    const timer = window.setTimeout(loadWarehouses, 0);
    return () => window.clearTimeout(timer);
  }, [loadWarehouses]);

  useEffect(() => {
    const timer = window.setTimeout(loadLocations, 0);
    return () => window.clearTimeout(timer);
  }, [loadLocations]);

  async function handleRefresh() {
    if (!warehouseId || isRefreshing || isListLoading) return;
    setIsRefreshing(true);
    setError("");
    try {
      setLocations(await listWarehouseLocations(warehouseId));
      setMessage("Đã làm mới sơ đồ vị trí.");
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể làm mới."));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleCreate() {
    if (!warehouseId || pending) return;
    const zoneName = createForm.zoneName.trim();
    const shelfCode = createForm.shelfCode.trim();
    const binCode = createForm.binCode.trim();
    if (!zoneName || !shelfCode || !binCode) {
      setError("Nhập đủ Zone, Shelf và mã Bin.");
      return;
    }

    setPending(true);
    setError("");
    setMessage("");
    try {
      await createStorageLocation(warehouseId, {
        zoneName,
        shelfCode,
        binCode,
        maxVolume: createForm.maxVolume,
        maxWeight: createForm.maxWeight,
        isActive: true,
        note: createForm.note || "",
      });
      await loadLocations();
      setCreateForm({
        ...EMPTY_FORM,
        zoneName,
        shelfCode,
      });
      setMessage(`Đã thêm vị trí ${zoneName} / ${shelfCode} / ${binCode}.`);
      setShowCreate(false);
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể thêm vị trí."));
    } finally {
      setPending(false);
    }
  }

  function openEdit(loc) {
    setEditLoc(loc);
    setEditForm({
      zoneName: loc.zoneName || loc.zoneCode || "",
      shelfCode: loc.shelfCode || "",
      binCode: loc.binCode || loc.code || "",
      maxVolume: loc.maxVolume ?? loc.capacity ?? null,
      maxWeight: loc.maxWeight ?? null,
      note: loc.note || "",
    });
    setError("");
  }

  async function handleUpdate() {
    if (!editLoc || pending) return;
    const locationId = editLoc.id || editLoc.locationId;
    if (!locationId) {
      setError("Thiếu mã vị trí.");
      return;
    }

    setPending(true);
    setError("");
    try {
      await updateStorageLocation(locationId, {
        zoneName: editForm.zoneName.trim() || null,
        shelfCode: editForm.shelfCode.trim() || null,
        binCode: editForm.binCode.trim() || null,
        maxVolume: editForm.maxVolume,
        maxWeight: editForm.maxWeight,
        isActive: editLoc.isActive !== false,
        note: editForm.note?.trim() || null,
      });
      await loadLocations();
      setEditLoc(null);
      setMessage("Đã cập nhật vị trí.");
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể cập nhật vị trí."));
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(loc) {
    const locationId = loc.id || loc.locationId;
    if (!locationId || pending) return;
    setPending(true);
    setError("");
    try {
      await deleteStorageLocation(locationId);
      await loadLocations();
      setMessage("Đã xóa vị trí.");
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể xóa vị trí."));
    } finally {
      setPending(false);
    }
  }

  const warehouseOptions = warehouses.map((warehouse) => {
    const typeLabel = formatWarehouseType(warehouse.warehouseType);
    let label = warehouse.name || "Kho";
    if (warehouse.code) label += ` (${warehouse.code})`;
    if (typeLabel && typeLabel !== "—") label += ` · ${typeLabel}`;
    return { value: warehouse.id, label };
  });

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>Sơ đồ vị trí kho</span>
          <h1>Chào {displayName}, quản lý vị trí lưu trữ</h1>
          <p>
            Chọn kho, xem Zone / Shelf / Bin và thêm vị trí mới khi cần mở rộng
            sức chứa.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Tổng quan</small>
            <strong>
              {zoneCount} zone · {shelfCount} shelf · {binCount} bin
            </strong>
          </div>
          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            disabled={!warehouseId || isRefreshing || isListLoading}
            onClick={handleRefresh}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!warehouseId}
            onClick={() => {
              setShowCreate(true);
              setError("");
            }}
          >
            Thêm vị trí
          </Button>
        </div>
      </section>

      <section className="ops-page__filters">
        <div>
          <label htmlFor="ops-warehouse">Kho</label>
          <Select
            id="ops-warehouse"
            style={{ width: "100%" }}
            loading={isLoading}
            value={warehouseId || undefined}
            placeholder="— Chọn kho —"
            options={warehouseOptions}
            onChange={(value) => {
              setWarehouseId(value);
              setMessage("");
              setError("");
              setShowCreate(false);
              setEditLoc(null);
            }}
          />
        </div>
      </section>

      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      ) : null}
      {message ? (
        <Alert
          type="success"
          showIcon
          closable
          message={message}
          style={{ marginBottom: 16 }}
          onClose={() => setMessage("")}
        />
      ) : null}

      {!warehouseId && !isLoading ? (
        <Alert type="info" showIcon message="Chọn một kho để xem sơ đồ vị trí." />
      ) : null}

      {warehouseId ? (
        <div className="ops-warehouse-tree">
          {isListLoading ? (
            <Typography.Text type="secondary">Đang tải vị trí…</Typography.Text>
          ) : tree.length === 0 ? (
            <Alert
              type="info"
              showIcon
              message="Kho này chưa có vị trí. Nhấn “Thêm vị trí” để tạo Zone / Shelf / Bin."
            />
          ) : (
            <Collapse
              defaultActiveKey={tree.map((zone) => zone.zoneName)}
              items={tree.map((zone) => ({
                key: zone.zoneName,
                label: (
                  <strong>
                    {zone.zoneName}{" "}
                    <Typography.Text type="secondary" style={{ fontWeight: 500 }}>
                      ({zone.shelves.reduce((n, s) => n + s.bins.length, 0)} bin)
                    </Typography.Text>
                  </strong>
                ),
                children: (
                  <div>
                    {zone.shelves.map((shelf) => (
                      <div key={shelf.shelfCode} className="ops-shelf">
                        <p className="ops-shelf__title">Shelf {shelf.shelfCode}</p>
                        <div className="ops-bin-grid">
                          {shelf.bins.map((bin) => {
                            const binCode = bin.binCode || bin.code || "—";
                            return (
                              <div
                                key={bin.id || bin.locationId || binCode}
                                className="ops-bin"
                              >
                                <strong>Bin {binCode}</strong>
                                <span>
                                  Max V: {formatVolume(bin.maxVolume ?? bin.capacity)} · Max
                                  W: {formatVolume(bin.maxWeight)}
                                </span>
                                {bin.note ? <span>{bin.note}</span> : null}
                                <div className="ops-bin__actions">
                                  <Button
                                    type="link"
                                    size="small"
                                    className="ops-bin__btn ops-bin__btn--edit"
                                    icon={<EditOutlined />}
                                    onClick={() => openEdit(bin)}
                                  >
                                    Sửa
                                  </Button>
                                  <Popconfirm
                                    title="Xóa vị trí này?"
                                    description={`Bin ${binCode} sẽ bị xóa khỏi sơ đồ.`}
                                    okText="Xóa"
                                    cancelText="Hủy"
                                    okButtonProps={{ danger: true }}
                                    onConfirm={() => handleDelete(bin)}
                                  >
                                    <Button
                                      type="link"
                                      size="small"
                                      danger
                                      className="ops-bin__btn ops-bin__btn--delete"
                                      icon={<DeleteOutlined />}
                                      loading={pending}
                                    >
                                      Xóa
                                    </Button>
                                  </Popconfirm>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              }))}
            />
          )}
        </div>
      ) : null}

      <Modal
        open={showCreate}
        title="Thêm vị trí kho"
        onCancel={() => setShowCreate(false)}
        onOk={handleCreate}
        confirmLoading={pending}
        okText="Thêm"
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label="Zone" required>
            <Select
              showSearch
              allowClear
              placeholder="Chọn hoặc nhập zone"
              value={createForm.zoneName || undefined}
              options={existingZones.map((zone) => ({ value: zone, label: zone }))}
              onChange={(value) =>
                setCreateForm((current) => ({
                  ...current,
                  zoneName: value || "",
                  shelfCode: "",
                }))
              }
              onSearch={(value) =>
                setCreateForm((current) => ({ ...current, zoneName: value }))
              }
              notFoundContent={null}
            />
            <Input
              style={{ marginTop: 8 }}
              placeholder="Hoặc gõ tên zone mới"
              value={createForm.zoneName}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  zoneName: event.target.value,
                }))
              }
            />
          </Form.Item>
          <Form.Item label="Shelf" required>
            <Select
              showSearch
              allowClear
              placeholder="Chọn hoặc nhập shelf"
              value={createForm.shelfCode || undefined}
              options={shelvesForCreateZone.map((code) => ({
                value: code,
                label: code,
              }))}
              onChange={(value) =>
                setCreateForm((current) => ({
                  ...current,
                  shelfCode: value || "",
                }))
              }
              notFoundContent={null}
            />
            <Input
              style={{ marginTop: 8 }}
              placeholder="Hoặc gõ mã shelf mới"
              value={createForm.shelfCode}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  shelfCode: event.target.value,
                }))
              }
            />
          </Form.Item>
          <Form.Item label="Bin" required>
            <Input
              value={createForm.binCode}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  binCode: event.target.value,
                }))
              }
            />
          </Form.Item>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item label="Max volume" style={{ marginBottom: 0, flex: 1 }}>
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                value={createForm.maxVolume}
                onChange={(value) =>
                  setCreateForm((current) => ({ ...current, maxVolume: value }))
                }
              />
            </Form.Item>
            <Form.Item label="Max weight" style={{ marginBottom: 0, flex: 1 }}>
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                value={createForm.maxWeight}
                onChange={(value) =>
                  setCreateForm((current) => ({ ...current, maxWeight: value }))
                }
              />
            </Form.Item>
          </Space>
          <Form.Item label="Ghi chú" style={{ marginTop: 16 }}>
            <Input.TextArea
              rows={2}
              value={createForm.note}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(editLoc)}
        title="Sửa vị trí"
        onCancel={() => setEditLoc(null)}
        onOk={handleUpdate}
        confirmLoading={pending}
        okText="Lưu"
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label="Zone">
            <Input
              value={editForm.zoneName}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  zoneName: event.target.value,
                }))
              }
            />
          </Form.Item>
          <Form.Item label="Shelf">
            <Input
              value={editForm.shelfCode}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  shelfCode: event.target.value,
                }))
              }
            />
          </Form.Item>
          <Form.Item label="Bin">
            <Input
              value={editForm.binCode}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  binCode: event.target.value,
                }))
              }
            />
          </Form.Item>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item label="Max volume" style={{ marginBottom: 0, flex: 1 }}>
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                value={editForm.maxVolume}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, maxVolume: value }))
                }
              />
            </Form.Item>
            <Form.Item label="Max weight" style={{ marginBottom: 0, flex: 1 }}>
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                value={editForm.maxWeight}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, maxWeight: value }))
                }
              />
            </Form.Item>
          </Space>
          <Form.Item label="Ghi chú" style={{ marginTop: 16 }}>
            <Input.TextArea
              rows={2}
              value={editForm.note}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
