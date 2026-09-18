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
  UserSwitchOutlined,
} from "@ant-design/icons";

import { getWarehousesApi } from "@features/warehouse/api/warehouseService";
import {
  assignWarehouseManager,
  getWarehouseManager,
  getWarehouseManagerCandidates,
} from "@features/warehouse/api/warehouseManagerService";
import { getAdminApiError } from "@features/admin/api/adminService";
import "@features/admin/styles/AdminPage.css";

const { Text } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const WAREHOUSE_TYPE_LABELS = {
  ORIGIN: "Kho nguồn (nước ngoài)",
  DESTINATION: "Kho đích (VN)",
  DOMESTIC: "Kho nội địa",
};

/**
 * Kho thật + quản lý hiện tại của từng kho. Không ném lỗi: trả { rows, error } để nơi gọi
 * chỉ việc áp vào state.
 */
const fetchWarehouseRows = async () => {
  try {
    const warehouses = await getWarehousesApi({});
    /* Mỗi kho một lời gọi manager — số kho ít (vài chục), chạy song song. */
    const managers = await Promise.allSettled(
      warehouses.map((warehouse) => getWarehouseManager(warehouse.id)),
    );

    return {
      error: "",
      rows: warehouses.map((warehouse, index) => {
        const result = managers[index];
        return {
          ...warehouse,
          manager: result.status === "fulfilled" ? result.value : null,
          managerError:
            result.status === "rejected"
              ? getAdminApiError(result.reason, "Không tải được quản lý kho.")
              : "",
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
      render: (value) => WAREHOUSE_TYPE_LABELS[String(value || "").toUpperCase()] || value || "—",
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
      title: "Thao tác",
      key: "actions",
      width: 230,
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
        </Space>
      ),
    },
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
            Kho chưa gán quản lý thì OperationsManager / Admin duyệt.
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
        pagination={false}
        scroll={{ x: 900 }}
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
