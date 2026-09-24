/**
 * Chuyển hướng cho các URL cũ của Sale, giữ nguyên state của navigate().
 *
 * <Navigate to={...}> trần làm rơi location.state, mà ConsignmentDetail mở màn chăm sóc
 * khách hàng bằng navigate(path, { state: { orderId, ... } }) — mất state là mở ra khung
 * chat trống.
 */
import { Navigate, useLocation } from "react-router-dom";

export default function LegacyRedirect({ to }) {
  const location = useLocation();

  return <Navigate to={to} state={location.state} replace />;
}
