/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "incident" — sự cố hàng hoá chặng Việt Nam (/api/parcel-incidents).
 * Một module api/ nên `export *` an toàn.
 */

export { default as OperationsIncidentsPage } from "./pages/OperationsIncidentsPage/OperationsIncidentsPage";
export { default as AdminCompensationsPage } from "./pages/AdminCompensationsPage/AdminCompensationsPage";
export { default as SaleIncidentsPage } from "./pages/SaleIncidentsPage/SaleIncidentsPage";
export { default as IncidentWorkspace } from "./components/IncidentWorkspace/IncidentWorkspace";

export * from "./api/parcelIncidentService";
export { default as parcelIncidentService } from "./api/parcelIncidentService";
