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
  Switch,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";

import {
  createWarehouseLocation,
  deleteWarehouseLocation,
  getAdminApiError,
  getWarehouses,
  getWarehouseLocations,
  updateWarehouseLocation,
} from "../../api/AdminAPI/adminService";
import AuthNotify from "../../utils/Common/AuthNotify";
import "./AdminPage.css";

const INITIAL_FORM = {
  zoneName: "",
  shelfCode: "",
  binCode: "",
  maxVolume: null,
  maxWeight: null,
  isActive: true,
  note: "",
};

const getLocationId = (record) => record?.id || record?.locationId || "";

const formatVolume = (value) => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("vi-VN");
};

const buildPayload = (form) => ({
  zoneName: form.zoneName.trim() || null,
  shelfCode: form.shelfCode.trim() || null,
  binCode: form.binCode.trim() || null,
  maxVolume: form.maxVolume === "" ? null : form.maxVolume,
  maxWeight: form.maxWeight === "" ? null : form.maxWeight,
  isActive: Boolean(form.isActive),
  note: form.note.trim() || null,
});

function groupLocations(locations) {
  const zones = new Map();
  for (const loc of locations || []) {
    const zoneName = loc.zoneName || loc.zoneCode || "Chưa có zone";
    const shelfCode = loc.shelfCode || "Chưa có shelf";
    if (!zones.has(zoneName)) zones.set(zoneName, new Map());
    const shelves = zones.get(zoneName);
    if (!shelves.has(shelfCode)) shelves.set(shelfCode, []);
    shelves.get(shelfCode).push(loc);
  }

  return [...zones.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "vi"))
    .map(([zoneName, shelves]) => ({
      zoneName,
      shelves: [...shelves.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "vi"))
        .map(([shelfCode, bins]) => ({
          shelfCode,
          bins: bins.sort((a, b) =>
            String(a.binCode || a.code || "").localeCompare(
              String(b.binCode || b.code || ""),
              "vi"
            )
          ),
        })),
    }));
}

export default function WarehouseLocationsPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [locations, setLocations] = useState([]);
  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const loadWarehouses = useCallback(async () => {
    try {
      const data = await getWarehouses();
      setWarehouses(data);
      setWarehouseId((current) => current || data[0]?.id || "");
    } catch (error) {
      AuthNotify.error("Tải kho thất bại", getAdminApiError(error, "Không thể tải danh sách kho."));
    }
  }, []);

  const loadLocations = useCallback(async () => {
    if (!warehouseId) {
      setLocations([]);
      return;
    }

    setLoading(true);
    try {
      setLocations(await getWarehouseLocations(warehouseId));
    } catch (error) {
      AuthNotify.error("Tải vị trí thất bại", getAdminApiError(error, "Không thể tải vị trí kho."));
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    const timer = window.setTimeout(loadWarehouses, 0);
    return () => window.clearTimeout(timer);
  }, [loadWarehouses]);

  useEffect(() => {
    setQuery("");
    setZoneFilter(null);
    setStatusFilter(null);
    const timer = window.setTimeout(loadLocations, 0);
    return () => window.clearTimeout(timer);
  }, [loadLocations]);

  const filteredLocations = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");

    return locations.filter((item) => {
      if (zoneFilter && item.zoneName !== zoneFilter) return false;
      if (statusFilter === "true" && !item.isActive) return false;
      if (statusFilter === "false" && item.isActive) return false;
      if (!keyword) return true;
      return [item.zoneName, item.shelfCode, item.binCode, item.note].some((value) =>
        String(value ?? "").toLocaleLowerCase("vi").includes(keyword)
      );
    });
  }, [locations, query, statusFilter, zoneFilter]);

  const tree = useMemo(() => groupLocations(filteredLocations), [filteredLocations]);
  const binCount = filteredLocations.length;
  const zoneCount = tree.length;
  const shelfCount = tree.reduce((sum, zone) => sum + zone.shelves.length, 0);

  const zoneOptions = useMemo(() => {
    const names = [
      ...new Set(
        locations
          .map((item) => item.zoneName)
          .filter((name) => name != null && name !== "")
      ),
    ].sort((a, b) => a.localeCompare(b, "vi"));
    return names.map((name) => ({ label: name, value: name }));
  }, [locations]);

  const existingZones = useMemo(
    () =>
      groupLocations(locations)
        .map((zone) => zone.zoneName)
        .filter((name) => name !== "Chưa có zone"),
    [locations]
  );

  const shelvesForCreateZone = useMemo(() => {
    const zone = groupLocations(locations).find(
      (entry) => entry.zoneName === form.zoneName.trim()
    );
    if (!zone) return [];
    return zone.shelves
      .map((shelf) => shelf.shelfCode)
      .filter((code) => code !== "Chưa có shelf");
  }, [locations, form.zoneName]);

  const openCreate = () => {
    setEditingRecord(null);
    setForm(INITIAL_FORM);
    setEditorOpen(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setForm({
      zoneName: record.zoneName || record.zoneCode || "",
      shelfCode: record.shelfCode || "",
      binCode: record.binCode || record.code || "",
      maxVolume: record.maxVolume ?? record.capacity ?? null,
      maxWeight: record.maxWeight ?? null,
      isActive: record.isActive !== false,
      note: record.note || "",
    });
    setEditorOpen(true);
  };

  const submit = async () => {
    if (!warehouseId) {
      AuthNotify.warning("Chưa chọn kho", "Vui lòng chọn kho.");
      return;
    }
    if (!form.zoneName.trim() || !form.shelfCode.trim() || !form.binCode.trim()) {
      AuthNotify.warning("Thiếu thông tin", "Vui lòng nhập đủ Zone, Shelf và Bin.");
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (editingRecord) {
        await updateWarehouseLocation(getLocationId(editingRecord), payload);
        AuthNotify.success("Cập nhật thành công", "Đã cập nhật vị trí kho.");
      } else {
        await createWarehouseLocation(warehouseId, payload);
        AuthNotify.success("Tạo thành công", "Đã tạo vị trí kho.");
      }
      setEditorOpen(false);
      await loadLocations();
    } catch (error) {
      AuthNotify.error("Lưu vị trí thất bại", getAdminApiError(error, "Không thể lưu vị trí kho."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (record) => {
    try {
      await deleteWarehouseLocation(getLocationId(record));
      AuthNotify.success("Xóa thành công", "Đã xóa vị trí kho.");
      await loadLocations();
    } catch (error) {
      AuthNotify.error("Xóa vị trí thất bại", getAdminApiError(error, "Không thể xóa vị trí kho."));
    }
  };

  return (
    <div className="admin-page">
      <section className="admin-page__hero">
        <div>
          <span>QUẢN TRỊ KHO</span>
          <h1>Sơ đồ vị trí kho</h1>
          <p>Chọn kho, xem Zone / Shelf / Bin và chỉnh vị trí lưu trữ.</p>
        </div>
        <div className="admin-page__hero-count">
          <strong>
            {zoneCount} · {shelfCount} · {binCount}
          </strong>
          <span>zone · shelf · bin</span>
          <small>{locations.length} vị trí tổng</small>
        </div>
      </section>

      <section className="admin-page__panel">
        <div className="admin-page__toolbar admin-page__toolbar--locations">
          <Select
            showSearch
            optionFilterProp="label"
            value={warehouseId || undefined}
            placeholder="Chọn kho"
            options={warehouses.map((warehouse) => ({
              value: warehouse.id,
              label: `${warehouse.name} (${warehouse.code || "chưa có mã"})`,
            }))}
            onChange={setWarehouseId}
            className="admin-page__warehouse-select"
          />
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm khu, kệ, ô..."
            className="admin-page__search"
          />
          <Select
            allowClear
            placeholder="Khu"
            value={zoneFilter}
            options={zoneOptions}
            onChange={setZoneFilter}
            className="admin-page__filter-select"
          />
          <Select
            allowClear
            placeholder="Trạng thái"
            value={statusFilter}
            options={[
              { label: "Đang dùng", value: "true" },
              { label: "Ngừng dùng", value: "false" },
            ]}
            onChange={setStatusFilter}
            className="admin-page__filter-select"
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadLocations}>
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!warehouseId}
            onClick={openCreate}
          >
            Thêm vị trí
          </Button>
        </div>

        {!warehouseId ? (
          <Alert type="info" showIcon message="Chọn một kho để xem sơ đồ vị trí." />
        ) : loading ? (
          <Typography.Text type="secondary">Đang tải vị trí…</Typography.Text>
        ) : tree.length === 0 ? (
          <Alert
            type="info"
            showIcon
            message="Kho này chưa có vị trí khớp bộ lọc. Nhấn “Thêm vị trí” để tạo Zone / Shelf / Bin."
          />
        ) : (
          <div className="admin-warehouse-tree">
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
                      <div key={shelf.shelfCode} className="admin-shelf">
                        <p className="admin-shelf__title">Shelf {shelf.shelfCode}</p>
                        <div className="admin-bin-grid">
                          {shelf.bins.map((bin) => {
                            const binCode = bin.binCode || bin.code || "—";
                            const active = bin.isActive !== false;
                            return (
                              <div
                                key={getLocationId(bin) || binCode}
                                className={`admin-bin${active ? "" : " is-inactive"}`}
                              >
                                <strong>Bin {binCode}</strong>
                                <span>
                                  Max V: {formatVolume(bin.maxVolume ?? bin.capacity)} · Max
                                  W: {formatVolume(bin.maxWeight)}
                                </span>
                                <span>{active ? "Đang dùng" : "Ngừng dùng"}</span>
                                {bin.note ? <span>{bin.note}</span> : null}
                                <div className="admin-bin__actions">
                                  <Button
                                    type="link"
                                    size="small"
                                    className="admin-bin__btn admin-bin__btn--edit"
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
                                    onConfirm={() => remove(bin)}
                                  >
                                    <Button
                                      type="link"
                                      size="small"
                                      danger
                                      className="admin-bin__btn admin-bin__btn--delete"
                                      icon={<DeleteOutlined />}
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
          </div>
        )}
      </section>

      <Modal
        open={editorOpen}
        title={editingRecord ? "Sửa vị trí kho" : "Thêm vị trí kho"}
        okText={editingRecord ? "Lưu thay đổi" : "Tạo vị trí"}
        cancelText="Hủy"
        confirmLoading={saving}
        mask={{ closable: !saving }}
        destroyOnHidden
        onOk={submit}
        onCancel={() => !saving && setEditorOpen(false)}
        className="admin-editor-modal"
      >
        <Form layout="vertical">
          <Form.Item label="Zone" required>
            {!editingRecord ? (
              <>
                <Select
                  showSearch
                  allowClear
                  placeholder="Chọn hoặc nhập zone"
                  value={form.zoneName || undefined}
                  options={existingZones.map((zone) => ({ value: zone, label: zone }))}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      zoneName: value || "",
                      shelfCode: "",
                    }))
                  }
                  notFoundContent={null}
                />
                <Input
                  style={{ marginTop: 8 }}
                  placeholder="Hoặc gõ tên zone mới"
                  value={form.zoneName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      zoneName: event.target.value,
                    }))
                  }
                />
              </>
            ) : (
              <Input
                value={form.zoneName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    zoneName: event.target.value,
                  }))
                }
              />
            )}
          </Form.Item>
          <Form.Item label="Shelf" required>
            {!editingRecord ? (
              <>
                <Select
                  showSearch
                  allowClear
                  placeholder="Chọn hoặc nhập shelf"
                  value={form.shelfCode || undefined}
                  options={shelvesForCreateZone.map((code) => ({
                    value: code,
                    label: code,
                  }))}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      shelfCode: value || "",
                    }))
                  }
                  notFoundContent={null}
                />
                <Input
                  style={{ marginTop: 8 }}
                  placeholder="Hoặc gõ mã shelf mới"
                  value={form.shelfCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      shelfCode: event.target.value,
                    }))
                  }
                />
              </>
            ) : (
              <Input
                value={form.shelfCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    shelfCode: event.target.value,
                  }))
                }
              />
            )}
          </Form.Item>
          <Form.Item label="Bin" required>
            <Input
              value={form.binCode}
              onChange={(event) =>
                setForm((current) => ({
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
                value={form.maxVolume}
                onChange={(value) =>
                  setForm((current) => ({ ...current, maxVolume: value }))
                }
              />
            </Form.Item>
            <Form.Item label="Max weight (kg)" style={{ marginBottom: 0, flex: 1 }}>
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                value={form.maxWeight}
                onChange={(value) =>
                  setForm((current) => ({ ...current, maxWeight: value }))
                }
              />
            </Form.Item>
          </Space>
          <Form.Item label="Đang hoạt động" style={{ marginTop: 16 }}>
            <Switch
              checked={form.isActive}
              onChange={(value) =>
                setForm((current) => ({ ...current, isActive: value }))
              }
            />
          </Form.Item>
          <Form.Item label="Ghi chú">
            <Input.TextArea
              rows={2}
              value={form.note}
              onChange={(event) =>
                setForm((current) => ({
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
