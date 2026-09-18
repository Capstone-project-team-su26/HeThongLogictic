import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  FilePdfOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

import {
  decideWarehouseRelease,
  getWarehouseReleaseDetail,
  getWroApiError,
  getWroParcelStatusMeta,
  getWroStatusMeta,
  listWarehouseReleases,
  openPickingSheetPdf,
  openReleaseNotePdf,
  WRO_STATUS_TABS,
} from "@features/operations/api/warehouseReleaseService";
import { AttachmentList } from "@features/attachments";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import "@features/operations/styles/OperationsPage.css";

const { Text, Title } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatNumber = (value, digits = 2) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("vi-VN", { maximumFractionDigits: digits })
    : "—";
};

/* Phiếu PDF xuất kho chỉ sinh khi phiếu đã được duyệt. */
const HAS_RELEASE_NOTE = new Set(["APPROVED", "PICKING", "READY", "IN_SHIPMENT", "HANDED_OVER"]);

/**
 * Phiếu xuất kho — màn DUYỆT của quản lý kho (OperationsManager) và Admin.
 *
 * Nhân viên kho lập và gửi duyệt trên app kho; ở đây chỉ xem, tải PDF và quyết định.
 * Khác nhau giữa hai vai trò truyền bằng prop:
 *   - `requireReason`: Admin duyệt THAY quản lý kho → backend bắt buộc ghi lý do.
 * Quyền thật nằm ở backend (người gửi duyệt không tự duyệt được, kho có quản lý riêng thì chỉ
 * người đó duyệt) — màn chỉ hiện nguyên `message` 403 server trả.
 */
export default function OperationsWroPage({ requireReason = false }) {
  const [statusTab, setStatusTab] = useState("PENDING_APPROVAL");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState({ pageNumber: 1, pageSize: 20 });
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [decision, setDecision] = useState(null); // { row, value: "APPROVED" | "REJECTED" }
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState("");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await listWarehouseReleases({
        status: statusTab,
        search: keyword.trim(),
        pageNumber: page.pageNumber,
        pageSize: page.pageSize,
      });
      setRows(result.items);
      setTotalCount(result.totalCount);
    } catch (error) {
      setErrorMessage(getWroApiError(error, "Không tải được danh sách phiếu xuất kho."));
    } finally {
      setLoading(false);
    }
  }, [statusTab, keyword, page]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openDetail = useCallback(async (row) => {
    setDetail({ ...row, parcels: [], attachments: [] });
    setDetailLoading(true);
    try {
      const full = await getWarehouseReleaseDetail(row.id);
      if (full) setDetail(full);
    } catch (error) {
      AuthNotify.error("Lỗi tải phiếu", getWroApiError(error, "Không tải được chi tiết phiếu."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDecision = useCallback((row, value) => {
    setDecision({ row, value });
    setReason("");
  }, []);

  const handleDecide = useCallback(async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      await decideWarehouseRelease(decision.row.id, {
        decision: decision.value,
        reason,
        reasonRequired: requireReason,
      });
      AuthNotify.success(
        decision.value === "APPROVED" ? "Đã duyệt phiếu" : "Đã từ chối phiếu",
        decision.value === "APPROVED"
          ? `Phiếu ${decision.row.wroCode} đã duyệt — kho được bốc hàng, phiếu PDF sẵn sàng.`
          : `Phiếu ${decision.row.wroCode} bị từ chối, hàng đã được nhả về tồn khả dụng.`,
      );
      setDecision(null);
      setDetail(null);
      await fetchRows();
    } catch (error) {
      AuthNotify.error("Không ghi được quyết định", getWroApiError(error, "Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  }, [decision, reason, requireReason, fetchRows]);

  const openPdf = useCallback(async (row, kind) => {
    setPdfBusy(`${row.id}:${kind}`);
    try {
      if (kind === "release") await openReleaseNotePdf(row.id, row.wroCode);
      else await openPickingSheetPdf(row.id, row.wroCode);
    } catch (error) {
      AuthNotify.error("Không mở được PDF", getWroApiError(error, "Vui lòng thử lại."));
    } finally {
      setPdfBusy("");
    }
  }, []);

  const pendingCount = useMemo(
    () => rows.filter((row) => String(row.status).toUpperCase() === "PENDING_APPROVAL").length,
    [rows],
  );

  const columns = useMemo(
    () => [
      {
        title: "Mã phiếu",
        dataIndex: "wroCode",
        width: 190,
        render: (value, row) => (
          <Space direction="vertical" size={0}>
            <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(row)}>
              {value || "—"}
            </Button>
            {row.isLegacy ? <Tag>Phiếu cũ</Tag> : null}
          </Space>
        ),
      },
      {
        title: "Tuyến",
        key: "route",
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Text>
              {row.originWarehouseName || "—"} → {row.destinationWarehouseName || "—"}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.shippingRouteCode || ""}
            </Text>
          </Space>
        ),
      },
      {
        title: "Kiện",
        key: "parcels",
        align: "center",
        width: 110,
        render: (_, row) => (
          <Text>
            {row.pickedCount || 0}/{row.parcelCount || 0}
          </Text>
        ),
      },
      {
        title: "Cân nặng",
        dataIndex: "totalWeight",
        align: "right",
        width: 110,
        render: (value) => `${formatNumber(value)} kg`,
      },
      {
        title: "Người lập",
        dataIndex: "createdByName",
        width: 170,
        render: (value, row) => (
          <Space direction="vertical" size={0}>
            <Text>{value || "—"}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Gửi duyệt: {formatDateTime(row.submittedAt)}
            </Text>
          </Space>
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 210,
        render: (value, row) => {
          const meta = getWroStatusMeta(value);
          return (
            <Space direction="vertical" size={2}>
              <Tag color={meta.color}>{row.statusText || meta.label}</Tag>
              {row.shipmentCode ? <Text type="secondary">Lô {row.shipmentCode}</Text> : null}
            </Space>
          );
        },
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 200,
        fixed: "right",
        render: (_, row) => {
          if (String(row.status).toUpperCase() !== "PENDING_APPROVAL") {
            return row.decidedByName ? (
              <Text type="secondary">
                {row.decidedByName} · {formatDateTime(row.decidedAt)}
              </Text>
            ) : (
              <Text type="secondary">—</Text>
            );
          }
          return (
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => openDecision(row, "APPROVED")}
              >
                Duyệt
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => openDecision(row, "REJECTED")}
              >
                Từ chối
              </Button>
            </Space>
          );
        },
      },
    ],
    [openDetail, openDecision],
  );

  const parcelColumns = [
    { title: "Mã kiện", dataIndex: "packageCode", width: 170, render: (v) => <Text code>{v || "—"}</Text> },
    {
      title: "Đơn / khách",
      key: "order",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>{row.consignmentCode || "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.customerName || ""}
          </Text>
        </Space>
      ),
    },
    { title: "Hàng", dataIndex: "productName", render: (v) => v || "—" },
    {
      title: "Cân / kích thước",
      key: "size",
      width: 170,
      render: (_, row) =>
        `${formatNumber(row.weight)} kg · ${formatNumber(row.length, 0)}×${formatNumber(
          row.width,
          0,
        )}×${formatNumber(row.height, 0)}`,
    },
    {
      title: "Vị trí",
      key: "bins",
      width: 190,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>Kệ: {row.sourceBinCode || "—"}</Text>
          {row.stagingBinCode ? <Text type="secondary">Khu xuất: {row.stagingBinCode}</Text> : null}
        </Space>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 190,
      render: (value, row) => {
        const meta = getWroParcelStatusMeta(value);
        return (
          <Space direction="vertical" size={0}>
            <Tag color={meta.color}>{meta.label}</Tag>
            {row.removedReason ? <Text type="danger">{row.removedReason}</Text> : null}
          </Space>
        );
      },
    },
  ];

  const detailStatus = getWroStatusMeta(detail?.status);
  const detailPending = String(detail?.status || "").toUpperCase() === "PENDING_APPROVAL";

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>{requireReason ? "QUẢN TRỊ HỆ THỐNG" : "BỘ PHẬN VẬN HÀNH (OPS)"}</span>
          <h1>Duyệt Phiếu Xuất Kho</h1>
          <p>
            Nhân viên kho lập phiếu và gửi duyệt; duyệt xong kho mới được bốc hàng sang khu xuất.
            Từ chối thì bắt buộc ghi lý do, hàng được nhả về tồn khả dụng.
            {requireReason ? " Admin duyệt thay quản lý kho phải ghi lý do." : ""}
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Chờ duyệt (trang này)</small>
            <strong>{pendingCount} phiếu</strong>
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

      <Tabs
        activeKey={statusTab}
        onChange={(key) => {
          setStatusTab(key);
          setPage((current) => ({ ...current, pageNumber: 1 }));
        }}
        items={WRO_STATUS_TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
      />

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Tìm mã phiếu hoặc mã kiện trong phiếu"
          style={{ width: 340 }}
          onSearch={(value) => {
            setKeyword(value);
            setPage((current) => ({ ...current, pageNumber: 1 }));
          }}
        />
        <Text type="secondary">{totalCount ? `${formatNumber(totalCount, 0)} phiếu` : ""}</Text>
      </Space>

      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1250 }}
        pagination={{
          current: page.pageNumber,
          pageSize: page.pageSize,
          total: totalCount,
          showSizeChanger: false,
          onChange: (pageNumber) => setPage((current) => ({ ...current, pageNumber })),
        }}
        locale={{ emptyText: <Empty description="Không có phiếu nào ở trạng thái này." /> }}
      />

      <Drawer
        open={!!detail}
        width={1040}
        onClose={() => setDetail(null)}
        title={detail ? `Phiếu xuất kho ${detail.wroCode || ""}` : "Chi tiết phiếu"}
        extra={
          detail ? (
            <Space>
              <Button
                icon={<FilePdfOutlined />}
                loading={pdfBusy === `${detail.id}:picking`}
                onClick={() => openPdf(detail, "picking")}
              >
                Danh sách soạn hàng
              </Button>
              {HAS_RELEASE_NOTE.has(String(detail.status).toUpperCase()) ? (
                <Button
                  icon={<FilePdfOutlined />}
                  loading={pdfBusy === `${detail.id}:release`}
                  onClick={() => openPdf(detail, "release")}
                >
                  Phiếu xuất kho PDF
                </Button>
              ) : null}
              {detailPending ? (
                <>
                  <Button danger icon={<CloseOutlined />} onClick={() => openDecision(detail, "REJECTED")}>
                    Từ chối
                  </Button>
                  <Button type="primary" icon={<CheckOutlined />} onClick={() => openDecision(detail, "APPROVED")}>
                    Duyệt phiếu
                  </Button>
                </>
              ) : null}
            </Space>
          ) : null
        }
      >
        {detail ? (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={detailStatus.color}>{detail.statusText || detailStatus.label}</Tag>
              {detail.splitFromCode ? <Tag>Tách từ {detail.splitFromCode}</Tag> : null}
              {detail.shipmentCode ? <Tag color="geekblue">Lô {detail.shipmentCode}</Tag> : null}
            </Space>

            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Kho nguồn">{detail.originWarehouseName || "—"}</Descriptions.Item>
              <Descriptions.Item label="Kho đích">{detail.destinationWarehouseName || "—"}</Descriptions.Item>
              <Descriptions.Item label="Tuyến">{detail.shippingRouteCode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Kiện đã bốc">
                {detail.pickedCount || 0}/{detail.parcelCount || 0} · {formatNumber(detail.totalWeight)} kg
              </Descriptions.Item>
              <Descriptions.Item label="Người lập">
                {detail.createdByName || "—"} · {formatDateTime(detail.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Gửi duyệt">{formatDateTime(detail.submittedAt)}</Descriptions.Item>
              <Descriptions.Item label="Người quyết định">
                {detail.decidedByName ? `${detail.decidedByName} · ${formatDateTime(detail.decidedAt)}` : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú quyết định">{detail.decisionNote || "—"}</Descriptions.Item>
              {detail.note ? (
                <Descriptions.Item label="Ghi chú phiếu" span={2}>
                  {detail.note}
                </Descriptions.Item>
              ) : null}
            </Descriptions>

            <Title level={5} style={{ marginTop: 20 }}>
              Kiện trong phiếu
            </Title>
            <Table
              rowKey={(row) => row.id || row.parcelId}
              size="small"
              loading={detailLoading}
              columns={parcelColumns}
              dataSource={detail.parcels || []}
              pagination={false}
              scroll={{ x: 1000 }}
            />

            <Title level={5} style={{ marginTop: 20 }}>
              Giấy tờ đính kèm
            </Title>
            <AttachmentList items={detail.attachments || []} showThumbnails />
          </>
        ) : null}
      </Drawer>

      <Modal
        open={!!decision}
        title={`${decision?.value === "APPROVED" ? "Duyệt" : "Từ chối"} phiếu ${decision?.row?.wroCode || ""}`}
        okText={decision?.value === "APPROVED" ? "Duyệt phiếu" : "Từ chối phiếu"}
        cancelText="Huỷ"
        okButtonProps={{
          danger: decision?.value === "REJECTED",
          loading: submitting,
          disabled:
            (decision?.value === "REJECTED" || requireReason) && !reason.trim(),
        }}
        onOk={handleDecide}
        onCancel={() => setDecision(null)}
      >
        <Alert
          type={decision?.value === "APPROVED" ? "info" : "warning"}
          showIcon
          style={{ marginBottom: 12 }}
          message={
            decision?.value === "APPROVED"
              ? "Server xét lại điều kiện xuất lần cuối. Duyệt xong kho bốc hàng sang khu xuất và phiếu PDF sẵn sàng."
              : "Hàng đang khoá cho phiếu được nhả về tồn khả dụng; người lập nhận thông báo kèm lý do."
          }
        />
        <Input.TextArea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={
            decision?.value === "REJECTED"
              ? "Bắt buộc — ví dụ: hàng chưa đủ giấy phép."
              : requireReason
                ? "Bắt buộc khi Admin duyệt thay quản lý kho."
                : "Ghi chú (không bắt buộc) — ví dụ: đủ điều kiện."
          }
        />
      </Modal>
    </div>
  );
}
