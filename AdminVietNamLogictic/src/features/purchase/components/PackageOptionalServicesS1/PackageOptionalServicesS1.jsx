import React, { useEffect, useMemo, useState } from "react";
import {
  CheckOutlined,
  CloseOutlined,
  GiftOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { Checkbox, Modal, Tooltip } from "antd";

import pricingRuleService from "@features/pricing/api/pricingRuleService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import {
  areCodeArraysEqual,
  areStringArraysEqual,
  calculateWoodCratePricing,
  formatIncompleteProductsMessage,
  formatMoney,
  formatNumber,
  formatRuleDescription,
  formatRuleFee,
  formatRuleInformation,
  getCalculationTypeLabel,
  getIncompleteProducts,
  getInitialSelectedCodes,
  getPackageDisplayName,
  getProductQuantity,
  getRuleCodeLabel,
  getRuleDisplayName,
  getRuleIcon,
  getRuleTypeLabel,
  getStatusClassName,
  getStatusLabel,
  isCanceledRequest,
  isHiddenRule,
  isRuleSelectable,
  normalizeCode,
  normalizeRuleId,
  normalizeRulesFromApi,
  normalizeStringArray,
  sanitizeSelectedPricingRuleIds,
  sanitizeSelectedRuleCodes,
  toFiniteNumberOrNull,
} from "./PackageOptionalServicesS1.helpers";
import "./PackageOptionalServicesS1.css";


// Shared initial form state used by the create-request page.
// eslint-disable-next-line react-refresh/only-export-components
export const EMPTY_PACKAGE_SERVICES = {
  requiresPacking: false,
  requiresWoodenCrate: false,
  requiresInsurance: false,
  requiresInspection: false,
  selectedRuleCodes: [],
  selectedPricingRuleIds: [],
  packageConfigurationByPackageId: {},
  selectedPackageConfigurations: [],
  woodCratePackageCount: 0,
  woodCrateQuantity: 0,
  woodCrateUnitFee: 0,
  woodCrateBaseFeePerPackage: 0,
  woodCrateBaseFee: 0,
  woodCrateConfigurationFee: 0,
  woodCrateTotalFee: 0,
  woodCrateCompleted: false,
};


const WoodCrateByProductPanel = ({
  packages,
  unitFee,
}) => {
  const normalizedPackages =
    Array.isArray(packages)
      ? packages.filter(Boolean)
      : [];

  const pricing =
    calculateWoodCratePricing({
      packages: normalizedPackages,
      unitFee,
      enabled: true,
    });

  return (
    <section
      className="wood-crate-configuration-panel"
      onClick={(event) =>
        event.stopPropagation()
      }
    >
      <div className="wood-crate-configuration-panel__header">
        <div>
          <span>ĐÓNG THÙNG GỖ THEO KIỆN</span>

          <strong>
            Mỗi sản phẩm được tính là một kiện
          </strong>

          <p>
            Số lượng bên trong một sản phẩm không làm tăng
            số kiện. Ví dụ sản phẩm có số lượng 10 vẫn chỉ
            được tính là 1 kiện đóng thùng gỗ.
          </p>

          <span className="wood-crate-auto-service-badge is-enabled">
            <CheckOutlined />
            {pricing.packageCount} kiện từ{" "}
            {pricing.packageCount} sản phẩm
          </span>
        </div>

        <div className="wood-crate-configuration-panel__base-fee">
          <small>Phí đóng thùng</small>

          <strong>
            {formatMoney(unitFee)}
          </strong>

          <span>/ kiện</span>
        </div>
      </div>

      {normalizedPackages.length === 0 ? (
        <div className="wood-crate-configuration-panel__state is-warning">
          <InfoCircleOutlined />
          Chưa có sản phẩm để tính số kiện đóng thùng gỗ.
        </div>
      ) : (
        <div className="wood-crate-package-list">
          {normalizedPackages.map(
            (packageItem, index) => (
              <article
                key={
                  packageItem?.id ||
                  packageItem?.itemId ||
                  `purchase-product-${index + 1}`
                }
                className="wood-crate-package-card"
              >
                <div className="wood-crate-package-card__heading">
                  <div>
                    <span>Kiện {index + 1}</span>

                    <strong>
                      {getPackageDisplayName(
                        packageItem,
                        index,
                      )}
                    </strong>

                    <small>
                      Số lượng sản phẩm:{" "}
                      {formatNumber(
                        getProductQuantity(
                          packageItem,
                        ),
                      )}
                      {" • "}Tính phí: 1 kiện
                    </small>
                  </div>

                  <span className="wood-crate-package-card__required">
                    1 KIỆN
                  </span>
                </div>
              </article>
            ),
          )}
        </div>
      )}

      <div className="wood-crate-price-summary is-complete">
        <div className="wood-crate-price-summary__selected-count">
          <span>Tổng số kiện</span>

          <strong>
            {pricing.packageCount}
          </strong>
        </div>

        <div>
          <span>Đơn giá mỗi kiện</span>

          <strong>
            {formatMoney(
              pricing.unitFee,
            )}
          </strong>
        </div>

        <div className="wood-crate-price-summary__total">
          <span>
            Tổng phí đóng thùng gỗ
          </span>

          <strong>
            {formatMoney(
              pricing.totalFee,
            )}
          </strong>
        </div>
      </div>
    </section>
  );
};

export default function PackageOptionalServices({
  value = EMPTY_PACKAGE_SERVICES,
  packages = [],
  disabled = false,
  onChange,

  triggerTitle = "Dịch vụ bổ sung cho đơn mua hộ",
  triggerDescription = "",

  modalEyebrow = "DỊCH VỤ BỔ SUNG",
  modalTitle = "Lựa chọn dịch vụ cho đơn mua hộ",
  modalDescription =
    "Danh sách được cập nhật trực tiếp từ bảng giá hệ thống. Khi có dịch vụ mới, giao diện sẽ tự động hiển thị thêm.",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pricingRules, setPricingRules] = useState([]);
  const [hiddenPricingRuleIds, setHiddenPricingRuleIds] = useState([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState("");
  const [draftSelectedCodes, setDraftSelectedCodes] = useState([]);


  useEffect(() => {
    const controller = new AbortController();

    const fetchPricingRules = async () => {
      try {
        setPricingLoading(true);
        setPricingError("");

        /*
          orderType=CONSIGNMENT là BỘ LỌC CỦA BACKEND, không phải loại đơn:
          nó bỏ đúng ba nhóm chỉ thuộc về tiền hàng mua hộ (PURCHASE_FEE, VAT,
          IMPORT_TAX) và giữ lại các dịch vụ gắn theo KIỆN. Modal này chọn dịch
          vụ theo kiện, nên cả ký gửi lẫn mua hộ đều cần đúng bộ đó. Gọi không
          tham số sẽ kéo cả VAT và thuế nhập khẩu vào danh sách tick chọn.
        */
        const result = await pricingRuleService.getPricingRules({
          orderType: "CONSIGNMENT",
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        const normalizedRules = normalizeRulesFromApi(result);

        const hiddenRules = normalizedRules.filter(isHiddenRule);
        const visibleRules = normalizedRules.filter(
          (rule) => !isHiddenRule(rule),
        );

        setHiddenPricingRuleIds(
          hiddenRules
            .map((rule) => normalizeRuleId(rule.id))
            .filter(Boolean),
        );

        setPricingRules(visibleRules);
      } catch (error) {
        if (controller.signal.aborted || isCanceledRequest(error)) {
          return;
        }

        console.error(
          "[PackageOptionalServices] Lỗi tải /api/pricing-rules:",
          error,
        );

        setPricingRules([]);
        setPricingError(
          error?.message || "Không thể tải danh sách quy tắc tính phí.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setPricingLoading(false);
        }
      }
    };

    fetchPricingRules();

    return () => controller.abort();
  }, []);


  const selectedCodes = useMemo(
    () => getInitialSelectedCodes(value, pricingRules),
    [pricingRules, value],
  );


  useEffect(() => {
    const currentRuleCodes = normalizeStringArray(
      value?.selectedRuleCodes ??
        value?.selectedPricingRuleCodes ??
        value?.pricingRuleCodes,
    ).map(normalizeCode);

    const currentPricingRuleIds = normalizeStringArray(
      value?.selectedPricingRuleIds ??
        value?.pricingRuleIds,
    ).map(normalizeRuleId);

    const sanitizedRuleCodes =
      sanitizeSelectedRuleCodes(currentRuleCodes);

    const sanitizedPricingRuleIds =
      sanitizeSelectedPricingRuleIds(
        currentPricingRuleIds,
        hiddenPricingRuleIds,
      );

    const hasHiddenRuleCode =
      !areStringArraysEqual(
        currentRuleCodes,
        sanitizedRuleCodes,
      );

    const hasHiddenRuleId =
      !areStringArraysEqual(
        currentPricingRuleIds,
        sanitizedPricingRuleIds,
      );

    if (!hasHiddenRuleCode && !hasHiddenRuleId) {
      return;
    }

    onChange?.({
      ...value,
      selectedRuleCodes: sanitizedRuleCodes,
      selectedPricingRuleIds: sanitizedPricingRuleIds,
    });
  }, [
    hiddenPricingRuleIds,
    onChange,
    value,
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const timeoutId = window.setTimeout(
      () => setDraftSelectedCodes(selectedCodes),
      0,
    );
    return () => window.clearTimeout(timeoutId);
  }, [
    isOpen,
    selectedCodes,
  ]);

  const selectedRules = useMemo(() => {
    const selectedSet = new Set(selectedCodes);
    return pricingRules.filter((rule) => selectedSet.has(rule.ruleCode));
  }, [pricingRules, selectedCodes]);

  const selectedDraftRules = useMemo(() => {
    const selectedSet = new Set(draftSelectedCodes);
    return pricingRules.filter((rule) => selectedSet.has(rule.ruleCode));
  }, [draftSelectedCodes, pricingRules]);

  const woodCrateRule = useMemo(
    () =>
      pricingRules.find(
        (rule) =>
          rule.ruleCode ===
          "WOOD_CRATE",
      ) || null,
    [pricingRules],
  );

  const isDraftWoodCrateSelected =
    draftSelectedCodes.includes(
      "WOOD_CRATE",
    );

  const normalizedPackages = useMemo(
    () =>
      Array.isArray(packages)
        ? packages.filter(Boolean)
        : [],
    [packages],
  );

  const incompleteWoodCrateProducts =
    useMemo(
      () =>
        getIncompleteProducts(
          normalizedPackages,
        ),
      [normalizedPackages],
    );

  const allProductsReadyForWoodCrate =
    normalizedPackages.length > 0 &&
    incompleteWoodCrateProducts.length === 0;

  const incompleteProductsMessage =
    useMemo(
      () =>
        formatIncompleteProductsMessage(
          incompleteWoodCrateProducts,
        ),
      [incompleteWoodCrateProducts],
    );

  const woodCrateUnitFee =
    toFiniteNumberOrNull(
      woodCrateRule?.value,
    ) ?? 0;

  const draftWoodCratePricing =
    useMemo(
      () =>
        calculateWoodCratePricing({
          packages:
            normalizedPackages,
          unitFee:
            woodCrateUnitFee,
          enabled:
            isDraftWoodCrateSelected,
        }),
      [
        normalizedPackages,
        woodCrateUnitFee,
        isDraftWoodCrateSelected,
      ],
    );

  /*
   * Nếu người dùng đã chọn đóng thùng gỗ rồi thêm một dòng
   * sản phẩm trống hoặc xóa dữ liệu bắt buộc, tự bỏ riêng
   * WOOD_CRATE. Các dịch vụ VAT, thuế, bảo hiểm... vẫn giữ nguyên.
   */
  useEffect(() => {
    if (
      !value?.requiresWoodenCrate ||
      allProductsReadyForWoodCrate
    ) {
      return;
    }

    const nextRuleCodes =
      sanitizeSelectedRuleCodes(
        value?.selectedRuleCodes ??
          value?.selectedPricingRuleCodes ??
          value?.pricingRuleCodes,
      ).filter(
        (ruleCode) =>
          ruleCode !== "WOOD_CRATE",
      );

    const woodCrateRuleId =
      normalizeRuleId(
        woodCrateRule?.id,
      );

    const nextPricingRuleIds =
      sanitizeSelectedPricingRuleIds(
        value?.selectedPricingRuleIds ??
          value?.pricingRuleIds,
        hiddenPricingRuleIds,
      ).filter(
        (ruleId) =>
          !woodCrateRuleId ||
          ruleId !== woodCrateRuleId,
      );

    const hasOtherPackingService =
      pricingRules.some(
        (rule) =>
          rule.ruleCode !== "WOOD_CRATE" &&
          nextRuleCodes.includes(
            rule.ruleCode,
          ) &&
          (
            rule.ruleCode.includes(
              "PACKING",
            ) ||
            rule.ruleType.includes(
              "PACKING",
            )
          ),
      );

    onChange?.({
      ...value,
      requiresPacking:
        hasOtherPackingService,
      requiresWoodenCrate: false,
      selectedRuleCodes:
        nextRuleCodes,
      selectedPricingRuleIds:
        nextPricingRuleIds,
      pricingRuleIds:
        nextPricingRuleIds,
      woodCratePackageCount: 0,
      woodCrateQuantity: 0,
      woodCrateUnitFee: 0,
      woodCrateBaseFeePerPackage: 0,
      woodCrateBaseFee: 0,
      woodCrateConfigurationFee: 0,
      woodCrateTotalFee: 0,
      woodCrateCompleted: false,
      packageConfigurationByPackageId: {},
      selectedPackageConfigurations: [],
    });

    AuthNotify.warning(
      "Đã bỏ đóng thùng gỗ",
      "Bạn vừa thêm hoặc xóa dữ liệu bắt buộc của sản phẩm. Vui lòng nhập đủ thông tin rồi chọn lại đóng thùng gỗ.",
    );
  }, [
    allProductsReadyForWoodCrate,
    hiddenPricingRuleIds,
    onChange,
    pricingRules,
    value,
    value?.requiresWoodenCrate,
    value?.pricingRuleIds,
    value?.selectedPricingRuleIds,
    value?.selectedPricingRuleCodes,
    value?.selectedRuleCodes,
    value?.pricingRuleCodes,
    woodCrateRule?.id,
  ]);

  /*
   * Khi thêm/xóa sản phẩm sau khi đã chọn đóng thùng gỗ,
   * tự đồng bộ số kiện và tổng phí vào form cha.
   */
  useEffect(() => {
    if (
      !value?.requiresWoodenCrate ||
      !allProductsReadyForWoodCrate
    ) {
      return;
    }

    const pricing =
      calculateWoodCratePricing({
        packages:
          normalizedPackages,
        unitFee:
          woodCrateUnitFee ||
          value?.woodCrateUnitFee ||
          value?.woodCrateBaseFeePerPackage,
        enabled: true,
      });

    const currentCount =
      Number(
        value?.woodCratePackageCount ??
        value?.woodCrateQuantity,
      ) || 0;

    const currentTotal =
      Number(
        value?.woodCrateTotalFee,
      ) || 0;

    if (
      currentCount ===
        pricing.packageCount &&
      currentTotal ===
        pricing.totalFee
    ) {
      return;
    }

    onChange?.({
      ...value,
      woodCratePackageCount:
        pricing.packageCount,
      woodCrateQuantity:
        pricing.packageCount,
      woodCrateUnitFee:
        pricing.unitFee,
      woodCrateBaseFeePerPackage:
        pricing.unitFee,
      woodCrateBaseFee:
        pricing.totalFee,
      woodCrateConfigurationFee: 0,
      woodCrateTotalFee:
        pricing.totalFee,
      woodCrateCompleted:
        pricing.packageCount > 0,
      packageConfigurationByPackageId: {},
      selectedPackageConfigurations: [],
    });
  }, [
    allProductsReadyForWoodCrate,
    normalizedPackages,
    onChange,
    value,
    value?.requiresWoodenCrate,
    value?.woodCratePackageCount,
    value?.woodCrateQuantity,
    value?.woodCrateTotalFee,
    value?.woodCrateUnitFee,
    value?.woodCrateBaseFeePerPackage,
    woodCrateUnitFee,
  ]);

  const hasChanges = useMemo(
    () =>
      !areCodeArraysEqual(
        selectedCodes,
        draftSelectedCodes,
      ),
    [
      draftSelectedCodes,
      selectedCodes,
    ],
  );

  const handleOpen = () => {
    if (disabled) {
      return;
    }

    setDraftSelectedCodes(selectedCodes);
    setIsOpen(true);
  };

  const handleToggle = (rule) => {
    if (
      disabled ||
      isHiddenRule(rule) ||
      !isRuleSelectable(rule) ||
      rule.isRequired
    ) {
      return;
    }

    const isCurrentlySelected =
      draftSelectedCodes.includes(
        rule.ruleCode,
      );

    if (
      rule.ruleCode === "WOOD_CRATE" &&
      !isCurrentlySelected &&
      !allProductsReadyForWoodCrate
    ) {
      AuthNotify.warning(
        normalizedPackages.length === 0
          ? "Chưa có sản phẩm"
          : "Chưa nhập đủ dữ liệu sản phẩm",
        normalizedPackages.length === 0
          ? "Vui lòng thêm ít nhất một sản phẩm trước khi chọn đóng thùng gỗ."
          : `Vui lòng hoàn tất các trường bắt buộc trước khi chọn đóng thùng gỗ. ${incompleteProductsMessage}`,
      );
      return;
    }

    setDraftSelectedCodes((currentCodes) => {
      const nextCodes =
        new Set(currentCodes);

      if (
        nextCodes.has(rule.ruleCode)
      ) {
        nextCodes.delete(
          rule.ruleCode,
        );
      } else {
        nextCodes.add(
          rule.ruleCode,
        );
      }

      return Array.from(nextCodes);
    });
  };


  const handleClose = () => {
    setDraftSelectedCodes(selectedCodes);
    setIsOpen(false);
  };

  const handleSave = () => {
    if (disabled) {
      return;
    }

    const selectedSet = new Set(
      sanitizeSelectedRuleCodes(
        draftSelectedCodes,
      ),
    );

    const activeSelectedRules =
      pricingRules.filter(
        (rule) =>
          !isHiddenRule(rule) &&
          selectedSet.has(
            rule.ruleCode,
          ) &&
          isRuleSelectable(rule),
      );

    const selectedRuleCodes =
      sanitizeSelectedRuleCodes(
        activeSelectedRules.map(
          (rule) => rule.ruleCode,
        ),
      );

    const selectedPricingRuleIds =
      sanitizeSelectedPricingRuleIds(
        activeSelectedRules.map(
          (rule) => rule.id,
        ),
        hiddenPricingRuleIds,
      );

    const requiresWoodenCrate =
      selectedRuleCodes.includes(
        "WOOD_CRATE",
      );

    const woodCratePricing =
      calculateWoodCratePricing({
        packages:
          normalizedPackages,
        unitFee:
          woodCrateUnitFee,
        enabled:
          requiresWoodenCrate,
      });

    if (
      requiresWoodenCrate &&
      !allProductsReadyForWoodCrate
    ) {
      AuthNotify.warning(
        normalizedPackages.length === 0
          ? "Chưa có sản phẩm"
          : "Chưa nhập đủ dữ liệu sản phẩm",
        normalizedPackages.length === 0
          ? "Vui lòng thêm ít nhất một sản phẩm trước khi chọn đóng thùng gỗ."
          : `Vui lòng hoàn tất các trường bắt buộc trước khi lưu dịch vụ đóng thùng gỗ. ${incompleteProductsMessage}`,
      );
      return;
    }

    const nextValue = {
      ...value,

      requiresPacking:
        selectedRuleCodes.some(
          (code) =>
            code.includes(
              "PACKING",
            ),
        ) ||
        requiresWoodenCrate,

      requiresWoodenCrate,

      requiresInsurance:
        activeSelectedRules.some(
          (rule) =>
            rule.ruleCode.includes(
              "INSURANCE",
            ) ||
            rule.ruleType.includes(
              "INSURANCE",
            ),
        ),

      /*
       * Giữ tương thích với dữ liệu cũ.
       * API mua hộ có thể chỉ dùng pricingRuleIds.
       */
      requiresInspection:
        activeSelectedRules.some(
          (rule) =>
            rule.ruleCode.includes(
              "INSPECTION",
            ) ||
            rule.ruleType.includes(
              "INSPECTION",
            ),
        ),

      selectedRuleCodes,
      selectedPricingRuleIds,
      pricingRuleIds:
        selectedPricingRuleIds,

      /*
       * Mua hộ không chọn kích thước/cấu hình thùng.
       * Mỗi dòng sản phẩm là 1 kiện, không nhân quantity.
       */
      woodCratePackageCount:
        woodCratePricing.packageCount,
      woodCrateQuantity:
        woodCratePricing.packageCount,
      woodCrateUnitFee:
        woodCratePricing.unitFee,
      woodCrateBaseFeePerPackage:
        woodCratePricing.unitFee,
      woodCrateBaseFee:
        woodCratePricing.totalFee,
      woodCrateConfigurationFee: 0,
      woodCrateTotalFee:
        woodCratePricing.totalFee,
      woodCrateCompleted:
        !requiresWoodenCrate ||
        woodCratePricing.packageCount > 0,

      packageConfigurationByPackageId: {},
      selectedPackageConfigurations: [],
    };

    try {
      onChange?.(nextValue);
      setIsOpen(false);

      if (
        activeSelectedRules.length > 0
      ) {
        AuthNotify.success(
          "Đã lưu dịch vụ bổ sung",
          `Đã chọn: ${activeSelectedRules
            .map(getRuleDisplayName)
            .join(", ")}.`,
        );
      } else {
        AuthNotify.success(
          "Đã cập nhật dịch vụ",
          "Đơn mua hộ không chọn dịch vụ bổ sung.",
        );
      }
    } catch (error) {
      AuthNotify.error(
        "Không thể lưu dịch vụ",
        error?.message ||
          "Đã xảy ra lỗi khi lưu lựa chọn dịch vụ.",
      );
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        className={[
          "package-services-trigger",
          selectedRules.length > 0 && "package-services-trigger--active",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={handleOpen}
      >
        <span className="package-services-trigger__icon" aria-hidden="true">
          <GiftOutlined />
        </span>

        <span className="package-services-trigger__body">
          <span className="package-services-trigger__title-row">
            <strong>{triggerTitle}</strong>

            <Tooltip
              placement="top"
              title="Danh sách dịch vụ được tải trực tiếp từ hệ thống và tự động cập nhật khi bảng giá thay đổi."
            >
              <InfoCircleOutlined
                aria-label="Thông tin dịch vụ bổ sung"
                className="package-services-trigger__info"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
            </Tooltip>
          </span>

          {selectedRules.length > 0 ? (
            <span className="package-services-trigger__chips">
              {selectedRules.map((rule) => (
                <span key={rule.id || rule.ruleCode}>
                  <CheckOutlined />
                  {getRuleDisplayName(rule)}

                  {rule.ruleCode ===
                    "WOOD_CRATE" &&
                    Number(
                      value?.woodCrateTotalFee,
                    ) > 0 && (
                      <b className="package-services-trigger__wood-price">
                        {formatMoney(
                          value.woodCrateTotalFee,
                        )}
                      </b>
                    )}
                </span>
              ))}
            </span>
          ) : (
            <span className="package-services-trigger__description">
              {pricingLoading
                ? "Đang tải dữ liệu bảng giá..."
                : triggerDescription ||
                  `${pricingRules.length} dịch vụ đang có trên hệ thống.`}
            </span>
          )}
        </span>

        <span
          className={[
            "package-services-trigger__status",
            selectedRules.length > 0 ? "is-active" : "is-optional",
          ].join(" ")}
        >
          <span className="package-services-trigger__status-dot" />
          {selectedRules.length > 0
            ? `${selectedRules.length} đã chọn`
            : "Không bắt buộc"}
        </span>
      </button>

      <Modal
        open={isOpen}
        centered
        width={1040}
        footer={null}
        closable={!disabled}
        mask={{ closable: !disabled }}
        keyboard={!disabled}
        destroyOnHidden
        closeIcon={<CloseOutlined />}
        className="package-services-modal"
        onCancel={handleClose}
      >
        <div className="package-services-modal__header">
          <span
            className="package-services-modal__header-icon"
            aria-hidden="true"
          >
            <GiftOutlined />
          </span>

          <div className="package-services-modal__header-content">
            <span className="package-services-modal__eyebrow">
              {modalEyebrow}
            </span>
            <h2>{modalTitle}</h2>
            <p>{modalDescription}</p>
          </div>
        </div>

        <div className="package-services-modal__notice">
          {pricingLoading ? <LoadingOutlined spin /> : <InfoCircleOutlined />}
          <span>
            {pricingLoading
              ? "Đang tải danh sách dịch vụ..."
              : pricingError
                ? pricingError
                : `Đang hiển thị ${pricingRules.length} dịch vụ. Hệ số quy đổi thể tích không hiển thị trong danh sách lựa chọn.`}
          </span>
        </div>

        <div className="package-services-modal__list">
          {pricingLoading ? (
            <div className="package-services-modal__api-state">
              <LoadingOutlined spin />
              <strong>Đang tải danh sách dịch vụ</strong>
              <span>Vui lòng chờ trong giây lát.</span>
            </div>
          ) : pricingError ? (
            <div className="package-services-modal__api-state is-error">
              <InfoCircleOutlined />
              <strong>Không tải được danh sách dịch vụ</strong>
              <span>{pricingError}</span>
            </div>
          ) : pricingRules.length === 0 ? (
            <div className="package-services-modal__api-state">
              <InfoCircleOutlined />
              <strong>Chưa có dịch vụ bổ sung</strong>
              <span>Hệ thống hiện chưa có dịch vụ phù hợp để lựa chọn.</span>
            </div>
          ) : (
            pricingRules.map((rule, ruleIndex) => {
              const Icon = getRuleIcon(rule);
              const checked = draftSelectedCodes.includes(rule.ruleCode);
              const selectable = isRuleSelectable(rule);
              const woodCrateProductDataMissing =
                rule.ruleCode === "WOOD_CRATE" &&
                !checked &&
                !allProductsReadyForWoodCrate;

              const itemDisabled =
                disabled ||
                !selectable ||
                rule.isRequired ||
                woodCrateProductDataMissing;

              return (
                <React.Fragment
                  key={
                    rule.id ||
                    rule.ruleCode ||
                    ruleIndex
                  }
                >
                <div
                  role="checkbox"
                  tabIndex={itemDisabled ? -1 : 0}
                  aria-checked={checked}
                  aria-disabled={itemDisabled}
                  style={{ "--service-index": ruleIndex }}
                  className={[
                    "package-services-modal__item",
                    checked && "package-services-modal__item--selected",
                    itemDisabled && "package-services-modal__item--disabled",
                    woodCrateProductDataMissing &&
                      "package-services-modal__item--measurement-required",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleToggle(rule)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleToggle(rule);
                    }
                  }}
                >
                  <span className="package-services-modal__checkbox">
                    <Checkbox
                      checked={checked}
                      disabled={itemDisabled}
                      tabIndex={-1}
                      style={{ pointerEvents: "none" }}
                    />
                  </span>

                  <span
                    className="package-services-modal__service-icon"
                    aria-hidden="true"
                  >
                    <Icon />
                  </span>

                  <span className="package-services-modal__content">
                    <span className="package-services-modal__title-row">
                      <strong>{getRuleDisplayName(rule)}</strong>

                      <Tooltip placement="top" title={formatRuleInformation(rule)}>
                        <InfoCircleOutlined
                          aria-label={`Thông tin ${getRuleDisplayName(rule)}`}
                          className="package-services-modal__info-icon"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                        />
                      </Tooltip>
                    </span>

                    <span className="package-services-modal__rule-meta">
                      <b title={rule.ruleCode || undefined}>
                        {getRuleCodeLabel(rule)}
                      </b>

                      <i title={rule.ruleType || undefined}>
                        {getRuleTypeLabel(rule)}
                      </i>

                      <em
                        className={`status-${getStatusClassName(rule.status)}`}
                      >
                        {getStatusLabel(rule.status)}
                      </em>
                    </span>

                    <span className="package-services-modal__description">
                      {formatRuleDescription(rule.description)}
                    </span>

                    {woodCrateProductDataMissing && (
                      <span className="package-services-modal__measurement-warning">
                        <InfoCircleOutlined />
                        {normalizedPackages.length === 0
                          ? "Thêm ít nhất một sản phẩm trước khi chọn."
                          : `Còn ${incompleteWoodCrateProducts.length} sản phẩm chưa nhập đủ dữ liệu bắt buộc.`}
                      </span>
                    )}

                  </span>

                  <span className="package-services-modal__fee">
                    <small>
                      {rule.ruleCode === "WOOD_CRATE"
                        ? "Phí đóng thùng / kiện"
                        : getCalculationTypeLabel(
                            rule.calculationType,
                          )}
                    </small>

                    <strong>
                      {formatRuleFee(rule)}
                    </strong>

                    {rule.ruleCode ===
                      "WOOD_CRATE" &&
                      checked && (
                        <em className="package-services-modal__wood-total">
                          {draftWoodCratePricing.packageCount}
                          {" kiện × "}
                          {formatMoney(
                            draftWoodCratePricing.unitFee,
                          )}
                          {" = "}
                          {formatMoney(
                            draftWoodCratePricing.totalFee,
                          )}
                        </em>
                      )}
                  </span>
                </div>

                {rule.ruleCode ===
                  "WOOD_CRATE" &&
                  checked && (
                    <WoodCrateByProductPanel
                      packages={
                        normalizedPackages
                      }
                      unitFee={
                        woodCrateUnitFee
                      }
                    />
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="package-services-modal__summary">
          <div className="package-services-modal__summary-count">
            <span>Dịch vụ đã chọn</span>
            <strong>{selectedDraftRules.length}</strong>
          </div>
          <p>
            {selectedDraftRules.length > 0
              ? selectedDraftRules
                  .map(getRuleDisplayName)
                  .join(", ")
              : "Chưa chọn dịch vụ bổ sung"}
          </p>

          {draftWoodCratePricing.totalFee > 0 && (
            <div className="package-services-modal__wood-summary">
              <span>
                Tổng phí đóng thùng gỗ
              </span>

              <strong>
                {formatMoney(
                  draftWoodCratePricing.totalFee,
                )}
              </strong>
            </div>
          )}
        </div>

        <div className="package-services-modal__footer">
          <button
            type="button"
            className="package-services-modal__cancel"
            disabled={disabled}
            onClick={handleClose}
          >
            <CloseOutlined />
            Hủy
          </button>

          <button
            type="button"
            className={[
              "package-services-modal__save",
              hasChanges && "has-changes",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={disabled || pricingLoading || Boolean(pricingError)}
            onClick={handleSave}
          >
            <CheckOutlined />
            Lưu lựa chọn
          </button>
        </div>
      </Modal>
    </>
  );
}
