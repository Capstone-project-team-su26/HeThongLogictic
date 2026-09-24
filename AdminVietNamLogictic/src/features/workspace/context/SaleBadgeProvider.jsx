/**
 * Một nguồn đếm duy nhất cho cả Sidebar lẫn thanh tab.
 *
 * Nếu để mỗi nơi tự gọi API thì mở một trang sẽ bắn 7 request hai lần. Provider bọc quanh
 * layout: đếm một lượt khi vào, làm mới mỗi 60 giây, và đếm lại khi người dùng quay lại
 * tab trình duyệt (bỏ qua nếu vừa đếm chưa tới 20 giây).
 *
 * Chỉ Sale mới đếm — Admin và Operations Manager dùng menu khác, không có badge nào.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { EMPTY_SALE_BADGES, loadSaleBadges } from "../api/saleBadgeService";
import { SaleBadgeContext } from "./saleBadgeStore";

const REFRESH_INTERVAL_MS = 60_000;
const MIN_REFETCH_GAP_MS = 20_000;

export default function SaleBadgeProvider({ enabled = false, children }) {
  const [badges, setBadges] = useState(EMPTY_SALE_BADGES);

  const lastLoadedAtRef = useRef(0);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(
    async ({ force = false } = {}) => {
      if (!enabled || inFlightRef.current) {
        return;
      }

      const since = Date.now() - lastLoadedAtRef.current;

      if (!force && since < MIN_REFETCH_GAP_MS) {
        return;
      }

      inFlightRef.current = true;

      try {
        const next = await loadSaleBadges();

        if (mountedRef.current) {
          setBadges(next);
        }
      } finally {
        lastLoadedAtRef.current = Date.now();
        inFlightRef.current = false;
      }
    },
    [enabled]
  );

  useEffect(() => {
    /* Vai trò cố định suốt phiên đăng nhập, nên không cần dọn lại state khi tắt: chưa
       từng đếm thì badges vẫn là EMPTY_SALE_BADGES. */
    if (!enabled) {
      return undefined;
    }

    refresh({ force: true });

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh({ force: true });
      }
    }, REFRESH_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, refresh]);

  /*
   * refresh() cho nơi gọi thường xuyên (đổi tab): có chặn 20 giây nên bấm qua lại
   * không bắn API liên tục. forceRefresh() cho sau khi vừa làm xong một việc.
   */
  const value = useMemo(
    () => ({
      badges,
      refresh: () => refresh(),
      forceRefresh: () => refresh({ force: true }),
    }),
    [badges, refresh]
  );

  return (
    <SaleBadgeContext.Provider value={value}>
      {children}
    </SaleBadgeContext.Provider>
  );
}

