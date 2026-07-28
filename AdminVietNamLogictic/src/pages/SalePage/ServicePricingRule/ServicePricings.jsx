import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Button,
  ConfigProvider,
  Empty,
  Input,
  Modal,
  Select,
  Skeleton,
  Tabs,
  Tag,
  Tooltip,
} from "antd";
import {
  CalculatorOutlined,
  CalendarOutlined,
  DollarOutlined,
  EyeOutlined,
  GlobalOutlined,
  InboxOutlined,
  PercentageOutlined,
  ReloadOutlined,
  SearchOutlined,
  TagsOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import {
  PRICING_RULE_CODE,
  getActivePricingRulesApi,
  getPricingRuleDetailApi,
} from "../../../api/SaleAPI/ConsignmentAPI/pricingRuleService";
import {
  formatVnd,
  getServicePricingDetailApi,
  getServicePricingsApi,
} from "../../../api/SaleAPI/ConsignmentAPI/servicePricingService";

import {
  getActivePackageConfigurationsApi,
} from "../../../api/SaleAPI/ConsignmentAPI/packageConfigurationService";
import AuthNotify from "../../../utils/Common/AuthNotify";

import "./ServicePricings.css";

const SERVICE_PRICINGS_FONT_FAMILY = [
  "-apple-system",
  "BlinkMacSystemFont",
  '"Segoe UI"',
  "Roboto",
  '"Helvetica Neue"',
  "Arial",
  "sans-serif",
].join(", ");

const SERVICE_PRICINGS_THEME = {
  token: {
    fontFamily:
      SERVICE_PRICINGS_FONT_FAMILY,
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

    Tabs: {
      titleFontSize: 14,
      horizontalItemPadding: "12px 0",
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

const SERVICE_OPTIONS = [
  {
    value: "ALL",
    label: "Tất cả dịch vụ",
  },
  {
    value: "Express",
    label: "Hỏa tốc",
  },
  {
    value: "Standard",
    label: "Tiêu chuẩn",
  },
  {
    value: "Economy",
    label: "Tiết kiệm",
  },
];

const COUNTRY_OPTIONS = [
  {
    value: "ALL",
    label: "Tất cả quốc gia",
  },
  {
    value: "CN",
    label: "Trung Quốc",
  },
  {
    value: "KR",
    label: "Hàn Quốc",
  },
  {
    value: "JP",
    label: "Nhật Bản",
  },
  {
    value: "VN",
    label: "Việt Nam",
  },
];

const normalizeText = (value) =>
  String(value ?? "").trim();

const UNIT_TYPE_LABELS = {
  KG: "Theo kg",
  KILOGRAM: "Theo kg",
  M3: "Theo m³",
  CBM: "Theo m³",
  PACKAGE: "Theo kiện",
  PARCEL: "Theo kiện",
  ORDER: "Theo đơn",
  ITEM: "Theo sản phẩm",
  BOX: "Theo thùng",
};

const RULE_CODE_LABELS = {
  WOOD_CRATE: "Phí đóng thùng gỗ",
  DOMESTIC_FEE:
    "Phí vận chuyển nội địa",
  VAT: "Thuế giá trị gia tăng",
  VOLUMETRIC_DIVISOR:
    "Hệ số khối lượng thể tích",
  SUR_INSPECTION:
    "Phụ phí kiểm hàng",
  IMPORT_TAX: "Thuế nhập khẩu",
  SUR_INSURANCE_3PERCENT:
    "Phụ phí bảo hiểm",
};

const RULE_TYPE_LABELS = {
  WOOD_BOX: "Đóng kiện gỗ",
  WOOD_CRATE: "Đóng kiện gỗ",
  DOMESTIC: "Vận chuyển nội địa",
  DOMESTIC_FEE:
    "Vận chuyển nội địa",
  VAT: "Thuế giá trị gia tăng",
  TAX: "Thuế và nghĩa vụ",
  VOLUMETRIC:
    "Khối lượng thể tích",
  VOLUMETRIC_WEIGHT:
    "Khối lượng thể tích",
  INSPECTION: "Kiểm hàng",
  IMPORT_TAX: "Thuế nhập khẩu",
  INSURANCE: "Bảo hiểm",
  SURCHARGE: "Phụ phí",
};

const getUnitTypeDisplayName = (
  value
) => {
  const normalized =
    normalizeText(value).toUpperCase();

  return (
    UNIT_TYPE_LABELS[normalized] ||
    normalizeText(value) ||
    "Theo cấu hình"
  );
};

const getRuleCodeDisplayName = (
  rule
) => {
  const code =
    normalizeText(
      rule?.ruleCode
    ).toUpperCase();

  return (
    RULE_CODE_LABELS[code] ||
    normalizeText(rule?.ruleName) ||
    "Quy tắc tính phí"
  );
};

const getRuleTypeDisplayName = (
  value
) => {
  const normalized =
    normalizeText(value).toUpperCase();

  return (
    RULE_TYPE_LABELS[normalized] ||
    "Phụ phí theo cấu hình"
  );
};

const getPackageDimensionDisplay = (
  configuration
) => {
  const code =
    normalizeText(
      configuration?.configCode
    ).toUpperCase();

  if (code === "CUSTOM") {
    return "Theo kích thước thực tế";
  }

  const length =
    Number(configuration?.length) || 0;
  const width =
    Number(configuration?.width) || 0;
  const height =
    Number(configuration?.height) || 0;

  return `${length} × ${width} × ${height} cm`;
};

const formatRuleValue = (rule) => {
  if (
    rule?.calculationType ===
    "PERCENTAGE"
  ) {
    return `${rule.value}%`;
  }

  if (
    rule?.ruleCode ===
    PRICING_RULE_CODE.VOLUMETRIC_DIVISOR
  ) {
    return new Intl.NumberFormat(
      "vi-VN"
    ).format(rule.value);
  }

  return formatVnd(rule?.value);
};

const getRuleValueUnit = (rule) => {
  if (
    rule?.calculationType ===
    "PERCENTAGE"
  ) {
    return "Tỷ lệ";
  }

  if (
    rule?.ruleCode ===
    PRICING_RULE_CODE.VOLUMETRIC_DIVISOR
  ) {
    return "Hệ số";
  }

  return "Mức phí";
};

function ServicePricingsLoading() {
  return (
    <ConfigProvider
      theme={SERVICE_PRICINGS_THEME}
    >
      <main className="service-pricings-page">
        <div className="service-pricings-loading">
          <Skeleton.Input
            active
            size="large"
          />

          <Skeleton
            active
            paragraph={{ rows: 9 }}
          />
        </div>
      </main>
    </ConfigProvider>
  );
}

export default function ServicePricings() {
  const [servicePricings, setServicePricings] =
    useState([]);
  const [pricingRules, setPricingRules] =
    useState([]);

  const [
    packageConfigurations,
    setPackageConfigurations,
  ] = useState([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  const [activeTab, setActiveTab] =
    useState("service-pricings");

  const [keyword, setKeyword] =
    useState("");
  const [serviceType, setServiceType] =
    useState("ALL");
  const [originCountry, setOriginCountry] =
    useState("ALL");

  const [detailOpen, setDetailOpen] =
    useState(false);
  const [detailType, setDetailType] =
    useState("");
  const [detailLoading, setDetailLoading] =
    useState(false);
  const [selectedDetail, setSelectedDetail] =
    useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [
        servicePricingResult,
        pricingRuleResult,
        packageConfigurationResult,
      ] = await Promise.allSettled([
        getServicePricingsApi(),
        getActivePricingRulesApi(),
        getActivePackageConfigurationsApi(),
      ]);

      if (
        servicePricingResult.status ===
        "fulfilled"
      ) {
        setServicePricings(
          Array.isArray(
            servicePricingResult.value
          )
            ? servicePricingResult.value
            : []
        );
      } else {
        throw servicePricingResult.reason;
      }

      if (
        pricingRuleResult.status ===
        "fulfilled"
      ) {
        setPricingRules(
          Array.isArray(
            pricingRuleResult.value
          )
            ? pricingRuleResult.value
            : []
        );
      } else {
        console.error(
          "GET PRICING RULES ERROR:",
          pricingRuleResult.reason
        );

        setPricingRules([]);

        AuthNotify.warning(
          "Thiếu một phần dữ liệu",
          "Không tải được danh sách quy tắc tính phí."
        );
      }


      if (
        packageConfigurationResult.status ===
        "fulfilled"
      ) {
        setPackageConfigurations(
          Array.isArray(
            packageConfigurationResult.value
          )
            ? packageConfigurationResult.value
            : []
        );
      } else {
        console.error(
          "GET PACKAGE CONFIGURATIONS ERROR:",
          packageConfigurationResult.reason
        );

        setPackageConfigurations([]);

        AuthNotify.warning(
          "Thiếu một phần dữ liệu",
          "Không tải được danh sách cấu hình đóng gói."
        );
      }
    } catch (requestError) {
      console.error(
        "GET SERVICE PRICINGS ERROR:",
        requestError
      );

      const message =
        requestError?.response?.data?.message ||
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Không thể tải dữ liệu phí dịch vụ.";

      setError(message);
      setServicePricings([]);
      setPricingRules([]);
      setPackageConfigurations([]);

      AuthNotify.error(
        "Tải dữ liệu thất bại",
        message
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      loadData,
      0
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadData]);

  const filteredPricings = useMemo(() => {
    const normalizedKeyword =
      keyword.trim().toLowerCase();

    return servicePricings.filter(
      (pricing) => {
        const matchesKeyword =
          !normalizedKeyword ||
          [
            pricing?.serviceTypeDisplayName,
            pricing?.routeDisplayName,
            pricing?.formattedPrice,
            pricing?.unitType,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedKeyword);

        const matchesServiceType =
          serviceType === "ALL" ||
          normalizeText(
            pricing?.serviceType
          ).toLowerCase() ===
            serviceType.toLowerCase();

        const matchesOrigin =
          originCountry === "ALL" ||
          normalizeText(
            pricing?.originCountry
          ).toUpperCase() ===
            originCountry;

        return (
          matchesKeyword &&
          matchesServiceType &&
          matchesOrigin
        );
      }
    );
  }, [
    servicePricings,
    keyword,
    serviceType,
    originCountry,
  ]);

  const filteredRules = useMemo(() => {
    const normalizedKeyword =
      keyword.trim().toLowerCase();

    return pricingRules.filter((rule) => {
      return (
        !normalizedKeyword ||
        [
          rule?.ruleName,
          rule?.ruleCode,
          rule?.ruleType,
          rule?.description,
          rule?.calculationTypeDisplayName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword)
      );
    });
  }, [pricingRules, keyword]);

  const filteredPackageConfigurations =
    useMemo(() => {
      const normalizedKeyword =
        keyword.trim().toLowerCase();

      return packageConfigurations.filter(
        (configuration) => {
          const dimension =
            getPackageDimensionDisplay(
              configuration
            );

          return (
            !normalizedKeyword ||
            [
              configuration?.displayName,
              configuration?.configName,
              configuration?.configCode,
              dimension,
              configuration?.maxWeight,
              configuration?.packageFee,
            ]
              .join(" ")
              .toLowerCase()
              .includes(
                normalizedKeyword
              )
          );
        }
      );
    }, [
      packageConfigurations,
      keyword,
    ]);

  const statistics = useMemo(() => {
    const expressCount =
      servicePricings.filter(
        (item) =>
          normalizeText(
            item?.serviceType
          ).toLowerCase() ===
          "express"
      ).length;

    const standardCount =
      servicePricings.filter(
        (item) =>
          normalizeText(
            item?.serviceType
          ).toLowerCase() ===
          "standard"
      ).length;

    const routes = new Set(
      servicePricings
        .map(
          (item) =>
            item?.routeDisplayName
        )
        .filter(Boolean)
    );

    return {
      totalPricings:
        servicePricings.length,
      expressCount,
      standardCount,
      routeCount: routes.size,
      ruleCount: pricingRules.length,

      packageConfigurationCount:
        packageConfigurations.length,
    };
  }, [
    servicePricings,
    pricingRules,
    packageConfigurations,
  ]);

  const handleOpenPricingDetail =
    async (pricing) => {
      if (!pricing?.id) {
        return;
      }

      try {
        setDetailType("pricing");
        setSelectedDetail(pricing);
        setDetailOpen(true);
        setDetailLoading(true);

        const detail =
          await getServicePricingDetailApi(
            pricing.id
          );

        setSelectedDetail(
          detail || pricing
        );
      } catch (requestError) {
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

  const handleOpenRuleDetail =
    async (rule) => {
      if (!rule?.id) {
        return;
      }

      try {
        setDetailType("rule");
        setSelectedDetail(rule);
        setDetailOpen(true);
        setDetailLoading(true);

        const detail =
          await getPricingRuleDetailApi(
            rule.id
          );

        setSelectedDetail(
          detail || rule
        );
      } catch (requestError) {
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
    setDetailType("");
    setSelectedDetail(null);
  };

  const resetFilters = () => {
    setKeyword("");
    setServiceType("ALL");
    setOriginCountry("ALL");
  };

  if (loading) {
    return <ServicePricingsLoading />;
  }

  return (
    <ConfigProvider
      theme={SERVICE_PRICINGS_THEME}
    >
      <main className="service-pricings-page">
      <section className="service-pricings-hero">
        <div>
          <span>
            CẤU HÌNH CHI PHÍ LOGISTICS
          </span>

          <h1>
            Phí dịch vụ và quy tắc tính phí
          </h1>

          <p>
            Theo dõi bảng giá vận chuyển
            theo tuyến, loại dịch vụ và các
            quy tắc phụ phí đang được hệ
            thống áp dụng.
          </p>
        </div>

        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={loadData}
          className="service-pricings-refresh"
        >
          Tải lại dữ liệu
        </Button>
      </section>

      <section className="service-pricings-stats">
        <article>
          <div className="service-pricings-stat__icon">
            <DollarOutlined />
          </div>
          <div>
            <span>Bảng giá</span>
            <strong>
              {statistics.totalPricings}
            </strong>
          </div>
        </article>

        <article>
          <div className="service-pricings-stat__icon is-express">
            <ThunderboltOutlined />
          </div>
          <div>
            <span>Hỏa tốc</span>
            <strong>
              {statistics.expressCount}
            </strong>
          </div>
        </article>

        <article>
          <div className="service-pricings-stat__icon is-standard">
            <TagsOutlined />
          </div>
          <div>
            <span>Tiêu chuẩn</span>
            <strong>
              {statistics.standardCount}
            </strong>
          </div>
        </article>

        <article>
          <div className="service-pricings-stat__icon is-route">
            <GlobalOutlined />
          </div>
          <div>
            <span>Số tuyến</span>
            <strong>
              {statistics.routeCount}
            </strong>
          </div>
        </article>

        <article>
          <div className="service-pricings-stat__icon is-rule">
            <CalculatorOutlined />
          </div>
          <div>
            <span>Quy tắc phí</span>
            <strong>
              {statistics.ruleCount}
            </strong>
          </div>
        </article>

        <article>
          <div className="service-pricings-stat__icon is-package">
            <InboxOutlined />
          </div>
          <div>
            <span>Cấu hình đóng gói</span>
            <strong>
              {
                statistics
                  .packageConfigurationCount
              }
            </strong>
          </div>
        </article>
      </section>

      <section className="service-pricings-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="service-pricings-tabs"
          items={[
            {
              key: "service-pricings",
              label: (
                <span>
                  <DollarOutlined />
                  Bảng giá vận chuyển
                </span>
              ),
            },
            {
              key: "pricing-rules",
              label: (
                <span>
                  <CalculatorOutlined />
                  Quy tắc tính phí
                </span>
              ),
            },
            {
              key: "package-configurations",
              label: (
                <span>
                  <InboxOutlined />
                  Cấu hình đóng gói
                </span>
              ),
            },
          ]}
        />

        <div className="service-pricings-toolbar">
          <Input
            allowClear
            value={keyword}
            prefix={<SearchOutlined />}
            placeholder={
              activeTab ===
              "service-pricings"
                ? "Tìm dịch vụ, tuyến hoặc mức giá..."
                : activeTab ===
                    "pricing-rules"
                  ? "Tìm tên quy tắc, nhóm phí hoặc mô tả..."
                  : "Tìm cấu hình, kích thước, khối lượng hoặc mức phí..."
            }
            onChange={(event) =>
              setKeyword(
                event.target.value
              )
            }
          />

          {activeTab ===
            "service-pricings" && (
            <>
              <Select
                value={serviceType}
                options={SERVICE_OPTIONS}
                onChange={setServiceType}
              />

              <Select
                value={originCountry}
                options={COUNTRY_OPTIONS}
                onChange={setOriginCountry}
              />
            </>
          )}

          <Button
            type="text"
            onClick={resetFilters}
          >
            Xóa bộ lọc
          </Button>
        </div>

        <div className="service-pricings-data-scroll">
          {error ? (
          <div className="service-pricings-error">
            <h2>Không thể tải dữ liệu</h2>
            <p>{error}</p>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadData}
            >
              Thử lại
            </Button>
          </div>
        ) : activeTab ===
          "service-pricings" ? (
          filteredPricings.length === 0 ? (
            <div className="service-pricings-empty">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không tìm thấy bảng giá phù hợp"
              />
            </div>
          ) : (
            <div className="service-pricings-table-wrapper">
              <table className="service-pricings-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Dịch vụ</th>
                    <th>Tuyến vận chuyển</th>
                    <th>Đơn vị</th>
                    <th>Đơn giá</th>
                    <th>Ngày hiệu lực</th>
                    <th aria-label="Thao tác" />
                  </tr>
                </thead>

                <tbody>
                  {filteredPricings.map(
                    (pricing, index) => (
                      <tr key={pricing.id}>
                        <td>
                          <span className="service-pricings-index">
                            {index + 1}
                          </span>
                        </td>

                        <td>
                          <Tag
                            className={`service-pricings-service-type ${
                              normalizeText(
                                pricing.serviceType
                              ).toLowerCase() ===
                              "express"
                                ? "is-express"
                                : "is-standard"
                            }`}
                          >
                            {
                              pricing.serviceTypeDisplayName
                            }
                          </Tag>
                        </td>

                        <td>
                          <div className="service-pricings-route">
                            <GlobalOutlined />
                            <strong>
                              {
                                pricing.routeDisplayName
                              }
                            </strong>
                          </div>
                        </td>

                        <td>
                          <span className="service-pricings-unit">
                            {
                              getUnitTypeDisplayName(
                                pricing.unitType
                              )
                            }
                          </span>
                        </td>

                        <td>
                          <strong className="service-pricings-price">
                            {
                              pricing.formattedPrice
                            }
                          </strong>
                        </td>

                        <td>
                          <span className="service-pricings-date">
                            <CalendarOutlined />
                            {
                              pricing.effectiveDateDisplay
                            }
                          </span>
                        </td>

                        <td>
                          <Tooltip title="Xem chi tiết">
                            <Button
                              type="text"
                              shape="circle"
                              icon={<EyeOutlined />}
                              onClick={() =>
                                handleOpenPricingDetail(
                                  pricing
                                )
                              }
                            />
                          </Tooltip>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab ===
          "pricing-rules" ? (
          filteredRules.length === 0 ? (
          <div className="service-pricings-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Không tìm thấy quy tắc tính phí"
            />
          </div>
        ) : (
          <div className="service-pricings-rules-grid">
            {filteredRules.map((rule) => (
              <article
                key={rule.id}
                className="service-pricings-rule-card"
              >
                <div className="service-pricings-rule-card__header">
                  <div className="service-pricings-rule-card__icon">
                    {rule.calculationType ===
                    "PERCENTAGE" ? (
                      <PercentageOutlined />
                    ) : (
                      <CalculatorOutlined />
                    )}
                  </div>

                  <div>
                    <span>
                      {
                        getRuleCodeDisplayName(
                          rule
                        )
                      }
                    </span>
                    <h3>
                      {rule.ruleName}
                    </h3>
                  </div>

                  <Tag className="service-pricings-rule-status">
                    Đang áp dụng
                  </Tag>
                </div>

                <p>
                  {rule.description ||
                    "Không có mô tả."}
                </p>

                <div className="service-pricings-rule-card__metrics">
                  <div>
                    <span>
                      {getRuleValueUnit(
                        rule
                      )}
                    </span>
                    <strong>
                      {formatRuleValue(
                        rule
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Cách tính</span>
                    <strong>
                      {
                        rule.calculationTypeDisplayName
                      }
                    </strong>
                  </div>
                </div>

                <Button
                  type="text"
                  icon={<EyeOutlined />}
                  onClick={() =>
                    handleOpenRuleDetail(
                      rule
                    )
                  }
                >
                  Xem chi tiết
                </Button>
              </article>
            ))}
          </div>
          )
        ) : filteredPackageConfigurations.length ===
          0 ? (
          <div className="service-pricings-empty">
            <Empty
              image={
                Empty.PRESENTED_IMAGE_SIMPLE
              }
              description="Không tìm thấy cấu hình đóng gói phù hợp"
            />
          </div>
        ) : (
          <div className="service-pricings-package-table-wrapper">
            <table className="service-pricings-package-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Cấu hình đóng gói</th>
                  <th>Kích thước</th>
                  <th>Khối lượng tối đa</th>
                  <th>Phí đóng gói</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>

              <tbody>
                {filteredPackageConfigurations.map(
                  (
                    configuration,
                    index
                  ) => (
                    <tr
                      key={
                        configuration.id
                      }
                    >
                      <td>
                        <span className="service-pricings-index">
                          {index + 1}
                        </span>
                      </td>

                      <td>
                        <div className="service-pricings-package-name">
                          <span className="service-pricings-package-icon">
                            <InboxOutlined />
                          </span>

                          <div>
                            <strong>
                              {
                                configuration.displayName
                              }
                            </strong>

                            <small>
                              Cấu hình đóng gói
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <strong className="service-pricings-package-dimension">
                          {
                            getPackageDimensionDisplay(
                              configuration
                            )
                          }
                        </strong>
                      </td>

                      <td>
                        <span className="service-pricings-package-weight">
                          {Number(
                            configuration.maxWeight
                          ).toLocaleString(
                            "vi-VN"
                          )}{" "}
                          kg
                        </span>
                      </td>

                      <td>
                        <strong className="service-pricings-price">
                          {formatVnd(
                            configuration
                              .estimatedFee ??
                              configuration
                                .packageFee
                          )}
                        </strong>
                      </td>

                      <td>
                        <Tag className="service-pricings-package-status">
                          Đang áp dụng
                        </Tag>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </section>

      <Modal
        open={detailOpen}
        centered
        width={660}
        footer={null}
        title={null}
        destroyOnHidden
        className="service-pricings-detail-modal"
        onCancel={handleCloseDetail}
      >
        {detailLoading ? (
          <Skeleton
            active
            paragraph={{ rows: 7 }}
          />
        ) : selectedDetail ? (
          detailType === "pricing" ? (
            <div className="service-pricings-detail">
              <div className="service-pricings-detail__hero">
                <DollarOutlined />
                <div>
                  <span>
                    CHI TIẾT BẢNG GIÁ
                  </span>
                  <h2>
                    {
                      selectedDetail.serviceTypeDisplayName
                    }
                  </h2>
                </div>
              </div>

              <div className="service-pricings-detail__grid">
                <article>
                  <span>Tuyến vận chuyển</span>
                  <strong>
                    {
                      selectedDetail.routeDisplayName
                    }
                  </strong>
                </article>

                <article>
                  <span>Loại dịch vụ</span>
                  <strong>
                    {
                      selectedDetail.serviceTypeDisplayName
                    }
                  </strong>
                </article>

                <article>
                  <span>Đơn vị tính</span>
                  <strong>
                    {
                      selectedDetail.unitType
                    }
                  </strong>
                </article>

                <article>
                  <span>Ngày hiệu lực</span>
                  <strong>
                    {
                      selectedDetail.effectiveDateDisplay
                    }
                  </strong>
                </article>

                <article className="is-full is-price">
                  <span>Đơn giá áp dụng</span>
                  <strong>
                    {
                      selectedDetail.formattedPrice
                    }
                  </strong>
                </article>
              </div>

              <div className="service-pricings-detail__actions">
                <Button onClick={handleCloseDetail}>
                  Đóng
                </Button>
              </div>
            </div>
          ) : (
            <div className="service-pricings-detail">
              <div className="service-pricings-detail__hero is-rule">
                <CalculatorOutlined />
                <div>
                  <span>
                    CHI TIẾT QUY TẮC TÍNH PHÍ
                  </span>
                  <h2>
                    {selectedDetail.ruleName}
                  </h2>
                </div>
              </div>

              <div className="service-pricings-detail__grid">
                <article>
                  <span>Nhóm phí</span>
                  <strong>
                    {
                      getRuleCodeDisplayName(
                        selectedDetail
                      )
                    }
                  </strong>
                </article>

                <article>
                  <span>Loại quy tắc</span>
                  <strong>
                    {
                      getRuleTypeDisplayName(
                        selectedDetail.ruleType
                      )
                    }
                  </strong>
                </article>

                <article>
                  <span>Cách tính</span>
                  <strong>
                    {
                      selectedDetail.calculationTypeDisplayName
                    }
                  </strong>
                </article>

                <article>
                  <span>
                    {getRuleValueUnit(
                      selectedDetail
                    )}
                  </span>
                  <strong>
                    {formatRuleValue(
                      selectedDetail
                    )}
                  </strong>
                </article>

                <article>
                  <span>Phí tối thiểu</span>
                  <strong>
                    {selectedDetail.minAmount ===
                    null
                      ? "Không áp dụng"
                      : formatVnd(
                          selectedDetail.minAmount
                        )}
                  </strong>
                </article>

                <article>
                  <span>Phí tối đa</span>
                  <strong>
                    {selectedDetail.maxAmount ===
                    null
                      ? "Không áp dụng"
                      : formatVnd(
                          selectedDetail.maxAmount
                        )}
                  </strong>
                </article>

                <article className="is-full">
                  <span>Mô tả</span>
                  <p>
                    {selectedDetail.description ||
                      "Không có mô tả."}
                  </p>
                </article>
              </div>

              <div className="service-pricings-detail__actions">
                <Button onClick={handleCloseDetail}>
                  Đóng
                </Button>
              </div>
            </div>
          )
        ) : null}
      </Modal>
      </main>
    </ConfigProvider>
  );
}
