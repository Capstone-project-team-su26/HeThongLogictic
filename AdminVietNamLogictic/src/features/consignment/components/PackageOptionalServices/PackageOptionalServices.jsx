import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckOutlined,
  CloseOutlined,
  GiftOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { Checkbox, Modal, Tooltip } from "antd";

import pricingRuleService from "@features/pricing/api/pricingRuleService.mock";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import { WOOD_CRATE_CODE } from "./PackageOptionalServices.constants";
import {
  areCodeArraysEqual,
  areConfigurationMapsEqual,
  areStringArraysEqual,
  formatConfigurationDimensions,
  formatMoney,
  formatNumber,
  formatPackageDimensions,
  formatRuleDescription,
  formatRuleFee,
  formatRuleInformation,
  getCalculationTypeLabel,
  getInitialSelectedCodes,
  getPackageConfigurationMapFromValue,
  getPackageSuggestionPayload,
  getRuleAvailability,
  getRuleCodeLabel,
  getRuleDisplayName,
  getRuleIcon,
  getRuleTypeLabel,
  getStatusClassName,
  getStatusLabel,
  isCanceledRequest,
  isHiddenRule,
  isInsuranceRule,
  isRuleSelectable,
  isWoodCrateRule,
  normalizeCode,
  normalizePackageConfiguration,
  normalizePackageConfigurationsFromApi,
  normalizePackageItems,
  normalizeRuleId,
  normalizeRulesFromApi,
  normalizeStringArray,
  sanitizeSelectedPricingRuleIds,
  sanitizeSelectedRuleCodes,
} from "./PackageOptionalServices.helpers";
import "./PackageOptionalServices.css";

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
};

export default function PackageOptionalServices({
  value = EMPTY_PACKAGE_SERVICES,
  packages = [],
  disabled = false,
  onChange,

  triggerTitle = "Dịch vụ bổ sung cho đơn ký gửi",
  triggerDescription = "",

  modalEyebrow = "DỊCH VỤ BỔ SUNG",
  modalTitle = "Lựa chọn dịch vụ cho đơn ký gửi",
  modalDescription =
    "Danh sách được cập nhật trực tiếp từ bảng giá hệ thống. Khi có dịch vụ mới, giao diện sẽ tự động hiển thị thêm.",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pricingRules, setPricingRules] = useState([]);
  const [hiddenPricingRuleIds, setHiddenPricingRuleIds] = useState([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState("");
  const [draftSelectedCodes, setDraftSelectedCodes] = useState([]);

  const [
    packageConfigurations,
    setPackageConfigurations,
  ] = useState([]);
  const [
    packageConfigurationsLoading,
    setPackageConfigurationsLoading,
  ] = useState(true);
  const [
    packageConfigurationsError,
    setPackageConfigurationsError,
  ] = useState("");

  const [
    draftPackageConfigurationByPackageId,
    setDraftPackageConfigurationByPackageId,
  ] = useState({});

  const [
    suggestedConfigurationByPackageId,
    setSuggestedConfigurationByPackageId,
  ] = useState({});

  const [
    suggestionLoadingByPackageId,
    setSuggestionLoadingByPackageId,
  ] = useState({});

  const [
    suggestionErrorByPackageId,
    setSuggestionErrorByPackageId,
  ] = useState({});

  const [
    autoSuggestionSignatureByPackageId,
    setAutoSuggestionSignatureByPackageId,
  ] = useState({});

  /*
   * Chỉ cho phép tự động gọi API gợi ý sau khi người dùng
   * CHỦ ĐỘNG bấm chọn "Đóng thùng gỗ" trong lần mở modal hiện tại.
   *
   * Nhờ vậy:
   * - Mở modal không tự POST gợi ý.
   * - Nhập/sửa kích thước không tự POST nếu chưa chọn thùng gỗ.
   * - Dữ liệu WOOD_CRATE cũ trong form cha cũng không làm API tự chạy.
   */
  const [
    woodCrateAutoSuggestionEnabled,
    setWoodCrateAutoSuggestionEnabled,
  ] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchPricingRules = async () => {
      try {
        setPricingLoading(true);
        setPricingError("");

        // Gọi đúng endpoint và lấy TOÀN BỘ dữ liệu thật từ API.
        // Không truyền ruleCodes, không dùng mảng dữ liệu mẫu.
        const result = await pricingRuleService.getPricingRules({
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

  const loadPackageConfigurations = useCallback(
    async (options = {}) => {
      const { signal } = options;

      try {
        setPackageConfigurationsLoading(true);
        setPackageConfigurationsError("");

        if (
          typeof pricingRuleService.getPackageConfigurations !==
          "function"
        ) {
          throw new Error(
            "pricingRuleService chưa có hàm getPackageConfigurations.",
          );
        }

        const result =
          await pricingRuleService.getPackageConfigurations({
            signal,
            onlyActive: true,
          });

        if (signal?.aborted) {
          return [];
        }

        const configurations =
          normalizePackageConfigurationsFromApi(result);

        setPackageConfigurations(configurations);

        return configurations;
      } catch (error) {
        if (
          signal?.aborted ||
          isCanceledRequest(error)
        ) {
          return [];
        }

        console.error(
          "[PackageOptionalServices] Lỗi tải /api/package-configurations:",
          error,
        );

        const message =
          error?.message ||
          "Không thể tải danh sách kích thước thùng.";

        setPackageConfigurations([]);
        setPackageConfigurationsError(message);

        return [];
      } finally {
        if (!signal?.aborted) {
          setPackageConfigurationsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      loadPackageConfigurations({
        signal: controller.signal,
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadPackageConfigurations]);

  const packageItems = useMemo(
    () => normalizePackageItems(packages),
    [packages],
  );

  const selectedPackageConfigurationByPackageId =
    useMemo(
      () =>
        getPackageConfigurationMapFromValue(value),
      [value],
    );

  const selectedCodes = useMemo(
    () => getInitialSelectedCodes(value, pricingRules),
    [pricingRules, value],
  );

  /*
   * Tự động loại DOMESTIC_FEE khỏi state của component cha.
   * Điều này xử lý trường hợp ID/code cũ đã tồn tại nhưng người dùng
   * không mở modal và không bấm "Lưu lựa chọn".
   */
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

    const timeoutId = window.setTimeout(() => {
      setDraftSelectedCodes(selectedCodes);
      setDraftPackageConfigurationByPackageId(
        selectedPackageConfigurationByPackageId,
      );
      setSuggestionErrorByPackageId({});
      setAutoSuggestionSignatureByPackageId({});
      setWoodCrateAutoSuggestionEnabled(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    isOpen,
    selectedCodes,
    selectedPackageConfigurationByPackageId,
  ]);

  const selectedRules = useMemo(() => {
    const selectedSet = new Set(selectedCodes);
    return pricingRules.filter((rule) => selectedSet.has(rule.ruleCode));
  }, [pricingRules, selectedCodes]);

  /*
   * Khi người dùng xóa dữ liệu bắt buộc sau khi đã chọn dịch vụ,
   * tự động bỏ dịch vụ không còn đủ điều kiện khỏi form cha.
   */
  useEffect(() => {
    if (pricingLoading || !pricingRules.length) {
      return;
    }

    const selectedSet = new Set(selectedCodes);
    const unavailableSelectedRules = pricingRules.filter(
      (rule) =>
        !rule.isRequired &&
        selectedSet.has(rule.ruleCode) &&
        !getRuleAvailability(rule, packageItems).available,
    );

    if (!unavailableSelectedRules.length) {
      return;
    }

    const unavailableCodes = new Set(
      unavailableSelectedRules.map((rule) => rule.ruleCode),
    );

    const nextSelectedRules = pricingRules.filter(
      (rule) =>
        !isHiddenRule(rule) &&
        selectedSet.has(rule.ruleCode) &&
        !unavailableCodes.has(rule.ruleCode) &&
        isRuleSelectable(rule),
    );

    const selectedRuleCodes = sanitizeSelectedRuleCodes(
      nextSelectedRules.map((rule) => rule.ruleCode),
    );

    const selectedPricingRuleIds = sanitizeSelectedPricingRuleIds(
      nextSelectedRules.map((rule) => rule.id),
      hiddenPricingRuleIds,
    );

    const requiresWoodenCrate = nextSelectedRules.some(isWoodCrateRule);
    const requiresInsurance = nextSelectedRules.some(isInsuranceRule);

    onChange?.({
      ...value,
      requiresPacking: nextSelectedRules.some((rule) =>
        rule.ruleCode.includes("PACKING"),
      ),
      requiresWoodenCrate,
      requiresInsurance,
      requiresInspection: nextSelectedRules.some(
        (rule) =>
          rule.ruleCode.includes("INSPECTION") ||
          rule.ruleType.includes("INSPECTION"),
      ),
      selectedRuleCodes,
      selectedPricingRuleIds,
      ...(requiresWoodenCrate
        ? {}
        : {
            packageConfigurationByPackageId: {},
            selectedPackageConfigurations: [],
            woodCrateBaseFeePerPackage: 0,
            woodCrateBaseFee: 0,
            woodCrateConfigurationFee: 0,
            woodCrateTotalFee: 0,
            woodCrateCompleted: false,
          }),
    });
  }, [
    hiddenPricingRuleIds,
    onChange,
    packageItems,
    pricingLoading,
    pricingRules,
    selectedCodes,
    value,
  ]);

  const selectedDraftRules = useMemo(() => {
    const selectedSet = new Set(draftSelectedCodes);
    return pricingRules.filter((rule) => selectedSet.has(rule.ruleCode));
  }, [draftSelectedCodes, pricingRules]);

  const hasChanges = useMemo(
    () =>
      !areCodeArraysEqual(
        selectedCodes,
        draftSelectedCodes,
      ) ||
      !areConfigurationMapsEqual(
        selectedPackageConfigurationByPackageId,
        draftPackageConfigurationByPackageId,
      ),
    [
      draftPackageConfigurationByPackageId,
      draftSelectedCodes,
      selectedCodes,
      selectedPackageConfigurationByPackageId,
    ],
  );

  const handleSelectPackageConfiguration = (
    packageId,
    configurationId,
  ) => {
    if (disabled) {
      return;
    }

    setDraftPackageConfigurationByPackageId(
      (previous) => ({
        ...previous,
        [packageId]: configurationId,
      }),
    );

    setSuggestionErrorByPackageId(
      (previous) => ({
        ...previous,
        [packageId]: "",
      }),
    );
  };

  const handleSuggestPackageConfiguration =
    useCallback(
      async (
        packageItem,
        {
          silent = false,
        } = {},
      ) => {
        const packageId =
          String(packageItem?.id || "").trim();

        if (!packageId) {
          return null;
        }

        const requestPayload =
          getPackageSuggestionPayload(packageItem);

        if (!requestPayload) {
          const message =
            "Cần nhập đầy đủ dài, rộng, cao và trọng lượng lớn hơn 0 trước khi gợi ý thùng.";

          setSuggestionErrorByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: message,
            }),
          );

          if (!silent) {
            AuthNotify.warning(
              "Chưa đủ thông tin kiện",
              message,
            );
          }

          return null;
        }

        try {
          setSuggestionLoadingByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: true,
            }),
          );

          setSuggestionErrorByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: "",
            }),
          );

          if (
            typeof pricingRuleService
              .suggestPackageConfiguration !==
            "function"
          ) {
            throw new Error(
              "pricingRuleService chưa có hàm suggestPackageConfiguration.",
            );
          }

          const suggestion =
            await pricingRuleService
              .suggestPackageConfiguration(
                requestPayload,
              );

          const normalizedSuggestion =
            normalizePackageConfiguration(
              suggestion,
            );

          const suggestedId =
            normalizedSuggestion.id;

          if (!suggestedId) {
            throw new Error(
              "API gợi ý không trả về packageConfigurationId.",
            );
          }

          setPackageConfigurations(
            (previous) => {
              const exists = previous.some(
                (configuration) =>
                  configuration.id ===
                  suggestedId,
              );

              return exists
                ? previous
                : [
                    ...previous,
                    normalizedSuggestion,
                  ];
            },
          );

          setSuggestedConfigurationByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: suggestedId,
            }),
          );

          setDraftPackageConfigurationByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: suggestedId,
            }),
          );

          if (!silent) {
            AuthNotify.success(
              "Đã gợi ý kích thước thùng",
              `${packageItem.displayName}: ${normalizedSuggestion.configName}.`,
            );
          }

          return normalizedSuggestion;
        } catch (error) {
          if (isCanceledRequest(error)) {
            return null;
          }

          const message =
            error?.message ||
            "Không thể gợi ý kích thước thùng.";

          console.error(
            "[PackageOptionalServices] Lỗi POST /api/package-configurations/suggest:",
            error,
          );

          setSuggestionErrorByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: message,
            }),
          );

          if (!silent) {
            AuthNotify.error(
              "Gợi ý thùng thất bại",
              message,
            );
          }

          return null;
        } finally {
          setSuggestionLoadingByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: false,
            }),
          );
        }
      },
      [],
    );

  useEffect(() => {
    const hasWoodCrateSelected =
      draftSelectedCodes.includes(
        WOOD_CRATE_CODE,
      );

    if (
      !isOpen ||
      !hasWoodCrateSelected ||
      !woodCrateAutoSuggestionEnabled ||
      packageConfigurationsLoading ||
      packageConfigurationsError ||
      !packageItems.length
    ) {
      return;
    }

    const pendingPackages = packageItems.filter(
      (packageItem) => {
        const packageId = packageItem.id;
        const payload =
          getPackageSuggestionPayload(packageItem);

        if (
          !payload ||
          draftPackageConfigurationByPackageId[
            packageId
          ] ||
          suggestionLoadingByPackageId[packageId]
        ) {
          return false;
        }

        const signature = [
          payload.length,
          payload.width,
          payload.height,
          payload.weight,
        ].join("|");

        return (
          autoSuggestionSignatureByPackageId[
            packageId
          ] !== signature
        );
      },
    );

    if (!pendingPackages.length) {
      return;
    }

    // Record packages queued by this effect before starting async suggestions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoSuggestionSignatureByPackageId(
      (previous) => {
        const next = {
          ...previous,
        };

        pendingPackages.forEach(
          (packageItem) => {
            const payload =
              getPackageSuggestionPayload(
                packageItem,
              );

            next[packageItem.id] = [
              payload.length,
              payload.width,
              payload.height,
              payload.weight,
            ].join("|");
          },
        );

        return next;
      },
    );

    pendingPackages.forEach(
      (packageItem) => {
        handleSuggestPackageConfiguration(
          packageItem,
          {
            silent: true,
          },
        );
      },
    );
  }, [
    autoSuggestionSignatureByPackageId,
    draftPackageConfigurationByPackageId,
    draftSelectedCodes,
    handleSuggestPackageConfiguration,
    isOpen,
    packageConfigurationsError,
    packageConfigurationsLoading,
    packageItems,
    suggestionLoadingByPackageId,
    woodCrateAutoSuggestionEnabled,
  ]);

  const handleOpen = () => {
    if (disabled) {
      return;
    }

    setDraftSelectedCodes(selectedCodes);
    setDraftPackageConfigurationByPackageId(
      selectedPackageConfigurationByPackageId,
    );
    setSuggestionErrorByPackageId({});
    setAutoSuggestionSignatureByPackageId({});
    setWoodCrateAutoSuggestionEnabled(false);
    setIsOpen(true);
  };

  const handleToggle = (rule) => {
    if (
      disabled ||
      isHiddenRule(rule) ||
      !isRuleSelectable(rule) ||
      rule.isRequired ||
      !getRuleAvailability(rule, packageItems).available
    ) {
      return;
    }

    const normalizedRuleCode = normalizeCode(rule?.ruleCode);
    const isCurrentlySelected =
      draftSelectedCodes.includes(normalizedRuleCode);

    /*
     * Bật quyền tự gợi ý CHỈ tại thao tác người dùng chọn WOOD_CRATE.
     * Nếu WOOD_CRATE đã có sẵn từ value cũ khi mở modal thì API không tự POST.
     */
    if (normalizedRuleCode === WOOD_CRATE_CODE) {
      const willSelectWoodCrate = !isCurrentlySelected;

      setWoodCrateAutoSuggestionEnabled(
        willSelectWoodCrate,
      );

      if (willSelectWoodCrate) {
        // Cho phép tạo một lượt gợi ý mới sau cú bấm chọn này.
        setAutoSuggestionSignatureByPackageId({});
      } else {
        /*
         * Bỏ chọn đóng thùng gỗ phải xóa toàn bộ lựa chọn kích thước.
         * Dữ liệu gợi ý AI cũ không được giữ lại để tự kích hoạt về sau.
         */
        setDraftPackageConfigurationByPackageId({});
        setSuggestedConfigurationByPackageId({});
        setSuggestionErrorByPackageId({});
        setAutoSuggestionSignatureByPackageId({});
      }
    }

    setDraftSelectedCodes((currentCodes) => {
      const nextCodes = new Set(currentCodes);

      if (nextCodes.has(normalizedRuleCode)) {
        nextCodes.delete(normalizedRuleCode);
      } else {
        nextCodes.add(normalizedRuleCode);
      }

      return Array.from(nextCodes);
    });
  };

  const handleClose = () => {
    setDraftSelectedCodes(selectedCodes);
    setDraftPackageConfigurationByPackageId(
      selectedPackageConfigurationByPackageId,
    );
    setSuggestionErrorByPackageId({});
    setWoodCrateAutoSuggestionEnabled(false);
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
          selectedSet.has(rule.ruleCode) &&
          isRuleSelectable(rule) &&
          getRuleAvailability(rule, packageItems).available,
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
        WOOD_CRATE_CODE,
      );

    let packageConfigurationByPackageId = {};
    let selectedPackageConfigurations = [];
    let woodCrateOrderFee = 0;
    let woodCrateConfigurationFee = 0;
    let woodCrateTotalFee = 0;
    let woodCrateCompleted = false;

    if (requiresWoodenCrate) {
      if (!packageItems.length) {
        AuthNotify.warning(
          "Chưa có kiện hàng",
          "Hãy thêm ít nhất một kiện trước khi chọn đóng thùng gỗ.",
        );
        return;
      }

      const validConfigurationIds = new Set(
        packageConfigurations
          .map((configuration) => String(configuration?.id || "").trim())
          .filter(Boolean),
      );

      const missingPackages = packageItems.filter((packageItem) => {
        const configurationId = String(
          draftPackageConfigurationByPackageId[packageItem.id] || "",
        ).trim();

        return (
          !configurationId ||
          !validConfigurationIds.has(configurationId)
        );
      });

      if (missingPackages.length) {
        AuthNotify.warning(
          "Bắt buộc chọn kích thước thùng",
          `Đã chọn đóng thùng gỗ nên phải chọn cấu hình kích thước hợp lệ cho: ${missingPackages
            .map((packageItem) => packageItem.displayName)
            .join(", ")}.`,
        );
        return;
      }

      packageConfigurationByPackageId = Object.fromEntries(
        packageItems.map((packageItem) => [
          packageItem.id,
          String(
            draftPackageConfigurationByPackageId[packageItem.id],
          ).trim(),
        ]),
      );

      selectedPackageConfigurations = packageItems.map((packageItem) => {
        const packageConfigurationId =
          packageConfigurationByPackageId[packageItem.id];

        const configuration = packageConfigurations.find(
          (item) => item.id === packageConfigurationId,
        );

        return {
          packageId: packageItem.id,
          packageIndex: packageItem.index,
          productName: packageItem.displayName,
          packageConfigurationId,
          configCode: configuration?.configCode || "",
          configName:
            configuration?.configName || "Cấu hình đóng gói",
          length: Number(configuration?.length) || 0,
          width: Number(configuration?.width) || 0,
          height: Number(configuration?.height) || 0,
          maxWeight: Number(configuration?.maxWeight) || 0,
          packageFee: Number(configuration?.packageFee) || 0,
        };
      });

      const woodCrateRule = activeSelectedRules.find(isWoodCrateRule);

      // Phí rule đóng thùng được tính một lần cho toàn bộ đơn.
      woodCrateOrderFee = Number(woodCrateRule?.value) || 0;
      woodCrateConfigurationFee = selectedPackageConfigurations.reduce(
        (total, configuration) =>
          total + (Number(configuration?.packageFee) || 0),
        0,
      );
      woodCrateTotalFee =
        woodCrateOrderFee + woodCrateConfigurationFee;
      woodCrateCompleted =
        selectedPackageConfigurations.length === packageItems.length;
    }

    const nextValue = {
      ...value,
      requiresPacking:
        selectedRuleCodes.some(
          (code) =>
            code.includes("PACKING"),
        ),
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
      packageConfigurationByPackageId,
      selectedPackageConfigurations,
      woodCrateBaseFeePerPackage: 0,
      woodCrateOrderFee,
      woodCrateBaseFee: woodCrateOrderFee,
      woodCrateConfigurationFee,
      woodCrateTotalFee,
      woodCrateCompleted,
    };

    try {
      onChange?.(nextValue);
      setWoodCrateAutoSuggestionEnabled(false);
      setIsOpen(false);

      if (activeSelectedRules.length > 0) {
        AuthNotify.success(
          "Đã lưu dịch vụ bổ sung",
          `Đã chọn: ${activeSelectedRules
            .map(getRuleDisplayName)
            .join(", ")}.`,
        );
      } else {
        AuthNotify.success(
          "Đã cập nhật dịch vụ",
          "Đơn ký gửi không chọn dịch vụ bổ sung.",
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

  const renderPackageConfigurationPanel =
    () => {
      if (
        !draftSelectedCodes.includes(
          WOOD_CRATE_CODE,
        )
      ) {
        return null;
      }

      return (
        <div className="package-config-panel">
          <div className="package-config-panel__header">
            <div>
              <strong>
                Chọn kích thước thùng cho từng kiện hàng (bắt buộc)
              </strong>
              <span>
                Sau khi bạn chọn đóng thùng gỗ, hệ thống
                mới gọi API để gợi ý dựa trên dài, rộng,
                cao và trọng lượng của kiện hàng.
              </span>
            </div>

            <button
              type="button"
              className="package-config-panel__reload"
              disabled={
                disabled ||
                packageConfigurationsLoading
              }
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();

                loadPackageConfigurations();

                setAutoSuggestionSignatureByPackageId(
                  {},
                );
              }}
            >
              {packageConfigurationsLoading ? (
                <LoadingOutlined spin />
              ) : (
                <InfoCircleOutlined />
              )}
              Tải lại cấu hình hệ thống
            </button>
          </div>

          {packageConfigurationsLoading ? (
            <div className="package-config-panel__state">
              <LoadingOutlined spin />
              <span>
                Đang tải danh sách kích thước
                thùng...
              </span>
            </div>
          ) : packageConfigurationsError ? (
            <div className="package-config-panel__state is-error">
              <InfoCircleOutlined />
              <div>
                <strong>
                  Không tải được cấu hình thùng
                </strong>
                <span>
                  {packageConfigurationsError}
                </span>
              </div>
            </div>
          ) : !packageItems.length ? (
            <div className="package-config-panel__state">
              <InfoCircleOutlined />
              <span>
                Chưa có kiện hàng để lựa chọn cấu
                hình đóng gói.
              </span>
            </div>
          ) : (
            <div className="package-config-panel__packages">
              {packageItems.map(
                (packageItem) => {
                  const selectedConfigurationId =
                    draftPackageConfigurationByPackageId[
                      packageItem.id
                    ];

                  const suggestedConfigurationId =
                    suggestedConfigurationByPackageId[
                      packageItem.id
                    ];

                  const isSuggesting =
                    Boolean(
                      suggestionLoadingByPackageId[
                        packageItem.id
                      ],
                    );

                  const suggestionError =
                    suggestionErrorByPackageId[
                      packageItem.id
                    ];

                  const selectedConfiguration =
                    packageConfigurations.find(
                      (configuration) =>
                        configuration.id ===
                        selectedConfigurationId,
                    );

                  return (
                    <div
                      key={packageItem.id}
                      className="package-config-package"
                    >
                      <div className="package-config-package__heading">
                        <div>
                          <strong>
                            Kiện{" "}
                            {packageItem.index + 1}:{" "}
                            {
                              packageItem.displayName
                            }
                          </strong>
                          <span>
                            {formatPackageDimensions(
                              packageItem,
                            )}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="package-config-package__suggest"
                          disabled={
                            disabled ||
                            isSuggesting
                          }
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            handleSuggestPackageConfiguration(
                              packageItem,
                            );
                          }}
                        >
                          {isSuggesting ? (
                            <LoadingOutlined spin />
                          ) : (
                            <InfoCircleOutlined />
                          )}
                          {isSuggesting
                            ? "Đang gợi ý"
                            : suggestedConfigurationId
                              ? "Gợi ý lại"
                              : "Gợi ý kích thước"}
                        </button>
                      </div>

                      {suggestionError && (
                        <div className="package-config-package__error">
                          <InfoCircleOutlined />
                          <span>
                            {suggestionError}
                          </span>
                        </div>
                      )}

                      <div className="package-config-options">
                        {packageConfigurations.map(
                          (configuration) => {
                            const isSelected =
                              selectedConfigurationId ===
                              configuration.id;

                            const isSuggested =
                              suggestedConfigurationId ===
                              configuration.id;

                            const isCustom =
                              configuration.configCode ===
                              "CUSTOM";

                            return (
                              <button
                                key={
                                  configuration.id
                                }
                                type="button"
                                className={[
                                  "package-config-option",
                                  isSelected &&
                                    "package-config-option--selected",
                                  isCustom &&
                                    "package-config-option--custom",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={(
                                  event,
                                ) => {
                                  event.preventDefault();
                                  event.stopPropagation();

                                  handleSelectPackageConfiguration(
                                    packageItem.id,
                                    configuration.id,
                                  );
                                }}
                              >
                                <span className="package-config-option__top">
                                  <strong>
                                    {
                                      configuration.configName
                                    }
                                  </strong>

                                  {isSuggested && (
                                    <small>
                                      Hệ thống gợi ý
                                    </small>
                                  )}
                                </span>

                                <span className="package-config-option__code">
                                  {
                                    configuration.configCode
                                  }
                                </span>

                                <span className="package-config-option__dimension">
                                  {formatConfigurationDimensions(
                                    configuration,
                                  )}
                                </span>

                                <span className="package-config-option__meta">
                                  <span>
                                    {isCustom
                                      ? "Theo thông số thực tế"
                                      : `Tối đa ${formatNumber(
                                          configuration.maxWeight,
                                        )} kg`}
                                  </span>

                                  <b>
                                    {formatMoney(
                                      configuration.packageFee,
                                    )}
                                  </b>
                                </span>

                                {isSelected && (
                                  <span className="package-config-option__selected">
                                    <CheckOutlined />
                                    Đã chọn
                                  </span>
                                )}
                              </button>
                            );
                          },
                        )}
                      </div>

                      <div className="package-config-package__footer">
                        {selectedConfiguration ? (
                          <>
                            <CheckOutlined />
                            <span>
                              Đã chọn{" "}
                              <strong>
                                {
                                  selectedConfiguration.configName
                                }
                              </strong>{" "}
                              cho kiện này.
                            </span>
                          </>
                        ) : (
                          <>
                            <InfoCircleOutlined />
                            <span>
                              Chưa chọn cấu hình
                              thùng.
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </div>
      );
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
                : `Đang hiển thị ${pricingRules.length} dịch vụ.`}
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
              const availability = getRuleAvailability(
                rule,
                packageItems,
              );
              const itemDisabled =
                disabled ||
                !selectable ||
                rule.isRequired ||
                !availability.available;
              const isWoodCrateService = isWoodCrateRule(rule);
              const isInsuranceService = isInsuranceRule(rule);

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
                    style={{
                      "--service-index":
                        ruleIndex,
                    }}
                    className={[
                      "package-services-modal__item",
                      checked &&
                        "package-services-modal__item--selected",
                      isWoodCrateService &&
                        checked &&
                        "package-services-modal__item--wood-open",
                      itemDisabled &&
                        "package-services-modal__item--disabled",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      handleToggle(rule)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
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
                        style={{
                          pointerEvents:
                            "none",
                        }}
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
                        <strong>
                          {getRuleDisplayName(
                            rule,
                          )}
                        </strong>

                        <Tooltip
                          placement="top"
                          title={formatRuleInformation(
                            rule,
                          )}
                        >
                          <InfoCircleOutlined
                            aria-label={`Thông tin ${getRuleDisplayName(
                              rule,
                            )}`}
                            className="package-services-modal__info-icon"
                            onClick={(
                              event,
                            ) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                          />
                        </Tooltip>
                      </span>

                      <span className="package-services-modal__rule-meta">
                        <b
                          title={
                            rule.ruleCode ||
                            undefined
                          }
                        >
                          {getRuleCodeLabel(
                            rule,
                          )}
                        </b>

                        <i
                          title={
                            rule.ruleType ||
                            undefined
                          }
                        >
                          {getRuleTypeLabel(
                            rule,
                          )}
                        </i>

                        <em
                          className={`status-${getStatusClassName(
                            rule.status,
                          )}`}
                        >
                          {getStatusLabel(
                            rule.status,
                          )}
                        </em>
                      </span>

                      <span className="package-services-modal__description">
                        {formatRuleDescription(
                          rule.description,
                        )}
                      </span>

                      {!availability.available && (
                        <span className="package-services-modal__requirement">
                          <InfoCircleOutlined />
                          {availability.reason}
                        </span>
                      )}
                    </span>

                    <span className="package-services-modal__fee">
                      <small>
                        {isWoodCrateService
                          ? "Theo cấu hình thùng"
                          : getCalculationTypeLabel(
                              rule.calculationType,
                            )}
                      </small>

                      <strong>
                        {isWoodCrateService
                          ? checked
                            ? "Chọn bên dưới"
                            : "Chưa chọn thùng"
                          : formatRuleFee(
                              rule,
                            )}
                      </strong>

                      {isInsuranceService && (
                        <span className="package-services-modal__fee-limits">
                          <span>
                            Tối thiểu:
                            <b>
                              {rule.minAmount === null
                                ? "Không quy định"
                                : formatMoney(rule.minAmount)}
                            </b>
                          </span>
                          <span>
                            Tối đa:
                            <b>
                              {rule.maxAmount === null
                                ? "Không giới hạn"
                                : formatMoney(rule.maxAmount)}
                            </b>
                          </span>
                        </span>
                      )}
                    </span>
                  </div>

                  {isWoodCrateService &&
                    checked &&
                    renderPackageConfigurationPanel()}
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
