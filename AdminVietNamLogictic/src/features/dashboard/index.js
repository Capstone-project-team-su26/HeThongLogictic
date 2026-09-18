/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "dashboard" — ba trang tổng quan theo vai trò.
 *
 * OperationsDashboard nay đếm hàng đợi việc bằng API thật của các feature khác (đi qua barrel);
 * module mock operationsDashboardService và các biểu đồ dựng từ dữ liệu mẫu đã bị xoá.
 */

export { default as AdminDashboard } from "./pages/AdminDashboard/AdminDashboard";
export { default as SaleDashboard } from "./pages/SaleDashboard/SaleDashboard";
export { default as OperationsDashboard } from "./pages/OperationsDashboard/OperationsDashboard";
