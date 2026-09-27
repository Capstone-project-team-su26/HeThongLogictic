import {
  useEffect,
  useMemo,
} from "react";
import {
  CheckCircleOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  LoadingOutlined,
  SafetyCertificateOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";
import {
  Carousel,
  Image,
  Tag,
  Tooltip,
} from "antd";

import {
  HIDDEN_SERVICE_CODES,
  SERVICE_DESCRIPTIONS,
} from "./ConsignmentOrderConfirm.constants";
import {
  calculatePackageVolume,
  calculateWoodCrateSummary,
  formatNumber,
  formatVnd,
  getConfigurationDisplay,
  getConfigurationFee,
  getLoadingProgress,
  getLoadingStage,
  getOptionLabel,
  getPackageId,
  getRulePriceLabel,
  getServiceClassName,
  getServiceLabel,
  getWoodCrateOrderFee,
  hasVietnameseCharacters,
  isWoodCrateServiceCode,
  normalizeCode,
  normalizeConfiguration,
  normalizeFullAddress,
  normalizeId,
  normalizePackageImages,
  normalizePricingRule,
  translateSubmitMessage,
} from "./ConsignmentOrderConfirm.helpers";

import EstimateInvoice from "@features/consignment/components/EstimateInvoice/EstimateInvoice";
/* Dùng lại đúng bộ nhãn của ô chọn trên form tạo đơn — hai nơi hiện giống hệt nhau. */
import { DESTINATION_HANDLING_OPTIONS } from "@features/consignment/pages/ConsignmentOrder/ConsignmentOrder.constants";
import "./ConsignmentOrderConfirm.css";

function PriceInfoLabel({
  label,
  tooltip,
}) {
  return (
    <span className="consignment-confirm-price-info-label">
      <span>{label}</span>

      <Tooltip
        title={tooltip}
        placement="top"
        mouseEnterDelay={0.12}
      >
        <button
          type="button"
          className="consignment-confirm-price-info-button"
          aria-label={`Giải thích ${label}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <InfoCircleOutlined />
        </button>
      </Tooltip>
    </span>
  );
}

function SummaryItem({
  label,
  value,
  fullWidth = false,
  tone = "",
}) {
  const hasValue =
    value !== null &&
    value !== undefined &&
    value !== "";

  return (
    <div
      className={[
        "consignment-confirm-summary-item",
        fullWidth &&
          "is-full-width",
        tone && `is-${tone}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>

      <strong>
        {hasValue
          ? value
          : "Chưa có thông tin"}
      </strong>
    </div>
  );
}

function ServiceCard({
  service,
}) {
  return (
    <article
      className={[
        "consignment-confirm-service-card",
        getServiceClassName(
          service.code,
        ),
      ].join(" ")}
    >
      <div className="consignment-confirm-service-card__heading">
        <span className="consignment-confirm-service-dot" />

        <div>
          <strong>
            {service.label}
          </strong>

          <small>
            {service.priceLabel}
          </small>
        </div>
      </div>

      {service.description && (
        <p>
          {service.description}
        </p>
      )}
    </article>
  );
}

function WoodCrateSummary({
  summary,
}) {
  if (!summary?.enabled) {
    return null;
  }

  return (
    <section className="consignment-confirm-wood-summary is-order-scope">
      <div className="consignment-confirm-wood-summary__header">
        <div className="consignment-confirm-wood-summary__icon">
          <SafetyCertificateOutlined />
        </div>

        <div className="consignment-confirm-wood-summary__title">
          <span>
            CHI PHÍ ĐÓNG THÙNG GỖ
          </span>

          <h3>
            Phí dịch vụ tính một lần cho toàn bộ đơn
          </h3>

          <p>
            Phí 35.000 ₫ không nhân theo số kiện.
            Mỗi kiện chỉ cộng thêm giá kích thước
            thùng đã chọn cho sản phẩm đó.
          </p>
        </div>

        <Tag className="consignment-confirm-wood-summary__count">
          {summary.selectedCount}/
          {summary.packageCount} kiện đã chọn thùng
        </Tag>
      </div>

      <div className="consignment-confirm-wood-summary__pricing">
        {/*
          Ô "phí dịch vụ toàn đơn" chỉ hiện khi hệ thống thật sự thu khoản đó. Hiện tại
          backend tính tiền thùng gỗ HOÀN TOÀN theo cỡ thùng của từng kiện
          (packageConfigurationId), nên ô này bằng 0 và bị ẩn — trước đây nó hiện 35.000đ
          lấy từ bảng quy tắc, làm Sale báo với khách một con số cao hơn hoá đơn thật.
        */}
        {summary.orderServiceFee > 0 && (
          <div className="consignment-confirm-wood-price-card is-order-fee">
            <PriceInfoLabel
              label="Phí dịch vụ đóng thùng gỗ"
              tooltip="Khoản phí cố định được tính một lần cho toàn bộ đơn ký gửi, không nhân với số lượng kiện."
            />

            <strong>
              {formatVnd(
                summary.orderServiceFee,
              )}
            </strong>

            <small>
              Tính 1 lần / toàn bộ đơn
            </small>
          </div>
        )}

        <div className="consignment-confirm-wood-price-card is-box-fee">
          <PriceInfoLabel
            label="Tổng giá thùng theo kiện"
            tooltip="Tổng giá SMALL, MEDIUM, LARGE hoặc CUSTOM đã chọn riêng cho từng kiện hàng."
          />

          <strong>
            {formatVnd(
              summary.configurationFee,
            )}
          </strong>

          <small>
            Cộng giá thùng của từng sản phẩm
          </small>
        </div>

        <div className="consignment-confirm-wood-price-card is-total">
          <PriceInfoLabel
            label="Tổng phí đóng thùng gỗ"
            tooltip="Phí dịch vụ toàn đơn cộng tổng giá cấu hình thùng của tất cả kiện."
          />

          <strong>
            {formatVnd(
              summary.totalFee,
            )}
          </strong>

          <small>
            Phí toàn đơn + giá thùng từng kiện
          </small>
        </div>
      </div>

      {summary.rows.length > 0 && (
        <div className="consignment-confirm-wood-breakdown">
          <div className="consignment-confirm-wood-breakdown__title">
            <div>
              <strong>
                Chi tiết kích thước thùng theo sản phẩm
              </strong>

              <span>
                Mỗi dòng tương ứng một kiện hàng.
              </span>
            </div>
          </div>

          <div className="consignment-confirm-wood-breakdown__list">
            {summary.rows.map(
              (row) => (
                <div
                  key={row.packageId}
                  className="consignment-confirm-wood-breakdown__row"
                >
                  <span className="consignment-confirm-wood-breakdown__index">
                    {row.packageIndex}
                  </span>

                  <div className="consignment-confirm-wood-breakdown__product">
                    <strong>
                      {row.productName}
                    </strong>

                    <small>
                      Kiện: {row.packageDimensions}
                    </small>
                  </div>

                  <div className="consignment-confirm-wood-breakdown__configuration">
                    <Tag>
                      {row.configurationSize}
                    </Tag>

                    <span>
                      {row.configurationName}
                    </span>

                    <small>
                      Thùng: {row.configurationDimensions}
                    </small>
                  </div>

                  <strong className="consignment-confirm-wood-breakdown__fee">
                    {formatVnd(
                      row.packageFee,
                    )}
                  </strong>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      <div className="consignment-confirm-wood-summary__note">
        <InfoCircleOutlined />

        <span>
          Phí dịch vụ đóng thùng gỗ chỉ xuất hiện một
          lần trong tổng đơn. Giá hiển thị tại từng kiện
          bên dưới chỉ là giá kích thước thùng của kiện đó.
        </span>
      </div>
    </section>
  );
}

function PackageConfigurationCard({
  pkg,
  packageIndex,
  selectedConfiguration,
}) {
  if (!selectedConfiguration) {
    return null;
  }

  const {
    name,
    size,
  } = getConfigurationDisplay(
    selectedConfiguration,
  );

  const packageFee =
    getConfigurationFee(
      selectedConfiguration,
    );

  const productName =
    String(
      pkg?.productName ||
        `Kiện hàng ${packageIndex}`,
    ).trim();

  const isCustomConfiguration =
    normalizeCode(
      selectedConfiguration
        ?.configCode,
    ) === "CUSTOM";

  const boxLength =
    isCustomConfiguration
      ? pkg?.length
      : selectedConfiguration
          ?.length;

  const boxWidth =
    isCustomConfiguration
      ? pkg?.width
      : selectedConfiguration
          ?.width;

  const boxHeight =
    isCustomConfiguration
      ? pkg?.height
      : selectedConfiguration
          ?.height;

  return (
    <section className="confirm-box-config">
      <div className="confirm-box-config__header">
        <div className="confirm-box-config__title">
          <span className="confirm-box-config__icon">
            <SafetyCertificateOutlined />
          </span>

          <div>
            <small>
              THÔNG TIN CẤU HÌNH ĐÓNG THÙNG
            </small>

            <h4>
              {productName}
            </h4>

            <p>
              Cấu hình đã chọn cho kiện{" "}
              {packageIndex}
            </p>
          </div>
        </div>

        <Tag className="confirm-box-config__size">
          {size}
        </Tag>
      </div>

      <div className="confirm-box-config__content">
        <div className="confirm-box-config__main">
          <span>
            Loại thùng
          </span>

          <strong>
            {name}
          </strong>

          <p>
            {isCustomConfiguration
              ? "Thùng được đóng theo kích thước thực tế của kiện hàng."
              : "Kích thước thùng được lấy từ cấu hình đã chọn trên hệ thống."}
          </p>
        </div>

        <div className="confirm-box-config__dimensions">
          <div>
            <span>Chiều dài thùng</span>

            <strong>
              {formatNumber(
                boxLength,
              )}{" "}
              cm
            </strong>
          </div>

          <div>
            <span>Chiều rộng thùng</span>

            <strong>
              {formatNumber(
                boxWidth,
              )}{" "}
              cm
            </strong>
          </div>

          <div>
            <span>Chiều cao thùng</span>

            <strong>
              {formatNumber(
                boxHeight,
              )}{" "}
              cm
            </strong>
          </div>

          <div>
            <span>Tải trọng tối đa</span>

            <strong>
              {formatNumber(
                selectedConfiguration
                  ?.maxWeight,
              )}{" "}
              kg
            </strong>
          </div>
        </div>

        <div className="confirm-box-config__price">
          <span>
            Giá thùng của kiện này
          </span>

          <strong>
            {formatVnd(packageFee)}
          </strong>

          <small>
            Không bao gồm phí dịch vụ đóng
            thùng gỗ tính một lần cho toàn đơn.
          </small>
        </div>
      </div>

      <div className="confirm-box-config__note">
        <InfoCircleOutlined />

        <span>
          Phí 35.000 ₫ của dịch vụ đóng
          thùng gỗ chỉ tính một lần cho đơn.
          Khu vực này chỉ hiển thị giá kích
          thước thùng của sản phẩm.
        </span>
      </div>
    </section>
  );
}

export default function ConsignmentOrderConfirm({
  form = {},
  packages = [],
  routeOptions = [],
  shippingOptions = [],
  productTypeOptions = [],
  pricingRules = [],
  packageConfigurations = [],
  masterDataLoading = false,
  masterDataError = "",
  isSubmitting,
  submitMessage,
  /* Ước tính do BACKEND tính — xem chú thích ở khối "Chi phí dự kiến" bên dưới. */
  estimate = null,
  estimateError = "",
  isEstimating = false,
  onBack,
  onConfirm,
}) {
  const loadingProgress =
    useMemo(
      () =>
        getLoadingProgress(
          submitMessage,
        ),
      [submitMessage],
    );

  const loadingStage = useMemo(
    () =>
      getLoadingStage(
        loadingProgress,
      ),
    [loadingProgress],
  );

  useEffect(() => {
    if (!isSubmitting) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isSubmitting]);

  const normalizedPricingRules =
    useMemo(
      () =>
        (
          Array.isArray(pricingRules)
            ? pricingRules
            : []
        ).map(
          normalizePricingRule,
        ),
      [pricingRules],
    );

  const normalizedConfigurations =
    useMemo(
      () =>
        (
          Array.isArray(
            packageConfigurations,
          )
            ? packageConfigurations
            : []
        ).map(
          normalizeConfiguration,
        ),
      [packageConfigurations],
    );

  const pricingRuleById = useMemo(
    () =>
      new Map(
        normalizedPricingRules.map(
          (rule) => [
            normalizeId(rule.id),
            rule,
          ],
        ),
      ),
    [normalizedPricingRules],
  );

  const pricingRuleByCode =
    useMemo(
      () =>
        new Map(
          normalizedPricingRules.map(
            (rule) => [
              rule.ruleCode,
              rule,
            ],
          ),
        ),
      [normalizedPricingRules],
    );

  const configurationById =
    useMemo(
      () =>
        new Map(
          normalizedConfigurations.map(
            (configuration) => [
              normalizeId(
                configuration.id,
              ),
              configuration,
            ],
          ),
        ),
      [normalizedConfigurations],
    );

  const optionalServices = useMemo(
    () => form.optionalServices || {},
    [form.optionalServices],
  );

  /*
   * Đây là nguồn sự thật duy nhất để quyết định có hiển thị
   * dịch vụ, phí và kích thước thùng gỗ hay không.
   * Dữ liệu packageConfigurationId do API gợi ý trả về không
   * được phép tự kích hoạt giao diện đóng thùng.
   */
  const woodCrateSelected =
    optionalServices
      ?.requiresWoodenCrate === true;

  const woodCrateOrderFee =
    useMemo(
      () =>
        getWoodCrateOrderFee({
          optionalServices,
          pricingRuleByCode,
        }),
      [
        optionalServices,
        pricingRuleByCode,
      ],
    );

  const selectedServices =
    useMemo(() => {
      const selectedRuleCodes = [
        optionalServices?.selectedRuleCodes,
        optionalServices?.selectedPricingRuleCodes,
        optionalServices?.pricingRuleCodes,
        optionalServices?.selectedServiceCodes,
        optionalServices?.serviceCodes,
      ]
        .filter(Array.isArray)
        .flat();

      const selectedPricingRuleIds = [
        optionalServices?.selectedPricingRuleIds,
        optionalServices?.pricingRuleIds,
        optionalServices?.selectedServiceIds,
        optionalServices?.serviceIds,
      ]
        .filter(Array.isArray)
        .flat();

      const selectedRuleObjects = [
        optionalServices?.selectedRules,
        optionalServices?.selectedPricingRules,
        optionalServices?.selectedServices,
        optionalServices?.services,
      ]
        .filter(Array.isArray)
        .flat()
        .filter(
          (item) =>
            item &&
            typeof item === "object",
        );

      const serviceMap = new Map();

      const findRuleByCode = (rawCode) => {
        const code = normalizeCode(rawCode);

        if (!code) {
          return null;
        }

        return (
          pricingRuleByCode.get(code) ||
          normalizedPricingRules.find(
            (rule) =>
              rule.ruleCode === code ||
              rule.ruleType === code,
          ) ||
          null
        );
      };

      const appendCode = (
        rawCode,
        fallback = {},
      ) => {
        const requestedCode =
          normalizeCode(rawCode);

        if (
          !requestedCode ||
          HIDDEN_SERVICE_CODES.has(
            requestedCode,
          )
        ) {
          return;
        }

        /*
         * WOOD_CRATE chỉ được xem là đã chọn khi cờ
         * requiresWoodenCrate thực sự bằng true.
         * Vì vậy dữ liệu gợi ý thùng còn sót lại hoặc
         * selectedRuleCodes cũ không thể tự làm dịch vụ
         * đóng thùng gỗ xuất hiện trên màn hình xác nhận.
         */
        if (
          isWoodCrateServiceCode(
            requestedCode,
          ) &&
          !woodCrateSelected
        ) {
          return;
        }

        const rule =
          findRuleByCode(requestedCode) ||
          fallback?.rule ||
          null;

        const normalizedRule =
          rule
            ? normalizePricingRule(
                rule,
              )
            : null;

        const code =
          normalizeCode(
            normalizedRule?.ruleCode ||
              requestedCode,
          );

        if (
          !code ||
          HIDDEN_SERVICE_CODES.has(code)
        ) {
          return;
        }

        if (
          isWoodCrateServiceCode(code) &&
          !woodCrateSelected
        ) {
          return;
        }

        serviceMap.set(code, {
          code,
          label: getServiceLabel(
            code,
            normalizedRule?.ruleName ||
              fallback?.label,
          ),
          description:
            SERVICE_DESCRIPTIONS[code] ||
            (
              hasVietnameseCharacters(
                normalizedRule
                  ?.description,
              )
                ? normalizedRule
                    ?.description
                : ""
            ) ||
            fallback?.description ||
            "",
          priceLabel:
            fallback?.priceLabel ||
            getRulePriceLabel(
              normalizedRule,
            ),
        });
      };

      selectedRuleCodes.forEach(
        (code) => appendCode(code),
      );

      selectedPricingRuleIds.forEach(
        (id) => {
          const rule =
            pricingRuleById.get(
              normalizeId(id),
            );

          if (rule) {
            appendCode(
              rule.ruleCode,
              { rule },
            );
          }
        },
      );

      selectedRuleObjects.forEach(
        (item) => {
          const rawCode =
            item?.ruleCode ||
            item?.code ||
            item?.serviceCode ||
            item?.ruleType;

          if (rawCode) {
            appendCode(rawCode, {
              rule: item,
              label:
                item?.ruleName ||
                item?.name ||
                item?.label,
              description:
                item?.description,
              priceLabel:
                item?.priceLabel,
            });
            return;
          }

          const rawId =
            item?.id ||
            item?.pricingRuleId ||
            item?.serviceId;

          const rule =
            pricingRuleById.get(
              normalizeId(rawId),
            );

          if (rule) {
            appendCode(
              rule.ruleCode,
              { rule },
            );
          }
        },
      );

      if (woodCrateSelected) {
        appendCode(
          "WOOD_CRATE",
          {
            priceLabel:
              woodCrateOrderFee > 0
                ? `${formatVnd(
                    woodCrateOrderFee,
                  )} / toàn bộ đơn`
                : undefined,
          },
        );
      }

      if (
        optionalServices
          ?.requiresInspection ||
        form.inspectPackage
      ) {
        appendCode(
          "SUR_INSPECTION",
        );
      }

      if (
        optionalServices
          ?.requiresInsurance
      ) {
        const insuranceRule =
          normalizedPricingRules.find(
            (rule) =>
              rule.ruleCode.includes(
                "INSURANCE",
              ) ||
              rule.ruleType.includes(
                "INSURANCE",
              ),
          );

        appendCode(
          insuranceRule?.ruleCode ||
            "INSURANCE",
          {
            rule: insuranceRule,
          },
        );
      }

      if (
        optionalServices
          ?.requiresPacking
      ) {
        appendCode("PACKING");
      }

      return Array.from(
        serviceMap.values(),
      );
    }, [
      form.inspectPackage,
      normalizedPricingRules,
      optionalServices,
      pricingRuleByCode,
      pricingRuleById,
      woodCrateOrderFee,
      woodCrateSelected,
    ]);

  const selectedConfigurationByPackage =
    useMemo(() => {
      const selectedMap = new Map();

      /*
       * Không chọn đóng thùng gỗ thì bỏ qua toàn bộ cấu hình thùng,
       * kể cả packageConfigurationId đã từng được API AI gợi ý.
       */
      if (!woodCrateSelected) {
        return selectedMap;
      }

      const savedList =
        Array.isArray(
          optionalServices
            ?.selectedPackageConfigurations,
        )
          ? optionalServices
              .selectedPackageConfigurations
          : [];

      const configurationIdMap =
        optionalServices
          ?.packageConfigurationByPackageId &&
        typeof optionalServices
          .packageConfigurationByPackageId ===
          "object"
          ? optionalServices
              .packageConfigurationByPackageId
          : {};

      packages.forEach(
        (pkg, index) => {
          const packageId =
            String(
              pkg?.id ||
                pkg?.packageId ||
                `package-${index + 1}`,
            ).trim();

          const savedItem =
            savedList.find(
              (item) =>
                String(
                  item?.packageId ||
                    "",
                ).trim() ===
                packageId,
            ) || null;

          const configurationId =
            String(
              pkg
                ?.packageConfigurationId ||
                savedItem
                  ?.packageConfigurationId ||
                configurationIdMap[
                  packageId
                ] ||
                "",
            ).trim();

          const apiConfiguration =
            configurationById.get(
              normalizeId(
                configurationId,
              ),
            ) || null;

          const mergedConfiguration =
            apiConfiguration ||
            (
              savedItem &&
              typeof savedItem ===
                "object"
                ? normalizeConfiguration(
                    savedItem,
                  )
                : null
            );

          if (
            mergedConfiguration
          ) {
            selectedMap.set(
              packageId,
              {
                ...mergedConfiguration,
                ...savedItem,
                id:
                  mergedConfiguration.id ||
                  configurationId,
              },
            );
          }
        },
      );

      return selectedMap;
    }, [
      configurationById,
      optionalServices,
      packages,
      woodCrateSelected,
    ]);

  const missingWoodCratePackages = useMemo(() => {
    if (!woodCrateSelected) {
      return [];
    }

    return packages
      .map((pkg, index) => ({
        packageId: getPackageId(pkg, index),
        packageIndex: index + 1,
        productName: String(
          pkg?.productName || `Kiện hàng ${index + 1}`,
        ).trim(),
      }))
      .filter(
        (item) =>
          !selectedConfigurationByPackage.has(item.packageId),
      );
  }, [
    packages,
    selectedConfigurationByPackage,
    woodCrateSelected,
  ]);

  const woodCrateSelectionComplete =
    !woodCrateSelected ||
    (packages.length > 0 &&
      missingWoodCratePackages.length === 0);

  const woodCratePricingSummary =
    useMemo(
      () =>
        calculateWoodCrateSummary({
          optionalServices,
          packages,
          selectedConfigurationByPackage,
          pricingRuleByCode,
        }),
      [
        optionalServices,
        packages,
        selectedConfigurationByPackage,
        pricingRuleByCode,
      ],
    );

  const totals = useMemo(
    () =>
      packages.reduce(
        (result, pkg) => ({
          quantity:
            result.quantity +
            Number(
              pkg.quantity || 0,
            ),

          weight:
            result.weight +
            Number(
              pkg.weight || 0,
            ),

          declaredValue:
            result.declaredValue +
            Number(
              pkg.declaredValue ||
                0,
            ),

          volume:
            result.volume +
            calculatePackageVolume(
              pkg,
            ),

          images:
            result.images +
            normalizePackageImages(
              pkg,
            ).length,
        }),
        {
          quantity: 0,
          weight: 0,
          declaredValue: 0,
          volume: 0,
          images: 0,
        },
      ),
    [packages],
  );

  const routeLabel =
    getOptionLabel(
      routeOptions,
      form.route,
      "route",
    );

  const shippingLabel =
    getOptionLabel(
      shippingOptions,
      form.shippingOption,
      "shipping",
    );

  const receiverAddress =
    normalizeFullAddress(
      form
        ?.selectedDeliveryAddress,
    ) ||
    normalizeFullAddress(
      form?.receiverAddress,
    );

  /*
   * Chủ đơn — Sale đang tạo hộ ai. Hiện ngay cạnh người nhận vì đây là hai người
   * KHÁC nhau (khách A gửi hàng cho người nhận B) và là thứ dễ nhầm nhất ở màn này.
   */
  const customerSummary = [
    form?.customer?.fullName,
    form?.customer?.phone,
    form?.customer?.email,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" · ");

  const inspectionRequested =
    Boolean(form?.inspectPackage) ||
    Boolean(
      optionalServices
        ?.requiresInspection,
    );

  return (
    <div className="consignment-confirm-page">
      <div className="consignment-confirm-shell">
        <div className="consignment-confirm-topbar">
          <button
            type="button"
            className="consignment-confirm-back"
            disabled={isSubmitting}
            onClick={onBack}
          >
            <LeftOutlined />
            QUAY LẠI CHỈNH SỬA
          </button>

          <div className="consignment-confirm-status">
            <CheckCircleOutlined />
            THÔNG TIN ĐÃ HỢP LỆ
          </div>
        </div>

        <div className="consignment-confirm-hero">
          <div className="consignment-confirm-hero-icon">
            <ShoppingOutlined />
          </div>

          <div className="consignment-confirm-hero-copy">
            <span className="consignment-confirm-hero-eyebrow">
              XÁC NHẬN ĐƠN KÝ GỬI
            </span>

            <h1>
              Kiểm tra lại toàn bộ thông tin
              trước khi tạo đơn
            </h1>

            <p>
              Hãy kiểm tra người nhận, tuyến vận
              chuyển, dịch vụ bổ sung, giá đóng
              thùng và thông tin từng kiện.
            </p>
          </div>

          <div className="consignment-confirm-hero-stats">
            <div>
              <span>Số kiện</span>
              <strong>
                {packages.length}
              </strong>
            </div>

            <div>
              <span>Dịch vụ</span>
              <strong>
                {
                  selectedServices.length
                }
              </strong>
            </div>

            <div>
              <span>Ảnh sản phẩm</span>
              <strong>
                {totals.images}
              </strong>
            </div>
          </div>
        </div>

        {masterDataLoading && (
          <div className="consignment-confirm-api-notice is-loading">
            <LoadingOutlined spin />

            <span>
              Đang tải tên dịch vụ, mức giá
              và cấu hình thùng...
            </span>
          </div>
        )}

        {!masterDataLoading &&
          masterDataError && (
            <div className="consignment-confirm-api-notice is-error">
              <InfoCircleOutlined />

              <span>
                Không thể tải đầy đủ tên dịch vụ,
                mức giá hoặc cấu hình thùng.
                Vui lòng quay lại và thử lại.
              </span>
            </div>
          )}

        <div className="consignment-confirm-section">
          <div className="consignment-confirm-section-title">
            <span>
              <EnvironmentOutlined />
            </span>

            <div>
              <h2>
                Thông tin giao nhận
              </h2>

              <p>
                Tuyến vận chuyển và thông tin
                người nhận cuối cùng.
              </p>
            </div>
          </div>

          <div className="consignment-confirm-summary-grid">
            <SummaryItem
              label="Khách hàng của đơn"
              value={
                customerSummary ||
                "Chưa chọn khách hàng"
              }
              tone={
                customerSummary
                  ? "success"
                  : "neutral"
              }
              fullWidth
            />

            <SummaryItem
              label="Tuyến hàng"
              value={routeLabel}
              tone="route"
            />

            <SummaryItem
              label="Hình thức vận chuyển"
              value={shippingLabel}
              tone="shipping"
            />

            <SummaryItem
              label="Người nhận"
              value={
                form.receiverName
              }
            />

            <SummaryItem
              label="Số điện thoại"
              value={
                form.receiverPhone
              }
            />

            <SummaryItem
              label="Địa chỉ nhận hàng"
              value={receiverAddress}
              fullWidth
            />

            <SummaryItem
              label="Yêu cầu kiểm hàng"
              value={
                inspectionRequested
                  ? "Có yêu cầu kiểm hàng"
                  : "Không yêu cầu kiểm hàng"
              }
              tone={
                inspectionRequested
                  ? "success"
                  : "neutral"
              }
            />

            {/*
              Nguyện vọng khi hàng về VN được gửi lên cùng đơn (defaultDestinationHandling)
              nhưng trước đây không hiện ở bước xác nhận — Sale tick hộ khách mà không soát lại.
            */}
            <SummaryItem
              label="Khi hàng về Việt Nam"
              value={
                DESTINATION_HANDLING_OPTIONS.find(
                  (option) =>
                    option.value ===
                    form?.defaultDestinationHandling
                )?.label ||
                "Chưa chọn (mặc định giao ngay)"
              }
            />

            <SummaryItem
              label="Số dịch vụ bổ sung"
              value={`${selectedServices.length} dịch vụ`}
              tone="service"
            />
          </div>
        </div>

        <div className="consignment-confirm-section">
          <div className="consignment-confirm-section-title">
            <span>
              <SafetyCertificateOutlined />
            </span>

            <div>
              <h2>
                Dịch vụ bổ sung
              </h2>

              <p>
                Tên dịch vụ và mức giá được
                đối chiếu từ bảng giá hệ thống.
              </p>
            </div>
          </div>

          {selectedServices.length >
          0 ? (
            <div className="consignment-confirm-service-list">
              {selectedServices.map(
                (service) => (
                  <ServiceCard
                    key={
                      service.code
                    }
                    service={
                      service
                    }
                  />
                ),
              )}
            </div>
          ) : (
            <div className="consignment-confirm-empty-service">
              Không sử dụng dịch vụ bổ sung.
            </div>
          )}

          {woodCrateSelected && (
            <>
              <WoodCrateSummary
                summary={
                  woodCratePricingSummary
                }
              />

              {!woodCrateSelectionComplete && (
                <div className="consignment-confirm-api-notice is-error">
                  <InfoCircleOutlined />
                  <span>
                    Đã chọn đóng thùng gỗ nên bắt buộc chọn kích thước cho tất cả kiện. Còn thiếu: {missingWoodCratePackages
                      .map((item) => item.productName)
                      .join(", ")}.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="consignment-confirm-totals">
          <div className="consignment-confirm-total-card is-package">
            <span>Tổng số kiện</span>

            <strong>
              {packages.length}
            </strong>
          </div>

          <div className="consignment-confirm-total-card is-quantity">
            <span>
              Tổng số lượng sản phẩm
            </span>

            <strong>
              {formatNumber(
                totals.quantity,
              )}
            </strong>
          </div>

          <div className="consignment-confirm-total-card is-weight">
            <span>
              Tổng khối lượng
            </span>

            <strong>
              {formatNumber(
                totals.weight,
              )}{" "}
              kg
            </strong>
          </div>

          <div className="consignment-confirm-total-card is-volume">
            <span>
              Tổng thể tích
            </span>

            <strong>
              {formatNumber(
                totals.volume,
              )}{" "}
              cm³
            </strong>
          </div>

          <div className="consignment-confirm-total-card is-value">
            <span>
              Tổng giá trị khai báo
            </span>

            <strong>
              {formatVnd(
                totals.declaredValue,
              )}
            </strong>
          </div>

          {woodCrateSelected && (
            <div className="consignment-confirm-total-card is-wood-total">
              <span>
                Tổng phí đóng thùng
              </span>

              <strong>
                {formatVnd(
                  woodCratePricingSummary
                    .totalFee,
                )}
              </strong>
            </div>
          )}
        </div>

        {/*
          CHI PHÍ DỰ KIẾN — số do BACKEND tính, không phải màn hình tự cộng.

          Sale đọc con số này cho khách nghe, nên nó phải bằng đúng con số trên báo giá hệ
          thống phát hành ngay sau khi bấm tạo đơn. Endpoint ước tính chạy đúng phép tính
          của lúc tạo đơn thật, chỉ khác là không ghi gì xuống DB.
        */}
        <div className="consignment-confirm-section is-estimate-section">
          <div className="consignment-confirm-section-title">
            <span>
              <DollarOutlined />
            </span>

            <div>
              <h2>Bảng kê chi phí dự kiến</h2>
              <p>Từng khoản một, hệ thống tính — không phải ước lượng của trình duyệt</p>
            </div>
          </div>

          {isEstimating ? (
            <div className="estimate-loading">
              <LoadingOutlined spin /> Đang tính chi phí…
            </div>
          ) : estimateError ? (
            <div className="estimate-error">
              <InfoCircleOutlined />
              <span>
                {estimateError} Vẫn tạo đơn được — báo giá tạm tính sẽ hiện ngay sau khi tạo.
              </span>
            </div>
          ) : estimate ? (
            <EstimateInvoice estimate={estimate} />
          ) : null}
        </div>

        <div className="consignment-confirm-section">
          <div className="consignment-confirm-section-title">
            <span>
              <ShoppingOutlined />
            </span>

            <div>
              <h2>
                Danh sách kiện hàng
              </h2>

              <p>
                {woodCrateSelected
                  ? "Chi tiết sản phẩm, kích thước kiện, cấu hình thùng và hình ảnh."
                  : "Chi tiết sản phẩm, kích thước kiện và hình ảnh."}
              </p>
            </div>
          </div>

          <div className="consignment-confirm-package-list">
            {packages.map(
              (pkg, index) => {
                const packageVolume =
                  calculatePackageVolume(
                    pkg,
                  );

                const images =
                  normalizePackageImages(
                    pkg,
                  );

                const packageId =
                  getPackageId(
                    pkg,
                    index,
                  );

                const selectedConfiguration =
                  selectedConfigurationByPackage.get(
                    packageId,
                  ) || null;

                const productName =
                  String(
                    pkg?.productName ||
                      "Chưa có tên sản phẩm",
                  ).trim();

                const productTypeLabel =
                  getOptionLabel(
                    productTypeOptions,
                    pkg.productType,
                    "productType",
                  );

                return (
                  <article
                    key={packageId}
                    className="confirm-package-card"
                  >
                    <header className="confirm-package-card__header">
                      <div className="confirm-package-card__identity">
                        <span className="confirm-package-card__number">
                          {String(
                            index + 1,
                          ).padStart(
                            2,
                            "0",
                          )}
                        </span>

                        <div>
                          <small>
                            KIỆN HÀNG THỨ{" "}
                            {index + 1}
                          </small>

                          <h3>
                            {productName}
                          </h3>

                          <p>
                            {woodCrateSelected
                              ? "Kiểm tra hình ảnh, thông tin sản phẩm, kích thước kiện và cấu hình thùng trước khi xác nhận."
                              : "Kiểm tra hình ảnh, thông tin sản phẩm và kích thước kiện trước khi xác nhận."}
                          </p>
                        </div>
                      </div>

                      <div className="confirm-package-card__quick-stats">
                        <div>
                          <span>Số lượng</span>

                          <strong>
                            {formatNumber(
                              pkg.quantity,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>Khối lượng</span>

                          <strong>
                            {formatNumber(
                              pkg.weight,
                            )}{" "}
                            kg
                          </strong>
                        </div>

                        <div className="is-value">
                          <span>
                            Giá trị khai báo
                          </span>

                          <strong>
                            {formatVnd(
                              pkg.declaredValue,
                            )}
                          </strong>
                        </div>
                      </div>
                    </header>

                    <div className="confirm-package-card__body">
                      <div className="confirm-package-overview">
                        <section className="confirm-package-media">
                          <div className="confirm-package-block-title">
                            <div>
                              <span>
                                HÌNH ẢNH SẢN PHẨM
                              </span>

                              <strong>
                                {images.length >
                                0
                                  ? `${images.length} ảnh đã tải lên`
                                  : "Chưa có hình ảnh"}
                              </strong>
                            </div>

                            <Tag>
                              KIỆN {index + 1}
                            </Tag>
                          </div>

                          {images.length > 0 ? (
                            <>
                              <Image.PreviewGroup>
                                <Carousel
                                  className="confirm-package-carousel"
                                  autoplay={
                                    images.length >
                                    1
                                  }
                                  autoplaySpeed={
                                    3200
                                  }
                                  pauseOnHover
                                  dots={
                                    images.length >
                                    1
                                  }
                                >
                                  {images.map(
                                    (
                                      image,
                                      imageIndex,
                                    ) => (
                                      <div
                                        key={
                                          image.id
                                        }
                                        className="confirm-package-carousel__slide"
                                      >
                                        <Image
                                          src={
                                            image.previewUrl
                                          }
                                          alt={`Ảnh ${
                                            imageIndex +
                                            1
                                          } của ${productName}`}
                                          className="confirm-package-carousel__image"
                                          preview={{
                                            mask:
                                              "Xem ảnh",
                                          }}
                                        />

                                        <span className="confirm-package-carousel__counter">
                                          Ảnh{" "}
                                          {imageIndex +
                                            1}
                                          /
                                          {
                                            images.length
                                          }
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </Carousel>
                              </Image.PreviewGroup>

                              <div className="confirm-package-media__footer">
                                <InfoCircleOutlined />

                                <span>
                                  Bấm vào ảnh để xem
                                  kích thước lớn.
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="confirm-package-media__empty">
                              <ShoppingOutlined />

                              <strong>
                                Chưa có hình ảnh
                              </strong>

                              <span>
                                Kiện hàng này chưa tải
                                lên ảnh sản phẩm.
                              </span>
                            </div>
                          )}
                        </section>

                        <section className="confirm-product-info">
                          <div className="confirm-package-block-title">
                            <div>
                              <span>
                                THÔNG TIN SẢN PHẨM
                              </span>

                              <strong>
                                Chi tiết kiện hàng
                              </strong>
                            </div>

                            <Tag className="confirm-product-info__type-tag">
                              {productTypeLabel}
                            </Tag>
                          </div>

                          <div className="confirm-product-info__grid">
                            <div className="is-product-name">
                              <span>
                                Tên sản phẩm
                              </span>

                              <strong>
                                {productName}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Loại hàng hóa
                              </span>

                              <strong>
                                {
                                  productTypeLabel
                                }
                              </strong>
                            </div>

                            <div>
                              <span>
                                Số lượng sản phẩm
                              </span>

                              <strong>
                                {formatNumber(
                                  pkg.quantity,
                                )}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Khối lượng kiện
                              </span>

                              <strong>
                                {formatNumber(
                                  pkg.weight,
                                )}{" "}
                                kg
                              </strong>
                            </div>

                            <div className="is-tracking">
                              <span>
                                Mã vận đơn nội địa
                              </span>

                              <strong>
                                {pkg.trackingCode
                                  ?.trim() ||
                                  pkg
                                    ?.domesticTrackingCode
                                    ?.trim() ||
                                  "Chưa có mã vận đơn"}
                              </strong>
                            </div>

                            <div className="is-declared-value">
                              <span>
                                Giá trị khai báo
                              </span>

                              <strong>
                                {formatVnd(
                                  pkg.declaredValue,
                                )}
                              </strong>
                            </div>
                          </div>

                          <div className="confirm-package-dimensions">
                            <div className="confirm-package-dimensions__header">
                              <div>
                                <span>
                                  KÍCH THƯỚC KIỆN HÀNG
                                </span>

                                <strong>
                                  Dài × Rộng × Cao
                                </strong>
                              </div>

                              <small>
                                Đơn vị: cm
                              </small>
                            </div>

                            <div className="confirm-package-dimensions__grid">
                              <div className="is-length">
                                <span>
                                  Chiều dài
                                </span>

                                <strong>
                                  {formatNumber(
                                    pkg.length,
                                  )}
                                </strong>

                                <small>cm</small>
                              </div>

                              <div className="is-width">
                                <span>
                                  Chiều rộng
                                </span>

                                <strong>
                                  {formatNumber(
                                    pkg.width,
                                  )}
                                </strong>

                                <small>cm</small>
                              </div>

                              <div className="is-height">
                                <span>
                                  Chiều cao
                                </span>

                                <strong>
                                  {formatNumber(
                                    pkg.height,
                                  )}
                                </strong>

                                <small>cm</small>
                              </div>

                              <div className="is-volume">
                                <span>
                                  Thể tích
                                </span>

                                <strong>
                                  {formatNumber(
                                    packageVolume,
                                  )}
                                </strong>

                                <small>
                                  cm³
                                </small>
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>

                      {woodCrateSelected &&
                        selectedConfiguration && (
                          <PackageConfigurationCard
                            pkg={pkg}
                            packageIndex={
                              index + 1
                            }
                            selectedConfiguration={
                              selectedConfiguration
                            }
                          />
                        )}

                      {woodCrateSelected &&
                        !selectedConfiguration && (
                          <div className="consignment-confirm-api-notice is-error">
                            <InfoCircleOutlined />
                            <span>
                              Kiện này chưa được chọn kích thước thùng gỗ. Vui lòng quay lại chỉnh sửa trước khi tạo đơn.
                            </span>
                          </div>
                        )}
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </div>

        <div className="consignment-confirm-section">
          <div className="consignment-confirm-section-title">
            <span>
              <InfoCircleOutlined />
            </span>

            <div>
              <h2>Ghi chú chung</h2>

              <p>
                Thông tin bổ sung được gửi kèm
                yêu cầu ký gửi.
              </p>
            </div>
          </div>

          <p className="consignment-confirm-note">
            {form.note?.trim() ||
              "Không có ghi chú."}
          </p>
        </div>

        <div className="consignment-confirm-warning">
          <SafetyCertificateOutlined />

          <span>
            Sau khi xác nhận, hệ thống sẽ tải
            ảnh và gửi yêu cầu tạo đơn. Vui
            lòng không đóng, quay lại hoặc tải
            lại trang trong lúc xử lý.
          </span>
        </div>

        <div className="consignment-confirm-actions">
          <button
            type="button"
            className="consignment-confirm-button is-secondary"
            disabled={isSubmitting}
            onClick={onBack}
          >
            <LeftOutlined />
            QUAY LẠI CHỈNH SỬA
          </button>

          <button
            type="button"
            className="consignment-confirm-button is-primary"
            disabled={
              isSubmitting ||
              masterDataLoading ||
              !woodCrateSelectionComplete
            }
            onClick={onConfirm}
          >
            {isSubmitting ? (
              <>
                <LoadingOutlined spin />
                ĐANG TẠO ĐƠN...
              </>
            ) : !woodCrateSelectionComplete ? (
              <>
                <InfoCircleOutlined />
                CHƯA CHỌN ĐỦ KÍCH THƯỚC THÙNG
              </>
            ) : (
              <>
                <CheckCircleOutlined />
                XÁC NHẬN TẠO ĐƠN
              </>
            )}
          </button>
        </div>
      </div>

      {isSubmitting && (
        <div
          className="consignment-confirm-loading-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consignment-loading-title"
          aria-describedby="consignment-loading-description"
        >
          <div className="consignment-confirm-loading-card">
            <div className="consignment-confirm-loading-header">
              <div
                className="consignment-confirm-loading-visual"
                aria-hidden="true"
              >
                <span className="consignment-confirm-loading-orbit" />

                <span className="consignment-confirm-loading-icon">
                  <LoadingOutlined spin />
                </span>
              </div>

              <div className="consignment-confirm-loading-copy">
                <span className="consignment-confirm-loading-eyebrow">
                  HỆ THỐNG ĐANG XỬ LÝ
                </span>

                <h3 id="consignment-loading-title">
                  Đang tạo đơn ký gửi
                </h3>

                <p id="consignment-loading-description">
                  {translateSubmitMessage(
                    submitMessage,
                  )}
                </p>
              </div>
            </div>

            <div className="consignment-confirm-loading-progress">
              <div className="consignment-confirm-loading-progress-info">
                <span>
                  Tiến trình xử lý
                </span>

                <strong>
                  {loadingProgress}%
                </strong>
              </div>

              <div
                className="consignment-confirm-loading-progress-track"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={
                  loadingProgress
                }
              >
                <span
                  style={{
                    width: `${loadingProgress}%`,
                  }}
                />
              </div>
            </div>

            <div className="consignment-confirm-loading-steps">
              {[
                "Kiểm tra dữ liệu",
                "Tải ảnh kiện hàng",
                "Gửi yêu cầu tạo đơn",
              ].map(
                (
                  stepLabel,
                  index,
                ) => {
                  const stepNumber =
                    index + 1;

                  const isCompleted =
                    loadingStage >
                    stepNumber;

                  const isActive =
                    loadingStage ===
                    stepNumber;

                  return (
                    <div
                      key={
                        stepLabel
                      }
                      className={[
                        "consignment-confirm-loading-step",
                        isCompleted &&
                          "is-completed",
                        isActive &&
                          "is-active",
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(" ")}
                    >
                      <span className="consignment-confirm-loading-step-dot">
                        {isCompleted ? (
                          <CheckCircleOutlined />
                        ) : (
                          stepNumber
                        )}
                      </span>

                      <span>
                        {stepLabel}
                      </span>
                    </div>
                  );
                },
              )}
            </div>

            <div className="consignment-confirm-loading-safe-note">
              <SafetyCertificateOutlined />

              <span>
                Dữ liệu đang được xử lý an
                toàn. Vui lòng không đóng,
                quay lại hoặc tải lại trang.
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
