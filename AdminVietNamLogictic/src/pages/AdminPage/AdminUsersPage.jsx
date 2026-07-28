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
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import {
  EyeOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UnlockOutlined,
} from "@ant-design/icons";

import {
  createAdminUser,
  getAdminApiError,
  getAdminUserDetail,
  getAdminUsers,
  lockAdminUser,
  unlockAdminUser,
  updateAdminUserRole,
} from "../../api/AdminAPI/adminService";
import { formatVietnamDateTime } from "../../utils/timeUtc";
import AuthNotify from "../../utils/Common/AuthNotify";
import "./AdminPage.css";

const ROLE_OPTIONS = [
  { value: "Admin", label: "Quản trị viên" },
  { value: "Sale", label: "Nhân viên Sale" },
  { value: "OperationsManager", label: "Quản lý vận hành" },
  { value: "WarehouseStaff", label: "Nhân viên kho" },
  { value: "Delivery", label: "Nhân viên giao nhận" },
];

const INITIAL_CREATE_FORM = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  role: "Sale",
  region: "",
};

const isLockedUser = (user) => {
  if (typeof user?.isLocked === "boolean") return user.isLocked;
  return String(user?.status || "").toUpperCase().includes("LOCK");
};

const formatDate = (value) => {
  return formatVietnamDateTime(value, { fallback: "—" });
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [roleForm, setRoleForm] = useState({ role: "", region: "" });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await getAdminUsers());
    } catch (error) {
      AuthNotify.error("Tải dữ liệu thất bại", getAdminApiError(error, "Không thể tải danh sách người dùng."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadUsers, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    if (!keyword) return users;

    return users.filter((user) =>
      [user.fullName, user.email, user.phone, user.role, user.region, user.status]
        .some((value) => String(value ?? "").toLocaleLowerCase("vi").includes(keyword))
    );
  }, [query, users]);

  const employeeCount = users.filter((user) => user.userType === "Employee").length;

  const updateCreateField = (name, value) => {
    setCreateForm((current) => ({ ...current, [name]: value }));
  };

  const submitCreate = async () => {
    const fullName = createForm.fullName.trim();
    const email = createForm.email.trim().toLowerCase();
    const phone = createForm.phone.replace(/\D/g, "");

    if (!fullName || !email || !createForm.password || !phone || !createForm.role) {
      AuthNotify.warning("Thiếu thông tin", "Vui lòng nhập đầy đủ các trường bắt buộc.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      AuthNotify.warning("Email không hợp lệ", "Email không đúng định dạng.");
      return;
    }
    if (!/^0\d{9}$/.test(phone)) {
      AuthNotify.warning("Số điện thoại không hợp lệ", "Số điện thoại phải gồm 10 số và bắt đầu bằng số 0.");
      return;
    }
    if (createForm.password.length < 6) {
      AuthNotify.warning("Mật khẩu không hợp lệ", "Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (users.some((user) => String(user.email || "").toLowerCase() === email)) {
      AuthNotify.warning("Email bị trùng", "Email đã tồn tại trong hệ thống.");
      return;
    }
    if (users.some((user) => String(user.phone || "").replace(/\D/g, "") === phone)) {
      AuthNotify.warning("Số điện thoại bị trùng", "Số điện thoại đã tồn tại trong hệ thống.");
      return;
    }

    setSaving(true);
    try {
      await createAdminUser({
        fullName,
        email,
        password: createForm.password,
        phone,
        role: createForm.role,
        region: createForm.region.trim() || null,
      });
      AuthNotify.success("Tạo tài khoản thành công", "Đã tạo tài khoản nhân viên.");
      setCreateOpen(false);
      setCreateForm(INITIAL_CREATE_FORM);
      await loadUsers();
    } catch (error) {
      AuthNotify.error("Tạo tài khoản thất bại", getAdminApiError(error, "Không thể tạo tài khoản."));
    } finally {
      setSaving(false);
    }
  };

  const openRoleEditor = (user) => {
    setSelectedUser(user);
    setRoleForm({ role: user.role || "", region: user.region || "" });
    setRoleOpen(true);
  };

  const submitRole = async () => {
    if (!selectedUser?.id || !roleForm.role) return;

    setSaving(true);
    try {
      await updateAdminUserRole(selectedUser.id, {
        role: roleForm.role,
        region: roleForm.region.trim() || null,
      });
      AuthNotify.success("Cập nhật thành công", "Đã cập nhật quyền tài khoản.");
      setRoleOpen(false);
      await loadUsers();
    } catch (error) {
      AuthNotify.error("Cập nhật quyền thất bại", getAdminApiError(error, "Không thể cập nhật quyền."));
    } finally {
      setSaving(false);
    }
  };

  const toggleLock = async (user) => {
    const shouldLock = !isLockedUser(user);

    try {
      if (shouldLock) {
        await lockAdminUser(user.id);
      } else {
        await unlockAdminUser(user.id);
      }
      AuthNotify.success(
        shouldLock ? "Khóa tài khoản thành công" : "Mở khóa thành công",
        shouldLock ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản."
      );
      await loadUsers();
    } catch (error) {
      AuthNotify.error("Cập nhật trạng thái thất bại", getAdminApiError(error, "Không thể cập nhật trạng thái tài khoản."));
    }
  };

  const openDetail = async (user) => {
    setDetailUser(user);
    setDetailOpen(true);
    try {
      setDetailUser((await getAdminUserDetail(user.id)) || user);
    } catch {
      setDetailUser(user);
    }
  };

  const columns = [
    {
      title: "Người dùng",
      dataIndex: "fullName",
      key: "fullName",
      width: 220,
      fixed: "left",
      render: (value, record) => (
        <div className="admin-user-cell">
          <strong>{value || "Chưa cập nhật"}</strong>
          <span>{record.email}</span>
        </div>
      ),
    },
    { title: "Số điện thoại", dataIndex: "phone", key: "phone", width: 135 },
    {
      title: "Vai trò",
      dataIndex: "role",
      key: "role",
      width: 145,
      render: (value) => <Tag color="blue">{value || "—"}</Tag>,
    },
    { title: "Loại tài khoản", dataIndex: "userType", key: "userType", width: 135 },
    { title: "Khu vực", dataIndex: "region", key: "region", width: 100, render: (value) => value || "—" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 135,
      render: (value, record) => (
        <Tag color={isLockedUser(record) ? "error" : value === "Active" ? "success" : "warning"}>
          {isLockedUser(record) ? "Đã khóa" : value || "—"}
        </Tag>
      ),
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 155,
      render: formatDate,
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 155,
      fixed: "right",
      align: "center",
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button type="text" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
          </Tooltip>
          <Tooltip title="Phân quyền">
            <Button
              type="text"
              className="admin-action-edit"
              icon={<SafetyCertificateOutlined />}
              onClick={() => openRoleEditor(record)}
            />
          </Tooltip>
          <Popconfirm
            title={isLockedUser(record) ? "Mở khóa tài khoản?" : "Khóa tài khoản?"}
            okText={isLockedUser(record) ? "Mở khóa" : "Khóa"}
            cancelText="Hủy"
            onConfirm={() => toggleLock(record)}
          >
            <Tooltip title={isLockedUser(record) ? "Mở khóa" : "Khóa tài khoản"}>
              <Button
                type="text"
                danger={!isLockedUser(record)}
                icon={isLockedUser(record) ? <UnlockOutlined /> : <LockOutlined />}
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
          <span>QUẢN TRỊ HỆ THỐNG</span>
          <h1>Quản lý người dùng</h1>
          <p>Tạo tài khoản nội bộ, phân quyền và kiểm soát trạng thái đăng nhập.</p>
        </div>
        <div className="admin-page__hero-count">
          <strong>{employeeCount}</strong>
          <span>nhân viên</span>
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
            placeholder="Tìm theo tên, email, SĐT, vai trò..."
            className="admin-page__search"
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadUsers}>
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setCreateForm(INITIAL_CREATE_FORM);
              setCreateOpen(true);
            }}
          >
            Thêm nhân viên
          </Button>
        </div>

        <div className="admin-page__table">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredUsers}
            loading={loading}
            scroll={{ x: "max-content" }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `${total} người dùng`,
            }}
          />
        </div>
      </section>

      <Modal
        open={createOpen}
        title="Tạo tài khoản nhân viên"
        width={680}
        okText="Tạo tài khoản"
        cancelText="Hủy"
        confirmLoading={saving}
        mask={{ closable: !saving }}
        destroyOnHidden
        onOk={submitCreate}
        onCancel={() => !saving && setCreateOpen(false)}
        className="admin-editor-modal"
      >
        <div className="admin-form-grid">
          <label className="admin-form-field">
            <span>Họ và tên <b>*</b></span>
            <Input value={createForm.fullName} onChange={(event) => updateCreateField("fullName", event.target.value)} />
          </label>
          <label className="admin-form-field">
            <span>Email <b>*</b></span>
            <Input type="email" value={createForm.email} onChange={(event) => updateCreateField("email", event.target.value)} />
          </label>
          <label className="admin-form-field">
            <span>Số điện thoại <b>*</b></span>
            <Input
              inputMode="numeric"
              maxLength={10}
              value={createForm.phone}
              onChange={(event) => updateCreateField("phone", event.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </label>
          <label className="admin-form-field">
            <span>Mật khẩu <b>*</b></span>
            <Input.Password value={createForm.password} onChange={(event) => updateCreateField("password", event.target.value)} />
          </label>
          <label className="admin-form-field">
            <span>Vai trò <b>*</b></span>
            <Select value={createForm.role} options={ROLE_OPTIONS} onChange={(value) => updateCreateField("role", value)} />
          </label>
          <label className="admin-form-field">
            <span>Khu vực</span>
            <Input value={createForm.region} placeholder="VN, CN, JP..." onChange={(event) => updateCreateField("region", event.target.value)} />
          </label>
        </div>
      </Modal>

      <Modal
        open={roleOpen}
        title={`Phân quyền: ${selectedUser?.fullName || "Tài khoản"}`}
        okText="Lưu phân quyền"
        cancelText="Hủy"
        confirmLoading={saving}
        mask={{ closable: !saving }}
        destroyOnHidden
        onOk={submitRole}
        onCancel={() => !saving && setRoleOpen(false)}
        className="admin-editor-modal"
      >
        <div className="admin-form-grid admin-form-grid--single">
          <label className="admin-form-field">
            <span>Vai trò <b>*</b></span>
            <Select
              value={roleForm.role}
              options={ROLE_OPTIONS}
              onChange={(value) => setRoleForm((current) => ({ ...current, role: value }))}
            />
          </label>
          <label className="admin-form-field">
            <span>Khu vực</span>
            <Input
              value={roleForm.region}
              onChange={(event) => setRoleForm((current) => ({ ...current, region: event.target.value }))}
            />
          </label>
        </div>
      </Modal>

      <Drawer
        open={detailOpen}
        title="Thông tin người dùng"
        width={520}
        rootClassName="admin-detail-drawer"
        destroyOnHidden
        onClose={() => setDetailOpen(false)}
      >
        <Descriptions column={1} bordered size="small">
          {Object.entries(detailUser || {})
            .filter(([, value]) => typeof value !== "object" || value === null)
            .map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {/(?:At|Date)$/i.test(key) ? formatDate(value) : value || "—"}
              </Descriptions.Item>
            ))}
        </Descriptions>
      </Drawer>
    </div>
  );
}
