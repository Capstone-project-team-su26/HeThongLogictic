import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  AimOutlined,
  AlertOutlined,
  AppstoreOutlined,
  CalculatorOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DownOutlined,
  ExportOutlined,
  CheckSquareOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  InboxOutlined,
  LogoutOutlined,
  MonitorOutlined,
  SendOutlined,
  FileSearchOutlined as InspectionOutlined,
  PlusCircleOutlined,
  RightOutlined,
  SearchOutlined,
  CloseCircleFilled,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";

import logoVietnamLogistics from "@assets/anhlogocap2.jpeg";
import {
  SALE_BADGE_KEYS,
  SALE_QUEUE_BADGE_KEYS,
  sumSaleBadges,
} from "@features/workspace/api/saleBadgeService";
import { useSaleBadges } from "@features/workspace/context/saleBadgeStore";
import UserProfileModal from "@shared/components/UserProfileModal/UserProfileModal";
import { clearAuthSession } from "@shared/utils/authSession";

import { filterMenus, normalizeSearchText } from "./Sidebar.helpers";

import "./Sidebar.css";

/* =====================================================
   ROLE
===================================================== */

const normalizeRole = (role) => {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

const ROLE_INFO = {
  admin: {
    label: "Administrator",
    shortLabel: "Admin",
  },

  operationsmanager: {
    label: "Operations Manager",
    shortLabel: "Operations",
  },

  sale: {
    label: "Sales Staff",
    shortLabel: "Sale",
  },
};

/* =====================================================
   MENU
===================================================== */

const MENU_BY_ROLE = {
  admin: [
    {
      key: "admin-dashboard",
      label: "Tổng quan",
      icon: <DashboardOutlined />,
      path: "/admin",
      end: true,
    },
    {
      key: "admin-users",
      label: "Quản lý người dùng",
      icon: <TeamOutlined />,
      path: "/admin/users",
    },
    {
      key: "admin-price-approvals",
      label: "Duyệt giá ngoại lệ",
      icon: <SafetyCertificateOutlined />,
      path: "/admin/price-approvals",
    },
    {
      key: "admin-purchase-orders",
      label: "Duyệt đơn mua NCC",
      icon: <ShoppingCartOutlined />,
      path: "/admin/purchase-orders",
    },
    {
      key: "admin-oversight",
      label: "Giám sát vận hành",
      icon: <MonitorOutlined />,
      children: [
        {
          key: "admin-consignments",
          label: "Đơn ký gửi",
          icon: <FileSearchOutlined />,
          path: "/admin/consignments",
        },
        {
          key: "admin-inventory",
          label: "Tồn kho",
          icon: <InboxOutlined />,
          path: "/admin/inventory",
        },
        {
          key: "admin-wro",
          label: "Duyệt phiếu xuất kho",
          icon: <CheckSquareOutlined />,
          path: "/admin/wro",
        },
        {
          key: "admin-shipments",
          label: "Lô vận chuyển",
          icon: <SendOutlined />,
          path: "/admin/shipments",
        },
        {
          key: "admin-receiving-notes",
          label: "Phiếu tiếp nhận kho",
          icon: <FileTextOutlined />,
          path: "/admin/receiving-notes",
        },
        {
          key: "admin-deliveries",
          label: "Đơn đang giao",
          icon: <SendOutlined />,
          path: "/admin/deliveries",
        },
        {
          key: "admin-tracking",
          label: "Theo dõi đơn / chốt đơn",
          icon: <AimOutlined />,
          path: "/admin/tracking",
        },
        {
          key: "admin-incidents",
          label: "Chi bồi thường sự cố",
          icon: <AlertOutlined />,
          path: "/admin/incidents",
        },
        {
          key: "admin-cash-flow",
          label: "Dòng tiền",
          icon: <WalletOutlined />,
          path: "/admin/cash-flow",
        },
      ],
    },
    {
      key: "admin-warehouse",
      label: "Kho vận hành",
      icon: <DatabaseOutlined />,
      children: [
        {
          key: "admin-warehouses",
          label: "Danh sách kho",
          icon: <DatabaseOutlined />,
          path: "/admin/warehouses",
        },
        {
          key: "admin-warehouse-managers",
          label: "Quản lý kho",
          icon: <TeamOutlined />,
          path: "/admin/warehouse-managers",
        },
        {
          key: "admin-warehouse-zones",
          label: "Khu kho & kiện sai khu",
          icon: <AppstoreOutlined />,
          path: "/admin/warehouse-zones",
        },
        {
          key: "admin-warehouse-locations",
          label: "Sơ đồ vị trí kho",
          icon: <InboxOutlined />,
          path: "/admin/warehouse-locations",
        },
      ],
    },
    {
      key: "admin-shipping",
      label: "Đối tác vận chuyển",
      icon: <ShoppingOutlined />,
      children: [
        {
          key: "admin-carriers",
          label: "Đơn vị vận chuyển",
          icon: <ShoppingOutlined />,
          path: "/admin/carriers",
        },
        {
          key: "admin-shipping-methods",
          label: "Phương thức vận chuyển",
          icon: <ShoppingCartOutlined />,
          path: "/admin/shipping-methods",
        },
        {
          key: "admin-shipping-routes",
          label: "Tuyến vận chuyển",
          icon: <ShoppingCartOutlined />,
          path: "/admin/shipping-routes",
        },
        {
          key: "admin-suppliers",
          label: "Nhà cung cấp",
          icon: <ShoppingOutlined />,
          path: "/admin/suppliers",
        },
      ],
    },
    {
      key: "admin-goods-catalog",
      label: "Danh mục hàng hóa",
      icon: <InboxOutlined />,
      children: [
        {
          key: "admin-product-types",
          label: "Loại hàng",
          icon: <InboxOutlined />,
          path: "/admin/product-types",
        },
        {
          key: "admin-units-of-measure",
          label: "Đơn vị tính",
          icon: <InboxOutlined />,
          path: "/admin/units-of-measure",
        },
      ],
    },
    {
      key: "admin-pricing",
      label: "Giá và phụ phí",
      icon: <CalculatorOutlined />,
      children: [
        {
          key: "admin-service-pricings",
          label: "Bảng giá vận chuyển",
          icon: <CalculatorOutlined />,
          path: "/admin/service-pricings",
        },
        {
          key: "admin-exchange-rates",
          label: "Bảng giá tiền tệ",
          icon: <CalculatorOutlined />,
          path: "/admin/exchange-rates",
        },
        {
          key: "admin-pricing-rules",
          label: "Quy tắc phụ phí",
          icon: <SettingOutlined />,
          path: "/admin/pricing-rules",
        },
        {
          key: "admin-package-configurations",
          label: "Cấu hình đóng gói",
          icon: <InboxOutlined />,
          path: "/admin/package-configurations",
        },
      ],
    },
    {
      key: "admin-restricted-items",
      label: "Hàng cấm, hạn chế",
      icon: <SafetyCertificateOutlined />,
      path: "/admin/restricted-items",
    },
  ],

  operationsmanager: [
    {
      key: "operations-dashboard",
      label: "Tổng quan vận hành",
      icon: <AppstoreOutlined />,
      path: "/operations-manager",
      end: true,
    },
    {
      key: "operations-receiving-approvals",
      label: "Duyệt nhập kho gốc",
      icon: <CheckSquareOutlined />,
      path: "/operations-manager/receiving-approvals",
    },
    {
      key: "operations-wro",
      label: "Duyệt phiếu xuất kho",
      icon: <CheckSquareOutlined />,
      path: "/operations-manager/wro",
    },
    {
      key: "operations-incidents",
      label: "Sự cố hàng hoá",
      icon: <AlertOutlined />,
      path: "/operations-manager/incidents",
    },
    {
      key: "operations-inbound-approvals",
      label: "Duyệt nhập kho VN",
      icon: <CheckSquareOutlined />,
      path: "/operations-manager/inbound-approvals",
    },
    {
      key: "operations-delivery-approvals",
      label: "Duyệt giao hàng",
      icon: <SendOutlined />,
      path: "/operations-manager/delivery-approvals",
    },
    {
      key: "operations-shipments",
      label: "Lô vận chuyển",
      icon: <SendOutlined />,
      path: "/operations-manager/shipments",
    },
    {
      key: "operations-warehouse-zones",
      label: "Khu kho & kiện sai khu",
      icon: <AppstoreOutlined />,
      path: "/operations-manager/warehouse-zones",
    },
    {
      key: "operations-parcels",
      label: "Tồn kho",
      icon: <InboxOutlined />,
      path: "/operations-manager/parcels",
    },
    {
      key: "operations-inspections",
      label: "Biên bản kiểm kiện VN",
      icon: <InspectionOutlined />,
      path: "/operations-manager/inspections",
    },
  ],

  /*
   * Sale chỉ còn 8 mục phẳng: mỗi mục là MỘT nhóm việc, các màn cùng mục đích nằm
   * trong nhóm đó dưới dạng tab (xem features/workspace/constants/saleWorkspaces.jsx).
   * Thứ tự đi đúng mạch sổ tay vận hành: tạo đơn -> theo loại đơn -> việc cần xử lý ->
   * theo dõi -> khách hàng -> tra cứu.
   */
  sale: [
    {
      key: "sale-dashboard",
      label: "Tổng quan",
      icon: <DashboardOutlined />,
      path: "/sale",
      end: true,
    },
    {
      key: "sale-create-order",
      label: "Tạo đơn hộ khách",
      icon: <PlusCircleOutlined />,
      path: "/sale/create-order",
    },
    {
      key: "sale-consignments",
      badgeKey: SALE_BADGE_KEYS.consignments,
      label: "Đơn ký gửi",
      icon: <FileSearchOutlined />,
      path: "/sale/consignments",
    },
    {
      key: "sale-purchase-requests",
      badgeKey: SALE_BADGE_KEYS.purchases,
      label: "Đơn mua hộ",
      icon: <ShoppingCartOutlined />,
      path: "/sale/purchase-requests",
    },
    {
      key: "sale-queue",
      badgeKeys: SALE_QUEUE_BADGE_KEYS,
      label: "Việc cần xử lý",
      icon: <ExportOutlined />,
      path: "/sale/queue",
    },
    {
      key: "sale-tracking",
      label: "Theo dõi đơn",
      icon: <AimOutlined />,
      path: "/sale/tracking",
    },
    {
      key: "sale-customers",
      label: "Khách hàng",
      icon: <TeamOutlined />,
      path: "/sale/customers",
    },
    {
      key: "sale-lookup",
      label: "Tra cứu phí, hàng cấm",
      icon: <CalculatorOutlined />,
      path: "/sale/lookup",
    },
  ],
};

/* =====================================================
   PATH HELPERS
===================================================== */

const normalizePath = (value) => {
  const path =
    String(value || "").trim();

  if (
    path.length > 1 &&
    path.endsWith("/")
  ) {
    return path.replace(/\/+$/, "");
  }

  return path || "/";
};

const isPathActive = (
  pathname,
  path,
  end = false
) => {
  if (!path) {
    return false;
  }

  const currentPath =
    normalizePath(pathname);

  const targetPath =
    normalizePath(path);

  if (end) {
    return currentPath === targetPath;
  }

  return (
    currentPath === targetPath ||
    currentPath.startsWith(
      `${targetPath}/`
    )
  );
};

const isMenuGroupActive = (
  pathname,
  children = []
) => {
  return children.some((child) =>
    isPathActive(
      pathname,
      child.path,
      child.end
    )
  );
};

/* =====================================================
   STORAGE
===================================================== */

const getStoredUser = () => {
  try {
    const rawUser =
      sessionStorage.getItem("user");

    if (!rawUser) {
      return {};
    }

    const parsedUser =
      JSON.parse(rawUser);

    return parsedUser &&
      typeof parsedUser === "object"
      ? parsedUser
      : {};
  } catch (error) {
    console.error(
      "Không thể đọc user từ sessionStorage:",
      error
    );

    return {};
  }
};

const getAvatarText = (fullName) => {
  const name =
    String(fullName || "").trim();

  if (!name) {
    return "U";
  }

  const words = name
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  const firstLetter =
    words[0]?.charAt(0) || "";

  const lastLetter =
    words[
      words.length - 1
    ]?.charAt(0) || "";

  return `${firstLetter}${lastLetter}`
    .toUpperCase();
};

/* =====================================================
   BADGE
===================================================== */

/**
 * Số việc đang chờ ở mục menu. Mục gom nhiều tab khai `badgeKeys` (cộng lại), mục một
 * màn khai `badgeKey`. Không có việc nào thì không vẽ gì — tránh hàng loạt số 0.
 */
const renderBadge = (item, badges) => {
  const count = item.badgeKeys
    ? sumSaleBadges(badges, item.badgeKeys)
    : Number(badges?.[item.badgeKey]) || 0;

  if (!count) {
    return null;
  }

  return (
    <span
      className="vcl-menu-item__badge"
      title={`${count} việc đang chờ`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
};

/* =====================================================
   COMPONENT
===================================================== */

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  /* Số việc đang chờ; rỗng với Admin / Operations Manager. */
  const { badges } = useSaleBadges();

  const [menuQuery, setMenuQuery] = useState("");

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [userProfile, setUserProfile] =
    useState(() => getStoredUser());

  const [
    openMenuGroups,
    setOpenMenuGroups,
  ] = useState(() => {
    const pathname =
      location.pathname;

    return {
      "admin-oversight":
        pathname.startsWith(
          "/admin/consignments"
        ) ||
        pathname.startsWith(
          "/admin/inventory"
        ) ||
        pathname.startsWith(
          "/admin/wro"
        ) ||
        pathname.startsWith(
          "/admin/cash-flow"
        ),
    };
  });

  const storedRole =
    sessionStorage.getItem("role") ||
    userProfile?.roleName ||
    userProfile?.role ||
    "admin";

  const normalizedRole =
    normalizeRole(storedRole);

  const currentRole =
    MENU_BY_ROLE[normalizedRole]
      ? normalizedRole
      : "admin";

  const menus =
    MENU_BY_ROLE[currentRole] || MENU_BY_ROLE.admin;

  const normalizedQuery = normalizeSearchText(menuQuery);

  const isSearching = normalizedQuery.length > 0;

  const visibleMenus = useMemo(
    () => filterMenus(menus, normalizedQuery),
    [menus, normalizedQuery],
  );

  const roleInfo =
    ROLE_INFO[currentRole] ||
    ROLE_INFO.admin;

  const fullName =
    userProfile?.fullName ||
    userProfile?.name ||
    userProfile?.email ||
    "Người dùng";

  const email =
    userProfile?.email || "";

  const avatarText =
    getAvatarText(fullName);

  /*
   * Khi người dùng đang ở trang con,
   * menu cha sẽ tự mở.
   */
  useEffect(() => {
    menus.forEach((item) => {
      if (
        Array.isArray(item.children) &&
        isMenuGroupActive(
          location.pathname,
          item.children
        )
      ) {
        setOpenMenuGroups(
          (previous) => ({
            ...previous,
            [item.key]: true,
          })
        );
      }
    });
  }, [
    location.pathname,
    menus,
  ]);

  const handleToggleMenuGroup = (
    groupKey
  ) => {
    setOpenMenuGroups(
      (previous) => {
        const isOpening =
          !previous[groupKey];

        if (!isOpening) {
          return {
            ...previous,
            [groupKey]: false,
          };
        }

        /*
         * Chỉ mở dropdown được bấm.
         * Tránh nhiều nhóm menu mở cùng lúc.
         */
        return {
          "admin-oversight": false,
          [groupKey]: true,
        };
      }
    );
  };

  const handleOpenProfile = () => {
    setProfileOpen(true);
  };

  const handleCloseProfile = () => {
    setProfileOpen(false);

    const latestUser =
      getStoredUser();

    if (
      Object.keys(latestUser)
        .length > 0
    ) {
      setUserProfile(latestUser);
    }
  };

  const handleProfileUpdated = (
    updatedProfile
  ) => {
    if (!updatedProfile) {
      return;
    }

    setUserProfile(
      (previous) => ({
        ...previous,
        ...updatedProfile,
      })
    );
  };

  const handleLogout = () => {
    clearAuthSession();

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <>
      <aside className="sidebar vcl-sidebar">
        <div className="vcl-sidebar__brand">
          <div className="vcl-sidebar__logo-box">
            <img
              src={logoVietnamLogistics}
              alt="Vietnam Logistics"
              className="vcl-sidebar__logo"
            />
          </div>

          <div className="vcl-sidebar__brand-content">
            <strong>
              VIETNAM LOGISTICS
            </strong>

            <span>
              Cross-border platform
            </span>
          </div>
        </div>

        <div className="vcl-sidebar__separator" />

        <section className="vcl-sidebar__navigation">
          <div className="vcl-sidebar__section-title">
            <span>
              KHÔNG GIAN LÀM VIỆC
            </span>
          </div>

          <div className="vcl-sidebar__search">
            <SearchOutlined className="vcl-sidebar__search-icon" />

            <input
              type="search"
              value={menuQuery}
              placeholder="Tìm nhanh trong menu..."
              aria-label="Tìm nhanh mục trong menu"
              className="vcl-sidebar__search-input"
              onChange={(event) => setMenuQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setMenuQuery("");
                }
              }}
            />

            {menuQuery && (
              <button
                type="button"
                title="Xoá từ khoá"
                aria-label="Xoá từ khoá"
                className="vcl-sidebar__search-clear"
                onClick={() => setMenuQuery("")}
              >
                <CloseCircleFilled />
              </button>
            )}
          </div>

          <nav
            className="vcl-sidebar__menu"
            aria-label="Điều hướng chính"
          >
            {visibleMenus.map(
              (item, index) => {
                const hasChildren =
                  Array.isArray(
                    item.children
                  ) &&
                  item.children.length > 0;

                if (hasChildren) {
                  const isGroupActive =
                    isMenuGroupActive(
                      location.pathname,
                      item.children
                    );

                  /* Đang tìm thì mở sẵn mọi nhóm còn lại — kết quả phải thấy ngay. */
                  const isGroupOpen =
                    isSearching ||
                    Boolean(
                      openMenuGroups[
                      item.key
                      ]
                    );

                  return (
                    <div
                      key={item.key}
                      className={`vcl-menu-group ${isGroupActive
                        ? "vcl-menu-group--active"
                        : ""
                        }`}
                      style={{
                        "--vcl-menu-index":
                          index,
                      }}
                    >
                      <button
                        type="button"
                        title={item.label}
                        aria-expanded={
                          isGroupOpen
                        }
                        aria-controls={`${item.key}-submenu`}
                        className={`vcl-menu-item vcl-menu-dropdown ${isGroupActive
                          ? "vcl-menu-item--active"
                          : ""
                          }`}
                        onClick={() =>
                          handleToggleMenuGroup(
                            item.key
                          )
                        }
                      >
                        <span className="vcl-menu-item__active-bar" />

                        <span className="vcl-menu-item__icon">
                          {item.icon}
                        </span>

                        <span className="vcl-menu-item__label">
                          {item.label}
                        </span>

                        <DownOutlined
                          className={`vcl-menu-item__arrow vcl-menu-dropdown__arrow ${isGroupOpen
                            ? "is-open"
                            : ""
                            }`}
                        />
                      </button>

                      <div
                        id={`${item.key}-submenu`}
                        className={`vcl-menu-submenu ${isGroupOpen
                          ? "is-open"
                          : ""
                          }`}
                      >
                        <div className="vcl-menu-submenu__inner">
                          {item.children.map(
                            (
                              child
                            ) => (
                              <NavLink
                                key={
                                  child.key
                                }
                                to={
                                  child.path
                                }
                                end={Boolean(
                                  child.end
                                )}
                                title={
                                  child.label
                                }
                                className={({
                                  isActive,
                                }) =>
                                  `vcl-submenu-item${isActive
                                    ? " vcl-submenu-item--active"
                                    : ""
                                  }`
                                }
                              >
                                <span className="vcl-submenu-item__line" />

                                <span className="vcl-submenu-item__icon">
                                  {
                                    child.icon
                                  }
                                </span>

                                <span className="vcl-submenu-item__label">
                                  {
                                    child.label
                                  }
                                </span>

                                <RightOutlined className="vcl-submenu-item__arrow" />
                              </NavLink>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={
                      item.key ||
                      item.path
                    }
                    to={item.path}
                    end={Boolean(item.end)}
                    title={item.label}
                    style={{
                      "--vcl-menu-index":
                        index,
                    }}
                    className={({
                      isActive,
                    }) =>
                      `vcl-menu-item${isActive
                        ? " vcl-menu-item--active"
                        : ""
                      }`
                    }
                  >
                    <span className="vcl-menu-item__active-bar" />

                    <span className="vcl-menu-item__icon">
                      {item.icon}
                    </span>

                    <span className="vcl-menu-item__label">
                      {item.label}
                    </span>

                    {renderBadge(item, badges)}

                    <RightOutlined className="vcl-menu-item__arrow" />
                  </NavLink>
                );
              }
            )}

            {isSearching && visibleMenus.length === 0 && (
              <p className="vcl-sidebar__empty">
                Không có mục nào khớp &ldquo;{menuQuery.trim()}&rdquo;.
              </p>
            )}
          </nav>
        </section>

        <footer className="vcl-sidebar__footer">
          <button
            type="button"
            className="vcl-profile-card"
            onClick={
              handleOpenProfile
            }
            aria-label="Mở thông tin cá nhân"
          >
            <span className="vcl-profile-card__avatar">
              {avatarText}

              <span className="vcl-profile-card__status" />
            </span>

            <span className="vcl-profile-card__info">
              <strong>
                {fullName}
              </strong>

              <span>
                {roleInfo.label}
              </span>

              {email && (
                <small>
                  {email}
                </small>
              )}
            </span>

            <span className="vcl-profile-card__action">
              <RightOutlined />
            </span>
          </button>

          <button
            type="button"
            className="vcl-logout-button"
            onClick={handleLogout}
          >
            <LogoutOutlined />

            <span>
              Đăng xuất hệ thống
            </span>
          </button>

          <p className="vcl-sidebar__version">
            Vietnam Logistics Management System · 2026
          </p>
        </footer>
      </aside>

      <UserProfileModal
        open={profileOpen}
        onClose={
          handleCloseProfile
        }
        onUpdated={
          handleProfileUpdated
        }
      />
    </>
  );
}
