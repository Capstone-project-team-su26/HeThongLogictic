import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Tabs } from "antd";
import {
  AppstoreOutlined,
  InboxOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";

import {
  getOperationsApiError,
  listCarriers,
  listWarehouses,
  listWroRequests,
  rejectWro,
  wroNeedsApproval,
} from "../../../api/OperationsAPI/consolidationWorkflowService";
import WroApproveModal from "../components/WroApproveModal";
import WroViewModal from "../components/WroViewModal";
import WroHeader from "./components/WroHeader";
import WroFilterBar from "./components/WroFilterBar";
import WroTableList from "./components/WroTableList";
import AuthNotify from "../../../utils/Common/AuthNotify";
import "./OperationsWroPage.css";

const INITIAL_FILTERS = {
  status: "NEEDS_APPROVAL",
  search: "",
  customsStatus: "",
  warehouseId: "",
  carrierId: "",
  exportType: "",
  dateRange: null,
};

export default function OperationsWroPage({ readOnly = false } = {}) {
  const [wroList, setWroList] = useState([]);
  const [activeTab, setActiveTab] = useState("BATCH"); // BATCH, SINGLE, ALL
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  // Lookups data for dropdowns
  const [lookups, setLookups] = useState({
    warehouses: [],
    carriers: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [approveTarget, setApproveTarget] = useState(null);
  const [viewWroId, setViewWroId] = useState(null);

  // Fetch Lookups (Warehouses & Carriers)
  const loadLookups = useCallback(async () => {
    try {
      const [whList, crList] = await Promise.all([
        listWarehouses().catch(() => []),
        listCarriers().catch(() => []),
      ]);
      setLookups({
        warehouses: Array.isArray(whList) ? whList : [],
        carriers: Array.isArray(crList) ? crList : [],
      });
    } catch {
      // Lookups fallbacks
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  // Main Data Loader
  const loadData = useCallback(
    async ({ refresh = false } = {}) => {
      refresh ? setIsRefreshing(true) : setIsLoading(true);
      setLoadError("");
      try {
        const apiStatus =
          filters.status && filters.status !== "NEEDS_APPROVAL"
            ? filters.status
            : undefined;

        const page = await listWroRequests({
          status: apiStatus,
          search: filters.search,
          pageSize: 200,
        });

        let items = page.items ?? [];
        if (filters.status === "NEEDS_APPROVAL") {
          items = items.filter((row) => wroNeedsApproval(row.status));
        }

        setWroList(items);
      } catch (error) {
        const errMsg = getOperationsApiError(
          error,
          "Không thể tải danh sách phiếu WRO."
        );
        AuthNotify.error("Lỗi tải dữ liệu", errMsg);
        setLoadError(errMsg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [filters.status, filters.search]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  // Filter Handlers
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  // Client-side Multi-Field Filter Processor
  const filteredList = useMemo(() => {
    return wroList.filter((row) => {
      // Filter by Customs Status
      if (
        filters.customsStatus &&
        row.customsStatus !== filters.customsStatus &&
        row.customsStatusText !== filters.customsStatus
      ) {
        return false;
      }

      // Filter by Warehouse
      if (
        filters.warehouseId &&
        row.warehouseId !== filters.warehouseId &&
        row.raw?.warehouseId !== filters.warehouseId
      ) {
        return false;
      }

      // Filter by Carrier
      if (
        filters.carrierId &&
        row.carrierId !== filters.carrierId &&
        row.raw?.carrierId !== filters.carrierId
      ) {
        return false;
      }

      // Filter by Export Type Chip Filter
      if (
        filters.exportType &&
        String(row.exportType).toUpperCase() !== String(filters.exportType).toUpperCase()
      ) {
        return false;
      }

      // Filter by Date Range
      if (filters.dateRange && filters.dateRange.length === 2 && row.createdAt) {
        const rowDate = new Date(row.createdAt).getTime();
        const startDate = filters.dateRange[0].startOf("day").valueOf();
        const endDate = filters.dateRange[1].endOf("day").valueOf();
        if (rowDate < startDate || rowDate > endDate) return false;
      }

      // Multi-keyword Search Filter
      if (filters.search && filters.search.trim()) {
        const kw = filters.search.trim().toLowerCase();
        const searchableText = [
          row.code,
          row.wroCode,
          row.exportBarcode,
          row.orderCode,
          row.customerName,
          row.receiverName,
          row.receiverPhone,
          row.consigneeName,
          row.consigneePhone,
          row.carrierName,
          row.driverName,
          row.vehicleNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(kw)) return false;
      }

      return true;
    });
  }, [wroList, filters]);

  // Sub-lists by ExportType
  const batchList = useMemo(
    () => filteredList.filter((row) => String(row.exportType).toUpperCase() === "BATCH"),
    [filteredList]
  );

  const singleList = useMemo(
    () => filteredList.filter((row) => String(row.exportType).toUpperCase() === "SINGLE"),
    [filteredList]
  );

  const pendingCount = useMemo(
    () => wroList.filter((row) => wroNeedsApproval(row.status)).length,
    [wroList]
  );

  const customsPendingCount = useMemo(
    () => wroList.filter((row) => row.customsStatus === "CUSTOMS_PENDING").length,
    [wroList]
  );

  // Active Count according to current Tab
  const activeTabCount = useMemo(() => {
    if (activeTab === "BATCH") return batchList.length;
    if (activeTab === "SINGLE") return singleList.length;
    return filteredList.length;
  }, [activeTab, batchList.length, singleList.length, filteredList.length]);

  const activeTabText = useMemo(() => {
    if (activeTab === "BATCH") return `${batchList.length} / ${wroList.length} phiếu gom lô (BATCH)`;
    if (activeTab === "SINGLE") return `${singleList.length} / ${wroList.length} phiếu đơn lẻ (SINGLE)`;
    return `${filteredList.length} / ${wroList.length} phiếu xuất kho`;
  }, [activeTab, batchList.length, singleList.length, filteredList.length, wroList.length]);

  // Reject Action Handler
  const handleReject = useCallback(
    async (wroId) => {
      setBusyId(wroId);
      try {
        await rejectWro(wroId, "Ops từ chối phiếu xuất kho");
        const msg = "Đã từ chối phiếu WRO.";
        AuthNotify.success("Thành công", msg);
        setNotice({ type: "success", message: msg });
        await loadData({ refresh: true });
      } catch (error) {
        const errMsg = getOperationsApiError(error, "Không từ chối được WRO.");
        AuthNotify.error("Từ chối thất bại", errMsg);
        setNotice({
          type: "error",
          message: errMsg,
        });
      } finally {
        setBusyId("");
      }
    },
    [loadData]
  );

  const tabItems = [
    {
      key: "BATCH",
      label: (
        <span>
          <AppstoreOutlined /> Gom Lô (BATCH) ({batchList.length})
        </span>
      ),
      children: (
        <WroTableList
          data={batchList}
          isLoading={isLoading}
          readOnly={readOnly}
          busyId={busyId}
          onView={(id) => setViewWroId(id)}
          onApprove={(row) => setApproveTarget(row)}
          onReject={handleReject}
          emptyText="Không có phiếu xuất gom theo lô (BATCH) phù hợp theo bộ lọc."
        />
      ),
    },
    {
      key: "SINGLE",
      label: (
        <span>
          <InboxOutlined /> Đơn Lẻ (SINGLE) ({singleList.length})
        </span>
      ),
      children: (
        <WroTableList
          data={singleList}
          isLoading={isLoading}
          readOnly={readOnly}
          busyId={busyId}
          onView={(id) => setViewWroId(id)}
          onApprove={(row) => setApproveTarget(row)}
          onReject={handleReject}
          emptyText="Không có phiếu xuất đơn lẻ (SINGLE) phù hợp theo bộ lọc."
        />
      ),
    },
    {
      key: "ALL",
      label: (
        <span>
          <UnorderedListOutlined /> Tất Cả Phiếu ({filteredList.length})
        </span>
      ),
      children: (
        <WroTableList
          data={filteredList}
          isLoading={isLoading}
          readOnly={readOnly}
          busyId={busyId}
          onView={(id) => setViewWroId(id)}
          onApprove={(row) => setApproveTarget(row)}
          onReject={handleReject}
          emptyText="Không tìm thấy phiếu xuất kho nào theo bộ lọc."
        />
      ),
    },
  ];

  return (
    <div className="ops-page">
      {/* 1. Hero Banner & KPI Stats */}
      <WroHeader
        totalCount={wroList.length}
        pendingCount={pendingCount}
        batchCount={batchList.length}
        singleCount={singleList.length}
        customsPendingCount={customsPendingCount}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onRefresh={() => loadData({ refresh: true })}
      />

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

      {/* 2. Advanced Multi-Field Filter Bar */}
      <WroFilterBar
        filters={filters}
        onChangeFilter={handleFilterChange}
        onResetFilters={handleResetFilters}
        warehouses={lookups.warehouses}
        carriers={lookups.carriers}
        totalResultCount={activeTabCount}
      />

      {/* 3. Main Data Tabs & Table Card */}
      <div className="ops-table-card">
        <div className="ops-table-card__head">
          <h3>Danh Sách Phiếu Xuất Kho</h3>
          <span>
            Hiển thị {activeTabText}
          </span>
        </div>
        <Tabs
          className="ops-wro-tabs"
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          items={tabItems}
        />
      </div>

      {approveTarget && !readOnly ? (
        <WroApproveModal
          open
          wro={approveTarget}
          onClose={() => setApproveTarget(null)}
          onApproved={async (wro) => {
            setApproveTarget(null);
            setNotice({
              type: "success",
              message: `Đã duyệt ${
                wro?.code || "WRO"
              } kèm chuyến bay & chứng từ thông quan.`,
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
