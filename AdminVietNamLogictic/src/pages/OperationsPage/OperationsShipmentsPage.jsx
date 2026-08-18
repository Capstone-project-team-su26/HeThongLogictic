import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Table, Tabs, Tag, Typography } from "antd";
import { ReloadOutlined, SendOutlined } from "@ant-design/icons";

import {
  createShipment,
  getOperationsApiError,
  listCarriers,
  listShipments,
  listShippingRoutes,
  listWarehouses,
  listWroRequests,
  SHIPMENT_STATUS_META,
  SHIPMENT_STATUS_TABS,
  WRO_STATUS_META,
} from "../../api/OperationsAPI/consolidationWorkflowService";
import WroLotFormModal from "./components/WroLotFormModal";
import ShipmentDetailModal from "./components/ShipmentDetailModal";
import AuthNotify from "../../utils/Common/AuthNotify";
import "./OperationsPage.css";

function formatNumber(value, suffix = "") {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")}${suffix}`
    : "—";
}

export default function OperationsShipmentsPage() {
  const [releasedWros, setReleasedWros] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [lookups, setLookups] = useState({
    warehouses: [],
    carriers: [],
    shippingRoutes: [],
  });
  const [selectedWroIds, setSelectedWroIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [activeTab, setActiveTab] = useState("lot");
  const [shipmentStatusTab, setShipmentStatusTab] = useState("PREPARING");
  const [wroLotDraft, setWroLotDraft] = useState(null);
  const [detailShipmentId, setDetailShipmentId] = useState(null);

  const loadData = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    setLoadError("");
    try {
      const [warehouses, carriers, shippingRoutes, releasedPage, shipmentPage] =
        await Promise.all([
          listWarehouses(),
          listCarriers(),
          listShippingRoutes({ isActive: true }),
          listWroRequests({ status: "RELEASED", pageSize: 100 }),
          listShipments({ pageSize: 100 }),
        ]);
      setLookups({ warehouses, carriers, shippingRoutes });
      setReleasedWros(releasedPage.items ?? []);
      setShipments(shipmentPage.items ?? []);
      setSelectedWroIds([]);
    } catch (error) {
      const errMsg = getOperationsApiError(error, "Không thể tải danh sách vận chuyển.");
      AuthNotify.error("Lỗi tải dữ liệu", errMsg);
      setLoadError(errMsg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const selectedReleasedWros = useMemo(
    () => releasedWros.filter((row) => selectedWroIds.includes(row.id)),
    [releasedWros, selectedWroIds]
  );

  const filteredShipments = useMemo(
    () =>
      shipments.filter(
        (row) => (row.statusTab || "PREPARING") === shipmentStatusTab
      ),
    [shipments, shipmentStatusTab]
  );

  function openCreateWroLot(wros) {
    const ready = (wros || []).filter((row) => row.status === "RELEASED");
    if (!ready.length) {
      const msg = "Chọn ít nhất một phiếu WRO RELEASED để gom lô.";
      AuthNotify.warning("Cảnh báo", msg);
      setNotice({
        type: "warning",
        message: msg,
      });
      return;
    }
    const routeIds = [
      ...new Set(ready.map((row) => row.shippingRouteId).filter(Boolean)),
    ];
    if (routeIds.length > 1) {
      const msg = "Các WRO phải cùng tuyến vận chuyển trước khi gom lô.";
      AuthNotify.warning("Cảnh báo", msg);
      setNotice({
        type: "warning",
        message: msg,
      });
      return;
    }
    setNotice(null);
    setWroLotDraft(ready);
  }

  const wroColumns = useMemo(
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
    ],
    []
  );

  const shipmentColumns = useMemo(
    () => [
      {
        title: "Mã lô",
        dataIndex: "code",
        fixed: "left",
        render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        render: (status) => {
          const meta = SHIPMENT_STATUS_META[status] || {
            label: status,
            tone: "default",
          };
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "Tuyến",
        dataIndex: "shippingRouteName",
        render: (value) => value || "—",
      },
      {
        title: "Kho",
        render: (_, row) =>
          `${row.originWarehouseName || "—"} → ${row.destinationWarehouseName || "—"}`,
      },
      {
        title: "WRO",
        align: "right",
        render: (_, row) => row.wroRequests?.length || 0,
      },
      {
        title: "Kiện / KG",
        align: "right",
        render: (_, row) =>
          `${formatNumber(row.totalPackages)} / ${formatNumber(row.totalWeight, " kg")}`,
      },
      {
        title: "PDF / CT",
        render: (_, row) =>
          `${row.pdfUrls?.length || 0} PDF · ${row.customsDocUrls?.length || 0} CT`,
      },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 100,
        render: (_, row) => (
          <Button size="small" type="link" onClick={() => setDetailShipmentId(row.id)}>
            Chi tiết
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>Vận chuyển quốc tế</span>
          <h1>Gom lô & theo dõi thông quan</h1>
          <p>
            Gom các WRO đã xuất kho (cùng kho + cùng tuyến) thành lô, rồi cập nhật
            PREPARING → CUSTOMS → IN_TRANSIT → ARRIVED / ISSUE.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            disabled={isRefreshing || isLoading}
            onClick={() => loadData({ refresh: true })}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={!selectedReleasedWros.length}
            onClick={() => openCreateWroLot(selectedReleasedWros)}
          >
            Tạo lô từ WRO đã chọn
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

      <section className="ops-kpi-grid" aria-label="Chỉ số gom lô">
        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">WRO sẵn sàng gom lô</p>
          <p className="ops-kpi-card__value" style={{ color: "#2563eb" }}>
            {isLoading ? "…" : releasedWros.length}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Đã xuất kho chuẩn bị</p>
          </div>
        </article>
        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">Tổng số lô hàng</p>
          <p className="ops-kpi-card__value" style={{ color: "#0284c7" }}>
            {isLoading ? "…" : shipments.length}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Lô vận chuyển quốc tế</p>
          </div>
        </article>
        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">Đang thông quan</p>
          <p className="ops-kpi-card__value" style={{ color: "#d97706" }}>
            {isLoading
              ? "…"
              : shipments.filter((row) => row.statusTab === "CUSTOMS").length}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Đang tiến hành thủ tục</p>
          </div>
        </article>
      </section>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "lot",
            label: `Gom lô (${releasedWros.length})`,
            children: (
              <div className="ops-table-card">
                <div className="ops-table-card__head">
                  <h3>WRO đã xuất kho sẵn sàng gom lô</h3>
                  <span>Đã chọn {selectedReleasedWros.length} WRO</span>
                </div>
                <Table
                  rowKey="id"
                  columns={wroColumns}
                  dataSource={releasedWros}
                  loading={isLoading}
                  sticky={{ offsetHeader: 0 }}
                  scroll={{ x: 1000, y: "calc(100vh - 430px)" }}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "15", "25", "50"],
                    showTotal: (total) => `Tổng ${total} WRO`,
                  }}
                  rowSelection={{
                    selectedRowKeys: selectedWroIds,
                    onChange: setSelectedWroIds,
                  }}
                  locale={{ emptyText: "Chưa có WRO đã xuất kho sẵn sàng gom lô." }}
                />
              </div>
            ),
          },
          {
            key: "shipments",
            label: `Lô vận chuyển (${shipments.length})`,
            children: (
              <div className="ops-table-card">
                <div className="ops-table-card__head">
                  <h3>Danh sách lô vận chuyển quốc tế</h3>
                  <span>
                    {filteredShipments.length}/{shipments.length} lô
                  </span>
                </div>
                <Tabs
                  size="small"
                  activeKey={shipmentStatusTab}
                  onChange={setShipmentStatusTab}
                  items={SHIPMENT_STATUS_TABS.map((tab) => ({
                    key: tab.key,
                    label: `${tab.label} (${
                      shipments.filter(
                        (row) => (row.statusTab || "PREPARING") === tab.key
                      ).length
                    })`,
                  }))}
                  style={{ marginBottom: 12, paddingLeft: 16, paddingRight: 16 }}
                />
                <Table
                  rowKey="id"
                  columns={shipmentColumns}
                  dataSource={filteredShipments}
                  loading={isLoading}
                  sticky={{ offsetHeader: 0 }}
                  scroll={{ x: 1100, y: "calc(100vh - 430px)" }}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "15", "25", "50"],
                    showTotal: (total) => `Tổng ${total} lô`,
                  }}
                  onRow={(row) => ({
                    onClick: () => setDetailShipmentId(row.id),
                    style: { cursor: "pointer" },
                  })}
                  locale={{ emptyText: "Không có lô vận chuyển nào trong mục này." }}
                />
              </div>
            ),
          },
        ]}
      />

      {wroLotDraft ? (
        <WroLotFormModal
          open
          wros={wroLotDraft}
          warehouses={lookups.warehouses}
          carriers={lookups.carriers}
          shippingRoutes={lookups.shippingRoutes}
          onClose={() => setWroLotDraft(null)}
          onSubmit={async (payload) => {
            try {
              const shipment = await createShipment(payload);
              setWroLotDraft(null);
              setNotice({
                type: "success",
                message: `Đã tạo lô ${shipment?.code || ""} từ ${
                  payload.wroRequestIds?.length || 0
                } phiếu WRO.`,
              });
              setActiveTab("shipments");
              await loadData({ refresh: true });
            } catch (error) {
              setNotice({
                type: "error",
                message: getOperationsApiError(error, "Không thể tạo lô từ WRO."),
              });
              throw error;
            }
          }}
        />
      ) : null}

      {detailShipmentId ? (
        <ShipmentDetailModal
          open
          shipmentId={detailShipmentId}
          onClose={() => setDetailShipmentId(null)}
          onChanged={(message) => {
            if (message) setNotice({ type: "success", message });
            loadData({ refresh: true });
          }}
        />
      ) : null}
    </div>
  );
}
