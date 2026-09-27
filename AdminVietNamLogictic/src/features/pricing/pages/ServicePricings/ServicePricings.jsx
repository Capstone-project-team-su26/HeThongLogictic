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
  ClockCircleOutlined,
  DollarOutlined,
  EyeOutlined,
  GlobalOutlined,
  InboxOutlined,
  PercentageOutlined,
  ReloadOutlined,
  SearchOutlined,
  SwapOutlined,
  TagsOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

/*
 * MỌI TAB ĐỌC API THẬT (27/09/2026): quy tắc tính phí (GET /api/pricing-rules), bảng giá dịch
 * vụ (GET /api/service-pricings), cấu hình kiện (GET /api/package-configurations), tỷ giá
 * (GET /api/exchange-rates?activeOnly=true). Không còn bản *.mock, không còn tỷ giá mặc định.
 */
import {
  getActivePricingRulesApi,
  getPricingRuleDetailApi,
} from "@features/pricing/api/pricingRuleService";
import {
  formatVnd,
  getServicePricingDetailApi,
  getServicePricingsApi,
} from "@features/pricing/api/servicePricingService";
import {
  getExchangeRatesApi,
} from "@features/pricing/api/exchangeRateService";

import {
  getActivePackageConfigurationsApi,
} from "@features/pricing/api/packageConfigurationService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";

import {
  COUNTRY_OPTIONS,
  SERVICE_OPTIONS,
  SERVICE_PRICINGS_THEME,
} from "./ServicePricings.constants";
import {
  formatRuleValue,
  getRuleCalculationDisplay,
  isSystemParameterRule,
  getForeignCurrencyEstimate,
  getPackageDimensionDisplay,
  getRuleCodeDisplayName,
  getRuleTypeDisplayName,
  getRuleValueUnit,
  getUnitTypeDisplayName,
  normalizeText,
} from "./ServicePricings.helpers";

import "./ServicePricings.css";

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
  const [servicePricings, setServicePricings] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [packageConfigurations, setPackageConfigurations] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("service-pricings");

  const [keyword, setKeyword] = useState("");
  const [serviceType, setServiceType] = useState("ALL");
  const [originCountry, setOriginCountry] = useState("ALL");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [
        servicePricingResult,
        pricingRuleResult,
        packageConfigurationResult,
        exchangeRateResult,
      ] = await Promise.allSettled([
        getServicePricingsApi(),
        getActivePricingRulesApi(),
        getActivePackageConfigurationsApi(),
        getExchangeRatesApi({ activeOnly: true }),
      ]);

      if (servicePricingResult.status === "fulfilled") {
        setServicePricings(
          Array.isArray(servicePricingResult.value) ? servicePricingResult.value : []
        );
      } else {
        throw servicePricingResult.reason;
      }

      /* Không có tỷ giá mặc định: lỗi thì để trống + cảnh báo, không bịa số. */
      if (exchangeRateResult.status === "fulfilled") {
        const val = exchangeRateResult.value;
        setExchangeRates(Array.isArray(val) ? val : []);
      } else {
        console.error("GET EXCHANGE RATES ERROR:", exchangeRateResult.reason);
        setExchangeRates([]);
        AuthNotify.warning(
          "Thiếu một phần dữ liệu",
          "Không tải được danh sách tỷ giá hối đoái."
        );
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
            {
              key: "exchange-rates",
              label: (
                <span>
                  <SwapOutlined />
                  Tỷ giá ngoại tệ hối đoái ({exchangeRates.length})
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
              activeTab === "service-pricings"
                ? "Tìm theo dịch vụ, tuyến vận chuyển..."
                : activeTab === "pricing-rules"
                ? "Tìm theo tên, mã quy tắc..."
                : activeTab === "package-configurations"
                ? "Tìm theo mã, tên cấu hình..."
                : "Tìm theo mã ngoại tệ (CNY, JPY, KRW, USD)..."
            }
            onChange={(e) => setKeyword(e.target.value)}
            className="service-pricings-search"
          />

          {activeTab === "service-pricings" && (
            <>
              <Select
                value={serviceType}
                options={SERVICE_OPTIONS}
                onChange={setServiceType}
                className="service-pricings-select"
              />

              <Select
                value={originCountry}
                options={COUNTRY_OPTIONS}
                onChange={setOriginCountry}
                className="service-pricings-select"
              />
            </>
          )}
        </div>

        <div className="service-pricings-content">
          {error ? (
            <div className="service-pricings-error">
              <p>{error}</p>
              <Button type="primary" onClick={loadData}>
                Thử lại
              </Button>
            </div>
          ) : activeTab === "service-pricings" ? (
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
                      <th>Đơn giá VNĐ & Quy đổi</th>
                      <th>Ngày hiệu lực</th>
                      <th aria-label="Thao tác" />
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPricings.map((pricing, index) => (
                      <tr key={pricing.id}>
                        <td>
                          <span className="service-pricings-index">
                            {index + 1}
                          </span>
                        </td>

                        <td>
                          <Tag
                            className={`service-pricings-service-type ${
                              normalizeText(pricing.serviceType).toLowerCase() === "express"
                                ? "is-express"
                                : "is-standard"
                            }`}
                          >
                            {pricing.serviceTypeDisplayName}
                          </Tag>
                        </td>

                        <td>
                          <div className="service-pricings-route">
                            <GlobalOutlined />
                            <strong>{pricing.routeDisplayName}</strong>
                          </div>
                        </td>

                        <td>
                          <span className="service-pricings-unit">
                            {getUnitTypeDisplayName(pricing.unitType)}
                          </span>
                        </td>

                        <td>
                          <div className="service-pricings-price-wrapper">
                            <strong className="service-pricings-price">
                              {pricing.formattedPrice}
                            </strong>
                            {(() => {
                              const est = getForeignCurrencyEstimate(
                                pricing.price,
                                pricing.routeCode || pricing.routeDisplayName,
                                exchangeRates
                              );
                              if (!est) return null;
                              return (
                                <span className="foreign-estimate-tag">
                                  {est.flag} {est.amount} {est.code}
                                </span>
                              );
                            })()}
                          </div>
                        </td>

                        <td>
                          <span className="service-pricings-date">
                            <CalendarOutlined />
                            {pricing.effectiveDateDisplay}
                          </span>
                        </td>

                        <td>
                          <Tooltip title="Xem chi tiết">
                            <Button
                              type="text"
                              shape="circle"
                              icon={<EyeOutlined />}
                              onClick={() => handleOpenPricingDetail(pricing)}
                            />
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : activeTab === "pricing-rules" ? (
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
                  <article key={rule.id} className="service-pricings-rule-card">
                    <div className="service-pricings-rule-card__header">
                      <div className="service-pricings-rule-card__icon">
                        {rule.calculationType === "PERCENTAGE" ? (
                          <PercentageOutlined />
                        ) : (
                          <CalculatorOutlined />
                        )}
                      </div>

                      <div>
                        <span>{getRuleCodeDisplayName(rule)}</span>
                        <h3>{rule.ruleName}</h3>
                      </div>

                      <Tag className="service-pricings-rule-status">
                        Đang áp dụng
                      </Tag>
                    </div>

                    <p>{rule.description || "Không có mô tả."}</p>

                    <div className="service-pricings-rule-card__metrics">
                      <div>
                        <span>{getRuleValueUnit(rule)}</span>
                        <strong>{formatRuleValue(rule)}</strong>
                      </div>

                      <div>
                        <span>Cách tính</span>
                        <strong>{getRuleCalculationDisplay(rule)}</strong>
                      </div>
                    </div>

                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => handleOpenRuleDetail(rule)}
                    >
                      Xem chi tiết
                    </Button>
                  </article>
                ))}
              </div>
            )
          ) : activeTab === "package-configurations" ? (
            filteredPackageConfigurations.length === 0 ? (
              <div className="service-pricings-empty">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
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
                    {filteredPackageConfigurations.map((configuration, index) => (
                      <tr key={configuration.id}>
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
                              <strong>{configuration.displayName}</strong>
                              <small>Cấu hình đóng gói</small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <strong className="service-pricings-package-dimension">
                            {getPackageDimensionDisplay(configuration)}
                          </strong>
                        </td>

                        <td>
                          <span className="service-pricings-package-weight">
                            {Number(configuration.maxWeight).toLocaleString("vi-VN")} kg
                          </span>
                        </td>

                        <td>
                          <strong className="service-pricings-price">
                            {formatVnd(
                              configuration.estimatedFee ?? configuration.packageFee
                            )}
                          </strong>
                        </td>

                        <td>
                          <Tag className="service-pricings-package-status">
                            Đang áp dụng
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : activeTab === "exchange-rates" ? (
            exchangeRates.length === 0 ? (
              <div className="service-pricings-empty">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Không tìm thấy tỷ giá hối đoái"
                />
              </div>
            ) : (
              <div className="service-pricings-rates-grid">
                {exchangeRates.map((rate) => {
                  const code = String(rate.currencyCode || "").toUpperCase();
                  let flag = "🌐";
                  let countryName = "Ngoại tệ";
                  if (code === "CNY") { flag = "🇨🇳"; countryName = "Nhân dân tệ (Trung Quốc)"; }
                  else if (code === "JPY") { flag = "🇯🇵"; countryName = "Yên Nhật (Nhật Bản)"; }
                  else if (code === "KRW") { flag = "🇰🇷"; countryName = "Won Hàn Quốc (Hàn Quốc)"; }
                  else if (code === "USD") { flag = "🇺🇸"; countryName = "Đô la Mỹ (Hoa Kỳ)"; }

                  return (
                    <article key={rate.id || code} className="exchange-rate-card">
                      <div className="rate-card-header">
                        <span className="rate-flag">{flag}</span>
                        <div>
                          <h3>1 {code}</h3>
                          <span>{countryName}</span>
                        </div>
                        <Tag color="green">Active</Tag>
                      </div>

                      <div className="rate-card-body">
                        <span className="rate-label">Tỷ giá công ty chốt:</span>
                        <strong className="rate-vnd-price">
                          {new Intl.NumberFormat("vi-VN").format(rate.rateToVnd)} ₫
                        </strong>
                      </div>

                      <div className="rate-card-footer">
                        <ClockCircleOutlined /> Áp dụng quy đổi đơn hàng real-time.
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : null}
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
                    {getRuleCalculationDisplay(
                      selectedDetail
                    )}
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

                {!isSystemParameterRule(
                  selectedDetail
                ) && (
                <>
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
                </>
                )}

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
