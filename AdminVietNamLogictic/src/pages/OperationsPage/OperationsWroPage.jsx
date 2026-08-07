import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Space, Table, Tag, Typography } from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

import {
  getOperationsApiError,
  listWroRequests,
  rejectWro,
  WRO_STATUS_META,
} from "../../api/OperationsAPI/consolidationWorkflowService";
import WroApproveModal from "./components/WroApproveModal";
import "./OperationsPage.css";

export default function OperationsWroPage() {
  const [pendingWros, setPendingWros] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [approveTarget, setApproveTarget] = useState(null);

  const loadData = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    setLoadError("");
    try {
      const page = await listWroRequests({
        status: "RELEASE_PENDING",
        pageSize: 100,
      });
      setPendingWros(page.items ?? []);
    } catch (error) {
      setLoadError(getOperationsApiError(error, "Không tải được danh sách WRO."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

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
        title: "Kiện",
        align: "right",
        render: (_, row) => row.items?.length || row.totalQuantity || 0,
      },
      {
        title: "Chứng từ",
        render: (_, row) =>
          row.customsDocumentUrls?.length
            ? `${row.customsDocumentUrls.length} file`
            : "—",
      },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 200,
        render: (_, row) => (
          <Space size={4}>
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
          <h1>Duyệt phiếu WRO</h1>
          <p>
            Khi duyệt, OM nhập mã chuyến bay và upload giấy tờ thông quan. Sau đó kho
            picking / đóng gói → RELEASED để gom lô.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Chờ duyệt</small>
            <strong>{pendingWros.length}</strong>
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

      <div className="ops-table-card">
        <div className="ops-table-card__head">
          <h3>Phiếu xuất kho chờ duyệt</h3>
          <span>{pendingWros.length} phiếu · RELEASE_PENDING</span>
        </div>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Nút Duyệt mở form: mã chuyến bay + giấy tờ thông quan (OM upload)."
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={pendingWros}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1100 }}
          locale={{ emptyText: "Không có phiếu WRO chờ duyệt." }}
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
    </div>
  );
}
