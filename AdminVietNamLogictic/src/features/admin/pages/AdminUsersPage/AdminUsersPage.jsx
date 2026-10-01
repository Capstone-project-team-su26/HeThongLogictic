import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
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
  Typography,
} from "antd";
import {
  EyeOutlined,
  HomeOutlined,
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
  getAdminUsers,
  lockAdminUser,
  unlockAdminUser,
  updateAdminUserRole,
} from "@features/admin/api/adminService";
import {
  LOCKED_STATUS_FILTER,
  applyLockState,
  applyRoleUpdate,
  applyWarehouseAssignment,
  buildCreatedAdminUser,
  filterAdminUsers,
  isLockedAdminUser,
  isWarehouseRole,
  patchAdminUser,
  summarizeAdminUsers,
  upsertAdminUser,
} from "@features/admin/api/adminUserService";
import { formatVietnamDateTime } from "@shared/utils/timeUtc";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import "@features/admin/styles/AdminPage.css";
import UserWarehouseAssignModal from "@features/admin/components/UserWarehouseAssignModal/UserWarehouseAssignModal";
import { getRoleLabel, getUserStatusLabel, getUserTypeLabel } from "@shared/utils/statusLabel";

/* Nhãn lấy từ bảng vai trò dùng chung — cùng một chữ ở bảng, bộ lọc và hộp phân quyền. */
const ROLE_OPTIONS = ["Admin", "Sale", "OperationsManager", "WarehouseStaff", "Delivery"].map((value) => ({
  value,
  label: getRoleLabel(value),
}));

/*
 * Luật của PUT /api/User/{id}/role (backend thật):
 *  - KHÔNG gán được vai trò Admin → khoá lựa chọn Admin trong hộp phân quyền;
 *  - region rỗng = GIỮ NGUYÊN, không có cách xoá vùng → chặn lưu khi Admin xoá trống ô vùng
 *    của tài khoản đang có vùng (không giả lập "đã xoá vùng");
 *  - đổi vai trò khỏi vai trò kho / đổi vùng khi tài khoản đang được gán kho → 400, hiện
 *    nguyên message của server.
 */
const ROLE_EDIT_OPTIONS = ROLE_OPTIONS.map((option) =>
  option.value === "Admin"
    ? { ...option, disabled: true, label: `${option.label} (máy chủ không cho gán)` }
    : option
);

/** Tên chuẩn của vai trò nhân viên kho — các biến thể khác vẫn chạy nhưng nên đổi về tên này. */
const STANDARD_WAREHOUSE_ROLE = "WarehouseStaff";

/** Vai trò kho viết khác chuẩn ("Warehouse Staff VN", "WarehouseTQ", "Warehouse"...). */
const isNonStandardWarehouseRole = (role) =>
  isWarehouseRole(role) && String(role).trim() !== STANDARD_WAREHOUSE_ROLE;

const INITIAL_CREATE_FORM = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  role: "Sale",
  region: "",
};

const isLockedUser = isLockedAdminUser;

const DEFAULT_PAGINATION = { current: 1, pageSize: 10 };

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
  /* Tài khoản vai trò kho đang mở hộp "Gán kho" (null = đóng). */
  const [warehouseAssignUser, setWarehouseAssignUser] = useState(null);
  /* Phân trang bảng (điều khiển được để về trang 1 khi đổi tìm kiếm / bộ lọc). */
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  /* id các tài khoản đang khoá / mở khoá — chặn bấm lặp và hiện loading đúng dòng. */
  const [lockPendingIds, setLockPendingIds] = useState(() => new Set());
  const queryRef = useRef(query);
  /* Chặn gửi hai lần (bấm đúp nút OK + Enter trong form) trước khi state saving kịp render. */
  const savingRef = useRef(false);
  const lockPendingRef = useRef(new Set());
  /* Chỉ kết quả của lần tải MỚI NHẤT được ghi vào bảng (bấm "Tải lại" liên tục). */
  const loadSeqRef = useRef(0);
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

  /*
   * GET /api/User trả TOÀN BỘ tài khoản trong một lần (backend không phân trang, không giới
   * hạn) và đã kèm assignedWarehouses — không gọi /api/users/{id}/warehouses cho từng người.
   * Chỉ gọi khi mở trang và khi bấm "Tải lại"; tạo / phân quyền / khoá / gán kho cập nhật
   * đúng dòng từ kết quả của chính thao tác đó.
   */
  const loadUsers = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const list = await getAdminUsers();
      if (seq === loadSeqRef.current) setUsers(list);
    } catch (error) {
      if (seq === loadSeqRef.current) {
        AuthNotify.error("Tải dữ liệu thất bại", getAdminApiError(error, "Không thể tải danh sách người dùng."));
      }
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadUsers, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const roleOptions = useMemo(
    () => uniqueSelectOptions(users, (user) => user.role, (value) => getRoleLabel(value)),
    [users]
  );
  const userTypeOptions = useMemo(
    () => uniqueSelectOptions(users, (user) => user.userType, (value) => getUserTypeLabel(value)),
    [users]
  );
  const statusOptions = useMemo(() => {
    const options = [];
    if (users.some(isLockedUser)) options.push({ label: "Đã khóa", value: LOCKED_STATUS_FILTER });
    uniqueSelectOptions(
      users.filter((user) => !isLockedUser(user)),
      (user) => user.status || "—",
      (value) => (value === "—" ? "—" : getUserStatusLabel(value))
    ).forEach((item) => options.push(item));
    return options;
  }, [users]);

  const filteredUsers = useMemo(
    () =>
      filterAdminUsers(users, {
        query,
        role: roleFilter,
        userType: userTypeFilter,
        status: statusFilter,
      }),
    [query, roleFilter, statusFilter, userTypeFilter, users]
  );

  /* Ô tổng: "nhân viên" = tài khoản KHÔNG phải khách; kèm tổng tài khoản + số khách để khớp
     với số bản ghi GET /api/User trả (bảng hiện đủ mọi bản ghi). */
  const summary = useMemo(() => summarizeAdminUsers(users), [users]);

  /* Đổi tìm kiếm / bộ lọc → về trang 1 (không để bảng đứng ở trang không còn dữ liệu). */
  const resetPage = () => setPagination((current) => (current.current === 1 ? current : { ...current, current: 1 }));
  const withPageReset = (setter) => (value) => {
    setter(value);
    resetPage();
  };

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

    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const payload = {
      fullName,
      email,
      password: createForm.password,
      phone,
      role: createForm.role,
      region: createForm.region.trim() || null,
    };
    try {
      const created = await createAdminUser(payload);
      /* Một request duy nhất: chèn bản ghi dựng từ dữ liệu đã gửi + id server trả, không tải
         lại cả danh sách. Chỉ khi server không trả id (ngoài hợp đồng) mới tải lại một lần. */
      const createdUser = buildCreatedAdminUser(payload, created);
      if (createdUser) {
        setUsers((current) => upsertAdminUser(current, createdUser));
        setPagination((current) => ({ ...current, current: 1 }));
      }
      AuthNotify.success("Tạo tài khoản thành công", `Đã tạo tài khoản ${fullName} (${email}).`);
      setCreateOpen(false);
      setCreateForm(INITIAL_CREATE_FORM);
      if (!createdUser) loadUsers();
    } catch (error) {
      AuthNotify.error("Tạo tài khoản thất bại", getAdminApiError(error, "Không thể tạo tài khoản."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const openRoleEditor = useCallback((user) => {
    setSelectedUser(user);
    setRoleForm({ role: user.role || "", region: user.region || "" });
    setRoleOpen(true);
  }, []);

  const roleEditBlockedReason = (() => {
    if (!selectedUser) return "";
    if (String(roleForm.role).trim().toLowerCase() === "admin") {
      return "Máy chủ không cho gán vai trò Admin (kể cả chỉ đổi vùng của tài khoản Admin) — thao tác này bị khoá.";
    }
    if (String(selectedUser.region || "").trim() && !roleForm.region.trim()) {
      return `Máy chủ không xoá được vùng: để trống sẽ GIỮ NGUYÊN vùng ${selectedUser.region}. Nhập lại vùng hoặc giữ nguyên.`;
    }
    return "";
  })();

  const submitRole = async () => {
    if (!selectedUser?.id || !roleForm.role) return;
    if (roleEditBlockedReason) {
      AuthNotify.warning("Không thể lưu", roleEditBlockedReason);
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const payload = { role: roleForm.role, region: roleForm.region.trim() || null };
    const userId = selectedUser.id;
    try {
      await updateAdminUserRole(userId, payload);
      /* Server chỉ trả { message } — cập nhật đúng dòng theo luật của server, không tải lại. */
      setUsers((current) => patchAdminUser(current, userId, (user) => applyRoleUpdate(user, payload)));
      AuthNotify.success("Cập nhật thành công", "Đã cập nhật quyền tài khoản.");
      setRoleOpen(false);
    } catch (error) {
      AuthNotify.error("Cập nhật quyền thất bại", getAdminApiError(error, "Không thể cập nhật quyền."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const setLockPending = useCallback((userId, pending) => {
    const next = new Set(lockPendingRef.current);
    if (pending) next.add(userId);
    else next.delete(userId);
    lockPendingRef.current = next;
    setLockPendingIds(next);
  }, []);

  const toggleLock = useCallback(async (user) => {
    if (!user?.id || lockPendingRef.current.has(user.id)) return;
    const shouldLock = !isLockedUser(user);
    setLockPending(user.id, true);

    try {
      if (shouldLock) {
        await lockAdminUser(user.id);
      } else {
        await unlockAdminUser(user.id);
      }
      setUsers((current) => patchAdminUser(current, user.id, (item) => applyLockState(item, shouldLock)));
      const name = user.fullName || user.email;
      AuthNotify.success(
        shouldLock ? "Khóa tài khoản thành công" : "Mở khóa thành công",
        `${shouldLock ? "Đã khóa" : "Đã mở khóa"} tài khoản${name ? ` ${name}` : ""}.`
      );
    } catch (error) {
      AuthNotify.error("Cập nhật trạng thái thất bại", getAdminApiError(error, "Không thể cập nhật trạng thái tài khoản."));
    } finally {
      setLockPending(user.id, false);
    }
  }, [setLockPending]);

  /* GET /api/User/{id} trả CÙNG DTO với dòng trong danh sách → mở chi tiết không gọi thêm API. */
  const openDetail = useCallback((user) => {
    setDetailUser(user);
    setDetailOpen(true);
  }, []);

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
        render: (value) =>
          isNonStandardWarehouseRole(value) ? (
            <Tag
              color="orange"
              title={`Vai trò kho viết khác chuẩn (“${value}”) — nên đổi sang ${STANDARD_WAREHOUSE_ROLE}`}
            >
              {getRoleLabel(value)}
            </Tag>
          ) : (
            <Tag color="blue">{getRoleLabel(value)}</Tag>
          ),
      },
      {
        title: "Loại tài khoản",
        dataIndex: "userType",
        key: "userType",
        width: 135,
        sorter: (a, b) => compareText(a.userType, b.userType),
        render: (value) => getUserTypeLabel(value),
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
        title: "Kho phụ trách",
        dataIndex: "assignedWarehouses",
        key: "assignedWarehouses",
        width: 240,
        sorter: (a, b) =>
          (a.assignedWarehouses?.length || 0) - (b.assignedWarehouses?.length || 0),
        render: (value, record) => {
          if (!isWarehouseRole(record.role)) return <Typography.Text type="secondary">—</Typography.Text>;
          const assigned = Array.isArray(value) ? value : [];
          return (
            <div className="uwa-assigned">
              {assigned.length ? (
                <Space size={[4, 4]} wrap>
                  {assigned.map((warehouse) => (
                    <Tag key={warehouse.warehouseId} color="geekblue">
                      {warehouse.warehouseName || warehouse.warehouseCode || "Kho"}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">
                  {record.region ? `Chưa gán — theo vùng ${record.region}` : "Chưa gán, chưa có vùng"}
                </Typography.Text>
              )}
              <Button
                type="link"
                size="small"
                icon={<HomeOutlined />}
                onClick={() => setWarehouseAssignUser(record)}
              >
                Gán kho
              </Button>
            </div>
          );
        },
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
            {isLockedUser(record) ? "Đã khóa" : getUserStatusLabel(value)}
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
                  loading={lockPendingIds.has(record.id)}
                  disabled={lockPendingIds.has(record.id)}
                  icon={isLockedUser(record) ? <UnlockOutlined /> : <LockOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [lockPendingIds, openDetail, openRoleEditor, toggleLock]
  );

  return (
    <div className="admin-page">
      <section className="admin-page__hero">
        <div>
          <span>QUẢN TRỊ HỆ THỐNG</span>
          <h1>Quản lý người dùng</h1>
          <p>Tạo tài khoản nội bộ, phân quyền và kiểm soát trạng thái đăng nhập.</p>
        </div>
        <div
          className="admin-page__hero-count admin-page__hero-count--wide"
          title={`GET /api/User trả ${summary.total} tài khoản: ${summary.staff} nhân viên nội bộ + ${summary.customers} khách hàng`}
        >
          <strong>{summary.staff}</strong>
          <span>nhân viên</span>
          <small>{summary.total} tài khoản · {summary.customers} khách</small>
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
            onChange={(event) => {
              setQuery(event.target.value);
              resetPage();
            }}
            placeholder="Tìm theo tên, email, SĐT, vai trò..."
            className="admin-page__search"
          />
          <Select
            allowClear
            placeholder="Vai trò"
            value={roleFilter}
            options={roleOptions}
            onChange={withPageReset(setRoleFilter)}
            className="admin-page__filter-select"
          />
          <Select
            allowClear
            placeholder="Loại TK"
            value={userTypeFilter}
            options={userTypeOptions}
            onChange={withPageReset(setUserTypeFilter)}
            className="admin-page__filter-select"
          />
          <Select
            allowClear
            placeholder="Trạng thái"
            value={statusFilter}
            options={statusOptions}
            onChange={withPageReset(setStatusFilter)}
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
              current: pagination.current,
              pageSize: pagination.pageSize,
              pageSizeOptions: [10, 20, 50, 100],
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}–${range[1]} / ${total} người dùng${
                  total !== users.length ? ` (lọc từ ${users.length})` : ""
                }`,
            }}
            onChange={(next) =>
              setPagination({
                current: next.current || 1,
                pageSize: next.pageSize || DEFAULT_PAGINATION.pageSize,
              })
            }
          />
        </div>
      </section>

      <Modal
        open={createOpen}
        title="Tạo tài khoản nhân viên"
        width={680}
        okText={saving ? "Đang tạo..." : "Tạo tài khoản"}
        cancelText="Hủy"
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        keyboard={!saving}
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
        okText={saving ? "Đang lưu..." : "Lưu phân quyền"}
        cancelText="Hủy"
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        keyboard={!saving}
        mask={{ closable: !saving }}
        destroyOnHidden
        okButtonProps={{ disabled: Boolean(roleEditBlockedReason) }}
        onOk={submitRole}
        onCancel={() => !saving && setRoleOpen(false)}
        className="admin-editor-modal"
      >
        {roleEditBlockedReason ? (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={roleEditBlockedReason} />
        ) : null}
        {selectedUser?.assignedWarehouses?.length ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`Tài khoản đang được gán ${selectedUser.assignedWarehouses.length} kho`}
            description="Đổi vai trò khỏi vai trò kho hoặc đổi vùng sẽ bị máy chủ từ chối — bỏ gán kho trước (nút “Gán kho”)."
          />
        ) : null}
        {isNonStandardWarehouseRole(roleForm.role) ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={`Vai trò “${roleForm.role}” là cách viết khác của Nhân viên kho`}
            description={
              <>
                Hệ thống vẫn nhận, nhưng nên dùng đúng <b>{STANDARD_WAREHOUSE_ROLE}</b> và khai vùng ở ô
                “Khu vực” (VN → giao diện Kho Việt Nam; CN/JP/KR… → Kho quốc tế).{" "}
                <Button
                  size="small"
                  type="link"
                  onClick={() => setRoleForm((current) => ({ ...current, role: STANDARD_WAREHOUSE_ROLE }))}
                >
                  Dùng {STANDARD_WAREHOUSE_ROLE}
                </Button>
              </>
            }
          />
        ) : null}
        {isWarehouseRole(roleForm.role) && !roleForm.region.trim() && !selectedUser?.assignedWarehouses?.length ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Nhân viên kho chưa có vùng"
            description="Tài khoản trống vùng và chưa gán kho sẽ không thao tác được kho. Nhập vùng (VN, CN, JP, KR…) hoặc gán kho."
          />
        ) : null}
        <div className="admin-form-grid admin-form-grid--single">
          <label className="admin-form-field">
            <span>Vai trò <b>*</b></span>
            <Select
              value={roleForm.role}
              options={ROLE_EDIT_OPTIONS}
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

      {warehouseAssignUser ? (
        <UserWarehouseAssignModal
          key={warehouseAssignUser.id}
          user={warehouseAssignUser}
          onClose={() => setWarehouseAssignUser(null)}
          onSaved={(result) => {
            const userId = warehouseAssignUser.id;
            setWarehouseAssignUser(null);
            /* PUT đã trả danh sách kho + vùng mới → cập nhật đúng dòng, không tải lại cả bảng. */
            if (result?.data) {
              setUsers((current) =>
                patchAdminUser(current, userId, (user) => applyWarehouseAssignment(user, result.data))
              );
            } else {
              loadUsers();
            }
          }}
        />
      ) : null}

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
