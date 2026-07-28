import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  ConfigProvider,
  Empty,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Tag,
  Tooltip,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FileProtectOutlined,
  GlobalOutlined,
  ReloadOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  RESTRICTION_TYPE,
  getRestrictedItemDetailApi,
  getRestrictedItemsApi,
} from "../../../api/SaleAPI/ConsignmentAPI/restrictedItemService";
import AuthNotify from "../../../utils/Common/AuthNotify";

import "./RestrictedItems.css";

const RESTRICTED_ITEMS_FONT_FAMILY = [
  "-apple-system",
  "BlinkMacSystemFont",
  '"Segoe UI"',
  "Roboto",
  '"Helvetica Neue"',
  "Arial",
  "sans-serif",
].join(", ");

const RESTRICTED_ITEMS_THEME = {
  token: {
    fontFamily:
      RESTRICTED_ITEMS_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 1.5,
    colorText: "#172033",
    colorTextSecondary: "#526176",
    borderRadius: 11,
    controlHeight: 42,
  },

  components: {
    Button: {
      fontWeight: 600,
      controlHeight: 42,
    },

    Input: {
      fontSize: 14,
      activeShadow: "none",
    },

    Select: {
      fontSize: 14,
      optionFontSize: 14,
    },

    Modal: {
      titleFontSize: 18,
      titleLineHeight: 1.4,
    },

    Tag: {
      fontSize: 12,
      lineHeight: 1.5,
    },

    Tooltip: {
      fontSize: 13,
    },
  },
};

const TYPE_CONFIG = {
  [RESTRICTION_TYPE.BANNED]: {
    label: "Cấm vận chuyển",
    className: "is-banned",
    icon: <StopOutlined />,
  },
  [RESTRICTION_TYPE.RESTRICTED]: {
    label: "Hạn chế vận chuyển",
    className: "is-restricted",
    icon: <SafetyCertificateOutlined />,
  },
  [RESTRICTION_TYPE.WARNING]: {
    label: "Cần lưu ý",
    className: "is-warning",
    icon: <WarningOutlined />,
  },
};

const COUNTRY_OPTIONS = [
  {
    value: "ALL",
    label: "Tất cả quốc gia",
  },
  {
    value: "Vietnam",
    label: "Việt Nam",
  },
  {
    value: "China",
    label: "Trung Quốc",
  },
  {
    value: "Korea",
    label: "Hàn Quốc",
  },
  {
    value: "Japan",
    label: "Nhật Bản",
  },
];

const TYPE_OPTIONS = [
  {
    value: "ALL",
    label: "Tất cả mức độ",
  },
  {
    value: RESTRICTION_TYPE.BANNED,
    label: "Cấm vận chuyển",
  },
  {
    value: RESTRICTION_TYPE.RESTRICTED,
    label: "Hạn chế vận chuyển",
  },
  {
    value: RESTRICTION_TYPE.WARNING,
    label: "Cần lưu ý",
  },
];

const RESTRICTED_ITEMS_PAGE_SIZE = 5;

const normalizeText = (value) =>
  String(value ?? "").trim();

const getTypeConfig = (value) => {
  return (
    TYPE_CONFIG[
      normalizeText(value).toUpperCase()
    ] || {
      label: "Loại hạn chế khác",
      className: "is-default",
      icon: <FileProtectOutlined />,
    }
  );
};

function RestrictedItemsLoading() {
  return (
    <ConfigProvider
      theme={RESTRICTED_ITEMS_THEME}
    >
      <main className="restricted-items-page">
        <div className="restricted-items-loading">
          <Skeleton.Input
            active
            size="large"
          />

          <Skeleton
            active
            paragraph={{ rows: 8 }}
          />
        </div>
      </main>
    </ConfigProvider>
  );
}

export default function RestrictedItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  const [keyword, setKeyword] =
    useState("");
  const [country, setCountry] =
    useState("ALL");
  const [restrictionType, setRestrictionType] =
    useState("ALL");
  const [activeOnly, setActiveOnly] =
    useState(false);

  const [detailOpen, setDetailOpen] =
    useState(false);
  const [detailLoading, setDetailLoading] =
    useState(false);
  const [selectedItem, setSelectedItem] =
    useState(null);

  const [currentPage, setCurrentPage] =
    useState(1);

  const tableScrollRef = useRef(null);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result =
        await getRestrictedItemsApi();

      setItems(
        Array.isArray(result)
          ? result
          : []
      );
    } catch (requestError) {
      console.error(
        "GET RESTRICTED ITEMS ERROR:",
        requestError
      );

      const message =
        requestError?.response?.data?.message ||
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Không thể tải danh sách hàng cấm và hạn chế.";

      setError(message);
      setItems([]);

      AuthNotify.error(
        "Tải dữ liệu thất bại",
        message
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const normalizedKeyword =
      keyword.trim().toLowerCase();

    return items.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        [
          item?.itemName,
          item?.note,
          item?.countryDisplayName,
          item?.restrictionTypeDisplayName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword);

      const matchesCountry =
        country === "ALL" ||
        normalizeText(item?.country)
          .toLowerCase() ===
          country.toLowerCase();

      const matchesType =
        restrictionType === "ALL" ||
        item?.restrictionType ===
          restrictionType;

      const matchesActive =
        !activeOnly ||
        item?.isActive === true;

      return (
        matchesKeyword &&
        matchesCountry &&
        matchesType &&
        matchesActive
      );
    });
  }, [
    items,
    keyword,
    country,
    restrictionType,
    activeOnly,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredItems.length /
        RESTRICTED_ITEMS_PAGE_SIZE
    )
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    keyword,
    country,
    restrictionType,
    activeOnly,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [
    currentPage,
    totalPages,
  ]);

  const paginatedItems = useMemo(() => {
    const startIndex =
      (currentPage - 1) *
      RESTRICTED_ITEMS_PAGE_SIZE;

    return filteredItems.slice(
      startIndex,
      startIndex +
        RESTRICTED_ITEMS_PAGE_SIZE
    );
  }, [
    filteredItems,
    currentPage,
  ]);

  const visibleStart =
    filteredItems.length === 0
      ? 0
      : (currentPage - 1) *
          RESTRICTED_ITEMS_PAGE_SIZE +
        1;

  const visibleEnd = Math.min(
    currentPage *
      RESTRICTED_ITEMS_PAGE_SIZE,
    filteredItems.length
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);

    window.requestAnimationFrame(() => {
      tableScrollRef.current?.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  };

  const statistics = useMemo(() => {
    return items.reduce(
      (summary, item) => {
        summary.total += 1;

        if (item?.isActive) {
          summary.active += 1;
        }

        if (
          item?.restrictionType ===
          RESTRICTION_TYPE.BANNED
        ) {
          summary.banned += 1;
        }

        if (
          item?.restrictionType ===
          RESTRICTION_TYPE.RESTRICTED
        ) {
          summary.restricted += 1;
        }

        if (
          item?.restrictionType ===
          RESTRICTION_TYPE.WARNING
        ) {
          summary.warning += 1;
        }

        return summary;
      },
      {
        total: 0,
        active: 0,
        banned: 0,
        restricted: 0,
        warning: 0,
      }
    );
  }, [items]);

  const handleOpenDetail = async (
    item
  ) => {
    if (!item?.id) {
      AuthNotify.warning(
        "Không thể xem chi tiết",
        "Không tìm thấy mã mặt hàng."
      );
      return;
    }

    try {
      setSelectedItem(item);
      setDetailOpen(true);
      setDetailLoading(true);

      const detail =
        await getRestrictedItemDetailApi(
          item.id
        );

      setSelectedItem(
        detail || item
      );
    } catch (requestError) {
      console.error(
        "GET RESTRICTED ITEM DETAIL ERROR:",
        requestError
      );

      AuthNotify.error(
        "Không thể tải chi tiết",
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Vui lòng thử lại."
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedItem(null);
  };

  const resetFilters = () => {
    setKeyword("");
    setCountry("ALL");
    setRestrictionType("ALL");
    setActiveOnly(false);
    setCurrentPage(1);
  };

  if (loading) {
    return <RestrictedItemsLoading />;
  }

  return (
    <ConfigProvider
      theme={RESTRICTED_ITEMS_THEME}
    >
      <main className="restricted-items-page">
      <section className="restricted-items-hero">
        <div className="restricted-items-hero__content">
          <span className="restricted-items-hero__eyebrow">
            QUẢN LÝ THÔNG TIN HẠN CHẾ
          </span>

          <h1>
            Danh sách hàng cấm và hạn chế
          </h1>

          <p>
            Tra cứu các mặt hàng bị cấm,
            hạn chế hoặc cần khai báo đặc
            biệt trước khi tạo yêu cầu vận
            chuyển.
          </p>
        </div>

        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={loadItems}
          className="restricted-items-refresh"
        >
          Tải lại dữ liệu
        </Button>
      </section>

      <section className="restricted-items-stats">
        <article>
          <div className="restricted-items-stat__icon is-total">
            <FileProtectOutlined />
          </div>
          <div>
            <span>Tổng mặt hàng</span>
            <strong>{statistics.total}</strong>
          </div>
        </article>

        <article>
          <div className="restricted-items-stat__icon is-banned">
            <StopOutlined />
          </div>
          <div>
            <span>Cấm vận chuyển</span>
            <strong>{statistics.banned}</strong>
          </div>
        </article>

        <article>
          <div className="restricted-items-stat__icon is-restricted">
            <SafetyCertificateOutlined />
          </div>
          <div>
            <span>Hạn chế</span>
            <strong>
              {statistics.restricted}
            </strong>
          </div>
        </article>

        <article>
          <div className="restricted-items-stat__icon is-warning">
            <WarningOutlined />
          </div>
          <div>
            <span>Cần lưu ý</span>
            <strong>{statistics.warning}</strong>
          </div>
        </article>

        <article>
          <div className="restricted-items-stat__icon is-active">
            <CheckCircleOutlined />
          </div>
          <div>
            <span>Đang áp dụng</span>
            <strong>{statistics.active}</strong>
          </div>
        </article>
      </section>

      <section className="restricted-items-card">
        <div className="restricted-items-toolbar">
          <div className="restricted-items-search">
            <Input
              allowClear
              value={keyword}
              prefix={<SearchOutlined />}
              placeholder="Tìm tên hàng, quốc gia hoặc ghi chú..."
              onChange={(event) =>
                setKeyword(
                  event.target.value
                )
              }
            />
          </div>

          <Select
            value={country}
            options={COUNTRY_OPTIONS}
            onChange={setCountry}
            className="restricted-items-select"
          />

          <Select
            value={restrictionType}
            options={TYPE_OPTIONS}
            onChange={setRestrictionType}
            className="restricted-items-select"
          />

          <button
            type="button"
            className={`restricted-items-active-toggle ${
              activeOnly
                ? "is-active"
                : ""
            }`}
            onClick={() =>
              setActiveOnly(
                (current) => !current
              )
            }
          >
            <CheckCircleOutlined />
            Chỉ đang áp dụng
          </button>

          <Button
            type="text"
            onClick={resetFilters}
          >
            Xóa bộ lọc
          </Button>
        </div>

        <div className="restricted-items-result">
          <span>
            Hiển thị{" "}
            <strong>
              {visibleStart}–{visibleEnd}
            </strong>{" "}
            trong{" "}
            <strong>
              {filteredItems.length}
            </strong>{" "}
            mặt hàng
          </span>
        </div>

        <div className="restricted-items-data-scroll">
          {error ? (
          <div className="restricted-items-error">
            <CloseCircleOutlined />
            <h2>Không thể tải dữ liệu</h2>
            <p>{error}</p>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadItems}
            >
              Thử lại
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="restricted-items-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Không tìm thấy mặt hàng phù hợp"
            />
          </div>
        ) : (
          <div
            ref={tableScrollRef}
            className="restricted-items-table-wrapper"
          >
            <table className="restricted-items-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Tên mặt hàng</th>
                  <th>Quốc gia</th>
                  <th>Mức độ hạn chế</th>
                  <th>Ghi chú</th>
                  <th>Trạng thái</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>

              <tbody>
                {paginatedItems.map(
                  (item, index) => {
                    const typeConfig =
                      getTypeConfig(
                        item?.restrictionType
                      );

                    return (
                      <tr key={item.id}>
                        <td>
                          <span className="restricted-items-index">
                            {(currentPage - 1) *
                              RESTRICTED_ITEMS_PAGE_SIZE +
                              index +
                              1}
                          </span>
                        </td>

                        <td>
                          <div className="restricted-items-name">
                            <div
                              className={`restricted-items-name__icon ${typeConfig.className}`}
                            >
                              {typeConfig.icon}
                            </div>

                            <strong>
                              {item.itemName ||
                                "Chưa có tên"}
                            </strong>
                          </div>
                        </td>

                        <td>
                          <span className="restricted-items-country">
                            <GlobalOutlined />
                            {item.countryDisplayName ||
                              item.country ||
                              "Chưa xác định"}
                          </span>
                        </td>

                        <td>
                          <Tag
                            className={`restricted-items-type ${typeConfig.className}`}
                            icon={typeConfig.icon}
                          >
                            {typeConfig.label}
                          </Tag>
                        </td>

                        <td>
                          <Tooltip
                            title={
                              item.note ||
                              "Không có ghi chú"
                            }
                          >
                            <span className="restricted-items-note">
                              {item.note ||
                                "Không có ghi chú"}
                            </span>
                          </Tooltip>
                        </td>

                        <td>
                          <Tag
                            className={`restricted-items-status ${
                              item.isActive
                                ? "is-active"
                                : "is-inactive"
                            }`}
                          >
                            {item.isActive
                              ? "Đang áp dụng"
                              : "Ngừng áp dụng"}
                          </Tag>
                        </td>

                        <td>
                          <Tooltip title="Xem chi tiết">
                            <Button
                              type="text"
                              shape="circle"
                              icon={<EyeOutlined />}
                              className="restricted-items-view-button"
                              onClick={() =>
                                handleOpenDetail(
                                  item
                                )
                              }
                            />
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
        </div>

        <div className="restricted-items-pagination">
          <Pagination
            current={currentPage}
            pageSize={
              RESTRICTED_ITEMS_PAGE_SIZE
            }
            total={filteredItems.length}
            showSizeChanger={false}
            showLessItems
            responsive
            onChange={handlePageChange}
            showTotal={(total, range) =>
              `${range[0]}–${range[1]} trong ${total} mặt hàng`
            }
          />
        </div>
      </section>

      <Modal
        open={detailOpen}
        centered
        width={620}
        footer={null}
        title={null}
        destroyOnHidden
        className="restricted-items-detail-modal"
        onCancel={handleCloseDetail}
      >
        {detailLoading ? (
          <Skeleton
            active
            paragraph={{ rows: 6 }}
          />
        ) : selectedItem ? (
          <div className="restricted-items-detail">
            <div className="restricted-items-detail__hero">
              <div className={`restricted-items-detail__hero-icon ${getTypeConfig(
                selectedItem.restrictionType
              ).className}`}>
                {
                  getTypeConfig(
                    selectedItem.restrictionType
                  ).icon
                }
              </div>

              <div>
                <span>
                  CHI TIẾT HÀNG HẠN CHẾ
                </span>

                <h2>
                  {selectedItem.itemName}
                </h2>
              </div>
            </div>

            <div className="restricted-items-detail__grid">
              <article>
                <span>Quốc gia áp dụng</span>
                <strong>
                  {selectedItem.countryDisplayName ||
                    selectedItem.country ||
                    "Chưa xác định"}
                </strong>
              </article>

              <article>
                <span>Mức độ hạn chế</span>
                <Tag
                  className={`restricted-items-type ${
                    getTypeConfig(
                      selectedItem.restrictionType
                    ).className
                  }`}
                >
                  {
                    getTypeConfig(
                      selectedItem.restrictionType
                    ).label
                  }
                </Tag>
              </article>

              <article>
                <span>Trạng thái</span>
                <strong>
                  {selectedItem.isActive
                    ? "Đang áp dụng"
                    : "Ngừng áp dụng"}
                </strong>
              </article>

              <article className="is-full">
                <span>Hướng dẫn và ghi chú</span>
                <p>
                  {selectedItem.note ||
                    "Không có ghi chú."}
                </p>
              </article>
            </div>

            <div className="restricted-items-detail__notice">
              <WarningOutlined />
              <span>
                Nhân viên kinh doanh cần kiểm
                tra quy định trước khi tiếp nhận
                hoặc tạo yêu cầu vận chuyển.
              </span>
            </div>

            <div className="restricted-items-detail__actions">
              <Button onClick={handleCloseDetail}>
                Đóng
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
      </main>
    </ConfigProvider>
  );
}
