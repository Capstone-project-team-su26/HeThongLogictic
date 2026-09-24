/**
 * Chỗ giữ context và hook đọc badge. Tách khỏi provider để file provider chỉ xuất ra
 * component (điều kiện của React Fast Refresh).
 */
import { createContext, useContext } from "react";

import { EMPTY_SALE_BADGES } from "../api/saleBadgeService";

/** Giá trị mặc định dùng cho Admin / Operations Manager: không đếm, không có badge. */
export const SaleBadgeContext = createContext({
  badges: EMPTY_SALE_BADGES,
  refresh: () => {},
  forceRefresh: () => {},
});

/** @returns {{ badges: Record<string, number>, refresh: Function, forceRefresh: Function }} */
export const useSaleBadges = () => useContext(SaleBadgeContext);
