import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Button,
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
  BankOutlined,
  EnvironmentOutlined,
  FilterOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  ReloadOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import {
  deleteCustomerApi,
  getCustomersApi,
  normalizeCustomerStatus,
} from "../../../api/SaleAPI/CusSale/CusSaleService";
import AuthNotify from "../../../utils/Common/AuthNotify";
import CustomerDetailModal from "./CusDeatilSale/CustomerDetailModal";
import CreateCustomerSale from "./CreateCustomerSale/CreateCustomerSale";
import EditCustomerSale from "./EditCustomerSale/EditCustomerSale";
import "./CustomerList.css";

const CUSTOMER_STATUS_CONFIG = {
  ACTIVE: {
    label: "Đang hoạt động",
    className: "is-active",
  },
  INACTIVE: {
    label: "Ngừng hoạt động",
    className: "is-inactive",
  },
  BLOCKED: {
    label: "Đã khóa",
    className: "is-blocked",
  },
  PENDING: {
    label: "Chờ kích hoạt",
    className: "is-pending",
  },
  PENDING_VERIFICATION: {
    label: "Chờ xác minh",
    className: "is-pending",
  },
  SUSPENDED: {
    label: "Tạm ngưng",
    className: "is-suspended",
  },
  DELETED: {
    label: "Đã xóa",
    className: "is-deleted",
  },
};

const STATUS_OPTIONS = [
  {
    value: "ALL",
    label: "Tất cả trạng thái",
  },
  {
    value: "ACTIVE",
    label: "Đang hoạt động",
  },
  {
    value: "INACTIVE",
    label: "Ngừng hoạt động",
  },
  {
    value: "PENDING",
    label: "Chờ kích hoạt",
  },
  {
    value: "PENDING_VERIFICATION",
    label: "Chờ xác minh",
  },
  {
    value: "BLOCKED",
    label: "Đã khóa",
  },
  {
    value: "SUSPENDED",
    label: "Tạm ngưng",
  },
];

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const normalizeSearchText = (value) => {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
};

const pickValue = (...values) => {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      normalizeText(value) !== ""
    ) {
      return value;
    }
  }

  return "";
};

const getArrayItems = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.customers)) {
    return data.customers;
  }

  return [];
};

const normalizeCustomerRecord = (
  customer = {}
) => {
  const raw =
    customer?.raw || customer;

  const profile =
    raw?.profile ||
    raw?.user ||
    raw?.account ||
    {};

  const id = normalizeText(
    pickValue(
      customer?.id,
      customer?.customerId,
      raw?.id,
      raw?.customerId,
      raw?.userId,
      profile?.id,
      profile?.userId
    )
  );

  const status = normalizeCustomerStatus(
    pickValue(
      customer?.status,
      raw?.status,
      raw?.accountStatus,
      profile?.status
    )
  );

  const explicitIsActive =
    pickValue(
      customer?.isActive,
      raw?.isActive,
      raw?.active,
      profile?.isActive
    );

  const isActive =
    typeof explicitIsActive ===
    "boolean"
      ? explicitIsActive
      : status === "ACTIVE";

  return {
    ...customer,

    id,
    customerId: id,

    customerCode: normalizeText(
      pickValue(
        customer?.customerCode,
        raw?.customerCode,
        raw?.code,
        profile?.customerCode,
        profile?.code
      )
    ),

    fullName: normalizeText(
      pickValue(
        customer?.fullName,
        raw?.fullName,
        raw?.name,
        raw?.customerName,
        profile?.fullName,
        profile?.name
      )
    ),

    email: normalizeText(
      pickValue(
        customer?.email,
        raw?.email,
        profile?.email
      )
    ),

    phone: normalizeText(
      pickValue(
        customer?.phone,
        raw?.phone,
        raw?.phoneNumber,
        profile?.phone,
        profile?.phoneNumber
      )
    ),

    address: normalizeText(
      pickValue(
        customer?.address,
        raw?.address,
        raw?.fullAddress,
        profile?.address
      )
    ),

    companyName: normalizeText(
      pickValue(
        customer?.companyName,
        raw?.companyName,
        profile?.companyName
      )
    ),

    taxId: normalizeText(
      pickValue(
        customer?.taxId,
        raw?.taxId,
        profile?.taxId
      )
    ),

    region: normalizeText(
      pickValue(
        customer?.region,
        raw?.region,
        raw?.province,
        raw?.city,
        profile?.region,
        profile?.province,
        profile?.city
      )
    ),

    country: normalizeText(
      pickValue(
        customer?.country,
        raw?.country,
        profile?.country
      )
    ),

    status,
    isActive,

    createdAt: pickValue(
      customer?.createdAt,
      raw?.createdAt,
      raw?.registeredAt,
      profile?.createdAt
    ),

    updatedAt: pickValue(
      customer?.updatedAt,
      raw?.updatedAt,
      profile?.updatedAt
    ),

    raw,
  };
};

const getCustomerStatusCode = (customer) => {
  const status = normalizeCustomerStatus(customer?.status);

  if (status) {
    return status;
  }

  return customer?.isActive === true
    ? "ACTIVE"
    : "INACTIVE";
};

const getCustomerStatus = (customer) => {
  const statusCode =
    getCustomerStatusCode(customer);

  return (
    CUSTOMER_STATUS_CONFIG[
      statusCode
    ] || {
      label: "Chưa xác định",
      className: "is-unknown",
    }
  );
};

const formatDate = (value) => {
  if (!value) {
    return "Chưa cập nhật";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa cập nhật";
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(date);
};

const getAvatarLetter = (fullName) => {
  return (
    normalizeText(fullName)
      .charAt(0)
      .toUpperCase() || "K"
  );
};

const getCustomerAddress = (customer) => {
  const values = [
    customer?.address,
    customer?.region,
    customer?.country,
  ]
    .map(normalizeText)
    .filter(Boolean);

  return [...new Set(values)].join(", ");
};

function CustomerListLoading() {
  return (
    <div className="customer-list-loading">
      {[1, 2, 3, 4, 5].map(
        (item) => (
          <div
            key={item}
            className="customer-list-loading__row"
          >
            <Skeleton.Avatar
              active
              size={44}
              shape="square"
            />

            <div className="customer-list-loading__content">
              <Skeleton.Input
                active
                size="small"
              />
              <Skeleton.Input
                active
                size="small"
              />
            </div>

            <Skeleton.Button
              active
              size="small"
            />
          </div>
        )
      )}
    </div>
  );
}

export default function CustomerList() {
  const [customers, setCustomers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [searchKeyword, setSearchKeyword] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(10);

  const [
    selectedCustomerId,
    setSelectedCustomerId,
  ] = useState("");

  const [
    selectedCustomer,
    setSelectedCustomer,
  ] = useState(null);

  const [detailOpen, setDetailOpen] =
    useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const loadCustomers =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const data =
          await getCustomersApi();

        const normalizedCustomers =
          getArrayItems(data)
            .map(
              normalizeCustomerRecord
            )
            .filter(
              (customer) =>
                Boolean(customer.id)
            );

        setCustomers(
          normalizedCustomers
        );

        return normalizedCustomers;
      } catch (requestError) {
        console.error(
          "GET CUSTOMERS ERROR:",
          requestError
        );

        const message =
          requestError?.response?.data
            ?.message ||
          requestError?.response?.data
            ?.error ||
          requestError?.message ||
          "Không thể tải danh sách khách hàng.";

        setError(message);
        setCustomers([]);

        AuthNotify.error(
          "Tải danh sách thất bại",
          message
        );

        return [];
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      loadCustomers,
      0
    );

    return () => window.clearTimeout(timeoutId);
  }, [loadCustomers]);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setCurrentPage(1),
      0
    );

    return () => window.clearTimeout(timeoutId);
  }, [
    searchKeyword,
    statusFilter,
    pageSize,
  ]);

  const summary = useMemo(() => {
    return customers.reduce(
      (result, customer) => {
        const statusCode =
          getCustomerStatusCode(
            customer
          );

        result.total += 1;

        if (statusCode === "ACTIVE") {
          result.active += 1;
        } else {
          result.inactive += 1;
        }

        return result;
      },
      {
        total: 0,
        active: 0,
        inactive: 0,
      }
    );
  }, [customers]);

  const filteredCustomers =
    useMemo(() => {
      const keyword =
        normalizeSearchText(
          searchKeyword
        );

      return customers.filter(
        (customer) => {
          const statusCode =
            getCustomerStatusCode(
              customer
            );

          const matchesStatus =
            statusFilter === "ALL" ||
            statusCode ===
              statusFilter;

          if (!matchesStatus) {
            return false;
          }

          if (!keyword) {
            return true;
          }

          const searchableText =
            normalizeSearchText(
              [
                customer?.fullName,
                customer?.customerCode,
                customer?.email,
                customer?.phone,
                customer?.address,
                customer?.region,
                customer?.country,
              ]
                .filter(Boolean)
                .join(" ")
            );

          return searchableText.includes(
            keyword
          );
        }
      );
    }, [
      customers,
      searchKeyword,
      statusFilter,
    ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredCustomers.length /
        pageSize
    )
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      const timeoutId = window.setTimeout(
        () => setCurrentPage(totalPages),
        0
      );

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [currentPage, totalPages]);

  const displayedCustomers =
    useMemo(() => {
      const startIndex =
        (currentPage - 1) *
        pageSize;

      return filteredCustomers.slice(
        startIndex,
        startIndex + pageSize
      );
    }, [
      filteredCustomers,
      currentPage,
      pageSize,
    ]);

  const handleOpenDetail = (
    customer
  ) => {
    setSelectedCustomerId(
      customer?.id ||
        customer?.customerId ||
        ""
    );

    setSelectedCustomer(
      customer || null
    );

    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);

    window.setTimeout(() => {
      setSelectedCustomerId("");
      setSelectedCustomer(null);
    }, 180);
  };

  const handleOpenCreate = () => {
    setCreateOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setEditOpen(true);
  };

  const handleDeleteCustomer = (customer) => {
    Modal.confirm({
      title: "Xóa khách hàng?",
      content: `Bạn có chắc muốn xóa ${customer?.fullName || "khách hàng này"}?`,
      okText: "Xóa",
      cancelText: "Hủy",
      okButtonProps: { danger: true },
      async onOk() {
        try {
          await deleteCustomerApi(customer.id);
          AuthNotify.success("Đã xóa", "Khách hàng đã được xóa khỏi hệ thống.");
          await loadCustomers();
        } catch (requestError) {
          AuthNotify.error(
            "Không thể xóa khách hàng",
            requestError?.response?.data?.message ||
              requestError?.response?.data?.error ||
              requestError?.message ||
              "Vui lòng thử lại."
          );
          throw requestError;
        }
      },
    });
  };

  return (
    <main className="customer-list-page">
      <section className="customer-list-hero">
        <div className="customer-list-hero__content">
          <div className="customer-list-hero__eyebrow">
            <TeamOutlined />
            QUẢN LÝ KHÁCH HÀNG
          </div>

          <h1>Danh sách khách hàng</h1>

          <p>
            Theo dõi thông tin liên hệ,
            trạng thái tài khoản và xem
            đầy đủ hồ sơ của từng khách
            hàng trên hệ thống.
          </p>
        </div>

        <div className="customer-list-summary">
          <article>
            <div className="customer-list-summary__icon">
              <TeamOutlined />
            </div>

            <div>
              <span>Tổng khách hàng</span>
              <strong>
                {summary.total}
              </strong>
            </div>
          </article>

          <article className="is-active">
            <div className="customer-list-summary__icon">
              <UserOutlined />
            </div>

            <div>
              <span>Đang hoạt động</span>
              <strong>
                {summary.active}
              </strong>
            </div>
          </article>

          <article className="is-inactive">
            <div className="customer-list-summary__icon">
              <IdcardOutlined />
            </div>

            <div>
              <span>Chưa hoạt động</span>
              <strong>
                {summary.inactive}
              </strong>
            </div>
          </article>
        </div>
      </section>

      <section className="customer-list-card">
        <div className="customer-list-toolbar">
          <div className="customer-list-toolbar__search">
            <Input
              allowClear
              value={searchKeyword}
              prefix={<SearchOutlined />}
              placeholder="Tìm theo tên, mã khách hàng, email, số điện thoại..."
              onChange={(event) =>
                setSearchKeyword(
                  event.target.value
                )
              }
            />
          </div>

          <div className="customer-list-toolbar__filters">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
            >
              Thêm khách hàng
            </Button>

            <Select
              value={statusFilter}
              options={STATUS_OPTIONS}
              suffixIcon={
                <FilterOutlined />
              }
              onChange={setStatusFilter}
              popupMatchSelectWidth={false}
            />

            <Tooltip title="Tải lại danh sách">
              <Button
                icon={
                  <ReloadOutlined />
                }
                loading={loading}
                onClick={loadCustomers}
              >
                Tải lại
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="customer-list-result-bar">
          <div className="customer-list-result-bar__info">
            <span>
              Tìm thấy{" "}
              <strong>
                {filteredCustomers.length}
              </strong>{" "}
              khách hàng
            </span>

            <span className="customer-list-result-bar__page">
              Trang {currentPage}/{totalPages}
            </span>
          </div>

          {(searchKeyword ||
            statusFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchKeyword("");
                setStatusFilter("ALL");
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {loading ? (
          <CustomerListLoading />
        ) : error ? (
          <div className="customer-list-state">
            <div className="customer-list-state__icon is-error">
              <TeamOutlined />
            </div>

            <h2>
              Không thể hiển thị danh sách
            </h2>

            <p>{error}</p>

            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadCustomers}
            >
              Thử tải lại
            </Button>
          </div>
        ) : displayedCustomers.length ===
          0 ? (
          <div className="customer-list-empty">
            <Empty
              image={
                Empty.PRESENTED_IMAGE_SIMPLE
              }
              description="Không có khách hàng phù hợp với bộ lọc hiện tại."
            />
          </div>
        ) : (
          <>
            <div className="customer-list-table" role="region" aria-label="Danh sách khách hàng">
              <div className="customer-list-table__header">
                <span>Khách hàng</span>
                <span>Email</span>
                <span>Số điện thoại</span>
                <span>Công ty</span>
                <span>Mã số thuế</span>
                <span>Địa chỉ</span>
                <span>Trạng thái</span>
                <span>Ngày tham gia</span>
                <span>Thao tác</span>
              </div>

              <div className="customer-list-table__body">
                {displayedCustomers.map(
                  (customer) => {
                    const status =
                      getCustomerStatus(
                        customer
                      );

                    const address =
                      getCustomerAddress(
                        customer
                      );

                    return (
                      <article
                        key={
                          customer.id ||
                          customer.customerId
                        }
                        className="customer-list-row"
                      >
                        <div
                          className="customer-list-row__customer"
                          data-label="Khách hàng"
                        >
                          <div className="customer-list-avatar">
                            {getAvatarLetter(
                              customer?.fullName
                            )}
                          </div>

                          <div className="customer-list-customer-name">
                            <strong>
                              {customer?.fullName ||
                                "Chưa cập nhật tên"}
                            </strong>

                            <span>
                              <IdcardOutlined />
                              {customer?.customerCode ||
                                "Chưa có mã khách hàng"}
                            </span>
                          </div>
                        </div>

                        <div
                          className="customer-list-info-cell"
                          data-label="Email"
                        >
                          <span>
                            <MailOutlined />
                            {customer?.email ||
                              "Chưa cập nhật email"}
                          </span>
                        </div>

                        <div
                          className="customer-list-info-cell"
                          data-label="Số điện thoại"
                        >
                          <span>
                            <PhoneOutlined />
                            {customer?.phone ||
                              "Chưa cập nhật số điện thoại"}
                          </span>
                        </div>

                        <div
                          className="customer-list-info-cell"
                          data-label="Công ty"
                        >
                          <span>
                            <BankOutlined />
                            {customer?.companyName || "Chưa cập nhật"}
                          </span>
                        </div>

                        <div
                          className="customer-list-info-cell"
                          data-label="Mã số thuế"
                        >
                          <span>
                            <IdcardOutlined />
                            {customer?.taxId || "Chưa cập nhật"}
                          </span>
                        </div>

                        <div
                          className="customer-list-address"
                          data-label="Địa chỉ"
                        >
                          <EnvironmentOutlined />

                          <span>
                            {address ||
                              "Chưa cập nhật địa chỉ"}
                          </span>
                        </div>

                        <div
                          className="customer-list-status-cell"
                          data-label="Trạng thái"
                        >
                          <Tag
                            className={`customer-status-tag ${status.className}`}
                          >
                            {status.label}
                          </Tag>
                        </div>

                        <div
                          className="customer-list-date"
                          data-label="Ngày tham gia"
                        >
                          {formatDate(
                            customer?.createdAt
                          )}
                        </div>

                        <div
                          className="customer-list-actions"
                          data-label="Thao tác"
                        >
                          <Tooltip title="Xem chi tiết">
                            <Button
                              className="customer-action-button is-view"
                              aria-label="Xem chi tiết"
                              icon={<VisibilityRoundedIcon />}
                              onClick={() => handleOpenDetail(customer)}
                            />
                          </Tooltip>

                          <Tooltip title="Chỉnh sửa">
                            <Button
                              className="customer-action-button is-edit"
                              aria-label="Chỉnh sửa khách hàng"
                              icon={<EditRoundedIcon />}
                              onClick={() => handleOpenEdit(customer)}
                            />
                          </Tooltip>

                          <Tooltip title="Xóa khách hàng">
                            <Button
                              className="customer-action-button is-delete"
                              aria-label="Xóa khách hàng"
                              icon={<DeleteOutlineRoundedIcon />}
                              onClick={() => handleDeleteCustomer(customer)}
                            />
                          </Tooltip>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            </div>

            <div className="customer-list-pagination">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={
                  filteredCustomers.length
                }
                showSizeChanger
                pageSizeOptions={[
                  10,
                  20,
                  50,
                ]}
                showTotal={(total) =>
                  `${total} khách hàng`
                }
                onChange={(
                  nextPage,
                  nextPageSize
                ) => {
                  setCurrentPage(nextPage);
                  setPageSize(
                    nextPageSize
                  );
                }}
              />
            </div>
          </>
        )}
      </section>

      <CustomerDetailModal
        open={detailOpen}
        customerId={
          selectedCustomerId
        }
        initialCustomer={
          selectedCustomer
        }
        onClose={handleCloseDetail}
      />

      <CreateCustomerSale
        open={createOpen}
        customers={customers}
        onClose={() => {
          setCreateOpen(false);
        }}
        onSaved={async (savedCustomer) => {
          setCreateOpen(false);
          setSearchKeyword("");
          setStatusFilter("ALL");
          setCurrentPage(1);

          const refreshedCustomers = await loadCustomers();
          const createdCustomer = normalizeCustomerRecord(savedCustomer);
          const createdId = normalizeText(createdCustomer?.id);
          const createdEmail = normalizeText(createdCustomer?.email).toLowerCase();
          const createdPhone = normalizeText(createdCustomer?.phone).replace(/\D/g, "");

          const createdIndex = refreshedCustomers.findIndex((customer) => {
            const customerId = normalizeText(customer?.id);
            const customerEmail = normalizeText(customer?.email).toLowerCase();
            const customerPhone = normalizeText(customer?.phone).replace(/\D/g, "");

            return (
              (createdId && customerId === createdId) ||
              (createdEmail && customerEmail === createdEmail) ||
              (createdPhone && customerPhone === createdPhone)
            );
          });

          if (createdIndex >= 0) {
            const newestCustomer = refreshedCustomers[createdIndex];
            setCustomers([
              newestCustomer,
              ...refreshedCustomers.filter((_, index) => index !== createdIndex),
            ]);
          } else if (createdCustomer?.id) {
            setCustomers([
              createdCustomer,
              ...refreshedCustomers.filter(
                (customer) => normalizeText(customer?.id) !== createdId
              ),
            ]);
          }
        }}
      />

      <EditCustomerSale
        open={editOpen}
        customer={editingCustomer}
        customers={customers}
        onClose={() => {
          setEditOpen(false);
          setEditingCustomer(null);
        }}
        onSaved={async () => {
          setEditOpen(false);
          setEditingCustomer(null);
          await loadCustomers();
        }}
      />
    </main>
  );
}
