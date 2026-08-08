import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

import {
  getOperationsApiError,
  listWroRequests,
  rejectWro,
  wroNeedsApproval,
  WRO_STATUS_META,
} from "../../api/OperationsAPI/consolidationWorkflowService";
import WroApproveModal from "./components/WroApproveModal";
import WroViewModal from "./components/WroViewModal";
import "./OperationsPage.css";

const STATUS_FILTER_OPTIONS = [
  { value: "NEEDS_APPROVAL", label: "Cần duyệt" },
  { value: "", label: "Tất cả phiếu" },
  ...Object.entries(WRO_STATUS_META).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export default function OperationsWroPage() {
  const [wroList, setWroList] = useState([]);
  const [statusFilter, setStatusFilter] = useState("NEEDS_APPROVAL");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [approveTarget, setApproveTarget] = useState(null);
  const [viewWroId, setViewWroId] = useState(null);

  const loadData = useCallback(
    async ({ refresh = false } = {}) => {
      refresh ? setIsRefreshing(true) : setIsLoading(true);
      setLoadError("");
      try {
        const apiStatus =
          statusFilter && statusFilter !== "NEEDS_APPROVAL"
            ? statusFilter
            : undefined;
        const page = await listWroRequests({
          status: apiStatus,
          search: searchTerm,
          pageSize: 100,
        });
        let items = page.items ?? [];
        if (statusFilter === "NEEDS_APPROVAL") {
          items = items.filter((row) => wroNeedsApproval(row.status));
        }
        setWroList(items);
      } catch (error) {
        setLoadError(getOperationsApiError(error, "Không tải được danh sách phiếu xuất kho."));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [statusFilter, searchTerm]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const pendingCount = useMemo(
    () => wroList.filter((row) => wroNeedsApproval(row.status)).length,
    [wroList]
  );

  const handleReject = useCallback(
    async (wroId) => {
      setBusyId(wroId);
      try {
        await rejectWro(wroId, "Ops từ chối phiếu xuất kho");
        setNotice({ type: "success", message: "Đã từ chối phiếu WRO." });
        await loadData({ refresh: true });
      } catch (error) {
        setNotice({
          type: "error",
          message: getOperationsApiError(error, "Không từ chối được WRO."),
        });
      } finally {
        setBusyId("");
      }
    },
    [loadData]
  );

  const columns = useMemo(
    () => [
      {
        title: "Mã WRO",
        dataIndex: "code",
        fixed: "left",
        render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
      },
      {
        title: "Mã vạch EXP",
        dataIndex: "exportBarcode",
        width: 160,
        render: (value) =>
          value ? <Typography.Text code>{value}</Typography.Text> : "—",
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        render: (status) => {
          const meta = WRO_STATUS_META[status] || { label: status, tone: "default" };
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "Người nhận",
        dataIndex: "receiverName",
        render: (value, row) => value || row.customerName || "—",
      },
      { title: "SĐT", dataIndex: "receiverPhone", render: (value) => value || "—" },
      {
        title: "Địa chỉ",
        dataIndex: "deliveryAddress",
        ellipsis: true,
        render: (value) => value || "—",
      },
      {
        title: "Tuyến",
        dataIndex: "shippingRoute",
        render: (value) => value || "—",
      },
      {
        title: "Chuyến bay",
        dataIndex: "vehicleNumber",
        render: (value) => value || "—",
      },
      {
        title: "Kiện",
        align: "right",
        width: 70,
        render: (_, row) => row.items?.length || row.totalQuantity || 0,
      },
      {
        title: "Giấy tờ",
        width: 120,
        render: (_, row) => {
          const urls = row.customsDocumentUrls || [];
          if (!urls.length) return "—";
          return (
            <Button
              type="link"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => setViewWroId(row.id)}
            >
              {urls.length} file
            </Button>
          );
        },
      },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 240,
        render: (_, row) => (
          <Space size={4}>
            <Button
              size="small"
              type="link"
              icon={<EyeOutlined />}
              onClick={() => setViewWroId(row.id)}
            >
              Xem
            </Button>
            {wroNeedsApproval(row.status) ? (
              <>
                <Button
                  size="small"
                  type="link"
                  icon={<CheckOutlined />}
                  onClick={() => setApproveTarget(row)}
                >
                  Duyệt
                </Button>
                <Button
                  size="small"
                  type="link"
                  danger
                  icon={<CloseOutlined />}
                  loading={busyId === row.id}
                  onClick={() => handleReject(row.id)}
                >
                  Từ chối
                </Button>
              </>
            ) : null}
          </Space>
        ),
      },
    ],
    [busyId, handleReject]
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>Xuất kho</span>
          <h1>Phiếu xuất kho (WRO)</h1>
          <p>
            Duyệt phiếu chờ xử lý, xem chi tiết và mở giấy tờ thông quan đã đính kèm.
            Khi duyệt bắt buộc nhập mã chuyến bay và upload chứng từ.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Cần duyệt (list)</small>
            <strong>{pendingCount}</strong>
          </div>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={isRefreshing} />}
            disabled={isRefreshing || isLoading}
            onClick={() => loadData({ refresh: true })}
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
            <Button size="small" onClick={() => loadData()}>
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

      <section className="ops-page__filters" aria-label="Bộ lọc phiếu xuất kho">
        <div>
          <label htmlFor="wro-status">Trạng thái</label>
          <Select
            id="wro-status"
            style={{ width: "100%" }}
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={(value) => setStatusFilter(value ?? "")}
          />
        </div>
        <div>
          <label htmlFor="wro-search">Tìm kiếm</label>
          <Input.Search
            id="wro-search"
            allowClear
            placeholder="Mã WRO, khách, SĐT…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onSearch={(value) => setSearchTerm(String(value || "").trim())}
          />
        </div>
      </section>

      <div className="ops-table-card">
        <div className="ops-table-card__head">
          <h3>Danh sách phiếu xuất kho</h3>
          <span>
            {wroList.length} phiếu
            {statusFilter === "NEEDS_APPROVAL" ? " · chờ duyệt" : ""}
          </span>
        </div>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Nút Xem / Giấy tờ mở phiếu và link chứng từ. Nút Duyệt mở form mã chuyến bay + upload giấy tờ."
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={wroList}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1280 }}
          locale={{ emptyText: "Không có phiếu xuất kho theo bộ lọc." }}
        />
      </div>

      {approveTarget ? (
        <WroApproveModal
          open
          wro={approveTarget}
          onClose={() => setApproveTarget(null)}
          onApproved={async (wro) => {
            setApproveTarget(null);
            setNotice({
              type: "success",
              message: `Đã duyệt ${wro?.code || "WRO"} kèm chuyến bay & chứng từ thông quan.`,
            });
            await loadData({ refresh: true });
          }}
        />
      ) : null}

      <WroViewModal
        open={Boolean(viewWroId)}
        wroId={viewWroId}
        onClose={() => setViewWroId(null)}
      />
    </div>
  );
}
