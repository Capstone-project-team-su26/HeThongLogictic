import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

const compareText = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), "vi", { sensitivity: "base" });

const uniqueSelectOptions = (items, getValue, getLabel = (value) => value) => {
  const map = new Map();
  for (const item of items) {
    const value = getValue(item);
    if (value == null || value === "") continue;
    if (!map.has(value)) map.set(value, getLabel(value, item));
  }
  return [...map.entries()]
    .sort((a, b) => compareText(a[1], b[1]))
    .map(([value, label]) => ({ label: String(label), value }));
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(null);
  const [userTypeFilter, setUserTypeFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [roleForm, setRoleForm] = useState({ role: "", region: "" });
  const queryRef = useRef(query);
  const searchGuardTimersRef = useRef([]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => () => {
    searchGuardTimersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const openCreateModal = () => {
    const searchSnapshot = queryRef.current;
    setCreateForm(INITIAL_CREATE_FORM);
    setCreateOpen(true);

    searchGuardTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    searchGuardTimersRef.current = [50, 200, 500].map((delay) =>
      window.setTimeout(() => setQuery(searchSnapshot), delay)
    );
  };

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

  const roleOptions = useMemo(
    () => uniqueSelectOptions(users, (user) => user.role),
    [users]
  );
  const userTypeOptions = useMemo(
    () => uniqueSelectOptions(users, (user) => user.userType),
    [users]
  );
  const statusOptions = useMemo(() => {
    const options = [];
    if (users.some(isLockedUser)) options.push({ label: "Đã khóa", value: "__locked__" });
    uniqueSelectOptions(
      users.filter((user) => !isLockedUser(user)),
      (user) => user.status || "—"
    ).forEach((item) => options.push(item));
    return options;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");

    return users.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (userTypeFilter && user.userType !== userTypeFilter) return false;
      if (statusFilter === "__locked__") {
        if (!isLockedUser(user)) return false;
      } else if (statusFilter && (isLockedUser(user) || (user.status || "—") !== statusFilter)) {
        return false;
      }
      if (!keyword) return true;
      return [user.fullName, user.email, user.phone, user.role, user.region, user.status]
        .some((value) => String(value ?? "").toLocaleLowerCase("vi").includes(keyword));
    });
  }, [query, roleFilter, statusFilter, userTypeFilter, users]);

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

  const columns = useMemo(
    () => [
      {
        title: "Người dùng",
        dataIndex: "fullName",
        key: "fullName",
        width: 220,
        fixed: "left",
        sorter: (a, b) => compareText(a.fullName, b.fullName),
        render: (value, record) => (
          <div className="admin-user-cell">
            <strong>{value || "Chưa cập nhật"}</strong>
            <span>{record.email}</span>
          </div>
        ),
      },
      {
        title: "Số điện thoại",
        dataIndex: "phone",
        key: "phone",
        width: 135,
        sorter: (a, b) => compareText(a.phone, b.phone),
      },
      {
        title: "Vai trò",
        dataIndex: "role",
        key: "role",
        width: 145,
        sorter: (a, b) => compareText(a.role, b.role),
        render: (value) => <Tag color="blue">{value || "—"}</Tag>,
      },
      {
        title: "Loại tài khoản",
        dataIndex: "userType",
        key: "userType",
        width: 135,
        sorter: (a, b) => compareText(a.userType, b.userType),
      },
      {
        title: "Khu vực",
        dataIndex: "region",
        key: "region",
        width: 100,
        sorter: (a, b) => compareText(a.region, b.region),
        render: (value) => value || "—",
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 135,
        sorter: (a, b) => {
          const statusA = isLockedUser(a) ? "Đã khóa" : a.status || "—";
          const statusB = isLockedUser(b) ? "Đã khóa" : b.status || "—";
          return compareText(statusA, statusB);
        },
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
        sorter: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
        defaultSortOrder: "descend",
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
    ],
    []
  );

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
            type="search"
            name="admin-users-search"
            autoComplete="off"
            prefix={<SearchOutlined />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên, email, SĐT, vai trò..."
            className="admin-page__search"
          />
          <Select
            allowClear
            placeholder="Vai trò"
            value={roleFilter}
            options={roleOptions}
            onChange={setRoleFilter}
            className="admin-page__filter-select"
          />
          <Select
            allowClear
            placeholder="Loại TK"
            value={userTypeFilter}
            options={userTypeOptions}
            onChange={setUserTypeFilter}
            className="admin-page__filter-select"
          />
          <Select
            allowClear
            placeholder="Trạng thái"
            value={statusFilter}
            options={statusOptions}
            onChange={setStatusFilter}
            className="admin-page__filter-select"
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadUsers}>
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
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
        <form
          className="admin-form-grid"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            if (!saving) submitCreate();
          }}
        >
          <input
            type="text"
            name="username"
            autoComplete="username"
            tabIndex={-1}
            aria-hidden="true"
            className="admin-autofill-trap"
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            tabIndex={-1}
            aria-hidden="true"
            className="admin-autofill-trap"
          />
          <label className="admin-form-field">
            <span>Họ và tên <b>*</b></span>
            <Input
              name="admin-create-fullName"
              autoComplete="off"
              value={createForm.fullName}
              onChange={(event) => updateCreateField("fullName", event.target.value)}
            />
          </label>
          <label className="admin-form-field">
            <span>Email <b>*</b></span>
            <Input
              type="email"
              name="admin-create-email"
              autoComplete="off"
              value={createForm.email}
              onChange={(event) => updateCreateField("email", event.target.value)}
            />
          </label>
          <label className="admin-form-field">
            <span>Số điện thoại <b>*</b></span>
            <Input
              name="admin-create-phone"
              autoComplete="off"
              inputMode="numeric"
              maxLength={10}
              value={createForm.phone}
              onChange={(event) => updateCreateField("phone", event.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </label>
          <label className="admin-form-field">
            <span>Mật khẩu <b>*</b></span>
            <Input.Password
              name="admin-create-password"
              autoComplete="new-password"
              value={createForm.password}
              onChange={(event) => updateCreateField("password", event.target.value)}
            />
          </label>
          <label className="admin-form-field">
            <span>Vai trò <b>*</b></span>
            <Select value={createForm.role} options={ROLE_OPTIONS} onChange={(value) => updateCreateField("role", value)} />
          </label>
          <label className="admin-form-field">
            <span>Khu vực</span>
            <Input
              name="admin-create-region"
              autoComplete="off"
              value={createForm.region}
              placeholder="VN, CN, JP..."
              onChange={(event) => updateCreateField("region", event.target.value)}
            />
          </label>
        </form>
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
