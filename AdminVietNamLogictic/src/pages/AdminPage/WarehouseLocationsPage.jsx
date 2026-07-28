import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Button,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
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

const buildPayload = (form) => ({
  zoneName: form.zoneName.trim() || null,
  shelfCode: form.shelfCode.trim() || null,
  binCode: form.binCode.trim() || null,
  maxVolume: form.maxVolume === "" ? null : form.maxVolume,
  maxWeight: form.maxWeight === "" ? null : form.maxWeight,
  isActive: Boolean(form.isActive),
  note: form.note.trim() || null,
});

export default function WarehouseLocationsPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [locations, setLocations] = useState([]);
  const [query, setQuery] = useState("");
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
    const timer = window.setTimeout(loadLocations, 0);
    return () => window.clearTimeout(timer);
  }, [loadLocations]);

  const filteredLocations = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    if (!keyword) return locations;

    return locations.filter((item) =>
      [item.zoneName, item.shelfCode, item.binCode, item.note]
        .some((value) => String(value ?? "").toLocaleLowerCase("vi").includes(keyword))
    );
  }, [locations, query]);

  const openCreate = () => {
    setEditingRecord(null);
    setForm(INITIAL_FORM);
    setEditorOpen(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setForm({
      zoneName: record.zoneName || "",
      shelfCode: record.shelfCode || "",
      binCode: record.binCode || "",
      maxVolume: record.maxVolume ?? null,
      maxWeight: record.maxWeight ?? null,
      isActive: Boolean(record.isActive),
      note: record.note || "",
    });
    setEditorOpen(true);
  };

  const submit = async () => {
    if (!warehouseId) {
      AuthNotify.warning("Chưa chọn kho", "Vui lòng chọn kho.");
      return;
    }
    if (!form.zoneName.trim() && !form.shelfCode.trim() && !form.binCode.trim()) {
      AuthNotify.warning("Thiếu thông tin", "Vui lòng nhập ít nhất tên khu, mã kệ hoặc mã ô.");
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

  const columns = [
    { title: "Khu", dataIndex: "zoneName", key: "zoneName", width: 170, fixed: "left", render: (value) => value || "—" },
    { title: "Mã kệ", dataIndex: "shelfCode", key: "shelfCode", width: 130, render: (value) => value || "—" },
    { title: "Mã ô", dataIndex: "binCode", key: "binCode", width: 130, render: (value) => value || "—" },
    { title: "Thể tích tối đa", dataIndex: "maxVolume", key: "maxVolume", width: 150, render: (value) => value ?? "—" },
    { title: "Tải trọng tối đa", dataIndex: "maxWeight", key: "maxWeight", width: 150, render: (value) => value == null ? "—" : `${value} kg` },
    { title: "Ghi chú", dataIndex: "note", key: "note", width: 220, ellipsis: true, render: (value) => value || "—" },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      width: 130,
      render: (value) => <Tag color={value ? "success" : "default"}>{value ? "Đang dùng" : "Ngừng dùng"}</Tag>,
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 110,
      fixed: "right",
      align: "center",
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Chỉnh sửa">
            <Button type="text" className="admin-action-edit" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="Xóa vị trí kho?" okText="Xóa" cancelText="Hủy" onConfirm={() => remove(record)}>
            <Tooltip title="Xóa">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="admin-page">
      <section className="admin-page__hero">
        <div>
          <span>QUẢN TRỊ KHO</span>
          <h1>Vị trí lưu trữ</h1>
          <p>Quản lý khu, kệ, ô chứa và giới hạn lưu trữ theo từng kho.</p>
        </div>
        <div className="admin-page__hero-count">
          <strong>{locations.length}</strong>
          <span>vị trí</span>
          <small>UTC đồng bộ</small>
        </div>
      </section>

      <section className="admin-page__panel">
        <div className="admin-page__toolbar admin-page__toolbar--locations">
          <Select
            showSearch
            optionFilterProp="label"
            value={warehouseId || undefined}
            placeholder="Chọn kho"
            options={warehouses.map((warehouse) => ({ value: warehouse.id, label: `${warehouse.name} (${warehouse.code || "chưa có mã"})` }))}
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
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadLocations}>Tải lại</Button>
          <Button type="primary" icon={<PlusOutlined />} disabled={!warehouseId} onClick={openCreate}>Thêm vị trí</Button>
        </div>

        <div className="admin-page__table">
          <Table
            rowKey={(record) => getLocationId(record)}
            columns={columns}
            dataSource={filteredLocations}
            loading={loading}
            scroll={{ x: "max-content" }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} vị trí` }}
          />
        </div>
      </section>

      <Modal
        open={editorOpen}
        title={editingRecord ? "Cập nhật vị trí kho" : "Thêm vị trí kho"}
        okText={editingRecord ? "Lưu thay đổi" : "Tạo vị trí"}
        cancelText="Hủy"
        confirmLoading={saving}
        mask={{ closable: !saving }}
        destroyOnHidden
        onOk={submit}
        onCancel={() => !saving && setEditorOpen(false)}
        className="admin-editor-modal"
      >
        <div className="admin-form-grid">
          <label className="admin-form-field"><span>Tên khu</span><Input value={form.zoneName} onChange={(event) => setForm((current) => ({ ...current, zoneName: event.target.value }))} /></label>
          <label className="admin-form-field"><span>Mã kệ</span><Input value={form.shelfCode} onChange={(event) => setForm((current) => ({ ...current, shelfCode: event.target.value }))} /></label>
          <label className="admin-form-field"><span>Mã ô</span><Input value={form.binCode} onChange={(event) => setForm((current) => ({ ...current, binCode: event.target.value }))} /></label>
          <label className="admin-form-field"><span>Thể tích tối đa</span><InputNumber min={0} value={form.maxVolume} style={{ width: "100%" }} onChange={(value) => setForm((current) => ({ ...current, maxVolume: value }))} /></label>
          <label className="admin-form-field"><span>Tải trọng tối đa (kg)</span><InputNumber min={0} value={form.maxWeight} style={{ width: "100%" }} onChange={(value) => setForm((current) => ({ ...current, maxWeight: value }))} /></label>
          <label className="admin-form-field"><span>Đang hoạt động</span><Switch checked={form.isActive} onChange={(value) => setForm((current) => ({ ...current, isActive: value }))} /></label>
          <label className="admin-form-field admin-form-field--wide"><span>Ghi chú</span><Input.TextArea rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></label>
        </div>
      </Modal>
    </div>
  );
}
