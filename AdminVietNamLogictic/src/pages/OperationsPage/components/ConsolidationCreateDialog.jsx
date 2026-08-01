import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, Input, Modal, Space, Table, Typography } from "antd";

import { getOperationalDashboard } from "../../../api/OperationsAPI/operationsDashboardService";
import {
  createOperationalConsolidation,
  getOperationsApiError,
} from "../../../api/OperationsAPI/consolidationService";

function formatNumber(value, suffix = "") {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")}${suffix}`
    : "—";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
}

export default function ConsolidationCreateDialog({ open, onClose, onCreated }) {
  const [eligible, setEligible] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let active = true;

    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setLoadError("");
      setSelectedIds([]);
      setSearch("");
      setSubmitError("");

      getOperationalDashboard()
        .then((result) => {
          if (!active) return;
          const items = (result?.items ?? [])
            .filter((item) => String(item.status).toUpperCase() === "APPROVED")
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          setEligible(items);
        })
        .catch((err) => {
          if (active) {
            setLoadError(
              getOperationsApiError(err, "Không thể tải danh sách lô đã duyệt.")
            );
          }
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return eligible;
    return eligible.filter((item) =>
      [item.consignmentCode, item.customerName, item.route, item.destination].some(
        (text) => String(text ?? "").toLowerCase().includes(query)
      )
    );
  }, [eligible, search]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedWeight = useMemo(
    () =>
      eligible.reduce(
        (sum, item) =>
          sum + (selectedSet.has(item.id) ? Number(item.totalWeight) || 0 : 0),
        0
      ),
    [eligible, selectedSet]
  );

  async function handleSubmit() {
    if (!selectedIds.length || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      await createOperationalConsolidation(selectedIds);
      onCreated?.(selectedIds.length);
    } catch (error) {
      setSubmitError(getOperationsApiError(error, "Không thể tạo lô gom hàng."));
      setIsSubmitting(false);
    }
  }

  const columns = [
    {
      title: "",
      width: 48,
      render: (_, row) => (
        <Checkbox
          checked={selectedSet.has(row.id)}
          onChange={() =>
            setSelectedIds((current) =>
              current.includes(row.id)
                ? current.filter((id) => id !== row.id)
                : [...current, row.id]
            )
          }
        />
      ),
    },
    {
      title: "Mã lô",
      dataIndex: "consignmentCode",
      render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
    },
    {
      title: "Khách hàng",
      dataIndex: "customerName",
      ellipsis: true,
    },
    {
      title: "Tuyến",
      render: (_, row) => row.route || row.destination || "—",
      ellipsis: true,
    },
    {
      title: "KG",
      dataIndex: "totalWeight",
      align: "right",
      render: (value) => formatNumber(value, " kg"),
    },
    {
      title: "Ngày",
      dataIndex: "createdAt",
      align: "right",
      render: (value) => formatDate(value),
    },
  ];

  return (
    <Modal
      open={open}
      title="Tạo lô gom hàng"
      onCancel={onClose}
      width={820}
      destroyOnHidden
      footer={
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Text type="secondary">
            Đã chọn {selectedIds.length} lô · {formatNumber(selectedWeight, " kg")}
          </Typography.Text>
          <Space>
            <Button onClick={onClose}>Hủy</Button>
            <Button
              type="primary"
              disabled={!selectedIds.length}
              loading={isSubmitting}
              onClick={handleSubmit}
            >
              Tạo lô gom
            </Button>
          </Space>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Chọn các lô đã duyệt (APPROVED) để gom vào một lô master.
      </Typography.Paragraph>

      <Input.Search
        allowClear
        placeholder="Tìm mã lô, khách hàng, tuyến..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        style={{ marginBottom: 12 }}
      />

      {loadError ? (
        <Alert type="error" showIcon message={loadError} style={{ marginBottom: 12 }} />
      ) : null}
      {submitError ? (
        <Alert type="error" showIcon message={submitError} style={{ marginBottom: 12 }} />
      ) : null}

      <Table
        rowKey={(row) => row.id}
        size="small"
        loading={isLoading}
        columns={columns}
        dataSource={visibleRows}
        pagination={{ pageSize: 8, showSizeChanger: false }}
        locale={{ emptyText: "Không có lô APPROVED để gom." }}
        scroll={{ y: 320 }}
      />
    </Modal>
  );
}
