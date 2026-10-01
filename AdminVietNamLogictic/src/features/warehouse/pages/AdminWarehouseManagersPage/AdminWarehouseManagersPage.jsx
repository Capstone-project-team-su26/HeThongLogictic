import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import {
  HistoryOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";

import { getWarehousesApi } from "@features/warehouse/api/warehouseService";
import {
  assignWarehouseManager,
  getWarehouseManager,
  getWarehouseManagerCandidates,
  getWarehouseStaff,
} from "@features/warehouse/api/warehouseManagerService";
import { getAdminApiError } from "@features/admin/api/adminService";
import "@features/admin/styles/AdminPage.css";
import { getRoleLabel, getUserStatusLabel, getWarehouseTypeLabel } from "@shared/utils/statusLabel";
import { tablePagination } from "@shared/utils/tablePagination";

const { Text } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

/* 403 body rỗng / 404 body rỗng (server chưa có route) → câu tiếng Việt thay vì câu axios. */
const getStaffError = (error) => {
  const status = error?.response?.status;
  if (!error?.response?.data?.message && status === 403) return "Không có quyền xem nhân viên kho.";
  if (!error?.response?.data?.message && status === 404) return "Máy chủ chưa hỗ trợ xem nhân viên kho.";
  return getAdminApiError(error, "Không tải được nhân viên kho.");
};

/**
 * Kho thật + quản lý hiện tại + nhân viên kho được gán của từng kho. Không ném lỗi: trả
 * { rows, error } để nơi gọi chỉ việc áp vào state.
 */
const fetchWarehouseRows = async () => {
  try {
    const warehouses = await getWarehousesApi({});
    /* Mỗi kho một lời gọi manager + một lời gọi staff — số kho ít (vài chục), chạy song song. */
    const [managers, staffs] = await Promise.all([
      Promise.allSettled(warehouses.map((warehouse) => getWarehouseManager(warehouse.id))),
      Promise.allSettled(warehouses.map((warehouse) => getWarehouseStaff(warehouse.id))),
    ]);

    return {
      error: "",
      rows: warehouses.map((warehouse, index) => {
        const result = managers[index];
        const staffResult = staffs[index];
        return {
          ...warehouse,
          manager: result.status === "fulfilled" ? result.value : null,
          managerError:
            result.status === "rejected"
              ? getAdminApiError(result.reason, "Không tải được quản lý kho.")
              : "",
          staff: staffResult.status === "fulfilled" ? staffResult.value.staff : null,
          staffError: staffResult.status === "rejected" ? getStaffError(staffResult.reason) : "",
        };
      }),
    };
  } catch (error) {
    return { rows: [], error: getAdminApiError(error, "Không tải được danh sách kho.") };
  }
};

/**
 * Admin gán quản lý cho từng kho — người duyệt phiếu nhập kho, biên bản lệch và phiếu xuất
 * kho của kho đó. Kho chưa gán thì OperationsManager / Admin duyệt thay.
 */
export default function AdminWarehouseManagersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [candidates, setCandidates] = useState([]);
  const [candidatesError, setCandidatesError] = useState("");

  const [target, setTarget] = useState(null);
  const [managerId, setManagerId] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [historyTarget, setHistoryTarget] = useState(null);
  const [staffTarget, setStaffTarget] = useState(null);

  /* Áp kết quả tải qua .then: effect không gọi setState đồng bộ (react-hooks/set-state-in-effect). */
  const applyResult = useCallback((result) => {
    setRows(result.rows);
    setErrorMessage(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWarehouseRows().then(applyResult);
  }, [applyResult]);

  const reload = () => {
    setLoading(true);
    fetchWarehouseRows().then(applyResult);
  };

  useEffect(() => {
    getWarehouseManagerCandidates()
      .then(setCandidates)
      .catch((error) =>
        setCandidatesError(getAdminApiError(error, "Không tải được danh sách tài khoản quản lý kho.")),
      );
  }, []);

  const candidateOptions = useMemo(
    () =>
      candidates.map((user) => ({
        value: user.id,
        label: `${user.fullName || user.email}${user.region ? ` · ${user.region}` : ""} (${user.email})`,
      })),
    [candidates],
  );

  const openAssign = (row) => {
    setTarget(row);
    setManagerId(row.manager?.managerId || null);
    setReason("");
  };

  const handleAssign = async () => {
    if (!target) return;
    if (!reason.trim()) {
      message.warning("Đổi quản lý kho phải ghi lý do.");
      return;
    }
    setSubmitting(true);
    try {
      await assignWarehouseManager(target.id, { managerId, reason });
      message.success(
        managerId
          ? `Đã gán quản lý cho ${target.name}. Phiếu đang chờ duyệt chuyển sang quản lý mới.`
          : `Đã bỏ quản lý của ${target.name}. OperationsManager / Admin sẽ duyệt phiếu của kho này.`,
      );
      setTarget(null);
      reload();
    } catch (error) {
      message.error(getAdminApiError(error, "Không cập nhật được quản lý kho."));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: "Kho",
      dataIndex: "name",
      render: (value, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value || "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {[row.code, row.region].filter(Boolean).join(" · ")}
          </Text>
        </Space>
      ),
    },
    {
      title: "Loại kho",
      dataIndex: "warehouseType",
      width: 190,
      render: (value) => getWarehouseTypeLabel(value),
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      width: 130,
      render: (value) =>
        value === false ? <Tag>Ngừng hoạt động</Tag> : <Tag color="green">Hoạt động</Tag>,
    },
    {
      title: "Quản lý kho",
      key: "manager",
      render: (_, row) => {
        if (row.managerError) return <Text type="danger">{row.managerError}</Text>;
        return row.manager?.managerName ? (
          <Text strong>{row.manager.managerName}</Text>
        ) : (
          <Text type="secondary">Chưa gán — OperationsManager / Admin duyệt</Text>
        );
      },
    },
    {
      title: "Nhân viên kho được gán",
      key: "staff",
      width: 260,
      render: (_, row) => {
        if (row.staffError) return <Text type="danger">{row.staffError}</Text>;
        const staff = row.staff || [];
        if (!staff.length) {
          return (
            <Text type="secondary">
              Chưa gán nhân viên nào — nhân viên kho cùng vùng vẫn thao tác được
            </Text>
          );
        }
        const names = staff.map((member) => member.fullName || member.email).filter(Boolean);
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{staff.length} nhân viên</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {names.slice(0, 3).join(", ")}
              {names.length > 3 ? ` và ${names.length - 3} người khác` : ""}
            </Text>
          </Space>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 330,
      render: (_, row) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<UserSwitchOutlined />}
            onClick={() => openAssign(row)}
          >
            {row.manager?.managerId ? "Đổi quản lý" : "Gán quản lý"}
          </Button>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            disabled={!row.manager?.history?.length}
            onClick={() => setHistoryTarget(row)}
          >
            Lịch sử
          </Button>
          <Button
            size="small"
            icon={<TeamOutlined />}
            disabled={Boolean(row.staffError)}
            onClick={() => setStaffTarget(row)}
          >
            Nhân viên
          </Button>
        </Space>
      ),
    },
  ];

  const staffColumns = [
    {
      title: "Nhân viên",
      key: "fullName",
      render: (_, member) => (
        <Space direction="vertical" size={0}>
          <Text strong>{member.fullName || "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {member.email || "—"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Vai trò",
      dataIndex: "role",
      width: 150,
      render: (value, member) => (
        <Space size={4} wrap>
          <Tag color="blue">{getRoleLabel(value)}</Tag>
          {member.status && String(member.status).toUpperCase() !== "ACTIVE" ? (
            <Tag color="warning">{getUserStatusLabel(member.status)}</Tag>
          ) : null}
        </Space>
      ),
    },
    { title: "Lúc gán", dataIndex: "assignedAt", width: 160, render: formatDateTime },
    { title: "Người gán", dataIndex: "assignedByName", width: 150, render: (value) => value || "—" },
    { title: "Ghi chú", dataIndex: "note", render: (value) => value || "—" },
  ];

  const assignedCount = rows.filter((row) => row.manager?.managerId).length;

  return (
    <div className="admin-page">
      <section className="admin-page__hero">
        <div>
          <span>KHO VẬN HÀNH</span>
          <h1>Quản lý kho</h1>
          <p>
            Người quản lý của kho duyệt phiếu nhập kho, biên bản kiểm đếm lệch và phiếu xuất kho.
            Kho chưa gán quản lý thì OperationsManager / Admin duyệt. Nhân viên kho được gán vào
            từng kho ở màn Quản lý người dùng (nút "Gán kho").
          </p>
        </div>
        <div className="admin-page__hero-count">
          <UserSwitchOutlined />
          <strong>
            {assignedCount}/{rows.length}
          </strong>
          <span>Kho đã gán quản lý</span>
        </div>
      </section>

      {errorMessage ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={errorMessage}
          action={
            <Button size="small" onClick={reload}>
              Thử lại
            </Button>
          }
        />
      ) : null}

      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ReloadOutlined spin={loading} />} disabled={loading} onClick={reload}>
          Làm mới
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={tablePagination({ unit: "kho", hideOnSinglePage: true })}
        scroll={{ x: 1250 }}
        locale={{ emptyText: <Empty description="Chưa có kho nào." /> }}
      />

      <Modal
        open={Boolean(target)}
        title={`Quản lý kho · ${target?.name || ""}`}
        okText="Lưu"
        cancelText="Huỷ"
        okButtonProps={{ loading: submitting, disabled: !reason.trim() }}
        onOk={handleAssign}
        onCancel={() => setTarget(null)}
      >
        {candidatesError ? (
          <Alert type="error" showIcon style={{ marginBottom: 12 }} message={candidatesError} />
        ) : null}

        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>Quản lý kho</div>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: "100%" }}
            placeholder="Chọn tài khoản OperationsManager — để trống để bỏ gán"
            value={managerId || undefined}
            options={candidateOptions}
            onChange={(value) => setManagerId(value || null)}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Chỉ tài khoản có vai trò quản lý kho (OperationsManager) đang hoạt động.
          </Text>
        </div>

        <div>
          <div style={{ marginBottom: 4 }}>
            Lý do <span style={{ color: "#dc2626" }}>*</span>
          </div>
          <Input.TextArea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Phân công quản lý kho Quảng Châu từ tháng 10."
          />
        </div>
      </Modal>

      <Drawer
        open={Boolean(staffTarget)}
        width={760}
        title={`Nhân viên kho · ${staffTarget?.name || ""}`}
        onClose={() => setStaffTarget(null)}
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          {[staffTarget?.code, staffTarget?.region].filter(Boolean).join(" · ")} — chỉ xem. Gán /
          bỏ gán ở màn Quản lý người dùng.
        </Text>
        <Table
          size="small"
          rowKey="userId"
          pagination={false}
          columns={staffColumns}
          dataSource={staffTarget?.staff || []}
          scroll={{ x: 700 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa gán nhân viên nào — nhân viên kho cùng vùng vẫn thao tác được."
              />
            ),
          }}
        />
      </Drawer>

      <Drawer
        open={Boolean(historyTarget)}
        width={520}
        title={`Lịch sử quản lý · ${historyTarget?.name || ""}`}
        onClose={() => setHistoryTarget(null)}
      >
        <Timeline
          items={(historyTarget?.manager?.history || [])
            .slice()
            .sort((left, right) => new Date(right.changedAt) - new Date(left.changedAt))
            .map((entry, index) => ({
              key: `${entry.changedAt}-${index}`,
              children: (
                <Space direction="vertical" size={0}>
                  <Text strong>
                    {entry.previousManagerName || "Chưa gán"} → {entry.managerName || "Bỏ gán"}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatDateTime(entry.changedAt)} · {entry.changedByName || "—"}
                  </Text>
                  {entry.reason ? <Text>{entry.reason}</Text> : null}
                </Space>
              ),
            }))}
        />
      </Drawer>
    </div>
  );
}
