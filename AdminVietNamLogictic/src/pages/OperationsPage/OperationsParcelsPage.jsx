import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";

import {
  addParcelsToMasterBox,
  createMasterBox,
  createShipment,
  getOperationsApiError,
  getInventoryStatusMeta,
  getPackageStatusMeta,
  getParcelBlockReason,
  INVENTORY_STATUS_META,
  listCarriers,
  listConsolidationInventory,
  listMasterBoxes,
  listShipments,
  listShippingMethods,
  listShippingRoutes,
  listWarehouses,
  MASTER_BOX_STATUS_META,
  PACKAGE_STATUS_META,
} from "../../api/OperationsAPI/consolidationWorkflowService";
import MasterBoxFormModal from "./components/MasterBoxFormModal";
import MasterBoxDetailModal from "./components/MasterBoxDetailModal";
import ShipmentFormModal from "./components/ShipmentFormModal";
import ParcelDetailModal from "./components/ParcelDetailModal";
import "./OperationsPage.css";

const EMPTY_FILTERS = {
  originWarehouseId: "",
  destinationWarehouseId: "",
  route: "",
  shippingMethodId: "",
  customer: "",
  search: "",
  inventoryStatus: "AVAILABLE",
  packageStatus: "",
};

function formatNumber(value, suffix = "") {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")}${suffix}`
    : "—";
}

const sumBy = (rows, key) =>
  rows.reduce((sum, row) => sum + (Number(row?.[key]) || 0), 0);

export default function OperationsParcelsPage() {
  const [inventory, setInventory] = useState([]);
  const [masterBoxes, setMasterBoxes] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [lookups, setLookups] = useState({
    warehouses: [],
    carriers: [],
    shippingMethods: [],
    shippingRoutes: [],
  });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedParcelIds, setSelectedParcelIds] = useState([]);
  const [selectedBoxIds, setSelectedBoxIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [activeTab, setActiveTab] = useState("inventory");

  const [masterBoxDraft, setMasterBoxDraft] = useState(null); // parcels -> create modal
  const [shipmentDraft, setShipmentDraft] = useState(null); // boxes -> shipment modal
  const [detailBoxId, setDetailBoxId] = useState(null);
  const [detailParcel, setDetailParcel] = useState(null);
  const [addToBoxId, setAddToBoxId] = useState("");

  const loadData = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    setLoadError("");
    try {
      const [
        warehouses,
        carriers,
        shippingMethods,
        shippingRoutes,
        inventoryRows,
        boxes,
        shipmentRows,
      ] = await Promise.all([
        listWarehouses(),
        listCarriers(),
        listShippingMethods(),
        listShippingRoutes({ isActive: true }),
        listConsolidationInventory(),
        listMasterBoxes(),
        listShipments(),
      ]);
      setLookups({ warehouses, carriers, shippingMethods, shippingRoutes });
      setInventory(inventoryRows);
      setMasterBoxes(boxes);
      setShipments(shipmentRows);
      setSelectedParcelIds([]);
      setSelectedBoxIds([]);
    } catch (error) {
      setLoadError(getOperationsApiError(error, "Không thể tải dữ liệu gom hàng."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  /* ============================ Lookups ============================ */

  const warehouseById = useMemo(
    () => new Map(lookups.warehouses.map((row) => [row.id, row])),
    [lookups.warehouses]
  );
  const methodById = useMemo(
    () => new Map(lookups.shippingMethods.map((row) => [row.id, row])),
    [lookups.shippingMethods]
  );
  const shipmentById = useMemo(
    () => new Map(shipments.map((row) => [row.id, row])),
    [shipments]
  );
  const parcelsByBoxId = useMemo(() => {
    const map = new Map();
    for (const box of masterBoxes) {
      map.set(box.id, box.parcels ?? []);
    }
    for (const row of inventory) {
      if (!row.masterBoxId || map.has(row.masterBoxId)) continue;
      const list = map.get(row.masterBoxId) ?? [];
      list.push(row);
      map.set(row.masterBoxId, list);
    }
    return map;
  }, [inventory, masterBoxes]);

  const warehouseName = useCallback(
    (id) => {
      const row = warehouseById.get(id);
      return row ? `${row.code} — ${row.name}` : "—";
    },
    [warehouseById]
  );

  /* ============================ Filters ============================ */

  const filteredInventory = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return inventory.filter((row) => {
      if (filters.originWarehouseId && row.warehouseId !== filters.originWarehouseId)
        return false;
      if (
        filters.destinationWarehouseId &&
        row.destinationWarehouseId !== filters.destinationWarehouseId
      )
        return false;
      if (filters.route && row.route !== filters.route) return false;
      if (filters.shippingMethodId && row.shippingMethodId !== filters.shippingMethodId)
        return false;
      if (filters.customer && row.customerName !== filters.customer) return false;
      if (filters.inventoryStatus && row.inventoryStatus !== filters.inventoryStatus)
        return false;
      if (filters.packageStatus && row.packageStatus !== filters.packageStatus)
        return false;
      if (
        query &&
        ![row.parcelCode, row.orderCode].some((text) =>
          String(text ?? "").toLowerCase().includes(query)
        )
      )
        return false;
      return true;
    });
  }, [inventory, filters]);

  const filterOptions = useMemo(() => {
    const unique = (values) => [...new Set(values.filter(Boolean))].sort();
    return {
      routes: unique(inventory.map((row) => row.route)),
      customers: unique(inventory.map((row) => row.customerName)),
    };
  }, [inventory]);

  /* ============================ Selection ============================ */

  const selectedParcels = useMemo(
    () => inventory.filter((row) => selectedParcelIds.includes(row.id)),
    [inventory, selectedParcelIds]
  );
  const selectedBoxes = useMemo(
    () => masterBoxes.filter((row) => selectedBoxIds.includes(row.id)),
    [masterBoxes, selectedBoxIds]
  );
  const selectedOriginWarehouseId = selectedParcels[0]?.warehouseId ?? "";

  const draftBoxesForSelection = useMemo(
    () =>
      masterBoxes.filter(
        (row) =>
          row.status === "DRAFT" &&
          (!selectedOriginWarehouseId ||
            !row.originWarehouseId ||
            row.originWarehouseId === selectedOriginWarehouseId)
      ),
    [masterBoxes, selectedOriginWarehouseId]
  );

  const originWarehouses = useMemo(
    () =>
      lookups.warehouses.filter(
        (row) => row.role === "ORIGIN" || row.role === "BOTH" || !row.role
      ),
    [lookups.warehouses]
  );
  const destinationWarehouses = useMemo(
    () =>
      lookups.warehouses.filter(
        (row) => row.role === "DESTINATION" || row.role === "BOTH" || !row.role
      ),
    [lookups.warehouses]
  );

  /* ============================ Summary ============================ */

  const eligibleRows = useMemo(
    () => filteredInventory.filter((row) => getParcelBlockReason(row) == null),
    [filteredInventory]
  );

  const summary = useMemo(
    () => ({
      eligible: eligibleRows.length,
      selected: selectedParcels.length,
      draftBoxes: masterBoxes.filter((row) => row.status === "DRAFT").length,
      chargeableWeight: sumBy(eligibleRows, "chargeableWeight"),
      volume: sumBy(eligibleRows, "volume"),
    }),
    [eligibleRows, selectedParcels, masterBoxes]
  );

  const SUMMARY_CARDS = [
    { key: "eligible", label: "Kiện đủ điều kiện gom", hint: "Trong phạm vi bộ lọc" },
    { key: "selected", label: "Kiện đang chọn", hint: "Chuẩn bị gom vào master box" },
    { key: "draftBoxes", label: "Master box nháp", hint: "Có thể thêm/rút kiện" },
    {
      key: "chargeableWeight",
      label: "Tổng trọng lượng tính cước",
      suffix: " kg",
      hint: "Của các kiện đủ điều kiện",
    },
    {
      key: "volume",
      label: "Tổng thể tích",
      suffix: " m³",
      hint: "Của các kiện đủ điều kiện",
    },
  ];

  /* ============================ Actions ============================ */

  const runAction = useCallback(
    async (action, successMessage) => {
      try {
        await action();
        setNotice({ type: "success", message: successMessage });
        await loadData({ refresh: true });
      } catch (error) {
        setNotice({
          type: "error",
          message: getOperationsApiError(error, "Thao tác không thành công."),
        });
      }
    },
    [loadData]
  );

  function openCreateMasterBox(parcels) {
    if (!parcels.length) {
      setNotice({ type: "warning", message: "Chọn ít nhất một kiện đủ điều kiện để gom." });
      return;
    }
    const warehouseIds = new Set(parcels.map((row) => row.warehouseId));
    if (warehouseIds.size > 1) {
      setNotice({
        type: "warning",
        message: "Chỉ được gom các kiện cùng một kho xuất vào một master box.",
      });
      return;
    }
    setNotice(null);
    setMasterBoxDraft(parcels);
  }

  function openCreateShipment(boxes) {
    const packable = boxes.filter((row) => row.status === "PACKED");
    if (!packable.length) {
      setNotice({
        type: "warning",
        message: "Chọn ít nhất một master box đã đóng gói (PACKED) để tạo shipment.",
      });
      return;
    }
    setNotice(null);
    setShipmentDraft(packable);
  }

  async function handleAddToDraftBox() {
    if (!addToBoxId || !selectedParcels.length) return;
    const box = masterBoxes.find((row) => row.id === addToBoxId);
    await runAction(
      () => addParcelsToMasterBox(addToBoxId, selectedParcels.map((row) => row.id)),
      `Đã thêm ${selectedParcels.length} kiện vào ${box?.code ?? "master box"}.`
    );
    setAddToBoxId("");
  }

  /* ============================ Columns ============================ */

  const inventoryColumns = useMemo(
    () => [
      {
        title: "Mã kiện",
        dataIndex: "parcelCode",
        key: "parcelCode",
        fixed: "left",
        render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
      },
      { title: "Mã đơn/ký gửi", dataIndex: "orderCode", key: "orderCode" },
      { title: "Khách hàng", dataIndex: "customerName", key: "customerName", ellipsis: true },
      {
        title: "Kho",
        key: "warehouse",
        render: (_, row) =>
          warehouseById.get(row.warehouseId)?.code || row.warehouseName || "—",
      },
      {
        title: "Bin / kệ",
        key: "bin",
        render: (_, row) =>
          row.shelfCode ? `${row.binCode ?? "—"} · ${row.shelfCode}` : row.binCode || "—",
      },
      { title: "Tuyến", dataIndex: "route", key: "route" },
      { title: "Dịch vụ", dataIndex: "serviceType", key: "serviceType" },
      {
        title: "KG thực",
        dataIndex: "actualWeight",
        key: "actualWeight",
        align: "right",
        render: (value) => formatNumber(value, " kg"),
      },
      {
        title: "KG quy đổi",
        dataIndex: "volumetricWeight",
        key: "volumetricWeight",
        align: "right",
        render: (value) => formatNumber(value, " kg"),
      },
      {
        title: "KG tính cước",
        dataIndex: "chargeableWeight",
        key: "chargeableWeight",
        align: "right",
        render: (value) => (
          <Typography.Text strong>{formatNumber(value, " kg")}</Typography.Text>
        ),
      },
      {
        title: "Thể tích",
        dataIndex: "volume",
        key: "volume",
        align: "right",
        render: (value) => formatNumber(value, " m³"),
      },
      {
        title: "TT kiện",
        dataIndex: "packageStatus",
        key: "packageStatus",
        render: (_, row) => {
          const meta = getPackageStatusMeta(row);
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "TT tồn kho",
        dataIndex: "inventoryStatus",
        key: "inventoryStatus",
        render: (value) => {
          const meta = getInventoryStatusMeta(value);
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      { title: "Ghi chú", dataIndex: "note", key: "note", ellipsis: true },
    ],
    [warehouseById]
  );

  const masterBoxColumns = useMemo(
    () => [
      {
        title: "Mã master box",
        dataIndex: "code",
        key: "code",
        fixed: "left",
        render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
      },
      {
        title: "Kho xuất",
        dataIndex: "originWarehouseId",
        key: "originWarehouseId",
        render: warehouseName,
      },
      {
        title: "Kho đích",
        dataIndex: "destinationWarehouseId",
        key: "destinationWarehouseId",
        render: warehouseName,
      },
      {
        title: "Số kiện",
        key: "parcelCount",
        align: "right",
        render: (_, row) =>
          formatNumber(
            parcelsByBoxId.get(row.id)?.length || row.orderIds?.length || 0
          ),
      },
      {
        title: "Tổng KG",
        key: "totalWeight",
        align: "right",
        render: (_, row) =>
          formatNumber(
            row.totalWeight ||
              sumBy(parcelsByBoxId.get(row.id) ?? [], "chargeableWeight"),
            " kg"
          ),
      },
      {
        title: "Tổng thể tích",
        key: "totalVolume",
        align: "right",
        render: (_, row) =>
          formatNumber(
            row.totalVolume || sumBy(parcelsByBoxId.get(row.id) ?? [], "volume"),
            " m³"
          ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        render: (value) => {
          const meta = MASTER_BOX_STATUS_META[value] ?? { label: value, tone: "default" };
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "Shipment",
        dataIndex: "shipmentId",
        key: "shipmentId",
        render: (value) =>
          value ? (
            <Typography.Text code>{shipmentById.get(value)?.code ?? value}</Typography.Text>
          ) : (
            "—"
          ),
      },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 150,
        render: (_, row) => (
          <Space size={4} wrap>
            <Button size="small" type="link" onClick={() => setDetailBoxId(row.id)}>
              Chi tiết
            </Button>
            {row.status === "PACKED" ? (
              <Button
                size="small"
                type="link"
                icon={<SendOutlined />}
                onClick={() => openCreateShipment([row])}
              >
                Tạo shipment
              </Button>
            ) : null}
          </Space>
        ),
      },
    ],
    [warehouseName, parcelsByBoxId, shipmentById]
  );

  /* ============================ Render ============================ */

  const inventoryTab = (
    <div className="ops-table-card">
      <div className="ops-table-card__head">
        <h3>Tồn kho chờ gom</h3>
        <span>
          {filteredInventory.length} kiện · đã chọn {selectedParcels.length}
        </span>
      </div>

      <div className="ops-selection-bar">
        <Space size={8} wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!selectedParcels.length}
            onClick={() => openCreateMasterBox(selectedParcels)}
          >
            Gom vào master box mới
          </Button>
          <Select
            placeholder="Chọn master box nháp..."
            style={{ minWidth: 220 }}
            value={addToBoxId || undefined}
            options={draftBoxesForSelection.map((row) => ({
              value: row.id,
              label: `${row.code} · ${warehouseById.get(row.originWarehouseId)?.code ?? ""} → ${
                warehouseById.get(row.destinationWarehouseId)?.code ?? ""
              }`,
            }))}
            onChange={setAddToBoxId}
            disabled={!selectedParcels.length}
            allowClear
          />
          <Button
            icon={<InboxOutlined />}
            disabled={!addToBoxId || !selectedParcels.length}
            onClick={handleAddToDraftBox}
          >
            Thêm vào master box đã chọn
          </Button>
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Chỉ kiện đủ điều kiện (cùng kho xuất, đủ cân/kích thước, chưa thuộc master box
          khác) mới chọn được.
        </Typography.Text>
      </div>

      <Table
        rowKey="id"
        size="middle"
        columns={inventoryColumns}
        dataSource={filteredInventory}
        loading={isLoading}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: 1500 }}
        rowSelection={{
          selectedRowKeys: selectedParcelIds,
          onChange: setSelectedParcelIds,
          getCheckboxProps: (row) => {
            const reason = getParcelBlockReason(row);
            return { disabled: reason != null, title: reason ?? undefined };
          },
        }}
        onRow={(row) => ({
          onClick: () => setDetailParcel(row),
          style: { cursor: "pointer" },
        })}
        locale={{ emptyText: "Không có kiện tồn kho nào khớp bộ lọc." }}
      />
    </div>
  );

  const masterBoxTab = (
    <div className="ops-table-card">
      <div className="ops-table-card__head">
        <h3>Master boxes</h3>
        <span>
          {masterBoxes.length} master box · đã chọn {selectedBoxes.length}
        </span>
      </div>
      <Table
        rowKey="id"
        columns={masterBoxColumns}
        dataSource={masterBoxes}
        loading={isLoading}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: 1200 }}
        rowSelection={{
          selectedRowKeys: selectedBoxIds,
          onChange: setSelectedBoxIds,
          getCheckboxProps: (row) => ({
            disabled: row.status !== "PACKED",
            title:
              row.status !== "PACKED"
                ? "Chỉ master box đã đóng gói mới tạo được shipment."
                : undefined,
          }),
        }}
        onRow={(row) => ({
          onClick: () => setDetailBoxId(row.id),
          style: { cursor: "pointer" },
        })}
        locale={{ emptyText: "Chưa có master box nào." }}
      />
    </div>
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>Gom hàng</span>
          <h1>Gom hàng theo tồn kho</h1>
          <p>
            Chọn các kiện đang tồn trong kho, gom vào master box và tạo shipment quốc tế.
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
            icon={<PlusOutlined />}
            onClick={() => openCreateMasterBox(selectedParcels)}
          >
            Tạo master box
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => openCreateShipment(selectedBoxes)}
          >
            Tạo shipment từ master box đã chọn
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

      <section className="ops-kpi-grid" aria-label="Chỉ số gom hàng">
        {SUMMARY_CARDS.map((meta) => (
          <article key={meta.key} className="ops-kpi-card">
            <p className="ops-kpi-card__label">{meta.label}</p>
            <p className="ops-kpi-card__value">
              {isLoading ? "…" : formatNumber(summary[meta.key], meta.suffix ?? "")}
            </p>
            <div className="ops-kpi-card__meta">
              <p>{meta.hint}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="ops-page__filters" aria-label="Bộ lọc gom hàng">
        <div>
          <label htmlFor="ops-f-origin">Kho xuất</label>
          <Select
            id="ops-f-origin"
            style={{ width: "100%" }}
            allowClear
            placeholder="Tất cả"
            value={filters.originWarehouseId || undefined}
            options={originWarehouses.map((row) => ({
              value: row.id,
              label: `${row.code} — ${row.name}`,
            }))}
            onChange={(value) =>
              setFilters((current) => ({ ...current, originWarehouseId: value ?? "" }))
            }
          />
        </div>
        <div>
          <label htmlFor="ops-f-destination">Kho đích</label>
          <Select
            id="ops-f-destination"
            style={{ width: "100%" }}
            allowClear
            placeholder="Tất cả"
            value={filters.destinationWarehouseId || undefined}
            options={destinationWarehouses.map((row) => ({
              value: row.id,
              label: `${row.code} — ${row.name}`,
            }))}
            onChange={(value) =>
              setFilters((current) => ({ ...current, destinationWarehouseId: value ?? "" }))
            }
          />
        </div>
        <div>
          <label htmlFor="ops-f-route">Tuyến</label>
          <Select
            id="ops-f-route"
            style={{ width: "100%" }}
            allowClear
            placeholder="Tất cả"
            value={filters.route || undefined}
            options={filterOptions.routes.map((value) => ({ value, label: value }))}
            onChange={(value) => setFilters((current) => ({ ...current, route: value ?? "" }))}
          />
        </div>
        <div>
          <label htmlFor="ops-f-method">Phương thức vận chuyển</label>
          <Select
            id="ops-f-method"
            style={{ width: "100%" }}
            allowClear
            placeholder="Tất cả"
            value={filters.shippingMethodId || undefined}
            options={lookups.shippingMethods.map((row) => ({
              value: row.id,
              label: row.name,
            }))}
            onChange={(value) =>
              setFilters((current) => ({ ...current, shippingMethodId: value ?? "" }))
            }
          />
        </div>
        <div>
          <label htmlFor="ops-f-customer">Khách hàng</label>
          <Select
            id="ops-f-customer"
            style={{ width: "100%" }}
            allowClear
            showSearch
            placeholder="Tất cả"
            value={filters.customer || undefined}
            options={filterOptions.customers.map((value) => ({ value, label: value }))}
            onChange={(value) =>
              setFilters((current) => ({ ...current, customer: value ?? "" }))
            }
          />
        </div>
        <div>
          <label htmlFor="ops-f-search">Mã kiện / mã đơn</label>
          <Input
            id="ops-f-search"
            allowClear
            placeholder="PCL-..., ORD-..."
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
          />
        </div>
        <div>
          <label htmlFor="ops-f-inv-status">Trạng thái tồn kho</label>
          <Select
            id="ops-f-inv-status"
            style={{ width: "100%" }}
            allowClear
            placeholder="Tất cả"
            value={filters.inventoryStatus || undefined}
            options={Object.entries(INVENTORY_STATUS_META).map(([value, meta]) => ({
              value,
              label: meta.label,
            }))}
            onChange={(value) =>
              setFilters((current) => ({ ...current, inventoryStatus: value ?? "" }))
            }
          />
        </div>
        <div>
          <label htmlFor="ops-f-pkg-status">Trạng thái kiện</label>
          <Select
            id="ops-f-pkg-status"
            style={{ width: "100%" }}
            allowClear
            placeholder="Tất cả"
            value={filters.packageStatus || undefined}
            options={Object.entries(PACKAGE_STATUS_META).map(([value, meta]) => ({
              value,
              label: meta.label,
            }))}
            onChange={(value) =>
              setFilters((current) => ({ ...current, packageStatus: value ?? "" }))
            }
          />
        </div>
      </section>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "inventory",
            label: `Tồn kho chờ gom (${filteredInventory.length})`,
            children: inventoryTab,
          },
          {
            key: "masterboxes",
            label: `Master boxes (${masterBoxes.length})`,
            children: masterBoxTab,
          },
        ]}
      />

      {masterBoxDraft ? (
        <MasterBoxFormModal
          open
          parcels={masterBoxDraft}
          warehouses={lookups.warehouses}
          carriers={lookups.carriers}
          shippingMethods={lookups.shippingMethods}
          onClose={() => setMasterBoxDraft(null)}
          onSubmit={async (payload) => {
            try {
              await createMasterBox(payload);
              setMasterBoxDraft(null);
              setNotice({
                type: "success",
                message: `Đã tạo consolidation từ ${payload.parcelIds.length} kiện (theo orderIds).`,
              });
              await loadData({ refresh: true });
            } catch (error) {
              setNotice({
                type: "error",
                message: getOperationsApiError(error, "Không thể tạo consolidation."),
              });
              throw error;
            }
          }}
        />
      ) : null}

      {shipmentDraft ? (
        <ShipmentFormModal
          open
          masterBoxes={shipmentDraft}
          parcelsByBoxId={parcelsByBoxId}
          warehouses={lookups.warehouses}
          carriers={lookups.carriers}
          shippingMethods={lookups.shippingMethods}
          shippingRoutes={lookups.shippingRoutes}
          onClose={() => setShipmentDraft(null)}
          onSubmit={async (payload) => {
            try {
              const shipment = await createShipment(payload);
              setShipmentDraft(null);
              setNotice({
                type: "success",
                message: `Đã tạo WRO + shipment ${shipment?.code || ""} từ ${
                  payload.masterBoxIds?.length || 0
                } master box.`,
              });
              await loadData({ refresh: true });
            } catch (error) {
              setNotice({
                type: "error",
                message: getOperationsApiError(error, "Không thể tạo WRO / shipment."),
              });
              throw error;
            }
          }}
        />
      ) : null}

      {detailBoxId ? (
        <MasterBoxDetailModal
          open
          boxId={detailBoxId}
          onClose={() => setDetailBoxId(null)}
          onChanged={(message) => {
            if (message) setNotice({ type: "success", message });
            loadData({ refresh: true });
          }}
          onCreateShipment={(box) => {
            setDetailBoxId(null);
            openCreateShipment([box]);
          }}
        />
      ) : null}

      {detailParcel ? (
        <ParcelDetailModal
          open
          parcel={detailParcel}
          warehouse={warehouseById.get(detailParcel.warehouseId)}
          destinationWarehouse={warehouseById.get(detailParcel.destinationWarehouseId)}
          shippingMethod={methodById.get(detailParcel.shippingMethodId)}
          masterBox={masterBoxes.find((row) => row.id === detailParcel.masterBoxId)}
          blockReason={getParcelBlockReason(detailParcel)}
          onClose={() => setDetailParcel(null)}
        />
      ) : null}
    </div>
  );
}
