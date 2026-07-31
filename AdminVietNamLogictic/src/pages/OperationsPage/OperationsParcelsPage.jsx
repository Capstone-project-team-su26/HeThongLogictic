import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Table, Tag, Typography } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";

import {
  buildConsolidationSummary,
  countConsolidationParcels,
  getConsolidationStatusMeta,
  getOperationsApiError,
  listConsolidations,
} from "../../api/OperationsAPI/consolidationService";
import ConsolidationCreateDialog from "./components/ConsolidationCreateDialog";
import ConsolidationDetailDialog from "./components/ConsolidationDetailDialog";
import "./OperationsPage.css";

const STAT_META = [
  { key: "batches", label: "Lô gom hàng", hint: (s) => `${s.waiting} lô chờ xử lý` },
  { key: "orders", label: "Đơn trong lô", hint: (s) => `${s.parcels} kiện hàng bên trong` },
  { key: "totalWeight", label: "Tổng trọng lượng", suffix: " kg", hint: () => "Tính trên toàn bộ lô gom" },
  { key: "totalVolume", label: "Tổng thể tích", suffix: " m³", hint: () => "Tính trên toàn bộ lô gom" },
];

function formatNumber(value, suffix = "") {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")}${suffix}`
    : "—";
}

export default function OperationsParcelsPage() {
  const displayName =
    String(sessionStorage.getItem("fullName") || "")
      .trim()
      .split(/\s+/)
      .at(-1) || "Ops";

  const [consolidations, setConsolidations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  const loadConsolidations = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    setLoadError("");
    try {
      setConsolidations(await listConsolidations());
    } catch (error) {
      setLoadError(
        getOperationsApiError(error, "Không thể tải danh sách lô gom hàng.")
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadConsolidations(), 0);
    return () => window.clearTimeout(timer);
  }, [loadConsolidations]);

  const summary = useMemo(
    () => buildConsolidationSummary(consolidations),
    [consolidations]
  );

  const columns = useMemo(
    () => [
      {
        title: "Mã master",
        dataIndex: "masterCode",
        key: "masterCode",
        render: (value) => (
          <Typography.Text code>{value || "—"}</Typography.Text>
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        render: (status) => {
          const meta = getConsolidationStatusMeta(status);
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "Số đơn",
        key: "orders",
        align: "right",
        render: (_, row) => formatNumber(row.orders?.length ?? 0),
      },
      {
        title: "Số kiện",
        key: "parcels",
        align: "right",
        render: (_, row) => formatNumber(countConsolidationParcels(row)),
      },
      {
        title: "Trọng lượng",
        dataIndex: "totalWeight",
        key: "totalWeight",
        align: "right",
        render: (value) => formatNumber(value, " kg"),
      },
      {
        title: "Thể tích",
        dataIndex: "totalVolume",
        key: "totalVolume",
        align: "right",
        render: (value) => formatNumber(value, " m³"),
      },
    ],
    []
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>Gom hàng</span>
          <h1>Chào {displayName}, danh sách lô gom hàng</h1>
          <p>
            Theo dõi các lô master, kiểm tra đơn và kiện bên trong từng lô, xuất
            phiếu manifest PDF khi cần bàn giao.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          {summary.waiting > 0 && !isLoading ? (
            <div className="ops-page__weight-chip">
              <small>Chờ xử lý</small>
              <strong>{summary.waiting} lô</strong>
            </div>
          ) : null}
          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            disabled={isRefreshing || isLoading}
            onClick={() => loadConsolidations({ refresh: true })}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setActionNotice(null);
              setIsCreateOpen(true);
            }}
          >
            Tạo lô gom mới
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
            <Button size="small" onClick={() => loadConsolidations()}>
              Thử lại
            </Button>
          }
        />
      ) : null}

      {actionNotice ? (
        <Alert
          type={actionNotice.type}
          showIcon
          closable
          style={{ marginBottom: 16 }}
          message={actionNotice.message}
          onClose={() => setActionNotice(null)}
        />
      ) : null}

      <section className="ops-kpi-grid" aria-label="Chỉ số gom hàng">
        {STAT_META.map((meta) => (
          <article key={meta.key} className="ops-kpi-card">
            <p className="ops-kpi-card__label">{meta.label}</p>
            <p className="ops-kpi-card__value">
              {isLoading
                ? "…"
                : formatNumber(summary[meta.key], meta.suffix ?? "")}
            </p>
            <div className="ops-kpi-card__meta">
              <p>{meta.hint(summary)}</p>
            </div>
          </article>
        ))}
      </section>

      <div className="ops-table-card">
        <div className="ops-table-card__head">
          <h3>Lô gom hàng</h3>
          <span>{consolidations.length} lô gom</span>
        </div>
        <Table
          rowKey={(row) => row.id || row.masterCode}
          columns={columns}
          dataSource={consolidations}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          onRow={(row) => ({
            onClick: () => setDetailId(row.id),
            style: { cursor: "pointer" },
          })}
          locale={{
            emptyText:
              "Chưa có lô gom hàng nào. Nhấn “Tạo lô gom mới” để chọn các lô đã duyệt.",
          }}
          scroll={{ x: 860 }}
        />
      </div>

      <ConsolidationCreateDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(count) => {
          setIsCreateOpen(false);
          setActionNotice({
            type: "success",
            message: `Đã tạo lô gom hàng từ ${count} lô đã duyệt.`,
          });
          loadConsolidations({ refresh: true });
        }}
      />

      {detailId ? (
        <ConsolidationDetailDialog
          consolidationId={detailId}
          open
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </div>
  );
}
