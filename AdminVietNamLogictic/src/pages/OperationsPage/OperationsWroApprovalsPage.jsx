import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import { CheckOutlined, ReloadOutlined } from "@ant-design/icons";

import {
  approveWro,
  getOperationsApiError,
  getWroStatusMeta,
  listCarriers,
  listShippingRoutes,
  listWarehouses,
  listWroRequests,
  rejectWro,
  wroNeedsApproval,
  WRO_STATUS_META,
} from "../../api/OperationsAPI/consolidationWorkflowService";
import WroDetailModal from "./components/WroDetailModal";
import AuthNotify from "../../utils/Common/AuthNotify";
import "./OperationsPage.css";

function formatNumber(value, suffix = "") {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")}${suffix}`
    : "—";
}

const STATUS_FILTER_OPTIONS = [
  { value: "NEEDS_APPROVAL", label: "Cần duyệt" },
  { value: "", label: "Tất cả" },
  ...Object.entries(WRO_STATUS_META).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export default function OperationsWroApprovalsPage() {
  const [wroList, setWroList] = useState([]);
  const [lookups, setLookups] = useState({
    warehouses: [],
    carriers: [],
    shippingRoutes: [],
  });
  // BE thật: Warehouse gửi RELEASE_PENDING / PENDING_REVIEW — không phải PENDING
  const [filters, setFilters] = useState({ status: "NEEDS_APPROVAL", search: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [detailWroId, setDetailWroId] = useState(null);
  const [rejectWroRow, setRejectWroRow] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadLookups = useCallback(async () => {
    const [warehouses, carriers, shippingRoutes] = await Promise.all([
      listWarehouses(),
      listCarriers(),
      listShippingRoutes({ isActive: true }),
    ]);
    setLookups({ warehouses, carriers, shippingRoutes });
  }, []);

  const loadWros = useCallback(
    async ({ refresh = false } = {}) => {
      refresh ? setIsRefreshing(true) : setIsLoading(true);
      setLoadError("");
      try {
        const rows = await listWroRequests({
          status: filters.status,
          search: filters.search,
          pageSize: 100,
        });
        setWroList(rows);
      } catch (error) {
        setLoadError(
          getOperationsApiError(error, "Không thể tải danh sách yêu cầu xuất kho.")
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadLookups().catch(() => {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLookups]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadWros(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWros]);

  const pendingCount = useMemo(
    () => wroList.filter((row) => wroNeedsApproval(row.status)).length,
    [wroList]
  );

  async function handleApproveWro(row) {
    try {
      await approveWro(row.id);
      const msg = `Đã duyệt xuất kho ${row.code || row.id}.`;
      AuthNotify.success("Thành công", msg);
      setNotice({ type: "success", message: msg });
      await loadWros({ refresh: true });
    } catch (error) {
      const errMsg = getOperationsApiError(error, "Không thể duyệt yêu cầu xuất kho.");
      AuthNotify.error("Duyệt thất bại", errMsg);
      setNotice({
        type: "error",
        message: errMsg,
      });
    }
  }

  async function handleRejectWroSubmit() {
    const reason = rejectReason.trim();
    if (!rejectWroRow) return;
    if (!reason) {
      const msg = "Cần nhập lý do từ chối.";
      AuthNotify.warning("Cảnh báo", msg);
      setNotice({ type: "warning", message: msg });
      return;
    }
    try {
      await rejectWro(rejectWroRow.id, reason);
      const msg = `Đã từ chối yêu cầu xuất kho ${rejectWroRow.code || rejectWroRow.id}.`;
      AuthNotify.success("Từ chối WRO", msg);
      setNotice({
        type: "success",
        message: msg,
      });
      setRejectWroRow(null);
      setRejectReason("");
      await loadWros({ refresh: true });
    } catch (error) {
      const errMsg = getOperationsApiError(error, "Không thể từ chối yêu cầu xuất kho.");
      AuthNotify.error("Lỗi từ chối", errMsg);
      setNotice({
        type: "error",
        message: errMsg,
      });
    }
  }

  const columns = useMemo(
    () => [
      {
        title: "Mã WRO",
        dataIndex: "code",
        key: "code",
        fixed: "left",
        render: (value, row) => (
          <Typography.Text code>{value || row.id || "—"}</Typography.Text>
        ),
      },
      {
        title: "Người gửi / bên tạo",
        key: "sender",
        ellipsis: true,
        render: (_, row) => {
          const name = row.createdByName || "—";
          const role = row.createdByUserRole ? ` (${row.createdByUserRole})` : "";
          return `${name}${role}`;
        },
      },
      {
        title: "Kho",
        dataIndex: "warehouseName",
        key: "warehouseName",
        ellipsis: true,
        render: (value) => value || "—",
      },
      {
        title: "Khách hàng",
        dataIndex: "customerName",
        key: "customerName",
        ellipsis: true,
        render: (value) => value || "—",
      },
      {
        title: "Lý do xuất",
        dataIndex: "exportReason",
        key: "exportReason",
        ellipsis: true,
        render: (value) => value || "—",
      },
      {
        title: "SL",
        dataIndex: "totalQuantity",
        key: "totalQuantity",
        align: "right",
        width: 72,
        render: (value, row) => formatNumber(value || row.itemCount || 0),
      },
      {
        title: "Hãng VC",
        key: "carrier",
        ellipsis: true,
        render: (_, row) => row.carrierName || "—",
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        render: (value) => {
          const meta = getWroStatusMeta(value);
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "Ngày tạo",
        dataIndex: "createdAt",
        key: "createdAt",
        render: (value) => (value ? new Date(value).toLocaleString("vi-VN") : "—"),
      },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 220,
        render: (_, row) => (
          <div className="ops-row-actions" onClick={(e) => e.stopPropagation()}>
            <Button
              type="link"
              size="small"
              className="ops-row-actions__primary"
              onClick={() => setDetailWroId(row.id)}
            >
              Chi tiết
            </Button>
            {wroNeedsApproval(row.status) ? (
              <>
                <Popconfirm
                  title={`Duyệt xuất kho ${row.code || ""}?`}
                  okText="Duyệt"
                  cancelText="Hủy"
                  onConfirm={() => handleApproveWro(row)}
                >
                  <Button type="link" size="small" icon={<CheckOutlined />}>
                    Duyệt
                  </Button>
                </Popconfirm>
                <Button
                  type="link"
                  size="small"
                  danger
                  onClick={() => {
                    setRejectWroRow(row);
                    setRejectReason("");
                  }}
                >
                  Từ chối
                </Button>
              </>
            ) : null}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>BỘ PHẬN VẬN HÀNH (OPS)</span>
          <h1>Duyệt Yêu Cầu Xuất Kho (WRO)</h1>
          <p>
            Quản lý và duyệt các yêu cầu xuất kho từ kho nguồn và đối tác liên kết.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Chờ duyệt</small>
            <strong>{pendingCount} yêu cầu</strong>
          </div>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={isRefreshing} />}
            disabled={isRefreshing || isLoading}
            onClick={() => loadWros({ refresh: true })}
          >
            Làm mới
          </Button>
        </div>
      </section>

      {loadError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={loadError}
          action={
            <Button size="small" onClick={() => loadWros()}>
              Thử lại
            </Button>
          }
        />
      ) : null}

      {notice ? (
        <Alert
          type={notice.type}
          showIcon
          closable
          style={{ marginBottom: 16 }}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      ) : null}

      <section className="ops-kpi-grid" aria-label="Chỉ số duyệt xuất kho">
        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">Tổng yêu cầu xuất kho</p>
          <p className="ops-kpi-card__value" style={{ color: "#2563eb" }}>
            {isLoading ? "…" : formatNumber(wroList.length)}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Trong hệ thống</p>
          </div>
        </article>
        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">Đang chờ duyệt</p>
          <p className="ops-kpi-card__value" style={{ color: "#d97706" }}>
            {isLoading ? "…" : formatNumber(pendingCount)}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Cần xem xét & xác nhận</p>
          </div>
        </article>
      </section>

      <section className="ops-page__filters" aria-label="Bộ lọc WRO">
        <div>
          <label htmlFor="wro-f-status">Trạng thái xuất kho</label>
          <Select
            id="wro-f-status"
            style={{ width: "100%" }}
            placeholder="Tất cả"
            value={filters.status}
            options={STATUS_FILTER_OPTIONS}
            onChange={(value) =>
              setFilters((current) => ({ ...current, status: value ?? "" }))
            }
          />
        </div>
        <div>
          <label htmlFor="wro-f-search">Tìm kiếm nhanh</label>
          <Input.Search
            id="wro-f-search"
            allowClear
            placeholder="Tìm theo mã WRO, người nhận, kho..."
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            onSearch={(value) => setFilters((current) => ({ ...current, search: value }))}
          />
        </div>
      </section>

      <div className="ops-table-card">
        <div className="ops-table-card__head">
          <h3>Danh sách yêu cầu xuất kho</h3>
          <span>{wroList.length} yêu cầu</span>
        </div>
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={wroList}
          loading={isLoading || isRefreshing}
          sticky={{ offsetHeader: 0 }}
          scroll={{ x: 1300, y: "calc(100vh - 410px)" }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50"],
            showTotal: (total) => `Tổng ${total} yêu cầu`,
          }}
          onRow={(row) => ({
            onClick: () => setDetailWroId(row.id),
            style: { cursor: "pointer" },
          })}
          locale={{ emptyText: "Không có yêu cầu xuất kho nào khớp bộ lọc." }}
        />
      </div>

      {detailWroId ? (
        <WroDetailModal
          open
          wroId={detailWroId}
          warehouses={lookups.warehouses}
          carriers={lookups.carriers}
          shippingRoutes={lookups.shippingRoutes}
          onClose={() => setDetailWroId(null)}
          onChanged={async (message) => {
            if (message) setNotice({ type: "success", message });
            setDetailWroId(null);
            await loadWros({ refresh: true });
          }}
        />
      ) : null}

      {rejectWroRow ? (
        <Modal
          open
          title={`Từ chối WRO ${rejectWroRow.code || ""}`}
          okText="Từ chối"
          okButtonProps={{ danger: true }}
          cancelText="Hủy"
          onCancel={() => setRejectWroRow(null)}
          onOk={handleRejectWroSubmit}
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
      ) : null}
    </div>
  );
}
