import {
  useEffect,
  useState,
} from "react";
import {
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  AppstoreOutlined,
  CalculatorOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DollarOutlined,
  DownOutlined,
  ExportOutlined,
  CheckSquareOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  InboxOutlined,
  LogoutOutlined,
  MonitorOutlined,
  SendOutlined,
  RollbackOutlined,
  FileSearchOutlined as InspectionOutlined,
  PlusCircleOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";

import logoVietnamLogistics from "../../assets/anhlogocap2.jpeg";
import UserProfileModal from "../../components/UserComponents/UserProfileModal";
import { clearAuthSession } from "../../utils/Common/authSession";

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
          label: "Phiếu xuất kho",
          icon: <CheckSquareOutlined />,
          path: "/admin/wro",
        },
        {
          key: "admin-deliveries",
          label: "Đơn đang giao",
          icon: <SendOutlined />,
          path: "/admin/deliveries",
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
          key: "admin-additional-fees",
          label: "Phí bổ sung",
          icon: <PlusCircleOutlined />,
          path: "/admin/additional-service-fees",
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
      key: "operations-wro",
      label: "Phiếu xuất kho",
      icon: <CheckSquareOutlined />,
      path: "/operations-manager/wro",
    },
    {
      key: "operations-purchase-store",
      label: "Duyệt nhập kho mua hộ",
      icon: <ShoppingCartOutlined />,
      path: "/operations-manager/purchase-store",
    },
    {
      key: "operations-shipments",
      label: "Lô vận chuyển",
      icon: <SendOutlined />,
      path: "/operations-manager/shipments",
    },
    {
      key: "operations-parcels",
      label: "Tồn kho",
      icon: <InboxOutlined />,
      path: "/operations-manager/parcels",
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
      key: "operations-parcel-returns",
      label: "Hàng hoàn về",
      icon: <RollbackOutlined />,
      path: "/operations-manager/parcel-returns",
    },
    {
      key: "operations-inspections",
      label: "Chênh lệch kiểm đếm",
      icon: <InspectionOutlined />,
      path: "/operations-manager/inspections",
    },
  ],

  sale: [
    {
      key: "sale-dashboard",
      label: "Tổng quan",
      icon: <DashboardOutlined />,
      path: "/sale",
      end: true,
    },

    /*
     * Giữ nguyên tên và icon người dùng đã đặt.
     * Chỉ sửa key và đường dẫn cho đúng chức năng.
     */
    {
      key: "sale-list-and-fees",
      label: "Danh sách và phí ",
      icon: <PlusCircleOutlined />,
      children: [
        {
          key: "sale-restricted-items",
          label: "Hàng cấm ",
          icon: <ShoppingOutlined />,
          path: "/sale/restricted-items",
          end: true,
        },
        {
          key: "sale-service-pricings",
          label: "Phí dịch vụ",
          icon: <InboxOutlined />,
          path: "/sale/service-pricings",
          end: true,
        },
      ],
    },

    {
      key: "sale-create-request",
      label: "Tạo yêu cầu",
      icon: <PlusCircleOutlined />,
      children: [
        {
          key: "sale-create-purchase",
          label: "Mua hộ",
          icon: <ShoppingOutlined />,
          path: "/sale/create-order/buy-orders",
          end: true,
        },
        {
          key: "sale-create-consignment",
          label: "Ký gửi",
          icon: <InboxOutlined />,
          path: "/sale/create-order/consignment",
          end: true,
        },
      ],
    },

    {
      key: "sale-customers",
      label: "Quản lý khách hàng",
      icon: <TeamOutlined />,
      path: "/sale/customers",
    },
    {
      key: "sale-consignments",
      label: "Quản lý ký gửi",
      icon: <FileSearchOutlined />,
      path: "/sale/consignments",
    },
    {
      key: "sale-purchase-requests",
      label: "Quản lý mua hộ",
      icon: <ShoppingCartOutlined />,
      path: "/sale/purchase-requests",
    },
    {
      key: "sale-settlements",
      label: "Hàng chờ tất toán",
      icon: <DollarOutlined />,
      path: "/sale/settlements",
    },
    {
      key: "sale-releases",
      label: "Đơn hàng cần xử lý",
      icon: <ExportOutlined />,
      path: "/sale/releases",
    },
    // {
    //   key: "sale-quotations",
    //   label: "Quản lý báo giá",
    //   icon: <CalculatorOutlined />,
    //   path: "/sale/quotations",
    // },

    {
      key: "sale-transaction-history",
      label: "Lịch sử giao dịch ",
      icon: <PlusCircleOutlined />,
      children: [
        {
          key: "sale-history-purchase",
          label: "Mua hộ",
          icon: <ShoppingOutlined />,
          path: "/sale/history/purchase-requests",
          end: true,
        },
        {
          key: "sale-history-consignment",
          label: "Ký gửi",
          icon: <InboxOutlined />,
          path: "/sale/history/order",
          end: true,
        },
      ],
    },

    {
      key: "sale-documents",
      label: "Quản lý giấy tờ",
      icon: <FileTextOutlined />,
      children: [
        {
          key: "sale-documents-purchase",
          label: "Giấy tờ mua hộ",
          icon: <ShoppingOutlined />,
          path: "/sale/documents/purchase-requests",
          end: true,
        },
        {
          key: "sale-documents-consignment",
          label: "Giấy tờ ký gửi",
          icon: <InboxOutlined />,
          path: "/sale/documents/consignments",
          end: true,
        },
      ],
    },
    {
      key: "sale-wro",
      label: "Quản lý WRO",
      icon: <CheckSquareOutlined />,
      children: [
        {
          key: "sale-wro-express",
          label: "WRO hỏa tốc",
          icon: <SendOutlined />,
          path: "/sale/wro/express",
          end: true,
        },
        {
          key: "sale-wro-batch",
          label: "WRO theo lô",
          icon: <InboxOutlined />,
          path: "/sale/wro/batch",
          end: true,
        },
      ],
    },

    {
      key: "sale-customer-service",
      label: "Chăm sóc khách hàng",
      icon: <CustomerServiceOutlined />,
      path: "/sale/customer-service",
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
   COMPONENT
===================================================== */

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

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

      "sale-list-and-fees":
        pathname.startsWith(
          "/sale/restricted-items"
        ) ||
        pathname.startsWith(
          "/sale/service-pricings"
        ),

      "sale-create-request":
        pathname.startsWith(
          "/sale/create-order/"
        ),

      "sale-transaction-history":
        pathname.startsWith(
          "/sale/history/"
        ),

      "sale-documents":
        pathname.startsWith(
          "/sale/documents/"
        ),

      "sale-wro":
        pathname.startsWith(
          "/sale/wro"
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
          "sale-list-and-fees": false,
          "sale-create-request": false,
          "sale-transaction-history": false,
          "sale-documents": false,
          "sale-wro": false,
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

          <nav
            className="vcl-sidebar__menu"
            aria-label="Điều hướng chính"
          >
            {menus.map(
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

                  const isGroupOpen =
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

                    <RightOutlined className="vcl-menu-item__arrow" />
                  </NavLink>
                );
              }
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
