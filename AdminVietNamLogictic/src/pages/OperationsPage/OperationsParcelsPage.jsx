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
import { Link } from "react-router-dom";

import {
  addParcelsToMasterBox,
  createMasterBox,
  createWroRequest,
  getOperationsApiError,
  getInventoryStatusMeta,
  getPackageStatusMeta,
  getParcelBlockReason,
  INVENTORY_STATUS_META,
  listCarriers,
  listConsolidationInventory,
  listMasterBoxes,
  listShippingMethods,
  listWarehouses,
  MASTER_BOX_STATUS_META,
  PACKAGE_STATUS_META,
} from "../../api/OperationsAPI/consolidationWorkflowService";
import MasterBoxFormModal from "./components/MasterBoxFormModal";
import MasterBoxDetailModal from "./components/MasterBoxDetailModal";
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

export default function OperationsParcelsPage({
  readOnly = false,
} = {}) {
  const [inventory, setInventory] = useState([]);
  const [masterBoxes, setMasterBoxes] = useState([]);
  const [lookups, setLookups] = useState({
    warehouses: [],
    carriers: [],
    shippingMethods: [],
  });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedParcelIds, setSelectedParcelIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [activeTab, setActiveTab] = useState("inventory");
  const [masterBoxDraft, setMasterBoxDraft] = useState(null);
  const [detailBoxId, setDetailBoxId] = useState(null);
  const [detailParcel, setDetailParcel] = useState(null);
  const [addToBoxId, setAddToBoxId] = useState("");

  const loadData = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    setLoadError("");
    try {
      const [warehouses, carriers, shippingMethods, inventoryRows, boxes] =
        await Promise.all([
          listWarehouses(),
          listCarriers(),
          listShippingMethods(),
          listConsolidationInventory(),
          listMasterBoxes(),
        ]);
      setLookups({ warehouses, carriers, shippingMethods });
      setInventory(inventoryRows);
      setMasterBoxes(boxes);
      setSelectedParcelIds([]);
    } catch (error) {
      setLoadError(getOperationsApiError(error, "Không thể tải dữ liệu tồn kho."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const warehouseById = useMemo(
    () => new Map(lookups.warehouses.map((row) => [row.id, row])),
    [lookups.warehouses]
  );
  const methodById = useMemo(
    () => new Map(lookups.shippingMethods.map((row) => [row.id, row])),
    [lookups.shippingMethods]
  );
  const parcelsByBoxId = useMemo(() => {
    const map = new Map();
    for (const box of masterBoxes) {
      map.set(box.id, box.parcels ?? []);
    }
    for (const row of inventory) {
      if (!row.masterBoxId) continue;
      const list = map.get(row.masterBoxId) ?? [];
      if (!list.some((item) => item.id === row.id)) list.push(row);
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

  const selectedParcels = useMemo(
    () => inventory.filter((row) => selectedParcelIds.includes(row.id)),
    [inventory, selectedParcelIds]
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
    }),
    [eligibleRows, selectedParcels, masterBoxes]
  );

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

  async function handleCreateWroFromInventory() {
    if (!selectedParcels.length) {
      setNotice({ type: "warning", message: "Chọn kiện tồn kho để tạo phiếu WRO." });
      return;
    }
    const warehouseIds = new Set(selectedParcels.map((row) => row.warehouseId));
    if (warehouseIds.size > 1) {
      setNotice({
        type: "warning",
        message: "Chỉ tạo WRO từ các kiện cùng một kho xuất.",
      });
      return;
    }
    await runAction(
      () =>
        createWroRequest({
          exportReason: "Xuất kho theo yêu cầu Ops",
          items: selectedParcels.map((row) => ({
            inventoryId: row.inventoryId || row.id,
            quantity: Math.max(1, Number(row.quantity) || 1),
          })),
        }),
      `Đã tạo phiếu WRO từ ${selectedParcels.length} kiện (chờ duyệt tại trang Duyệt WRO).`
    );
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

  const inventoryColumns = useMemo(
    () => [
      {
        title: "Mã kiện",
        dataIndex: "parcelCode",
        fixed: "left",
        render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
      },
      { title: "Mã đơn", dataIndex: "orderCode" },
      { title: "Khách hàng", dataIndex: "customerName", ellipsis: true },
      {
        title: "Kho",
        render: (_, row) =>
          warehouseById.get(row.warehouseId)?.code || row.warehouseName || "—",
      },
      {
        title: "Bin / kệ",
        render: (_, row) =>
          row.shelfCode ? `${row.binCode ?? "—"} · ${row.shelfCode}` : row.binCode || "—",
      },
      { title: "Tuyến", dataIndex: "route" },
      {
        title: "KG tính cước",
        dataIndex: "chargeableWeight",
        align: "right",
        render: (value) => (
          <Typography.Text strong>{formatNumber(value, " kg")}</Typography.Text>
        ),
      },
      {
        title: "TT kiện",
        render: (_, row) => {
          const meta = getPackageStatusMeta(row);
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "TT tồn kho",
        dataIndex: "inventoryStatus",
        render: (value) => {
          const meta = getInventoryStatusMeta(value);
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
    ],
    [warehouseById]
  );

  const masterBoxColumns = useMemo(
    () => [
      {
        title: "Mã master box",
        dataIndex: "code",
        fixed: "left",
        render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
      },
      {
        title: "Kho xuất",
        dataIndex: "originWarehouseId",
        render: warehouseName,
      },
      {
        title: "Kho đích",
        dataIndex: "destinationWarehouseId",
        render: warehouseName,
      },
      {
        title: "Số kiện",
        align: "right",
        render: (_, row) =>
          formatNumber(
            parcelsByBoxId.get(row.id)?.length || row.orderIds?.length || 0
          ),
      },
      {
        title: "Tổng KG",
        align: "right",
        render: (_, row) =>
          formatNumber(
            row.totalWeight ||
              sumBy(parcelsByBoxId.get(row.id) ?? [], "chargeableWeight"),
            " kg"
          ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        render: (value) => {
          const meta = MASTER_BOX_STATUS_META[value] ?? { label: value, tone: "default" };
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 100,
        render: (_, row) => (
          <Button size="small" type="link" onClick={() => setDetailBoxId(row.id)}>
            Chi tiết
          </Button>
        ),
      },
    ],
    [warehouseName, parcelsByBoxId]
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>Tồn kho</span>
          <h1>Tồn kho & master box</h1>
          <p>
            {readOnly
              ? "Chế độ giám sát: chỉ xem kiện tồn kho và master box."
              : "Lọc kiện trong kho, gom master box nội bộ, hoặc tạo phiếu WRO để Ops duyệt ở trang riêng."}
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <Link to="/operations-manager/wro">
            <Button>Sang duyệt WRO</Button>
          </Link>
          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            disabled={isRefreshing || isLoading}
            onClick={() => loadData({ refresh: true })}
          >
            Làm mới
          </Button>
          {!readOnly && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openCreateMasterBox(selectedParcels)}
            >
              Tạo master box
            </Button>
          )}
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

      <section className="ops-kpi-grid" aria-label="Chỉ số tồn kho">
        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">Kiện đủ điều kiện</p>
          <p className="ops-kpi-card__value">
            {isLoading ? "…" : formatNumber(summary.eligible)}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Trong bộ lọc hiện tại</p>
          </div>
        </article>
        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">Đang chọn</p>
          <p className="ops-kpi-card__value">
            {isLoading ? "…" : formatNumber(summary.selected)}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Chuẩn bị gom / tạo WRO</p>
          </div>
        </article>
        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">Master box nháp</p>
          <p className="ops-kpi-card__value">
            {isLoading ? "…" : formatNumber(summary.draftBoxes)}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Có thể thêm kiện</p>
          </div>
        </article>
        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">KG tính cước</p>
          <p className="ops-kpi-card__value">
            {isLoading ? "…" : formatNumber(summary.chargeableWeight, " kg")}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Kiện đủ điều kiện</p>
          </div>
        </article>
      </section>

      <section className="ops-page__filters" aria-label="Bộ lọc tồn kho">
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
              setFilters((current) => ({
                ...current,
                destinationWarehouseId: value ?? "",
              }))
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
          <label htmlFor="ops-f-method">Phương thức VC</label>
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
            label: `Tồn kho (${filteredInventory.length})`,
            children: (
              <div className="ops-table-card">
                <div className="ops-table-card__head">
                  <h3>Tồn kho chờ gom</h3>
                  <span>
                    {filteredInventory.length} kiện · đã chọn {selectedParcels.length}
                  </span>
                </div>
                {!readOnly && (
                  <div className="ops-selection-bar">
                    <Space size={8} wrap>
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        disabled={!selectedParcels.length}
                        onClick={handleCreateWroFromInventory}
                      >
                        Tạo phiếu WRO
                      </Button>
                      <Button
                        icon={<PlusOutlined />}
                        disabled={!selectedParcels.length}
                        onClick={() => openCreateMasterBox(selectedParcels)}
                      >
                        Gom master box mới
                      </Button>
                      <Select
                        placeholder="Master box nháp..."
                        style={{ minWidth: 220 }}
                        value={addToBoxId || undefined}
                        options={draftBoxesForSelection.map((row) => ({
                          value: row.id,
                          label: row.code,
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
                        Thêm vào box
                      </Button>
                    </Space>
                  </div>
                )}
                <Table
                  rowKey="id"
                  size="middle"
                  columns={inventoryColumns}
                  dataSource={filteredInventory}
                  loading={isLoading}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  scroll={{ x: 1200 }}
                  rowSelection={
                    readOnly
                      ? undefined
                      : {
                          selectedRowKeys: selectedParcelIds,
                          onChange: setSelectedParcelIds,
                          getCheckboxProps: (row) => {
                            const reason = getParcelBlockReason(row);
                            return { disabled: reason != null, title: reason ?? undefined };
                          },
                        }
                  }
                  onRow={(row) => ({
                    onClick: () => setDetailParcel(row),
                    style: { cursor: "pointer" },
                  })}
                  locale={{ emptyText: "Không có kiện tồn kho nào khớp bộ lọc." }}
                />
              </div>
            ),
          },
          {
            key: "masterboxes",
            label: `Master boxes (${masterBoxes.length})`,
            children: (
              <div className="ops-table-card">
                <div className="ops-table-card__head">
                  <h3>Master boxes</h3>
                  <span>{masterBoxes.length} box</span>
                </div>
                <Table
                  rowKey="id"
                  columns={masterBoxColumns}
                  dataSource={masterBoxes}
                  loading={isLoading}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  scroll={{ x: 1000 }}
                  onRow={(row) => ({
                    onClick: () => setDetailBoxId(row.id),
                    style: { cursor: "pointer" },
                  })}
                  locale={{ emptyText: "Chưa có master box nào." }}
                />
              </div>
            ),
          },
        ]}
      />

      {masterBoxDraft && !readOnly ? (
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
                message: `Đã tạo consolidation từ ${payload.parcelIds.length} kiện.`,
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

      {detailBoxId ? (
        <MasterBoxDetailModal
          open
          boxId={detailBoxId}
          onClose={() => setDetailBoxId(null)}
          onChanged={(message) => {
            if (message) setNotice({ type: "success", message });
            loadData({ refresh: true });
          }}
          onCreateShipment={() => {
            setDetailBoxId(null);
            setNotice({
              type: "info",
              message: "Tạo lô tại trang Lô vận chuyển từ WRO đã RELEASED.",
            });
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
