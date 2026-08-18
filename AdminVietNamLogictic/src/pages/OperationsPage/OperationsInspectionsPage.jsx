import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Input,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  AlertOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  getConditionMeta,
  getInspectionApiError,
  getShipmentInspectionOverview,
  listParcelInspections,
} from "../../api/OperationsAPI/parcelInspectionService";
import "./OperationsPage.css";
import "./OperationsWroPage/OperationsWroPage.css";

const { Text } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatWeight = (value) =>
  value === null || value === undefined ? "—" : `${Number(value).toLocaleString("vi-VN")} kg`;

/** Chênh lệch âm là thiếu/nhẹ hơn — tô đỏ; dương là thừa/nặng hơn — tô vàng. */
const DifferenceTag = ({ value, unit }) => {
  if (value === null || value === undefined || Number(value) === 0) {
    return <Text type="secondary">Khớp</Text>;
  }

  const number = Number(value);
  return (
    <Tag color={number < 0 ? "error" : "warning"}>
      {number > 0 ? "+" : ""}
      {number.toLocaleString("vi-VN")} {unit}
    </Tag>
  );
};

export default function OperationsInspectionsPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    withDiscrepancy: 0,
    recentDiscrepancy: 0,
    damagedParcels: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [onlyDiscrepancy, setOnlyDiscrepancy] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [detail, setDetail] = useState(null);

  /* Toàn cảnh một lô: mọi kiện, kể cả kiện khớp và kiện kho chưa đếm. */
  const [batch, setBatch] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const openBatch = useCallback(async (shipmentId, shipmentCode) => {
    if (!shipmentId) return;
    setBatch({ shipmentCode, parcels: [] });
    setBatchLoading(true);
    try {
      const result = await getShipmentInspectionOverview(shipmentId);
      setBatch(result);
    } catch (error) {
      setBatch(null);
      setErrorMessage(getInspectionApiError(error, "Không tải được chi tiết lô hàng."));
    } finally {
      setBatchLoading(false);
    }
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await listParcelInspections({ onlyDiscrepancy });
      setRows(result.items);
      setSummary(result.summary);
    } catch (error) {
      setErrorMessage(getInspectionApiError(error, "Không tải được biên bản kiểm đếm."));
    } finally {
      setLoading(false);
    }
  }, [onlyDiscrepancy]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const visibleRows = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.packageCode, row.orderCode, row.shipmentCode, row.customerName, row.customerPhone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    );
  }, [rows, keyword]);

  const columns = useMemo(
    () => [
      {
        title: "Mã kiện",
        dataIndex: "packageCode",
        fixed: "left",
        width: 210,
        render: (value, row) => (
          <Button type="link" style={{ padding: 0 }} onClick={() => setDetail(row)}>
            {value || "—"}
          </Button>
        ),
      },
      {
        title: "Đơn / Khách",
        dataIndex: "orderCode",
        width: 220,
        render: (value, row) => (
          <Space direction="vertical" size={0}>
            <Text>{value || "—"}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.customerName || "—"}
            </Text>
          </Space>
        ),
      },
      {
        title: "Lô hàng",
        dataIndex: "shipmentCode",
        width: 220,
        render: (value, row) =>
          value ? (
            <Button type="link" style={{ padding: 0 }} onClick={() => openBatch(row.shipmentId, value)}>
              {value}
            </Button>
          ) : (
            "—"
          ),
      },
      {
        title: "Số lượng",
        dataIndex: "quantityDifference",
        width: 150,
        align: "center",
        render: (value, row) => (
          <Space direction="vertical" size={0}>
            <DifferenceTag value={value} unit="kiện" />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {row.declaredQuantity ?? "—"} → {row.actualQuantity ?? "—"}
            </Text>
          </Space>
        ),
      },
      {
        title: "Cân nặng",
        dataIndex: "weightDifference",
        width: 170,
        align: "center",
        render: (value, row) => (
          <Space direction="vertical" size={0}>
            <DifferenceTag value={value} unit="kg" />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {formatWeight(row.declaredWeight)} → {formatWeight(row.actualWeight)}
            </Text>
          </Space>
        ),
      },
      {
        title: "Tình trạng",
        dataIndex: "condition",
        width: 160,
        render: (value) => {
          const meta = getConditionMeta(value);
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "Kết luận",
        dataIndex: "discrepancySummary",
        width: 260,
        render: (value, row) =>
          row.hasDiscrepancy ? (
            <Text type="danger" strong>
              {value}
            </Text>
          ) : (
            <Text type="secondary">{value}</Text>
          ),
      },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 130,
        render: (_, row) => (
          <Button size="small" onClick={() => openBatch(row.shipmentId, row.shipmentCode)}>
            Xem cả lô
          </Button>
        ),
      },
      {
        title: "Người đếm",
        dataIndex: "inspectedByName",
        width: 200,
        render: (value, row) => (
          <Space direction="vertical" size={0}>
            <Text>{value || "—"}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {formatDateTime(row.inspectedAt)}
            </Text>
          </Space>
        ),
      },
    ],
    [openBatch],
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>BỘ PHẬN VẬN HÀNH (OPS)</span>
          <h1>Chênh Lệch Kiểm Đếm</h1>
          <p>
            Kết quả kho VN cân đếm lại từng kiện so với khai báo. Hệ thống chỉ ghi nhận số liệu —
            việc làm việc với hãng vận chuyển hay đền khách xử lý bên ngoài.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Có chênh lệch</small>
            <strong>{summary.withDiscrepancy} kiện</strong>
          </div>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={loading} />}
            disabled={loading}
            onClick={fetchRows}
          >
            Làm mới
          </Button>
        </div>
      </section>

      {!!errorMessage && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={errorMessage}
          action={
            <Button size="small" onClick={fetchRows}>
              Thử lại
            </Button>
          }
        />
      )}

      <section className="wro-kpi-grid-enhanced" aria-label="Chỉ số kiểm đếm">
        <div className="ops-kpi-card wro-kpi-card--blue">
          <div className="wro-kpi-card__icon-box">
            <FileSearchOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Tổng biên bản</p>
            <p className="ops-kpi-card__value">{loading ? "…" : summary.total}</p>
            <div className="ops-kpi-card__meta">
              <p>Kiện đã được kho đếm lại</p>
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--amber">
          <div className="wro-kpi-card__icon-box">
            <AlertOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Có chênh lệch</p>
            <p className="ops-kpi-card__value">{loading ? "…" : summary.withDiscrepancy}</p>
            <div className="ops-kpi-card__meta">
              <p>Lệch số lượng, cân nặng hoặc hư hỏng</p>
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--purple">
          <div className="wro-kpi-card__icon-box">
            <ClockCircleOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Trong 7 ngày qua</p>
            <p className="ops-kpi-card__value">{loading ? "…" : summary.recentDiscrepancy}</p>
            <div className="ops-kpi-card__meta">
              <p>Còn kịp làm việc với hãng vận chuyển</p>
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--amber">
          <div className="wro-kpi-card__icon-box">
            <WarningOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Kiện hư hỏng</p>
            <p className="ops-kpi-card__value">{loading ? "…" : summary.damagedParcels}</p>
            <div className="ops-kpi-card__meta">
              <p>Móp, ướt hoặc rách niêm phong</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ops-page__filters" aria-label="Bộ lọc biên bản kiểm đếm">
        <div>
          <label htmlFor="inspect-f-scope">Phạm vi</label>
          <Segmented
            id="inspect-f-scope"
            block
            value={onlyDiscrepancy ? "DIFF" : "ALL"}
            onChange={(value) => setOnlyDiscrepancy(value === "DIFF")}
            options={[
              { label: "Chỉ kiện lệch", value: "DIFF" },
              { label: "Tất cả biên bản", value: "ALL" },
            ]}
          />
        </div>
        <div>
          <label htmlFor="inspect-f-search">Tìm kiếm nhanh</label>
          <Input.Search
            id="inspect-f-search"
            allowClear
            placeholder="Tìm theo mã kiện, đơn, lô, khách hàng..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
      </section>

      <div className="ops-table-card">
        <div className="ops-table-card__head">
          <h3>Biên bản kiểm đếm tại kho Việt Nam</h3>
          <span>{visibleRows.length} biên bản</span>
        </div>
        <Table
          rowKey={(row) => row.inspectionId}
          size="middle"
          columns={columns}
          dataSource={visibleRows}
          loading={loading}
          sticky={{ offsetHeader: 0 }}
          scroll={{ x: 1600, y: "calc(100vh - 520px)" }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50"],
            showTotal: (total) => `Tổng ${total} biên bản`,
          }}
          locale={{
            emptyText: onlyDiscrepancy
              ? "Chưa phát hiện chênh lệch nào."
              : "Chưa có biên bản kiểm đếm nào.",
          }}
        />
      </div>

      <Drawer
        open={Boolean(batch)}
        onClose={() => setBatch(null)}
        width={1040}
        title={`Toàn bộ kiện của lô ${batch?.shipmentCode || ""}`}
        loading={batchLoading}
      >
        {batch && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`${batch.parcels.length} kiện trong lô`}
              description={
                <>
                  Kho đã đếm{" "}
                  <strong>{batch.parcels.filter((p) => p.inspection).length}</strong> kiện ·{" "}
                  <strong>
                    {batch.parcels.filter((p) => p.inspection?.hasDiscrepancy).length}
                  </strong>{" "}
                  kiện lệch ·{" "}
                  <strong>{batch.parcels.filter((p) => !p.inspection).length}</strong> kiện chưa đếm.
                </>
              }
            />

            <Table
              rowKey={(row) => row.parcelId}
              size="small"
              pagination={false}
              dataSource={batch.parcels}
              columns={[
                {
                  title: "Mã kiện",
                  dataIndex: "packageCode",
                  width: 200,
                  render: (v) => v || "—",
                },
                {
                  // OM nhìn kiện lệch là phải biết ngay của khách nào để còn gọi báo.
                  title: "Đơn / Khách",
                  dataIndex: "customerName",
                  width: 230,
                  render: (value, row) => (
                    <Space direction="vertical" size={0}>
                      <Text strong>{value || "Chưa rõ khách"}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {row.orderCode || "—"}
                        {row.customerPhone ? ` · ${row.customerPhone}` : ""}
                      </Text>
                    </Space>
                  ),
                },
                {
                  title: "Khai báo",
                  dataIndex: "declaredWeight",
                  align: "center",
                  render: (value) => `1 kiện · ${formatWeight(value)}`,
                },
                {
                  title: "Kho đếm được",
                  align: "center",
                  render: (_, row) =>
                    row.inspection ? (
                      `${row.inspection.actualQuantity ?? "—"} kiện · ${formatWeight(
                        row.inspection.actualWeight,
                      )}`
                    ) : (
                      <Text type="secondary">Chưa đếm</Text>
                    ),
                },
                {
                  title: "Tình trạng",
                  align: "center",
                  render: (_, row) => {
                    if (!row.inspection) return <Tag>Chưa đếm</Tag>;
                    const meta = getConditionMeta(row.inspection.condition);
                    return <Tag color={meta.tone}>{meta.label}</Tag>;
                  },
                },
                {
                  title: "Kết luận",
                  render: (_, row) => {
                    if (!row.inspection) {
                      return <Text type="secondary">Kho chưa đối chiếu kiện này</Text>;
                    }
                    return row.inspection.hasDiscrepancy ? (
                      <Text type="danger" strong>
                        {row.inspection.discrepancySummary}
                      </Text>
                    ) : (
                      <Text type="success">Khớp khai báo</Text>
                    );
                  },
                },
                {
                  title: "Ghi chú kho",
                  dataIndex: ["inspection", "note"],
                  render: (_, row) => row.inspection?.note || "—",
                },
              ]}
              scroll={{ x: 1000 }}
              locale={{ emptyText: "Lô này chưa có kiện nào." }}
            />
          </>
        )}
      </Drawer>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={620}
        title={detail?.packageCode || "Chi tiết biên bản kiểm đếm"}
      >
        {detail && (
          <>
            {detail.hasDiscrepancy && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={detail.discrepancySummary}
                description="Số liệu đã được ghi nhận. Liên hệ hãng vận chuyển hoặc kho nguồn để xử lý phần chênh lệch này."
              />
            )}

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Mã kiện">{detail.packageCode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Lô hàng">{detail.shipmentCode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Đơn ký gửi">{detail.orderCode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Khách hàng">
                {detail.customerName || "—"}
                {detail.customerPhone ? ` · ${detail.customerPhone}` : ""}
              </Descriptions.Item>
              <Descriptions.Item label="Kho phát hiện">{detail.warehouseName || "—"}</Descriptions.Item>
              <Descriptions.Item label="Số lượng">
                Khai báo {detail.declaredQuantity ?? "—"} → thực tế {detail.actualQuantity ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Cân nặng">
                {formatWeight(detail.declaredWeight)} → {formatWeight(detail.actualWeight)}
              </Descriptions.Item>
              <Descriptions.Item label="Tình trạng kiện">
                <Tag color={getConditionMeta(detail.condition).tone}>
                  {getConditionMeta(detail.condition).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú của kho">{detail.note || "—"}</Descriptions.Item>
              <Descriptions.Item label="Người đếm">
                {detail.inspectedByName || "—"} · {formatDateTime(detail.inspectedAt)}
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Drawer>
    </div>
  );
}
