/**
 * Vỏ của một nhóm việc: thanh tab ở trên, màn cũ nguyên vẹn ở dưới.
 *
 * Tab nằm ở query "?tab=" chứ không phải đoạn đường dẫn, vì các URL chi tiết hiện có
 * (/sale/consignments/:orderId, /sale/tracking/:orderId) đã chiếm chỗ đoạn thứ hai —
 * dùng query thì mọi link cũ trong app và bookmark của Sale vẫn mở đúng màn.
 */
import { useSearchParams } from "react-router-dom";

import { SALE_WORKSPACES } from "../../constants/saleWorkspaces";
import { useSaleBadges } from "../../context/saleBadgeStore";

import "./SaleWorkspacePage.css";

export default function SaleWorkspacePage({ group }) {
  const [searchParams, setSearchParams] = useSearchParams();

  /* Cùng bộ đếm với menu bên trái — không gọi thêm API. */
  const { badges, refresh: refreshBadges } = useSaleBadges();

  const workspace = SALE_WORKSPACES[group];
  const tabs = workspace?.tabs || [];

  const requestedTab = searchParams.get("tab");

  const activeTab =
    tabs.find((tab) => tab.key === requestedTab) || tabs[0] || null;

  const handleSelectTab = (tabKey) => {
    const nextParams = new URLSearchParams(searchParams);

    if (tabKey === tabs[0]?.key) {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tabKey);
    }

    setSearchParams(nextParams, { replace: true });

    /* Đổi tab là lúc người dùng vừa làm xong việc ở tab cũ — đếm lại (có chặn 20 giây). */
    refreshBadges();
  };

  if (!workspace || !activeTab) {
    return null;
  }

  const ActivePage = activeTab.component;

  return (
    <div className="sale-workspace">
      {tabs.length > 1 && (
        <nav
          className="sale-workspace__nav"
          aria-label={`Các mục của ${workspace.label}`}
        >
          <div className="sale-workspace__heading">
            <strong>{workspace.label}</strong>

            {workspace.hint && <span>{workspace.hint}</span>}
          </div>

          <div className="sale-workspace__tabs" role="tablist">
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab.key;

              const tabCount = Number(badges?.[tab.badgeKey]) || 0;

              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  title={tab.label}
                  className={`sale-workspace__tab${
                    isActive ? " sale-workspace__tab--active" : ""
                  }`}
                  onClick={() => handleSelectTab(tab.key)}
                >
                  <span className="sale-workspace__tab-icon">
                    <tab.Icon />
                  </span>

                  <span>{tab.label}</span>

                  {tabCount > 0 && (
                    <span className="sale-workspace__tab-badge">
                      {tabCount > 99 ? "99+" : tabCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <div className="sale-workspace__body">
        <ActivePage />
      </div>
    </div>
  );
}
