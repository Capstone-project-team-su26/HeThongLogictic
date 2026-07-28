import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Button,
  Descriptions,
  Drawer,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";

import { getAdminApiError } from "../../api/AdminAPI/adminService";
import AuthNotify from "../../utils/Common/AuthNotify";
import {
  formatVietnamDateTime,
  localToUtcIso,
  toDateTimeLocalInputValue,
} from "../../utils/timeUtc";
import "./AdminPage.css";

const formatNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("vi-VN") : "—";
};

const formatDate = (value) => {
  return formatVietnamDateTime(value, { fallback: "—" });
};

const toDateTimeLocalValue = (value) => {
  return toDateTimeLocalInputValue(value);
};

const getInitialForm = (fields, record = null) => {
  return fields.reduce((form, field) => {
    let value = record?.[field.name];

    if (field.type === "datetime-local") {
      value = toDateTimeLocalValue(value);
    }

    if (value === null || value === undefined) {
      value = field.defaultValue ?? (field.type === "switch" ? false : "");
    }

    form[field.name] = value;
    return form;
  }, {});
};

const buildPayload = (fields, form) => {
  return fields.reduce((payload, field) => {
    let value = form[field.name];

    if (field.type === "datetime-local") {
      value = value ? localToUtcIso(value) : null;
    } else if (field.type === "number") {
      value = value === "" || value === null ? null : Number(value);
    } else if (field.type === "switch") {
      value = Boolean(value);
    } else if (typeof value === "string") {
      value = value.trim() || null;
    }

    payload[field.name] = value;
    return payload;
  }, {});
};

const getRecordId = (record) => {
  return record?.id || record?.resourceId || record?.configurationId || "";
};

const renderColumnValue = (column, value, record) => {
  if (column.type === "active") {
    return value ? <Tag color="success">Đang hoạt động</Tag> : <Tag>Ngừng hoạt động</Tag>;
  }

  if (column.type === "status") {
    const active = String(value || "").toUpperCase() === "ACTIVE";
    return <Tag color={active ? "success" : "default"}>{value || "—"}</Tag>;
  }

  if (column.type === "restriction") {
    const colors = { BANNED: "error", RESTRICTED: "warning", WARNING: "gold" };
    const labels = { BANNED: "Cấm", RESTRICTED: "Hạn chế", WARNING: "Cảnh báo" };
    return <Tag color={colors[value]}>{labels[value] || value || "—"}</Tag>;
  }

  if (column.type === "tag") return value ? <Tag color="blue">{value}</Tag> : "—";
  if (column.type === "money") {
    return `${formatNumber(value)} ${record?.currency || "₫"}`;
  }
  if (column.type === "number") return formatNumber(value);
  if (column.type === "weight") return `${formatNumber(value)} kg`;
  if (column.type === "date") return formatDate(value);
  if (column.type === "route") {
    return `${record?.originCountry || "—"} → ${record?.destinationCountry || "—"}`;
  }
  if (column.type === "dimensions") {
    return `${formatNumber(record?.length)} × ${formatNumber(record?.width)} × ${formatNumber(record?.height)} cm`;
  }

  return value === null || value === undefined || value === "" ? "—" : String(value);
};

export default function AdminResourcePage({
  title,
  singular,
  description,
  searchFields,
  columns,
  fields,
  api,
}) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [form, setForm] = useState({});

  const loadItems = useCallback(async () => {
    setLoading(true);

    try {
      const data = await api.list();
      setItems(data);
    } catch (error) {
      AuthNotify.error(
        "Tải dữ liệu thất bại",
        getAdminApiError(error, `Không thể tải ${title.toLowerCase()}.`)
      );
    } finally {
      setLoading(false);
    }
  }, [api, title]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery("");
      setEditorOpen(false);
      setDetailOpen(false);
      loadItems();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");

    if (!keyword) return items;

    return items.filter((item) =>
      searchFields.some((fieldName) =>
        String(item?.[fieldName] ?? "")
          .toLocaleLowerCase("vi")
          .includes(keyword)
      )
    );
  }, [items, query, searchFields]);

  const openCreate = () => {
    setEditingRecord(null);
    setForm(getInitialForm(fields));
    setEditorOpen(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setForm(getInitialForm(fields, record));
    setEditorOpen(true);
  };

  const openDetail = async (record) => {
    setDetailRecord(record);
    setDetailOpen(true);
    setDetailLoading(true);

    try {
      if (typeof api.detail === "function") {
        const detail = await api.detail(getRecordId(record));
        setDetailRecord(detail || record);
      }
    } catch {
      setDetailRecord(record);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submitForm = async () => {
    const missingField = fields.find((field) => {
      if (!field.required) return false;
      const value = form[field.name];
      return value === "" || value === null || value === undefined;
    });

    if (missingField) {
      AuthNotify.warning("Thiếu thông tin", `Vui lòng nhập ${missingField.label.toLowerCase()}.`);
      return;
    }

    setSaving(true);

    try {
      const payload = buildPayload(fields, form);

      if (editingRecord) {
        await api.update(getRecordId(editingRecord), payload);
        AuthNotify.success("Cập nhật thành công", `Đã cập nhật ${singular}.`);
      } else {
        await api.create(payload);
        AuthNotify.success("Tạo mới thành công", `Đã tạo ${singular}.`);
      }

      setEditorOpen(false);
      await loadItems();
    } catch (error) {
      AuthNotify.error("Lưu dữ liệu thất bại", getAdminApiError(error, `Không thể lưu ${singular}.`));
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (record) => {
    try {
      await api.remove(getRecordId(record));
      AuthNotify.success("Xử lý thành công", `Đã xóa/ngừng sử dụng ${singular}.`);
      await loadItems();
    } catch (error) {
      AuthNotify.error("Xóa dữ liệu thất bại", getAdminApiError(error, `Không thể xóa ${singular}.`));
    }
  };

  const tableColumns = [
    ...columns.map((column, index) => ({
      title: column.label,
      dataIndex: column.name,
      key: column.name,
      width: index === 0 ? 230 : 150,
      fixed: index === 0 ? "left" : undefined,
      ellipsis: true,
      render: (value, record) => renderColumnValue(column, value, record),
    })),
    {
      title: "Thao tác",
      key: "actions",
      width: 142,
      fixed: "right",
      align: "center",
      render: (_, record) => (
        <Space size={5}>
          <Tooltip title="Xem chi tiết">
            <Button
              aria-label="Xem chi tiết"
              type="text"
              icon={<EyeOutlined />}
              onClick={() => openDetail(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button
              aria-label="Chỉnh sửa"
              type="text"
              className="admin-action-edit"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title={`Xóa ${singular}?`}
            description="Dữ liệu đang được đơn hàng sử dụng có thể chỉ chuyển sang ngừng hoạt động."
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => removeRecord(record)}
          >
            <Tooltip title="Xóa/ngừng sử dụng">
              <Button
                aria-label="Xóa"
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
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
          <span>TRUNG TÂM QUẢN TRỊ</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="admin-page__hero-count">
          <strong>{items.length}</strong>
          <span>bản ghi</span>
          <small>UTC đồng bộ</small>
        </div>
      </section>

      <section className="admin-page__panel">
        <div className="admin-page__toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Tìm trong ${title.toLowerCase()}...`}
            className="admin-page__search"
          />
          <Button icon={<ReloadOutlined />} onClick={loadItems} loading={loading}>
            Tải lại
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm {singular}
          </Button>
        </div>

        <div className="admin-page__table">
          <Table
            rowKey={(record) => getRecordId(record)}
            loading={loading}
            columns={tableColumns}
            dataSource={filteredItems}
            scroll={{ x: "max-content" }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `${total} bản ghi`,
            }}
          />
        </div>
      </section>

      <Modal
        open={editorOpen}
        title={editingRecord ? `Cập nhật ${singular}` : `Thêm ${singular}`}
        width={720}
        okText={editingRecord ? "Lưu thay đổi" : "Tạo mới"}
        cancelText="Hủy"
        confirmLoading={saving}
        mask={{ closable: !saving }}
        keyboard={!saving}
        destroyOnHidden
        onOk={submitForm}
        onCancel={() => !saving && setEditorOpen(false)}
        className="admin-editor-modal"
      >
        <div className="admin-form-grid">
          {fields.map((field) => (
            <label
              key={field.name}
              className={field.span === 2 ? "admin-form-field admin-form-field--wide" : "admin-form-field"}
            >
              <span>
                {field.label}
                {field.required && <b>*</b>}
              </span>

              {field.type === "select" && (
                <Select
                  value={form[field.name] || undefined}
                  options={field.options}
                  placeholder={field.placeholder || `Chọn ${field.label.toLowerCase()}`}
                  onChange={(value) => updateField(field.name, value)}
                />
              )}

              {field.type === "switch" && (
                <Switch
                  checked={Boolean(form[field.name])}
                  checkedChildren="Có"
                  unCheckedChildren="Không"
                  onChange={(value) => updateField(field.name, value)}
                />
              )}

              {field.type === "number" && (
                <InputNumber
                  value={form[field.name]}
                  min={field.min}
                  max={field.max}
                  style={{ width: "100%" }}
                  onChange={(value) => updateField(field.name, value)}
                />
              )}

              {field.type === "textarea" && (
                <Input.TextArea
                  value={form[field.name]}
                  rows={3}
                  placeholder={field.placeholder}
                  onChange={(event) => updateField(field.name, event.target.value)}
                />
              )}

              {!["select", "switch", "number", "textarea"].includes(field.type) && (
                <Input
                  type={field.type || "text"}
                  value={form[field.name]}
                  placeholder={field.placeholder}
                  onChange={(event) => updateField(field.name, event.target.value)}
                />
              )}
            </label>
          ))}
        </div>
      </Modal>

      <Drawer
        open={detailOpen}
        title={`Chi tiết ${singular}`}
        width={560}
        rootClassName="admin-detail-drawer"
        destroyOnHidden
        onClose={() => setDetailOpen(false)}
      >
        {detailLoading ? (
          <div className="admin-page__drawer-loading"><Spin /></div>
        ) : (
          <Descriptions column={1} bordered size="small">
            {Object.entries(detailRecord || {})
              .filter(([, value]) => typeof value !== "object" || value === null)
              .map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>
                  {typeof value === "boolean"
                    ? value ? "Có" : "Không"
                    : /(?:At|Date)$/i.test(key)
                      ? formatDate(value)
                      : value === null || value === "" ? "—" : String(value)}
                </Descriptions.Item>
              ))}
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
