import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  Button,
  Divider,
  Image,
  Input,
  InputNumber,
  Modal,
  Switch,
  Tag,
  Tooltip,
} from "antd";

import {
  CalculatorOutlined,
  CloseOutlined,
  DollarOutlined,
  FileTextOutlined,
  GiftOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  TruckOutlined,
} from "@ant-design/icons";

import {
  createPurchaseRequestQuotationApi,
} from "@features/purchase/api/purchaseRequestService";
import {
  getActivePricingRulesApi,
  PRICING_RULE_CODE,
} from "@features/pricing/api/pricingRuleService";
/* Tỷ giá THẬT (GET /api/exchange-rates?activeOnly=true). Không có tỷ giá mặc định: mã tiền
   tệ của tuyến không có tỷ giá đang bật thì báo lỗi và chặn gửi báo giá. */
import {
  convertToVndWithRate,
  findActiveExchangeRate,
  getExchangeRatesApi,
} from "@features/pricing/api/exchangeRateService";
import {
  getServicePricingsApi,
} from "@features/pricing/api/servicePricingService";
/*
 * Thuế suất NK theo loại hàng để ước tính phần TẠM TÍNH. Đi đường sâu (không qua barrel) như các
 * module api khác của modal: GET /api/product-types (id, name) và GET /api/product-types/{id}
 * (có importTaxRate) — cả hai AllowAnonymous nên Sale gọi được.
 */
import { getProductTypeDetail } from "@features/catalog/api/catalogAdminService";
import { getProductTypesApi } from "@features/consignment/api/consignmentMasterService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import {
  calculateRuleAmountWithContext,
  formatCurrency,
  formatNumber,
  getCalculationType,
  getItemId,
  getMinRequiredOrderAmount,
  getRuleCode,
  getRuleId,
  getRuleScopeLabel,
  getRuleValueLabel,
  isDomesticFeeRule,
  isGuid,
  moneyFormatter,
  moneyParser,
  normalizeMoney,
  normalizeNumber,
  normalizeText,
  resolveVatRatePercent,
  roundHalfEven,
  roundMoney,
} from "./CreatePurchaseRequestQuotationModal.helpers";

import { getRouteLabel } from "@shared/utils/statusLabel";
import "./CreatePurchaseRequestQuotationModal.css";

const { TextArea } = Input;

export default function CreatePurchaseRequestQuotationModal({
  open,
  onClose,
  onSuccess,
  purchaseRequest,
  pricingRules = [],
}) {
  const items = useMemo(
    () =>
      Array.isArray(
        purchaseRequest?.items
      )
        ? purchaseRequest.items
        : [],
    [purchaseRequest?.items]
  );

  const [activeRules, setActiveRules] = useState([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (Array.isArray(pricingRules) && pricingRules.length > 0) {
      setActiveRules(pricingRules);
    } else {
      getActivePricingRulesApi()
        .then((data) => {
          if (Array.isArray(data)) {
            setActiveRules(data);
          }
        })
        .catch(() => { });
    }
  }, [open, pricingRules]);

  const effectiveRules = useMemo(() => {
    return Array.isArray(activeRules) && activeRules.length > 0
      ? activeRules
      : Array.isArray(pricingRules)
        ? pricingRules
        : [];
  }, [activeRules, pricingRules]);

  const [purchaseFee, setPurchaseFee] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);

  /*
   * Ba ô của luồng chuẩn. Ship nội địa nằm ở phần TRẢ TRƯỚC (khách trả ngay); đơn giá cước
   * và cân ước tính chỉ để TẠM TÍNH chặng quốc tế — tiền thật thu ở Việt Nam theo cân đo.
   */
  /*
   * Sale sửa phụ phí cho từng khách: { [pricingRuleId]: { amount?, disabled?, note? } }.
   * Không đụng tới VAT và thuế nhập khẩu — hai khoản đó backend tự tính lại từ các con số
   * bên trên, gửi kèm chỉ làm cộng hai lần.
   */
  const [feeOverrides, setFeeOverrides] = useState({});

  /*
   * Ship nội địa từ NCC — nguồn DUY NHẤT của khoản này trong báo giá. null = Sale chưa sửa:
   * ô tự đi theo số tính từ quy tắc DOMESTIC_FEE (xem suggestedDomesticShippingFee); Sale gõ
   * số nào (kể cả 0) thì giữ đúng số đó.
   */
  const [domesticShippingFeeInput, setDomesticShippingFeeInput] = useState(null);
  const [freightRatePerKg, setFreightRatePerKg] = useState(0);
  const [estimatedWeight, setEstimatedWeight] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const routeCurrencyInfo = useMemo(() => {
    const route = String(purchaseRequest?.route || "").toUpperCase();
    if (route.includes("KOREA") || route.includes("HAN") || route.includes("HÀN")) {
      return { code: "KRW", flag: "🇰🇷", name: "Won Hàn Quốc", label: "🇰🇷 KRW (Won Hàn)" };
    }
    if (route.includes("JAPAN") || route.includes("NHAT") || route.includes("NHẬT")) {
      return { code: "JPY", flag: "🇯🇵", name: "Yên Nhật", label: "🇯🇵 JPY (Yên Nhật)" };
    }
    if (route.includes("CHINA") || route.includes("TRUNG")) {
      return { code: "CNY", flag: "🇨🇳", name: "Nhân dân tệ", label: "🇨🇳 CNY (Nhân dân tệ)" };
    }
    if (route.includes("USA") || route.includes("MY") || route.includes("MỸ") || route.includes("US")) {
      return { code: "USD", flag: "🇺🇸", name: "Đô la Mỹ", label: "🇺🇸 USD (Đô la Mỹ)" };
    }
    return { code: "CNY", flag: "🇨🇳", name: "Nhân dân tệ", label: "🇨🇳 CNY (Nhân dân tệ)" };
  }, [purchaseRequest?.route]);

  const defaultCurrency = routeCurrencyInfo.code;

  const [exchangeRates, setExchangeRates] = useState([]);
  /* "loading" | "ready" | "error" — chỉ "ready" mới được nhập giá / gửi báo giá. */
  const [ratesStatus, setRatesStatus] = useState("loading");
  const [ratesError, setRatesError] = useState("");
  const [ratesReloadKey, setRatesReloadKey] = useState(0);
  const [foreignInputs, setForeignInputs] = useState({});

  /* Tỷ giá đang bật của đúng mã tiền tệ tuyến này; null = không được báo giá. */
  const activeRate = useMemo(
    () => findActiveExchangeRate(exchangeRates, defaultCurrency),
    [exchangeRates, defaultCurrency]
  );

  const rateBlockingMessage = useMemo(() => {
    if (ratesStatus === "loading") {
      return `Đang tải tỷ giá ${defaultCurrency} từ hệ thống...`;
    }
    if (ratesStatus === "error") {
      return `Không tải được tỷ giá ${defaultCurrency}: ${ratesError || "lỗi không xác định"}. Chưa thể lập báo giá.`;
    }
    if (!activeRate) {
      return `Chưa có tỷ giá ${defaultCurrency} đang bật trong danh mục tỷ giá. Vui lòng nhờ Admin cấu hình tỷ giá ${defaultCurrency} rồi mở lại báo giá — hệ thống không dùng tỷ giá mặc định.`;
    }
    return "";
  }, [activeRate, defaultCurrency, ratesError, ratesStatus]);

  const [servicePricings, setServicePricings] = useState([]);
  const [, setLoadingPricings] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLoadingPricings(true);
    getServicePricingsApi()
      .then((list) => {
        if (Array.isArray(list)) {
          setServicePricings(list);
        }
      })
      .catch((err) => {
        console.error("GET SERVICE PRICINGS ERROR:", err);
      })
      .finally(() => {
        setLoadingPricings(false);
      });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const controller = new AbortController();

    setRatesStatus("loading");
    setRatesError("");
    getExchangeRatesApi({ activeOnly: true, signal: controller.signal })
      .then((list) => {
        setExchangeRates(Array.isArray(list) ? list : []);
        setRatesStatus("ready");
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("GET EXCHANGE RATES ERROR:", err);
        setExchangeRates([]);
        setRatesError(
          err?.response?.data?.message || err?.message || "Không kết nối được máy chủ."
        );
        setRatesStatus("error");
      });

    return () => controller.abort();
  }, [open, ratesReloadKey]);

  const autoMatchedServicePricing = useMemo(() => {
    if (!Array.isArray(servicePricings) || servicePricings.length === 0) return null;

    const routeText = String(purchaseRequest?.route || "").toUpperCase();
    const shippingOptionText = String(purchaseRequest?.shippingOption || "").toUpperCase();

    let targetOrigin = "";
    if (routeText.includes("KOREA") || routeText.includes("HAN") || routeText.includes("HÀN")) {
      targetOrigin = "KOREA";
    } else if (routeText.includes("JAPAN") || routeText.includes("NHAT") || routeText.includes("NHẬT")) {
      targetOrigin = "JAPAN";
    } else if (routeText.includes("CHINA") || routeText.includes("TRUNG")) {
      targetOrigin = "CHINA";
    } else if (routeText.includes("USA") || routeText.includes("MY") || routeText.includes("MỸ") || routeText.includes("US")) {
      targetOrigin = "USA";
    }

    const byRoute = servicePricings.filter((sp) => {
      const origin = String(sp.originCountry || sp.originCountryDisplayName || "").toUpperCase();
      if (targetOrigin === "CHINA") return origin.includes("CHINA") || origin.includes("CN") || origin.includes("TRUNG");
      if (targetOrigin === "KOREA") return origin.includes("KOREA") || origin.includes("KR") || origin.includes("HÀN");
      if (targetOrigin === "JAPAN") return origin.includes("JAPAN") || origin.includes("JP") || origin.includes("NHẬT");
      if (targetOrigin === "USA") return origin.includes("USA") || origin.includes("US") || origin.includes("MỸ");
      return true;
    });

    if (byRoute.length === 0) return null;

    if (shippingOptionText) {
      const byOption = byRoute.find((sp) => {
        const serviceType = String(sp.serviceType || sp.serviceTypeDisplayName || "").toUpperCase();
        return serviceType.includes(shippingOptionText) || shippingOptionText.includes(serviceType);
      });
      if (byOption) return byOption;
    }

    return byRoute[0];
  }, [servicePricings, purchaseRequest?.route, purchaseRequest?.shippingOption]);

  const matchedPurchaseFeeRule = useMemo(() => {
    if (!Array.isArray(effectiveRules) || effectiveRules.length === 0) return null;
    return effectiveRules.find((rule) => {
      const type = String(rule?.ruleType || "").toUpperCase();
      const code = String(rule?.ruleCode || "").toUpperCase();
      return type === "PURCHASE_FEE" || code === "PURCHASE_FEE_FIXED" || code.includes("PURCHASE_FEE");
    });
  }, [effectiveRules]);

  useEffect(() => {
    if (!open) {
      return;
    }

    /* Không có quy tắc PURCHASE_FEE đang bật thì để 0 cho Sale tự nhập — không đoán số. */
    const defaultPurchaseFee = Number(matchedPurchaseFeeRule?.value) || 0;
    setPurchaseFee(defaultPurchaseFee);
    setShippingFee(0);
    setFeeOverrides({});
    setDomesticShippingFeeInput(null);
    setFreightRatePerKg(0);
    setEstimatedWeight(0);
    setNote("");
    setFormError("");
    setSubmitting(false);
    setForeignInputs({});
  }, [
    items,
    open,
    purchaseRequest?.purchaseRequestId,
    matchedPurchaseFeeRule,
  ]);

  // Auto-fill shipping fee from exact matched route + shippingOption
  useEffect(() => {
    if (!open) return;
    if (autoMatchedServicePricing) {
      const basePrice = Number(autoMatchedServicePricing.price) || 0;
      const totalQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
      const calculatedFee = basePrice > 0 ? basePrice * (totalQty > 0 ? totalQty : 1) : basePrice;
      setShippingFee(calculatedFee > 0 ? calculatedFee : basePrice);
    }
  }, [autoMatchedServicePricing, open, items]);

  /*
   * Quy đổi ngay tại chỗ bằng tỷ giá THẬT đã tải (không gọi API mỗi phím gõ). Con số VND chỉ để
   * HIỂN THỊ: khi lưu, FE gửi currency + giá ngoại tệ và backend tự nhân với tỷ giá của nó
   * (PurchaseRequestService: Math.Round(unitPrice × rate, AwayFromZero)), đóng băng vào báo giá.
   */
  const handleConvertForeignPrice = (itemId, currency, amount) => {
    if (!itemId) return;

    const selectedCurr = currency || defaultCurrency;
    const numAmount = Number(amount);
    const hasAmount =
      amount !== null && amount !== undefined && amount !== "" &&
      Number.isFinite(numAmount) && numAmount > 0;
    setForeignInputs((prev) => ({
      ...prev,
      [itemId]: {
        currency: selectedCurr,
        amount: hasAmount ? numAmount : null,
      },
    }));
    setFormError("");
  };

  const itemBreakdown =
    useMemo(
      () =>
        items.map((item) => {
          const itemId =
            getItemId(item);

          /* Đơn giá VND chỉ để hiển thị: giá ngoại tệ × tỷ giá THẬT đang bật (0 nếu chưa có). */
          const unitPrice = convertToVndWithRate(
            foreignInputs?.[itemId]?.amount,
            activeRate?.rateToVnd
          );

          const quantity =
            Math.max(
              0,
              normalizeNumber(
                item?.quantity
              )
            );

          return {
            item,
            itemId,
            unitPrice,
            quantity,
            lineTotal:
              roundMoney(
                unitPrice *
                quantity
              ),
          };
        }),
      [
        activeRate?.rateToVnd,
        foreignInputs,
        items,
      ]
    );

  const productSubtotal =
    useMemo(
      () =>
        itemBreakdown.reduce(
          (
            total,
            current
          ) =>
            total +
            current.lineTotal,
          0
        ),
      [itemBreakdown]
    );

  const selectedRuleIds = useMemo(() => {
    return new Set(
      Array.isArray(purchaseRequest?.pricingRuleIds)
        ? purchaseRequest.pricingRuleIds.map(normalizeText).filter(Boolean)
        : []
    );
  }, [purchaseRequest?.pricingRuleIds]);

  const packageCount = useMemo(() => {
    if (Array.isArray(items) && items.length > 0) {
      return items.length;
    }
    return 1;
  }, [items]);

  /* Quy tắc DOMESTIC_FEE đang bật (nếu có) — chỉ dùng để điền sẵn ô "Ship nội địa từ NCC". */
  const domesticFeeRule = useMemo(
    () => effectiveRules.find(isDomesticFeeRule) || null,
    [effectiveRules]
  );

  /* Cùng cách tính và cùng context như khi khoản này còn nằm trong danh sách phụ phí. */
  const suggestedDomesticShippingFee = useMemo(
    () =>
      domesticFeeRule
        ? calculateRuleAmountWithContext(domesticFeeRule, {
          productSubtotal,
          purchaseFee,
          shippingFee,
          packageCount,
        })
        : 0,
    [domesticFeeRule, productSubtotal, purchaseFee, shippingFee, packageCount]
  );

  const domesticShippingFee = roundMoney(
    domesticShippingFeeInput ?? suggestedDomesticShippingFee
  );

  const additionalFeeBreakdown = useMemo(() => {
    const list = [];
    const processedRuleIds = new Set();

    effectiveRules.forEach((rule) => {
      const ruleId = getRuleId(rule);
      const ruleCode = getRuleCode(rule);
      if (!ruleId || processedRuleIds.has(ruleId)) return;
      if (ruleCode === PRICING_RULE_CODE.VOLUMETRIC_DIVISOR) {
        return;
      }

      /* Ship nội địa đi riêng qua ô domesticShippingFee — không phải phụ phí. */
      if (isDomesticFeeRule(rule)) {
        return;
      }

      const isImportTax = ruleCode === PRICING_RULE_CODE.IMPORT_TAX;
      const isVat = ruleCode === PRICING_RULE_CODE.VAT;
      const isInsurance =
        ruleCode === PRICING_RULE_CODE.SUR_INSURANCE_3PERCENT ||
        ruleCode.includes("INSURANCE");
      const isWoodCrate = ruleCode === PRICING_RULE_CODE.WOOD_CRATE;
      const isInspection = ruleCode === PRICING_RULE_CODE.SUR_INSPECTION;

      let isRequested = selectedRuleIds.has(ruleId);
      if (isImportTax || isVat) {
        isRequested = true;
      } else if (isInsurance && purchaseRequest?.requiresInsurance) {
        isRequested = true;
      } else if (isWoodCrate && purchaseRequest?.requiresWoodenCrate) {
        isRequested = true;
      } else if (isInspection && purchaseRequest?.requiresInspection) {
        isRequested = true;
      }

      if (!isRequested) return;

      processedRuleIds.add(ruleId);

      let amount;
      let isSkipped = false;
      let skipReason = "";

      if (isInsurance) {
        const minOrderAmount = getMinRequiredOrderAmount(rule);
        if (minOrderAmount > 0 && productSubtotal < minOrderAmount) {
          isSkipped = true;
          skipReason = `Đơn hàng chưa đạt mức tối thiểu ${formatCurrency(minOrderAmount)} - Không áp dụng bảo hiểm`;
          amount = 0;
        } else {
          amount = calculateRuleAmountWithContext(rule, {
            productSubtotal,
            purchaseFee,
            shippingFee,
            packageCount,
          });
        }
      } else {
        amount = calculateRuleAmountWithContext(rule, {
          productSubtotal,
          purchaseFee,
          shippingFee,
          packageCount,
        });
      }

      /* Sale ghi đè: số tiền do hệ thống tính vẫn giữ lại để đối chiếu và khôi phục. */
      const systemAmount = amount;
      const override = feeOverrides[ruleId];
      const canOverride = !(isImportTax || isVat);

      if (canOverride && override) {
        if (override.disabled) {
          isSkipped = true;
          skipReason = "Sale không áp dụng khoản này cho khách";
          amount = 0;
        } else if (Number.isFinite(Number(override.amount))) {
          amount = Math.max(0, Math.round(Number(override.amount)));
          isSkipped = false;
          skipReason = "";
        }
      }

      list.push({
        rule,
        pricingRuleId: ruleId,
        ruleCode,
        ruleName: rule?.ruleName || "Phụ phí dịch vụ",
        amount,
        systemAmount,
        canOverride,
        isOverridden:
          canOverride &&
          Boolean(override) &&
          (override.disabled || Math.round(Number(override.amount) || 0) !== Math.round(systemAmount)),
        overrideNote: override?.note || "",
        isSkipped,
        skipReason,
        isTaxOrVat: isImportTax || isVat,
        isInsurance,
      });
    });

    return list;
  }, [
    effectiveRules,
    purchaseRequest?.pricingRuleIds,
    purchaseRequest?.requiresInsurance,
    purchaseRequest?.requiresWoodenCrate,
    purchaseRequest?.requiresInspection,
    selectedRuleIds,
    productSubtotal,
    purchaseFee,
    shippingFee,
    packageCount,
    feeOverrides,
  ]);

  /*
   * Thuế suất NK từng loại hàng (key = productType thô của dòng hàng: UUID hoặc tên).
   * `null` = không tra được → phần thuế NK của dòng đó không ước tính được (báo rõ, không đoán).
   */
  const productTypeKeys = useMemo(
    () => [...new Set(items.map((item) => normalizeText(item?.productType)).filter(Boolean))].sort(),
    [items]
  );
  const productTypeSignature = productTypeKeys.join("|");
  /* { signature, rates } — kết quả gắn với đúng bộ loại hàng đã tra, đổi bộ là coi như chưa có. */
  const [importTaxLookup, setImportTaxLookup] = useState({ signature: "", rates: {} });
  const importTaxRatesLoading =
    open && productTypeKeys.length > 0 && importTaxLookup.signature !== productTypeSignature;

  useEffect(() => {
    if (!open || productTypeKeys.length === 0) return undefined;

    let cancelled = false;

    (async () => {
      /* Dòng hàng lưu tên loại hàng (đời cũ) thì đổi tên → id qua danh sách loại đang dùng. */
      let idByName = new Map();
      if (productTypeKeys.some((key) => !isGuid(key))) {
        try {
          const list = await getProductTypesApi();
          idByName = new Map(list.map((type) => [normalizeText(type.name).toLowerCase(), type.id]));
        } catch {
          idByName = new Map();
        }
      }

      const entries = await Promise.all(
        productTypeKeys.map(async (key) => {
          const id = isGuid(key) ? key : idByName.get(key.toLowerCase());
          if (!id) return [key, null];
          try {
            const detail = await getProductTypeDetail(id);
            return [key, Number.isFinite(detail?.importTaxRate) ? detail.importTaxRate : null];
          } catch {
            return [key, null];
          }
        })
      );

      if (!cancelled) {
        setImportTaxLookup({ signature: productTypeKeys.join("|"), rates: Object.fromEntries(entries) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, productTypeKeys]);

  /*
   * TRẢ TRƯỚC / TẠM TÍNH — cùng công thức backend lúc lưu báo giá
   * (PurchaseRequestService.cs ~1675-1709):
   *   prepay = tiền hàng + phí mua hộ + ship nội địa + phụ phí + VAT phần phí
   *   later  = cước ước tính + VAT cước + thuế NK
   * Chỉ là số xem trước — số chính thức do hệ thống tính khi lưu.
   */
  const quotationEstimate = useMemo(() => {
    const vatRatePercent = resolveVatRatePercent(effectiveRules);
    const fee = roundMoney(purchaseFee);
    /* Phụ phí = đúng các dòng gửi lên backend (bỏ VAT / thuế NK — backend tự tính). */
    const surcharges = additionalFeeBreakdown
      .filter((current) => !current.isSkipped && !current.isTaxOrVat && current.amount > 0)
      .reduce((total, current) => total + current.amount, 0);
    const vatOnFees = roundHalfEven((fee + domesticShippingFee + surcharges) * (vatRatePercent / 100));
    const prepay = productSubtotal + fee + domesticShippingFee + surcharges + vatOnFees;

    const manualRate = roundMoney(freightRatePerKg);
    const tableRate = normalizeMoney(autoMatchedServicePricing?.price);
    const freightRate = manualRate > 0 ? manualRate : tableRate;
    const totalQuantity = items.reduce((total, item) => total + Math.max(0, normalizeNumber(item?.quantity)), 0);
    const weight = Number(estimatedWeight) > 0 ? Number(estimatedWeight) : Math.max(1, totalQuantity * 0.2);
    const freight = roundHalfEven(weight * freightRate);
    const vatOnFreight = roundHalfEven(freight * (vatRatePercent / 100));

    const importTaxRates =
      importTaxLookup.signature === productTypeSignature ? importTaxLookup.rates : {};
    let importTax = 0;
    let importTaxUnknown = 0;
    itemBreakdown.forEach((current) => {
      const rate = importTaxRates[normalizeText(current.item?.productType)];
      if (rate === null || rate === undefined) {
        importTaxUnknown += 1;
        return;
      }
      importTax += roundHalfEven(current.lineTotal * rate);
    });

    const later = freight + vatOnFreight + importTax;

    return {
      vatRatePercent,
      fee,
      surcharges,
      vatOnFees,
      prepay,
      freightRate,
      freightRateFromTable: manualRate <= 0 && tableRate > 0,
      weight,
      weightIsDefault: !(Number(estimatedWeight) > 0),
      freight,
      vatOnFreight,
      importTax,
      importTaxUnknown,
      later,
      total: prepay + later,
    };
  }, [
    additionalFeeBreakdown,
    autoMatchedServicePricing?.price,
    domesticShippingFee,
    effectiveRules,
    estimatedWeight,
    freightRatePerKg,
    importTaxLookup,
    itemBreakdown,
    items,
    productSubtotal,
    productTypeSignature,
    purchaseFee,
  ]);

  /* Tổng báo giá = trả trước + tạm tính, như backend lưu vào quotation.TotalAmount. */
  const quotationTotal = quotationEstimate.total;

  const validateForm = () => {
    if (rateBlockingMessage) {
      return rateBlockingMessage;
    }

    if (
      !normalizeText(
        purchaseRequest
          ?.purchaseRequestId
      )
    ) {
      return "Không tìm thấy mã yêu cầu mua hộ.";
    }

    if (items.length === 0) {
      return "Yêu cầu mua hộ chưa có sản phẩm.";
    }

    const missingItem =
      itemBreakdown.find(
        (current) =>
          !current.itemId
      );

    if (missingItem) {
      return "Có sản phẩm chưa có itemId.";
    }

    const invalidPriceItem =
      itemBreakdown.find(
        (current) =>
          current.unitPrice <= 0
      );

    const missingForeignItem = itemBreakdown.find(
      (current) => !(Number(foreignInputs?.[current.itemId]?.amount) > 0)
    );

    if (missingForeignItem) {
      return `Vui lòng nhập giá ${defaultCurrency} lớn hơn 0 cho sản phẩm "${missingForeignItem?.item?.productName || "chưa xác định"}".`;
    }

    if (invalidPriceItem) {
      return `Vui lòng nhập đơn giá lớn hơn 0 cho sản phẩm "${invalidPriceItem
        ?.item
        ?.productName ||
        "chưa xác định"
        }".`;
    }

    return "";
  };

  const handleSubmit =
    async () => {
      const validationMessage =
        validateForm();

      if (validationMessage) {
        setFormError(
          validationMessage
        );

        AuthNotify.warning(
          "Thông tin chưa đầy đủ",
          validationMessage
        );

        return;
      }

      const payload = {
        /* Backend quy đổi Items[].unitPrice (ngoại tệ) sang VND bằng tỷ giá của nó. */
        currency: defaultCurrency,

        purchaseFee:
          roundMoney(
            purchaseFee
          ),

        /* Backend bỏ qua (ghi đè bằng cước tạm tính); giữ trường để đúng hợp đồng DTO. */
        shippingFee:
          roundMoney(
            shippingFee
          ),

        /*
         * Luồng chuẩn: ship nội địa vào phần trả trước, hai ô còn lại để tạm tính cước.
         * Đây là nguồn duy nhất của ship nội địa — additionalFees không còn dòng DOMESTIC_FEE.
         */
        domesticShippingFee,

        freightRatePerKg:
          roundMoney(
            freightRatePerKg
          ),

        estimatedWeight:
          Number(estimatedWeight) || 0,

        note:
          normalizeText(note),

        items:
          itemBreakdown.map(
            (current) => ({
              purchaseRequestItemId:
                current.itemId,

              /* Giá NGOẠI TỆ Sale nhập — không gửi số VND FE tự tính. */
              unitPrice:
                Number(foreignInputs?.[current.itemId]?.amount) || 0,
            })
          ),

        additionalFees:
          additionalFeeBreakdown
            /*
             * Thuế NK (theo loại hàng, thu ở chặng VN) và VAT phần phí do backend tự tính khi lưu báo giá.
             * Gửi kèm như phụ phí thì bị cộng hai lần và thuế NK rơi vào phần khách trả trước.
             */
            .filter((current) => !current.isSkipped && !current.isTaxOrVat && current.amount > 0)
            .map((current) => {
              const rule =
                current.rule;

              return {
                pricingRuleId:
                  current
                    .pricingRuleId,

                feeName:
                  normalizeText(
                    rule?.ruleName
                  ),

                feeType:
                  normalizeText(
                    rule?.ruleType
                  ),

                calculationType:
                  getCalculationType(
                    rule
                  ),

                value:
                  normalizeMoney(
                    rule?.value
                  ),

                amount:
                  current.amount,

                /* Ưu tiên lý do Sale ghi khi sửa mức phí; không có thì giữ mô tả quy tắc. */
                note:
                  normalizeText(
                    current.overrideNote || rule?.description
                  ),
              };
            }),
      };

      try {
        setSubmitting(true);
        setFormError("");

        const result =
          await createPurchaseRequestQuotationApi(
            purchaseRequest
              ?.purchaseRequestId,
            payload
          );

        AuthNotify.success(
          "Tạo báo giá thành công",
          "Báo giá mua hộ đã được gửi lên hệ thống."
        );

        onSuccess?.(
          result,
          payload
        );
      } catch (error) {
        const message =
          error?.message ||
          "Không thể tạo báo giá mua hộ.";

        setFormError(message);

        AuthNotify.error(
          "Tạo báo giá thất bại",
          message
        );
      } finally {
        setSubmitting(false);
      }
    };

  const handleClose = () => {
    if (submitting) {
      return;
    }

    onClose?.();
  };

  return (
    <Modal
      open={open}
      centered
      width={1080}
      footer={null}
      closable={false}
      mask={{ closable: !submitting }}
      keyboard={!submitting}
      destroyOnHidden
      onCancel={handleClose}
      className="purchase-quotation-modal"
      rootClassName="purchase-quotation-modal-root"
    >
      <div className="purchase-quotation-modal__header">
        <div className="purchase-quotation-modal__heading">
          <div className="purchase-quotation-modal__heading-icon">
            <CalculatorOutlined />
          </div>

          <div>
            <span>
              TẠO BÁO GIÁ MUA HỘ
            </span>

            <h2>
              {purchaseRequest
                ?.purchaseCode ||
                "Yêu cầu mua hộ"}
            </h2>

            <p>
              Nhập đơn giá sản phẩm, phí mua hộ,
              phí vận chuyển và kiểm tra dịch vụ
              trước khi xác nhận.
            </p>

            {/*
              Báo giá lập cho khách nào: trước đây form không có tên khách / người nhận, Sale có thể
              báo nhầm đơn. Lấy nguyên từ chi tiết yêu cầu đã nạp (GET /api/purchase-requests/{id}).
            */}
            <p style={{ marginTop: 4, fontWeight: 600 }}>
              {[
                purchaseRequest?.customerName
                  ? `Khách: ${purchaseRequest.customerName}`
                  : null,
                purchaseRequest?.route
                  ? `Tuyến: ${getRouteLabel(purchaseRequest.route)}`
                  : null,
                purchaseRequest?.receiverName
                  ? `Nhận: ${[
                    purchaseRequest.receiverName,
                    purchaseRequest.receiverPhone,
                    purchaseRequest.receiverAddress,
                  ]
                    .filter(Boolean)
                    .join(" · ")}`
                  : null,
              ]
                .filter(Boolean)
                .join("  |  ") || "Chưa đọc được thông tin khách của yêu cầu."}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="purchase-quotation-modal__close"
          onClick={handleClose}
          disabled={submitting}
          aria-label="Đóng cửa sổ tạo báo giá"
        >
          <CloseOutlined />
        </button>
      </div>

      <div className="purchase-quotation-modal__meta">
        <div>
          <ShoppingCartOutlined />
          <span>
            Số mặt hàng
          </span>
          <strong>
            {items.length}
          </strong>
        </div>

        <div>
          <ShoppingOutlined />
          <span>
            Tổng số lượng
          </span>
          <strong>
            {formatNumber(
              purchaseRequest
                ?.totalQuantity
            )}
          </strong>
        </div>

        <div>
          <GiftOutlined />
          <span>
            Quy tắc dịch vụ & thuế
          </span>
          <strong>
            {additionalFeeBreakdown.filter((item) => !item.isSkipped).length}
          </strong>
        </div>
      </div>

      <div className="purchase-quotation-modal__body">
        {rateBlockingMessage && ratesStatus !== "loading" && (
          <Alert
            type="error"
            showIcon
            message={`Không lập được báo giá: thiếu tỷ giá ${defaultCurrency}`}
            description={rateBlockingMessage}
            action={
              ratesStatus === "error" ? (
                <Button size="small" onClick={() => setRatesReloadKey((key) => key + 1)}>
                  Thử lại
                </Button>
              ) : null
            }
            className="purchase-quotation-modal__alert"
          />
        )}

        {formError && (
          <Alert
            type="error"
            showIcon
            message="Không thể tạo báo giá"
            description={
              formError
            }
            className="purchase-quotation-modal__alert"
          />
        )}

        <section className="purchase-quotation-section">
          <div className="purchase-quotation-section__heading">
            <div>
              <ShoppingCartOutlined />

              <div>
                <span>
                  CHI PHÍ SẢN PHẨM
                </span>

                <h3>
                  Nhập đơn giá từng sản phẩm
                </h3>
              </div>
            </div>

            <Tag className="purchase-quotation-section__tag">
              Thành tiền:{" "}
              {formatCurrency(
                productSubtotal
              )}
            </Tag>
          </div>

          <div className="purchase-quotation-item-list">
            {itemBreakdown.map(
              (
                current,
                index
              ) => {
                const item =
                  current.item;

                const firstImage =
                  Array.isArray(
                    item?.imageUrls
                  )
                    ? item
                      .imageUrls[0]
                    : "";

                const currentForeign = foreignInputs[current.itemId] || {};

                return (
                  <article
                    key={
                      current.itemId ||
                      index
                    }
                    className="purchase-quotation-item"
                  >
                    <div className="purchase-quotation-item__index">
                      {index + 1}
                    </div>

                    <div className="purchase-quotation-item__image">
                      {firstImage ? (
                        <Image
                          src={
                            firstImage
                          }
                          alt={
                            item
                              ?.productName ||
                            "Sản phẩm"
                          }
                          preview
                        />
                      ) : (
                        <ShoppingOutlined />
                      )}
                    </div>

                    <div className="purchase-quotation-item__content">
                      <span>
                        SẢN PHẨM
                      </span>

                      <h4>
                        {item
                          ?.productName ||
                          "Sản phẩm"}
                      </h4>
                    </div>

                    <div className="purchase-quotation-item__price">
                      <div className="pricing-card-box">
                        <div className="pricing-field-group">
                          <div className="pricing-field-header">
                            <label className="pricing-field-label">
                              Giá ngoại tệ ({routeCurrencyInfo.code}) <b className="required-star">*</b>
                            </label>
                            <span className="currency-pill-badge">
                              {routeCurrencyInfo.flag} {routeCurrencyInfo.code} • {routeCurrencyInfo.name}
                            </span>
                          </div>

                          <InputNumber
                            value={currentForeign.amount ?? null}
                            placeholder={`Nhập số tiền (${routeCurrencyInfo.code})`}
                            disabled={Boolean(rateBlockingMessage)}
                            min={0}
                            precision={2}
                            controls={false}
                            addonAfter={routeCurrencyInfo.code}
                            formatter={(val) => {
                              if (val === undefined || val === null || val === "") return "";
                              const [intPart, decPart] = `${val}`.split(".");
                              const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                              return decPart !== undefined ? `${grouped},${decPart}` : grouped;
                            }}
                            parser={(val) => (val ? val.replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "") : "")}
                            onKeyDown={(e) => {
                              if (
                                !/[0-9,]/.test(e.key) &&
                                !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key) &&
                                !e.ctrlKey &&
                                !e.metaKey
                              ) {
                                e.preventDefault();
                              }
                            }}
                            onChange={(amount) => {
                              handleConvertForeignPrice(current.itemId, routeCurrencyInfo.code, amount);
                            }}
                            className="premium-price-input"
                          />
                        </div>

                        <div className="pricing-field-group">
                          <div className="pricing-field-header">
                            <label className="pricing-field-label">
                              Đơn giá quy đổi (VNĐ)
                            </label>
                            {current.unitPrice > 0 && currentForeign.amount > 0 && activeRate && (
                              <span className="rate-info-chip">
                                💡 1 {activeRate.currencyCode} = {formatNumber(activeRate.rateToVnd)} ₫
                              </span>
                            )}
                          </div>

                          <InputNumber
                            value={current.unitPrice || null}
                            placeholder="Tự động quy đổi từ giá ngoại tệ"
                            min={0}
                            disabled
                            controls={false}
                            formatter={moneyFormatter}
                            addonAfter="₫"
                            className="premium-price-input is-vnd"
                          />
                        </div>

                        <div className="pricing-card-footer">
                          <span className="line-item-qty">
                            Số lượng: <strong>{formatNumber(current.quantity)}</strong> sản phẩm
                          </span>

                          <span className="line-item-total">
                            Thành tiền: <strong>{formatCurrency(current.lineTotal || 0)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </section>

        <section className="purchase-quotation-section">
          <div className="purchase-quotation-section__heading">
            <div>
              <DollarOutlined />

              <div>
                <span>
                  CHI PHÍ CHUNG
                </span>

                <h3>
                  Phí mua hộ và vận chuyển
                </h3>
              </div>
            </div>
          </div>

          <div className="purchase-quotation-base-fee-grid">
            <div className="purchase-quotation-field">
              <label>
                <DollarOutlined />
                Phí mua hộ
              </label>

              <InputNumber
                value={
                  purchaseFee
                }
                min={0}
                step={1000}
                precision={0}
                controls={false}
                formatter={
                  moneyFormatter
                }
                parser={
                  moneyParser
                }
                onChange={(value) =>
                  setPurchaseFee(
                    normalizeMoney(
                      value
                    )
                  )
                }
                addonAfter="₫"
                placeholder="Nhập phí mua hộ"
              />

              <small>
                {/* Không còn mức mặc định 50.000đ: có quy tắc PURCHASE_FEE đang bật thì điền sẵn theo quy tắc, không có thì để 0 cho Sale nhập. */}
                {matchedPurchaseFeeRule
                  ? `Điền sẵn theo quy tắc phí "${matchedPurchaseFeeRule.ruleName || "PURCHASE_FEE"}" (${formatCurrency(matchedPurchaseFeeRule.value)}) — Sale sửa được.`
                  : "Chưa có quy tắc phí mua hộ đang bật — Sale tự nhập phí cho đơn này."}
                {" "}Thuộc phần <b>TRẢ TRƯỚC</b>.
              </small>
            </div>

            {/*
              Ô "Phí vận chuyển" (shippingFee) đã ẨN: backend không còn dùng số này cho tiền —
              PurchaseRequestService gán quotation.ShippingFee = request.ShippingFee rồi ghi đè
              bằng cước tạm tính (cân ước tính × đơn giá /kg); DTO ghi "Không còn dùng, giữ để FE
              cũ gửi lên không bị lỗi". Cước quốc tế nhập ở hai ô "Đơn giá cước" + "Cân ước tính".
            */}

            <div className="purchase-quotation-field">
              <label>
                <TruckOutlined />
                Ship nội địa từ NCC
              </label>

              <InputNumber
                value={domesticShippingFee}
                min={0}
                step={1000}
                precision={0}
                controls={false}
                formatter={moneyFormatter}
                parser={moneyParser}
                onChange={(value) => setDomesticShippingFeeInput(normalizeMoney(value))}
                addonAfter="₫"
                placeholder="Phí NCC giao tới kho nguồn"
              />

              <small>
                Thuộc phần <b>TRẢ TRƯỚC</b> — khách trả ngay cùng tiền hàng và phí mua hộ.
                Chỉ tính ở ô này, không cộng thêm ở phụ phí.
                {domesticFeeRule && (
                  <>
                    {" "}
                    {domesticShippingFeeInput === null
                      ? `Điền sẵn theo quy tắc ${domesticFeeRule.ruleName || "DOMESTIC_FEE"}.`
                      : `Mức theo quy tắc ${domesticFeeRule.ruleName || "DOMESTIC_FEE"}: ${formatCurrency(suggestedDomesticShippingFee)}.`}
                  </>
                )}
              </small>

              {domesticFeeRule &&
                domesticShippingFeeInput !== null &&
                roundMoney(domesticShippingFeeInput) !==
                roundMoney(suggestedDomesticShippingFee) && (
                <button
                  type="button"
                  className="purchase-quotation-fee-edit__reset"
                  onClick={() => setDomesticShippingFeeInput(null)}
                >
                  Khôi phục mức hệ thống (
                  {formatCurrency(suggestedDomesticShippingFee)})
                </button>
              )}
            </div>

            <div className="purchase-quotation-field">
              <label>
                <TruckOutlined />
                Đơn giá cước quốc tế
              </label>

              <InputNumber
                value={freightRatePerKg}
                min={0}
                step={1000}
                precision={0}
                controls={false}
                formatter={moneyFormatter}
                parser={moneyParser}
                onChange={(value) => setFreightRatePerKg(normalizeMoney(value))}
                addonAfter="₫/kg"
                placeholder="Bỏ trống: lấy theo bảng giá tuyến"
              />

              <small>
                Chỉ để <b>tạm tính</b>. Cước thật tính lại theo cân đo ở kho Việt Nam.
              </small>
            </div>

            <div className="purchase-quotation-field">
              <label>
                <TruckOutlined />
                Cân ước tính
              </label>

              <InputNumber
                value={estimatedWeight}
                min={0}
                step={0.5}
                precision={2}
                controls={false}
                onChange={(value) => setEstimatedWeight(Number(value) || 0)}
                addonAfter="kg"
                placeholder="Bỏ trống: 0,2 kg/món, tối thiểu 1 kg"
              />

              <small>
                Dùng để nhân với đơn giá cước ra số tạm tính cho khách xem trước.
              </small>
            </div>
          </div>
        </section>

        <section className="purchase-quotation-section">
          <div className="purchase-quotation-section__heading">
            <div>
              <GiftOutlined />

              <div>
                <span>
                  DỊCH VỤ & THUẾ
                </span>

                <h3>
                  Phụ phí & Quy tắc thuế theo hệ thống
                </h3>
              </div>
            </div>

            <Tag className="purchase-quotation-section__tag is-service">
              {additionalFeeBreakdown.filter((item) => !item.isSkipped).length} quy tắc áp dụng
            </Tag>
          </div>

          {additionalFeeBreakdown.length ===
            0 ? (
            <div className="purchase-quotation-service-empty">
              <InfoCircleOutlined />

              <div>
                <strong>
                  Không có phụ phí dịch vụ
                </strong>

                <span>
                  Khách hàng không chọn dịch vụ có quy tắc tính phí.
                </span>
              </div>
            </div>
          ) : (
            <div className="purchase-quotation-service-list">
              {additionalFeeBreakdown.map(
                (
                  current,
                  index
                ) => {
                  const rule = current.rule;
                  const isInsurance = current.isInsurance;
                  const isSkipped = current.isSkipped;
                  const isTaxOrVat = current.isTaxOrVat;

                  return (
                    <article
                      key={
                        current.pricingRuleId || index
                      }
                      className={`purchase-quotation-service-card ${isSkipped
                        ? "is-disabled"
                        : isTaxOrVat
                          ? "is-tax-vat"
                          : isInsurance
                            ? "is-insurance-card"
                            : ""
                        }`}
                    >
                      <div className="purchase-quotation-service-card__icon">
                        {isInsurance ? (
                          <SafetyCertificateOutlined />
                        ) : isTaxOrVat ? (
                          <DollarOutlined />
                        ) : (
                          <GiftOutlined />
                        )}
                      </div>

                      <div className="purchase-quotation-service-card__content">
                        <span>
                          {rule?.ruleCode || "PRICING_RULE"}
                        </span>

                        <h4>
                          {rule?.ruleName || "Phụ phí dịch vụ"}
                        </h4>

                        <p>
                          {isSkipped
                            ? current.skipReason
                            : isTaxOrVat
                              ? "Hệ thống tự tính khi lưu báo giá (VAT trên phí dịch vụ trả trước; thuế nhập khẩu theo loại hàng, thu khi hàng về VN). Số ở đây chỉ để tham khảo."
                              : rule?.description ||
                              "Phụ phí được lấy từ cấu hình hệ thống."}
                        </p>

                        <div>
                          <Tag>
                            {getCalculationType(rule) === "PERCENTAGE"
                              ? "Phần trăm"
                              : "Cố định"}
                          </Tag>

                          <Tag>
                            {getRuleScopeLabel(rule, packageCount)}
                          </Tag>

                          {isSkipped && (
                            <Tag color="warning">
                              Chưa đạt tối thiểu (&lt; {formatCurrency(getMinRequiredOrderAmount(rule))})
                            </Tag>
                          )}
                        </div>
                      </div>

                      <div className="purchase-quotation-service-card__amount">
                        <span>
                          Mức cấu hình
                        </span>

                        <strong>
                          {getRuleValueLabel(rule)}
                        </strong>

                        <Divider />

                        <span>
                          Thành tiền
                        </span>

                        <b style={{ color: isSkipped ? "#8c8c8c" : undefined }}>
                          {isSkipped
                            ? "0 ₫ (Bỏ qua)"
                            : formatCurrency(current.amount)}
                        </b>

                        {/* Sale sửa mức phí cho riêng khách này. VAT và thuế nhập khẩu do
                            hệ thống tự tính từ các con số bên trên nên không cho sửa tay. */}
                        {current.canOverride ? (
                          <div className="purchase-quotation-fee-edit">
                            <InputNumber
                              size="small"
                              min={0}
                              step={1000}
                              precision={0}
                              controls={false}
                              disabled={Boolean(feeOverrides[current.pricingRuleId]?.disabled)}
                              value={
                                feeOverrides[current.pricingRuleId]?.amount ??
                                current.systemAmount
                              }
                              formatter={moneyFormatter}
                              parser={moneyParser}
                              addonAfter="₫"
                              onChange={(value) =>
                                setFeeOverrides((previous) => ({
                                  ...previous,
                                  [current.pricingRuleId]: {
                                    ...previous[current.pricingRuleId],
                                    amount: normalizeMoney(value),
                                  },
                                }))
                              }
                            />

                            <label className="purchase-quotation-fee-edit__toggle">
                              <Switch
                                size="small"
                                checked={!feeOverrides[current.pricingRuleId]?.disabled}
                                onChange={(checked) =>
                                  setFeeOverrides((previous) => ({
                                    ...previous,
                                    [current.pricingRuleId]: {
                                      ...previous[current.pricingRuleId],
                                      disabled: !checked,
                                    },
                                  }))
                                }
                              />
                              <span>Áp dụng cho khách</span>
                            </label>

                            {current.isOverridden && (
                              <>
                                <Input
                                  size="small"
                                  placeholder="Lý do sửa mức phí (gửi kèm báo giá)"
                                  value={feeOverrides[current.pricingRuleId]?.note || ""}
                                  onChange={(event) =>
                                    setFeeOverrides((previous) => ({
                                      ...previous,
                                      [current.pricingRuleId]: {
                                        ...previous[current.pricingRuleId],
                                        note: event.target.value,
                                      },
                                    }))
                                  }
                                />

                                <button
                                  type="button"
                                  className="purchase-quotation-fee-edit__reset"
                                  onClick={() =>
                                    setFeeOverrides((previous) => {
                                      const next = { ...previous };
                                      delete next[current.pricingRuleId];
                                      return next;
                                    })
                                  }
                                >
                                  Khôi phục mức hệ thống ({formatCurrency(current.systemAmount)})
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <small className="purchase-quotation-fee-edit__locked">
                            Hệ thống tự tính, không sửa tay
                          </small>
                        )}
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}

          <div className="purchase-quotation-service-note">
            <InfoCircleOutlined />

            <span>
              Thuế nhập khẩu và VAT được tự động tính theo quy tắc hệ thống và đơn giá đã nhập.
              Bảo hiểm hàng hóa chỉ áp dụng khi tổng tiền sản phẩm đạt mức tối thiểu theo cấu hình quy tắc.
            </span>
          </div>
        </section>

        <section className="purchase-quotation-section">
          <div className="purchase-quotation-section__heading">
            <div>
              <FileTextOutlined />

              <div>
                <span>
                  GHI CHÚ BÁO GIÁ
                </span>

                <h3>
                  Nội dung gửi kèm báo giá
                </h3>
              </div>
            </div>
          </div>

          <TextArea
            value={note}
            onChange={(event) =>
              setNote(
                event.target.value
              )
            }
            maxLength={1000}
            showCount
            autoSize={{
              minRows: 3,
              maxRows: 6,
            }}
            placeholder="Nhập ghi chú cho khách hàng..."
            className="purchase-quotation-note-input"
          />
        </section>
      </div>

      <div className="purchase-quotation-modal__footer">
        <div className="purchase-quotation-summary">
          <div>
            <span>
              Tiền sản phẩm
            </span>

            <strong>
              {formatCurrency(
                productSubtotal
              )}
            </strong>
          </div>

          <div>
            <span>
              Phí mua hộ
            </span>

            <strong>
              {formatCurrency(
                purchaseFee
              )}
            </strong>
          </div>

          <div>
            <span>
              Ship nội địa
            </span>

            <strong>
              {formatCurrency(
                domesticShippingFee
              )}
            </strong>
          </div>

          {(() => {
            /* Chỉ phụ phí thật gửi lên backend; VAT và thuế NK nằm ở khối TRẢ TRƯỚC / TẠM TÍNH bên dưới. */
            const activeFees = additionalFeeBreakdown.filter(
              (item) => !item.isSkipped && !item.isTaxOrVat && item.amount > 0
            );
            if (activeFees.length === 0) return null;
            const activeFeesTotal = activeFees.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            const tooltipContent = (
              <div style={{ padding: "4px 2px" }}>
                <div style={{ fontWeight: 800, marginBottom: "6px", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: "4px" }}>
                  Chi tiết {activeFees.length} khoản phụ phí:
                </div>
                {activeFees.map((fee) => (
                  <div key={fee.pricingRuleId} style={{ display: "flex", justifyContent: "space-between", gap: "16px", fontSize: "12px", lineHeight: "1.6" }}>
                    <span>• {fee.ruleName}</span>
                    <strong>{formatCurrency(fee.amount)}</strong>
                  </div>
                ))}
              </div>
            );

            return (
              <div>
                <Tooltip title={tooltipContent} placement="top">
                  <span style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    Phụ phí ({activeFees.length} khoản) <InfoCircleOutlined style={{ fontSize: "12px", color: "#60a5fa" }} />
                  </span>
                </Tooltip>

                <strong>
                  {formatCurrency(activeFeesTotal)}
                </strong>
              </div>
            );
          })()}

          <div className="purchase-quotation-summary__total">
            <span>
              Tổng báo giá (dự kiến)
            </span>

            <strong>
              {formatCurrency(
                quotationTotal
              )}
            </strong>
          </div>

          <div className="purchase-quotation-split">
            <div className="purchase-quotation-split__card is-prepay">
              <div className="purchase-quotation-split__head">
                <b>TRẢ TRƯỚC (khách trả ngay)</b>
                <strong>{formatCurrency(quotationEstimate.prepay)}</strong>
              </div>
              <ul>
                <li><i>Tiền hàng</i><em>{formatCurrency(productSubtotal)}</em></li>
                <li><i>Phí mua hộ</i><em>{formatCurrency(quotationEstimate.fee)}</em></li>
                <li><i>Ship nội địa từ NCC</i><em>{formatCurrency(domesticShippingFee)}</em></li>
                <li><i>Phụ phí</i><em>{formatCurrency(quotationEstimate.surcharges)}</em></li>
                <li>
                  <i>VAT {formatNumber(quotationEstimate.vatRatePercent)}% phần phí</i>
                  <em>{formatCurrency(quotationEstimate.vatOnFees)}</em>
                </li>
              </ul>
            </div>

            <div className="purchase-quotation-split__card is-later">
              <div className="purchase-quotation-split__head">
                <b>TẠM TÍNH (thu khi hàng về VN)</b>
                <strong>{formatCurrency(quotationEstimate.later)}</strong>
              </div>
              <ul>
                <li>
                  <i>
                    Cước quốc tế ước tính ({formatNumber(quotationEstimate.weight)} kg
                    {quotationEstimate.weightIsDefault ? " mặc định" : ""} × {formatCurrency(quotationEstimate.freightRate)}/kg
                    {quotationEstimate.freightRateFromTable ? " theo bảng giá tuyến" : ""})
                  </i>
                  <em>{formatCurrency(quotationEstimate.freight)}</em>
                </li>
                <li>
                  <i>VAT {formatNumber(quotationEstimate.vatRatePercent)}% cước</i>
                  <em>{formatCurrency(quotationEstimate.vatOnFreight)}</em>
                </li>
                <li>
                  <i>
                    Thuế nhập khẩu
                    {importTaxRatesLoading
                      ? " (đang tải thuế suất…)"
                      : quotationEstimate.importTaxUnknown > 0
                        ? ` (thiếu thuế suất ${quotationEstimate.importTaxUnknown} dòng — chưa cộng)`
                        : ""}
                  </i>
                  <em>{formatCurrency(quotationEstimate.importTax)}</em>
                </li>
              </ul>
              {quotationEstimate.freightRate <= 0 && (
                <p className="purchase-quotation-split__warn">
                  Chưa có đơn giá cước /kg cho tuyến này — nhập ô "Đơn giá cước quốc tế", nếu không hệ thống sẽ từ chối lưu.
                </p>
              )}
            </div>

            <p className="purchase-quotation-split__note">
              Số xem trước, tính cùng công thức với hệ thống. <b>Số chính thức do hệ thống tính khi lưu</b>{" "}
              (tỷ giá, thuế suất, bảng giá cước tại thời điểm lưu); phần tạm tính thu lại theo cân đo thật ở kho VN.
            </p>
          </div>
        </div>

        <div className="purchase-quotation-modal__actions">
          <Button
            size="large"
            onClick={handleClose}
            disabled={submitting}
          >
            Hủy bỏ
          </Button>

          <Tooltip
            title={
              productSubtotal <= 0
                ? "Vui lòng nhập đơn giá sản phẩm"
                : ""
            }
          >
            <Button
              type="primary"
              size="large"
              icon={
                submitting ? (
                  <CalculatorOutlined />
                ) : (
                  <SaveOutlined />
                )
              }
              loading={submitting}
              disabled={
                submitting ||
                productSubtotal <= 0 ||
                Boolean(rateBlockingMessage)
              }
              onClick={
                handleSubmit
              }
              className="purchase-quotation-submit-button"
            >
              Xác nhận tạo báo giá
            </Button>
          </Tooltip>
        </div>
      </div>
    </Modal>
  );
}
