import {
    BellOutlined,
    CrownOutlined,
    TeamOutlined,
    UserSwitchOutlined,
  } from "@ant-design/icons";
  
  import "./rc-hd.header.css";
  
  const normalizeRole = (role) => {
    return String(role || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  };
  
  const ROLE_INFO = {
    admin: {
      title: "Admin",
      subtitle: "Quản trị và cấu hình toàn bộ hệ thống",
      icon: <CrownOutlined />,
    },
  
    operationsmanager: {
      title: "Operations Manager",
      subtitle: "Quản lý vận hành, kho hàng và vận chuyển",
      icon: <TeamOutlined />,
    },
  
    sale: {
      title: "Sale",
      subtitle: "Quản lý khách hàng, đơn hàng và báo giá",
      icon: <UserSwitchOutlined />,
    },
  };
  
  export default function Header() {
    const storedRole = sessionStorage.getItem("role");
    const normalizedRole = normalizeRole(storedRole);
  
    const currentRole =
      ROLE_INFO[normalizedRole] || ROLE_INFO.admin;
  
    const handleNotificationClick = () => {
      console.log("Mở danh sách thông báo");
    };
  
    return (
      <header className="rc-hd">
        <div className="rc-hd__left">
          <div className="rc-hd__logo-icon">
            {currentRole.icon}
          </div>
  
          <div className="rc-hd__logo-text">
            <h3>{currentRole.title}</h3>
            <span>{currentRole.subtitle}</span>
          </div>
        </div>
  
        <div className="rc-hd__actions">
          <button
            type="button"
            className="rc-hd__notification"
            onClick={handleNotificationClick}
            aria-label="Thông báo"
          >
            <BellOutlined />
  
            <span className="rc-hd__notification-dot" />
          </button>
  
          <span className="rc-hd__lang">
            <span className="rc-hd__lang-label">
              Ngôn ngữ
            </span>
  
            <strong>VN</strong>
          </span>
        </div>
      </header>
    );
  }