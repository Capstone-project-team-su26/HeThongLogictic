import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Alert,
  Button,
  Checkbox,
  ConfigProvider,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Switch,
  Tag,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  FileTextOutlined,
  InboxOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";

import {
  getConsignmentDetailApi,
  sendQuotationApi,
} from "@features/consignment/api/consignmentService";
import {
  getOrderLevelFees,
  getOrderQuotationApi,
  getRequoteGuard,
  groupFeesByOrderItem,
} from "@features/consignment/api/quotationService";
import {
  getActivePricingRulesApi,
  findPricingRuleByCode,
  calculatePricingRuleAmount,
  PRICING_RULE_CODE,
} from "@features/pricing/api/pricingRuleService";
import {
  getOriginWarehousesApi,
} from "@features/warehouse/api/warehouseService";
import {
  getServicePricingsApi,
  findMatchingServicePricing,
} from "@features/pricing/api/servicePricingService";
import {
  getActivePackageConfigurationsApi,
  calculateItemsPackageFee,
  calculateItemPackageFee,
  resolveItemPackageConfiguration,
  getPackageConfigurationDisplayName,
} from "@features/pricing/api/packageConfigurationService";

import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import ConfirmConsignmentQuotation from "@features/consignment/components/ConfirmConsignmentQuotation/ConfirmConsignmentQuotation";
import {
  DIM_DECIMAL_PLACES,
  REQUOTE_LOCK_TITLES,
} from "./CreateConsignmentQuotation.constants";
import {
  calculateItemDimKg,
  calculateItemVolumeCm3,
  formatCurrency,
  formatMeasurement,
  getClientUtcPayload,
  getCountryName,
  getFiniteMoney,
  getItemDeclaredValue,
  getItemWeightKg,
  getOrderStatus,
  getUnitSuffix,
  getUnitTypeLabel,
  isRuleEligible,
  isRuleSelectedByCustomer,
  normalizeCountryCode,
  normalizeNullableMoney,
  normalizePositiveNumber,
  normalizeSearchText,
  normalizeServiceTypeCode,
  normalizeText,
  normalizeUpperText,
  parseRouteCountries,
  roundMoney,
  roundToDecimals,
  translateConsignmentType,
  warehouseMatchesCountry,
} from "./CreateConsignmentQuotation.helpers";
import { normalizeOrderStatus } from "../../constants/orderStatus";
import "./CreateConsignmentQuotation.css";
import { getRouteLabel } from "@shared/utils/statusLabel";

/* =========================
   HIỂN THỊ TẢI DỮ LIỆU
========================= */

function PageLoading() {
  return (
    <main className="quotation-create-page">
      <div className="quotation-create-loading">
        <Skeleton.Button
          active
          size="small"
        />

        <Skeleton
          active
          paragraph={{ rows: 8 }}
        />
      </div>
    </main>
  );
}


/* =========================
   COMPONENT
========================= */

export default function CreateConsignmentQuotation() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const orderId =
    params?.orderId ||
    location?.state?.consignment
      ?.orderId ||
    location?.state?.orderId ||
    "";

  const [form] = Form.useForm();

  const [detail, setDetail] =
    useState(null);

  const [
    pricingRules,
    setPricingRules,
  ] = useState([]);

  const [
    warehouses,
    setWarehouses,
  ] = useState([]);

  const [
    servicePricings,
    setServicePricings,
  ] = useState([]);

  const [
    packageConfigurations,
    setPackageConfigurations,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [
    quotationSubmitted,
    setQuotationSubmitted,
  ] = useState(false);

  const quotationSubmitLockRef =
    useRef(false);

  const [error, setError] =
    useState("");

  const [
    warningMessage,
    setWarningMessage,
  ] = useState("");

  const [
    confirmationOpen,
    setConfirmationOpen,
  ] = useState(false);

  const [
    confirmationData,
    setConfirmationData,
  ] = useState(null);

  const [
    pendingPayload,
    setPendingPayload,
  ] = useState(null);

  const [
    selectedWarehouseId,
    setSelectedWarehouseId,
  ] = useState("");

  /*
   * Báo giá NHÁP mà backend sinh sẵn lúc khách tạo đơn. Đây là nguồn sự thật cho
   * phí thùng gỗ và dịch vụ theo từng kiện: hệ thống đã tính rồi, Sale chỉ xem và
   * (nếu cần) sửa số tiền — không nhập lại từ đầu.
   */
  const [draftQuotation, setDraftQuotation] =
    useState(null);

  /*
   * Sale sửa phí dịch vụ của một kiện: khoá là `${orderItemId}::${feeId}`,
   * giá trị { amount, enabled }. Chỉ những dòng có mặt ở đây mới được gửi lên.
   */
  const [itemFeeOverrides, setItemFeeOverrides] =
    useState({});

  /*
   * Phụ phí CẢ ĐƠN do Sale chủ động thêm (không gắn kiện nào): khoá là feeId,
   * giá trị { amount, enabled }.
   */
  const [orderFeeSelections, setOrderFeeSelections] =
    useState({});

  const loadPageData =
    useCallback(async () => {
      if (!orderId) {
        setError(
          "Không tìm thấy mã đơn ký gửi."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setWarningMessage("");

        const [
          detailResult,
          ruleResult,
          warehouseResult,
          pricingResult,
          packageResult,
          quotationResult,
        ] = await Promise.allSettled([
          getConsignmentDetailApi(
            orderId
          ),
          /* orderType=CONSIGNMENT: bỏ các phí chỉ dùng cho luồng mua hộ. */
          getActivePricingRulesApi({
            orderType: "CONSIGNMENT",
          }),
          getOriginWarehousesApi(),
          getServicePricingsApi(),
          getActivePackageConfigurationsApi(),
          /* Đơn chưa có báo giá nào thì trả null thay vì ném 404. */
          getOrderQuotationApi(orderId, {
            allowMissing: true,
          }),
        ]);

        if (
          detailResult.status ===
          "rejected"
        ) {
          throw detailResult.reason;
        }

        setDetail(
          detailResult.value || null
        );

        setPricingRules(
          ruleResult.status ===
            "fulfilled" &&
            Array.isArray(
              ruleResult.value
            )
            ? ruleResult.value
            : []
        );

        setWarehouses(
          warehouseResult.status ===
            "fulfilled" &&
            Array.isArray(
              warehouseResult.value
            )
            ? warehouseResult.value
            : []
        );

        setServicePricings(
          pricingResult.status ===
            "fulfilled" &&
            Array.isArray(
              pricingResult.value
            )
            ? pricingResult.value
            : []
        );

        setPackageConfigurations(
          packageResult.status ===
            "fulfilled" &&
            Array.isArray(
              packageResult.value
            )
            ? packageResult.value
            : []
        );

        setDraftQuotation(
          quotationResult.status ===
            "fulfilled"
            ? quotationResult.value ||
            null
            : null
        );

        /* Mở lại màn là bỏ hết chỉnh sửa cũ: số liệu nền vừa được tải lại. */
        setItemFeeOverrides({});
        setOrderFeeSelections({});

        const warnings = [];

        if (
          ruleResult.status ===
          "rejected"
        ) {
          warnings.push(
            "Không tải được cấu hình phí và thuế."
          );
        }

        if (
          warehouseResult.status ===
          "rejected"
        ) {
          warnings.push(
            "Không tải được danh sách kho gửi hàng."
          );
        }

        if (
          pricingResult.status ===
          "rejected"
        ) {
          warnings.push(
            "Không tải được bảng giá vận chuyển."
          );
        }

        if (
          packageResult.status ===
          "rejected"
        ) {
          warnings.push(
            "Không tải được cấu hình đóng gói."
          );
        }

        if (
          quotationResult.status ===
          "rejected"
        ) {
          warnings.push(
            "Không tải được phí thùng gỗ và dịch vụ theo kiện mà hệ thống đã tính sẵn."
          );
        }

        setWarningMessage(
          warnings.join(" ")
        );
      } catch (requestError) {
        const message =
          requestError?.response?.data
            ?.message ||
          requestError?.response?.data
            ?.error ||
          requestError?.message ||
          "Không thể tải thông tin lập báo giá.";

        setError(message);

        AuthNotify.error(
          "Tải dữ liệu thất bại",
          message
        );
      } finally {
        setLoading(false);
      }
    }, [orderId]);

  useEffect(() => {
    quotationSubmitLockRef.current =
      false;

    const resetTimer = window.setTimeout(
      () => {
        setQuotationSubmitted(false);
        loadPageData();
      },
      0
    );

    return () =>
      window.clearTimeout(resetTimer);
  }, [loadPageData, orderId]);

  const items = useMemo(() => {
    return Array.isArray(
      detail?.items
    )
      ? detail.items
      : [];
  }, [detail]);

  const orderStatus =
    useMemo(
      () =>
        getOrderStatus(
          detail?.status
        ),
      [detail?.status]
    );

  const routeCountries =
    useMemo(
      () =>
        parseRouteCountries(
          detail?.route
        ),
      [detail?.route]
    );

  const routeCountryCodes =
    useMemo(
      () => ({
        originCountry:
          normalizeCountryCode(
            routeCountries
              .originCountry
          ),
        destinationCountry:
          normalizeCountryCode(
            routeCountries
              .destinationCountry
          ),
      }),
      [routeCountries]
    );

  const matchedWarehouses =
    useMemo(() => {
      const matches =
        warehouses.filter(
          (warehouse) =>
            warehouseMatchesCountry(
              warehouse,
              routeCountryCodes
                .originCountry
            )
        );

      return matches.sort(
        (a, b) =>
          normalizeText(
            a?.name
          ).localeCompare(
            normalizeText(b?.name),
            "vi"
          )
      );
    }, [
      warehouses,
      routeCountryCodes
        .originCountry,
    ]);

  const warehouseOptions =
    useMemo(() => {
      return matchedWarehouses.map(
        (warehouse) => ({
          value: normalizeText(
            warehouse?.id
          ),
          label:
            normalizeText(
              warehouse?.name
            ) || "Kho gửi hàng",
          searchText:
            normalizeSearchText(
              [
                warehouse?.name,
                warehouse?.code,
                warehouse?.address,
              ]
                .filter(Boolean)
                .join(" ")
            ),
        })
      );
    }, [matchedWarehouses]);

  useEffect(() => {
    const warehouseTimer =
      window.setTimeout(() => {
        if (
          matchedWarehouses.length === 0
        ) {
          setSelectedWarehouseId("");
          return;
        }

        const quotationWarehouseId =
          normalizeText(
            detail?.quotation?.warehouseId
          );

        setSelectedWarehouseId(
          (currentWarehouseId) => {
            const currentStillValid =
              matchedWarehouses.some(
                (warehouse) =>
                  normalizeText(
                    warehouse?.id
                  ) ===
                  normalizeText(
                    currentWarehouseId
                  )
              );

            if (currentStillValid) {
              return currentWarehouseId;
            }

            const quotationWarehouseExists =
              matchedWarehouses.some(
                (warehouse) =>
                  normalizeText(
                    warehouse?.id
                  ) ===
                  quotationWarehouseId
              );

            if (
              quotationWarehouseExists
            ) {
              return quotationWarehouseId;
            }

            return normalizeText(
              matchedWarehouses[0]?.id
            );
          }
        );
      }, 0);

    return () =>
      window.clearTimeout(
        warehouseTimer
      );
  }, [
    detail?.quotation?.warehouseId,
    matchedWarehouses,
  ]);

  const selectedWarehouse =
    useMemo(() => {
      return (
        matchedWarehouses.find(
          (warehouse) =>
            normalizeText(
              warehouse?.id
            ) ===
            normalizeText(
              selectedWarehouseId
            )
        ) || null
      );
    }, [
      matchedWarehouses,
      selectedWarehouseId,
    ]);

  const selectedServicePricing =
    useMemo(() => {
      const serviceType =
        normalizeServiceTypeCode(
          detail?.consignmentType
        );

      const quotationPricingId =
        normalizeText(
          detail?.quotation
            ?.servicePricingId
        );

      const existingPricing =
        servicePricings.find(
          (pricing) =>
            normalizeText(
              pricing?.id
            ) ===
            quotationPricingId &&
            normalizeUpperText(
              pricing?.serviceType
            ) === serviceType &&
            normalizeCountryCode(
              pricing?.originCountry
            ) ===
            routeCountryCodes
              .originCountry &&
            normalizeCountryCode(
              pricing
                ?.destinationCountry
            ) ===
            routeCountryCodes
              .destinationCountry
        );

      if (existingPricing) {
        return existingPricing;
      }

      return findMatchingServicePricing(
        servicePricings,
        {
          serviceType,
          originCountry:
            routeCountryCodes
              .originCountry,
          destinationCountry:
            routeCountryCodes
              .destinationCountry,
        }
      );
    }, [
      detail?.consignmentType,
      detail?.quotation
        ?.servicePricingId,
      routeCountryCodes,
      servicePricings,
    ]);

  const dimRule =
    useMemo(
      () =>
        findPricingRuleByCode(
          pricingRules,
          PRICING_RULE_CODE
            .VOLUMETRIC_DIVISOR
        ),
      [pricingRules]
    );

  const dimDivisor =
    normalizePositiveNumber(
      dimRule?.value
    );

  const packageCount =
    items.length;

  const totalWeightKg =
    useMemo(() => {
      const returnedWeight =
        normalizePositiveNumber(
          detail?.totalWeight
        );

      if (returnedWeight > 0) {
        return returnedWeight;
      }

      return items.reduce(
        (total, item) =>
          total +
          getItemWeightKg(item),
        0
      );
    }, [
      detail?.totalWeight,
      items,
    ]);

  const totalVolumeCm3 =
    useMemo(() => {
      const returnedVolume =
        normalizePositiveNumber(
          detail?.totalVolume
        );

      if (returnedVolume > 0) {
        return returnedVolume;
      }

      return items.reduce(
        (total, item) =>
          total +
          calculateItemVolumeCm3(
            item
          ),
        0
      );
    }, [
      detail?.totalVolume,
      items,
    ]);

  const totalVolumeM3 =
    totalVolumeCm3 /
    1_000_000;

  const totalDimKg =
    useMemo(() => {
      return roundToDecimals(
        items.reduce(
          (total, item) =>
            total +
            calculateItemDimKg(
              item,
              dimDivisor
            ),
          0
        ),
        DIM_DECIMAL_PLACES
      );
    }, [
      items,
      dimDivisor,
    ]);

  const chargeableWeightKg =
    roundToDecimals(
      Math.max(
        totalWeightKg,
        totalDimKg
      ),
      DIM_DECIMAL_PLACES
    );

  const declaredValue =
    useMemo(() => {
      const itemTotal =
        items.reduce(
          (total, item) =>
            total +
            getItemDeclaredValue(
              item
            ),
          0
        );

      return itemTotal > 0
        ? itemTotal
        : normalizePositiveNumber(
          detail?.quotation
            ?.declaredValue
        );
    }, [
      items,
      detail?.quotation
        ?.declaredValue,
    ]);

  const packageConfigurationFee =
    useMemo(() => {
      return calculateItemsPackageFee(
        items,
        packageConfigurations
      );
    }, [
      items,
      packageConfigurations,
    ]);

  const selectedPackageRows =
    useMemo(() => {
      return items
        .map((item) => {
          const configuration =
            resolveItemPackageConfiguration(
              item,
              packageConfigurations
            );

          if (!configuration) {
            return null;
          }

          return {
            id:
              item?.id ||
              item?.packageConfigurationId,
            name:
              normalizeText(
                item?.productName
              ) || "Kiện hàng",
            configurationName:
              getPackageConfigurationDisplayName(
                configuration
              ),
            fee: calculateItemPackageFee(
              item,
              packageConfigurations
            ),
          };
        })
        .filter(Boolean);
    }, [
      items,
      packageConfigurations,
    ]);

  /* =========================
     PHÍ HỆ THỐNG ĐÃ TÍNH SẴN (báo giá nháp)

     Backend sinh báo giá nháp ngay khi khách tạo đơn; `additionalFees` của nó chỉ
     gồm hai loại: SURCHARGE (dịch vụ khách chọn cho từng kiện) và PACKING_FEE
     (phí thùng gỗ của kiện). Dòng nào có `orderItemId` là phí của riêng kiện đó.

     Sale KHÔNG nhập lại các khoản này. Sale chỉ được:
       - sửa số tiền của một dịch vụ trên đúng một kiện, hoặc
       - tắt (miễn phí) dịch vụ đó cho kiện đó.
     Cả hai đều là "giá ngoài bảng giá" → bắt buộc ghi lý do và chờ Admin duyệt.
  ========================= */

  const itemFeeKey = useCallback(
    (orderItemId, feeId) =>
      `${normalizeText(orderItemId)}::${normalizeText(feeId)}`,
    []
  );

  /* Nhóm phí theo từng kiện, đã gộp phần Sale chỉnh sửa vào từng dòng. */
  const itemFeeGroups = useMemo(() => {
    return groupFeesByOrderItem(
      draftQuotation?.additionalFees
    ).map((group) => {
      const fees = group.fees.map((fee) => {
        /*
         * Phí thùng (PACKING_FEE) không gắn quy tắc phí nên KHÔNG sửa được qua API —
         * backend chỉ nhận cặp (orderItemId, feeId = PRICING_RULES.id) là dịch vụ khách
         * đã chọn (QuotationService.Send.cs, vòng AdditionalFees). Hiển thị chỉ-đọc để
         * Sale vẫn thấy khoản đó trong tổng tiền.
         *
         * KHÔNG dựa vào `feeId` thô của backend: nó rơi về ID DÒNG PHÍ khi dòng không có
         * quy tắc, trước đây làm phí thùng thành "sửa được" rồi gửi ID dòng phí lên →
         * 400 "Không tìm thấy quy định phí với ID". normalizeQuotationFee đã bóc về
         * pricingRuleId thật (null nếu không có).
         */
        const ruleId = normalizeText(
          fee.pricingRuleId
        );

        const editable =
          Boolean(ruleId) &&
          normalizeUpperText(fee.feeType) !==
          "PACKING_FEE";

        const key = itemFeeKey(
          group.orderItemId,
          ruleId || fee.id
        );

        const override = editable
          ? itemFeeOverrides[key]
          : undefined;

        const enabled = override
          ? override.enabled !== false
          : true;

        const amount = override
          ? normalizePositiveNumber(
            override.amount
          )
          : roundMoney(fee.amount);

        return {
          ...fee,
          key,
          editable,
          enabled,
          amount,
          originalAmount: roundMoney(
            fee.amount
          ),
          isOverridden:
            editable &&
            Boolean(override) &&
            (!enabled ||
              Math.abs(
                amount -
                roundMoney(fee.amount)
              ) > 1),
        };
      });

      return {
        ...group,
        fees,
        total: roundMoney(
          fees.reduce(
            (sum, fee) =>
              sum +
              (fee.enabled
                ? fee.amount
                : 0),
            0
          )
        ),
      };
    });
  }, [
    draftQuotation?.additionalFees,
    itemFeeOverrides,
    itemFeeKey,
  ]);

  const itemFeeTotal = useMemo(
    () =>
      roundMoney(
        itemFeeGroups.reduce(
          (sum, group) =>
            sum + group.total,
          0
        )
      ),
    [itemFeeGroups]
  );

  /* Phụ phí cấp ĐƠN đã có sẵn trong báo giá nháp (không gắn kiện nào). */
  const draftOrderFeeRows = useMemo(
    () =>
      getOrderLevelFees(
        draftQuotation?.additionalFees
      )
        .map((fee) => ({
          ...fee,
          amount: roundMoney(fee.amount),
        }))
        /*
         * Bỏ dòng 0đ. Đó là bản ghi lưu vết của quy tắc trong DB, không phải khoản tiền —
         * in ra thì Sale (và khách khi nghe Sale đọc) thấy "VAT dịch vụ logistics 0đ"
         * trong khi hoá đơn vẫn có VAT thật, vì hai dòng đó là hai bản ghi khác nhau.
         */
        .filter((fee) => fee.amount > 0),
    [draftQuotation?.additionalFees]
  );

  const draftOrderFeeTotal = useMemo(
    () =>
      roundMoney(
        draftOrderFeeRows.reduce(
          (sum, fee) =>
            sum +
            (fee.enabled
              ? fee.amount
              : 0),
          0
        )
      ),
    [draftOrderFeeRows]
  );

  const hasItemFeeOverride = useMemo(
    () =>
      itemFeeGroups.some((group) =>
        group.fees.some(
          (fee) => fee.isOverridden
        )
      ),
    [itemFeeGroups]
  );

  /* Danh sách phí Sale được phép THÊM cho cả đơn (không gắn kiện). */
  const orderFeeCandidates = useMemo(() => {
    const itemFeeRuleIds = new Set(
      itemFeeGroups.flatMap((group) =>
        group.fees
          .map((fee) => fee.pricingRuleId)
          .filter(Boolean)
      )
    );

    return pricingRules
      .filter((rule) => {
        const code =
          normalizeUpperText(
            rule?.ruleCode
          );

        /*
         * Bỏ: phí hệ thống tự áp (VAT, thuế), hệ số quy đổi, phí nội địa (backend
         * tự thêm), và những dịch vụ đã tính theo kiện — gửi lại chỉ bị bỏ qua.
         */
        return (
          Boolean(code) &&
          rule?.isRequired !== true &&
          code !==
          PRICING_RULE_CODE
            .VOLUMETRIC_DIVISOR &&
          code !==
          PRICING_RULE_CODE
            .DOMESTIC_FEE &&
          code !== PRICING_RULE_CODE.VAT &&
          code !==
          PRICING_RULE_CODE.IMPORT_TAX &&
          /*
           * Bỏ luôn THÙNG GỖ khỏi mục phụ phí cả đơn.
           *
           * Tiền thùng gỗ tính hoàn toàn theo cỡ thùng chọn cho TỪNG KIỆN
           * (packageConfigurationId); dòng WOOD_CRATE trong bảng quy tắc chỉ để hiện tên
           * dịch vụ cho khách tick chọn, `value` của nó không phải khoản thu. Để nó ở đây
           * thì Sale thấy "Đóng thùng gỗ · bảng giá 35.000đ" và dễ cộng thêm một khoản mà
           * hệ thống không hề thu — đúng chỗ đã làm màn xác nhận của khách báo dư 35.000đ.
           */
          !code.includes("WOOD") &&
          !code.includes("CRATE") &&
          /*
           * Hệ số/ngưỡng tính cước (MIN_WEIGHT) và phí mua hộ (PURCHASE_FEE_*) không phải
           * phụ phí đơn ký gửi: backend bỏ qua khi gửi, để ở đây Sale tưởng đã thu.
           */
          !code.includes("MIN_WEIGHT") &&
          !code.startsWith("PURCHASE_FEE") &&
          normalizeUpperText(rule?.ruleType) !==
          "PURCHASE_FEE" &&
          !itemFeeRuleIds.has(
            normalizeText(rule?.id)
          )
        );
      })
      .map((rule) => {
        const selection =
          orderFeeSelections[
          normalizeText(rule?.id)
          ];

        const suggested = roundMoney(
          calculatePricingRuleAmount(
            rule,
            {
              declaredValue,
              packageCount,
              requiresInspection:
                detail?.requiresInspection,
            }
          )
        );

        return {
          id: normalizeText(rule?.id),
          code: normalizeUpperText(
            rule?.ruleCode
          ),
          label:
            normalizeText(
              rule?.ruleName
            ) || "Phụ phí",
          description: normalizeText(
            rule?.description
          ),
          suggestedAmount: suggested,
          selected: Boolean(selection),
          amount: selection
            ? normalizePositiveNumber(
              selection.amount
            )
            : suggested,
        };
      });
  }, [
    pricingRules,
    itemFeeGroups,
    orderFeeSelections,
    declaredValue,
    packageCount,
    detail?.requiresInspection,
  ]);

  const selectedOrderFeeRows = useMemo(
    () =>
      orderFeeCandidates.filter(
        (row) => row.selected
      ),
    [orderFeeCandidates]
  );

  const selectedOrderFeeTotal = useMemo(
    () =>
      roundMoney(
        selectedOrderFeeRows.reduce(
          (sum, row) =>
            sum + row.amount,
          0
        )
      ),
    [selectedOrderFeeRows]
  );

  /*
   * Phụ phí cả đơn Sale thêm mà số tiền lệch bảng giá cũng là giá ngoại lệ —
   * backend so với chính công thức của rule (lệch > 1đ là phải duyệt).
   */
  const hasOrderFeeOverride = useMemo(
    () =>
      selectedOrderFeeRows.some(
        (row) =>
          Math.abs(
            row.amount -
            row.suggestedAmount
          ) > 1
      ),
    [selectedOrderFeeRows]
  );

  const hasDraftFees =
    itemFeeGroups.length > 0 ||
    draftOrderFeeRows.length > 0;

  /*
   * Phí vận chuyển nội địa là khoản phí của đơn ký gửi,
   * được lấy trực tiếp từ cấu hình phí đang áp dụng.
   * Khoản này luôn được tính riêng và không phụ thuộc
   * vào danh sách phụ phí khách hàng lựa chọn.
   */
  const domesticFeeRule =
    useMemo(() => {
      return findPricingRuleByCode(
        pricingRules,
        PRICING_RULE_CODE.DOMESTIC_FEE
      );
    }, [pricingRules]);

  const selectedOptionalFeeRows =
    useMemo(() => {
      return pricingRules
        .filter((rule) => {
          const code =
            normalizeUpperText(
              rule?.ruleCode
            );

          if (
            !code ||
            rule?.isRequired ===
            true ||
            code ===
            PRICING_RULE_CODE
              .VOLUMETRIC_DIVISOR ||
            code ===
            PRICING_RULE_CODE
              .DOMESTIC_FEE
          ) {
            return false;
          }

          return (
            isRuleSelectedByCustomer(
              rule,
              detail
            ) &&
            isRuleEligible(
              rule,
              {
                declaredValue,
                requiresInspection:
                  detail
                    ?.requiresInspection,
              }
            )
          );
        })
        .map((rule) => {
          const ruleCode =
            normalizeUpperText(
              rule?.ruleCode
            );

          /*
           * Phí đóng thùng gỗ áp dụng theo toàn đơn.
           * Không truyền tổng số kiện vào công thức vì
           * sẽ làm mức phí bị nhân nhiều lần.
           *
           * Các phụ phí theo kiện khác vẫn dùng đúng
           * packageCount thực tế của đơn.
           */
          const calculationPackageCount =
            ruleCode ===
              PRICING_RULE_CODE
                .WOOD_CRATE
              ? 1
              : packageCount;

          const amount =
            calculatePricingRuleAmount(
              rule,
              {
                declaredValue,

                packageCount:
                  calculationPackageCount,

                requiresInspection:
                  detail
                    ?.requiresInspection,
              }
            );

          return {
            id: rule.id,
            code:
              normalizeUpperText(
                rule.ruleCode
              ),
            label:
              normalizeText(
                rule.ruleName
              ) || "Phụ phí",
            description:
              normalizeText(
                rule.description
              ),
            amount:
              roundMoney(amount),
          };
        })
        .filter(
          (row) => row.amount > 0
        );
    }, [
      pricingRules,
      detail,
      declaredValue,
      packageCount,
    ]);

  const domesticShippingFee =
    useMemo(() => {
      if (!domesticFeeRule) {
        return 0;
      }

      return roundMoney(
        calculatePricingRuleAmount(
          domesticFeeRule,
          {
            declaredValue,
            packageCount,
            requiresInspection:
              detail?.requiresInspection,
          }
        )
      );
    }, [
      domesticFeeRule,
      declaredValue,
      packageCount,
      detail?.requiresInspection,
    ]);

  /*
   * Phí đóng thùng gỗ là phụ phí theo toàn đơn.
   * Phí cấu hình thùng được tính riêng theo từng kiện.
   */
  const woodCrateFeeRow =
    useMemo(() => {
      return (
        selectedOptionalFeeRows.find(
          (row) =>
            row.code ===
            PRICING_RULE_CODE.WOOD_CRATE
        ) || null
      );
    }, [selectedOptionalFeeRows]);

  /*
   * Giá trị duy nhất dùng chung cho:
   * - Tổng hợp báo giá phía sale.
   * - Popup xác nhận gửi báo giá.
   * - Payload gửi về API.
   * - Báo giá phía khách hàng.
   */
  const woodCrateFee =
    roundMoney(
      woodCrateFeeRow?.amount
    );

  const otherSurchargeRows =
    useMemo(() => {
      return selectedOptionalFeeRows.filter(
        (row) =>
          row.code !==
          PRICING_RULE_CODE.DOMESTIC_FEE &&
          row.code !==
          PRICING_RULE_CODE.WOOD_CRATE
      );
    }, [selectedOptionalFeeRows]);

  const otherSurchargeTotal =
    useMemo(() => {
      return otherSurchargeRows.reduce(
        (total, row) =>
          total + row.amount,
        0
      );
    }, [otherSurchargeRows]);

  const packagingFeeTotal =
    roundMoney(
      packageConfigurationFee +
      woodCrateFee
    );

  const watchedDiscountPercent =
    Form.useWatch(
      "discountPercent",
      form
    ) ?? 0;

  const watchedSalesNote =
    Form.useWatch(
      "salesNote",
      form
    ) || "";

  useEffect(() => {
    if (!detail?.orderId) {
      return;
    }

    form.setFieldsValue({
      discountPercent:
        normalizePositiveNumber(
          detail?.quotation
            ?.discountPercent
        ),
      salesNote:
        normalizeText(
          detail?.quotation
            ?.salesNote
        ),
    });
  }, [
    detail,
    form,
  ]);

  const unitType =
    normalizeUpperText(
      selectedServicePricing
        ?.unitType
    ) || "KG";

  const billingQuantity =
    unitType === "M3"
      ? totalVolumeM3
      : unitType === "PACKAGE"
        ? packageCount
        : chargeableWeightKg;

  const unitPrice =
    normalizePositiveNumber(
      selectedServicePricing?.price
    );

  const freightCharge =
    roundMoney(
      unitPrice *
      normalizePositiveNumber(
        billingQuantity
      )
    );

  /*
   * Phí dịch vụ hiển thị trước khi gửi.
   *
   * Có báo giá nháp (trường hợp thường gặp): lấy ĐÚNG những khoản backend đã
   * tính — phí thùng gỗ và dịch vụ của từng kiện, cộng phụ phí cấp đơn đã có —
   * rồi cộng thêm phụ phí cả đơn Sale vừa thêm.
   *
   * Không có báo giá nháp (đơn cũ): rơi về cách tính tại chỗ như trước để màn
   * hình không trống trơn.
   */
  const serviceFee =
    roundMoney(
      hasDraftFees
        ? itemFeeTotal +
        draftOrderFeeTotal +
        selectedOrderFeeTotal
        : packagingFeeTotal +
        otherSurchargeTotal +
        selectedOrderFeeTotal
    );

  /*
   * Thuế và phí nhập khẩu do backend tính theo cấu hình (VAT + thuế nhập khẩu
   * theo loại hàng). Ưu tiên số của báo giá nháp, rồi tới số trả kèm chi tiết đơn.
   *
   * Sale có thể GHI ĐÈ hai khoản này — khi đó báo giá thành "giá ngoại lệ" và
   * phải chờ Admin duyệt, nên hai ô nhập ở dưới mặc định để trống (null = không
   * ghi đè), KHÔNG điền sẵn số hệ thống.
   */
  const returnedTaxAndDuty =
    draftQuotation?.taxAndDuty !== undefined &&
      draftQuotation?.taxAndDuty !== null
      ? getFiniteMoney(
        draftQuotation.taxAndDuty
      )
      : detail?.quotation?.taxAndDuty !== undefined &&
        detail?.quotation?.taxAndDuty !== null
        ? getFiniteMoney(
          detail.quotation.taxAndDuty
        )
        : null;

  const watchedVatOverride =
    Form.useWatch("vatOverride", form);

  const watchedImportTaxOverride =
    Form.useWatch(
      "importTaxOverride",
      form
    );

  const vatOverride =
    normalizeNullableMoney(
      watchedVatOverride
    );

  const importTaxOverride =
    normalizeNullableMoney(
      watchedImportTaxOverride
    );

  const hasTaxOverride =
    vatOverride !== null ||
    importTaxOverride !== null;

  const taxAndDuty = hasTaxOverride
    ? roundMoney(
      (vatOverride ??
        getFiniteMoney(
          draftQuotation?.vat,
          0
        )) +
      (importTaxOverride ??
        getFiniteMoney(
          draftQuotation?.importTax,
          0
        ))
    )
    : returnedTaxAndDuty ?? 0;

  const subtotal =
    roundMoney(
      freightCharge +
      domesticShippingFee +
      serviceFee
    );

  const discountPercent =
    Math.min(
      100,
      normalizePositiveNumber(
        watchedDiscountPercent
      )
    );

  const discountAmount =
    roundMoney(
      subtotal *
      (discountPercent / 100)
    );

  const totalEstimatedCost =
    roundMoney(
      subtotal -
      discountAmount +
      taxAndDuty
    );

  const currentOrderStatus =
    normalizeUpperText(
      normalizeOrderStatus(detail?.status)
    );

  const terminalStatus =
    [
      "COMPLETED",
      "CANCELLED",
    ].includes(currentOrderStatus);

  /*
   * ĐƠN CÒN BÁO GIÁ ĐƯỢC HAY KHÔNG — bám đúng luật của backend
   * (VCL_BLL/Services/QuotationService.Send.cs · QuotableOrderStatuses):
   * báo giá lại được khi đơn ở PENDING_REVIEW, NEED_MORE_INFO, APPROVED,
   * QUOTATION_SENT hoặc QUOTATION_REJECTED, và CHƯA có báo giá nào được khách
   * chấp nhận. Gửi báo giá mới thì bản cũ chưa được chấp nhận tự bị thay thế.
   *
   * Trước đây màn này khoá luôn khi đơn đã ở QUOTATION_SENT / APPROVED — nghĩa là
   * khách từ chối báo giá xong thì Sale KHÔNG báo giá lại được, dù backend cho phép.
   */
  const QUOTABLE_ORDER_STATUSES = [
    "PENDING_REVIEW",
    "NEED_MORE_INFO",
    "APPROVED",
    "QUOTATION_SENT",
    "QUOTATION_REJECTED",
  ];

  const quotationAccepted =
    useMemo(() => {
      const statuses = [
        normalizeUpperText(
          draftQuotation?.status
        ),
        normalizeUpperText(
          detail?.quotation?.status
        ),
      ];

      return (
        statuses.includes("ACCEPTED") ||
        [
          "WAITING_DEPOSIT",
          "DEPOSIT_PAID",
        ].includes(currentOrderStatus)
      );
    }, [
      draftQuotation?.status,
      detail?.quotation?.status,
      currentOrderStatus,
    ]);

  /*
   * LUẬT LẬP LẠI BÁO GIÁ — backend trả kèm báo giá của nhân viên
   * (canSalesRequote / requoteState / requoteBlockedReason, cùng luật với
   * POST .../quotation/send): báo giá đã tới tay khách, hoặc Admin đã duyệt giá
   * ngoại lệ, thì KHÔNG lập lại (API trả 409). Chỉ lập lại khi khách từ chối,
   * báo giá hết hạn, hoặc Admin từ chối giá ngoại lệ. Backend cũ chưa trả cờ thì
   * getRequoteGuard tự suy từ status / priceApprovalStatus / expiredAt.
   */
  const requoteGuard = useMemo(
    () =>
      getRequoteGuard(
        draftQuotation ||
        detail?.quotation ||
        null
      ),
    [draftQuotation, detail?.quotation]
  );

  const requoteLocked =
    !requoteGuard.allowed;

  const orderIsQuotable =
    QUOTABLE_ORDER_STATUSES.includes(
      currentOrderStatus
    ) &&
    !quotationAccepted &&
    !requoteLocked;

  /* Khoá nút sau khi vừa gửi xong trong phiên này, tránh bấm hai lần. */
  const hasSentQuotation = Boolean(
    quotationSubmitted ||
    location?.state?.quotationSent
  );

  /* Báo giá đang chờ Admin duyệt giá: gửi bản mới sẽ thay thế bản đang chờ. */
  const pendingPriceApproval =
    normalizeUpperText(
      draftQuotation?.status
    ) === "PENDING_PRICE_APPROVAL";

  const watchedOverrideReason =
    Form.useWatch(
      "overrideReason",
      form
    ) || "";

  /*
   * GIÁ NGOÀI BẢNG GIÁ.
   *
   * Backend đánh dấu "giá ngoại lệ" khi Sale sửa phí dịch vụ của một kiện, thêm
   * phụ phí cả đơn khác công thức, hoặc ghi đè thuế — lệch quá 1đ là tính. Khi đó
   * BẮT BUỘC có overrideReason (hoặc salesNote), nếu không request bị 400.
   */
  const hasOutOfPriceListEdit =
    hasItemFeeOverride ||
    hasOrderFeeOverride ||
    hasTaxOverride;

  const overrideReasonProvided =
    normalizeText(
      watchedOverrideReason
    ).length > 0 ||
    normalizeText(watchedSalesNote)
      .length > 0;

  const requiresOverrideReason =
    hasOutOfPriceListEdit &&
    !overrideReasonProvided;

  const canCreateQuotation =
    Boolean(orderId) &&
    packageCount > 0 &&
    totalWeightKg > 0 &&
    Boolean(selectedWarehouse?.id) &&
    Boolean(
      selectedServicePricing?.id
    ) &&
    !terminalStatus &&
    orderIsQuotable &&
    !hasSentQuotation &&
    !requiresOverrideReason;

  const validationMessages =
    useMemo(() => {
      const messages = [];

      if (packageCount <= 0) {
        messages.push(
          "Đơn hàng chưa có kiện hàng."
        );
      }

      if (totalWeightKg <= 0) {
        messages.push(
          "Đơn hàng chưa có trọng lượng hợp lệ."
        );
      }

      if (
        !selectedWarehouse?.id
      ) {
        messages.push(
          `Không tìm thấy kho gửi hàng phù hợp với tuyến từ ${getCountryName(
            routeCountryCodes
              .originCountry
          )} về Việt Nam.`
        );
      }

      if (
        !selectedServicePricing?.id
      ) {
        messages.push(
          "Không tìm thấy bảng giá phù hợp với tuyến và loại dịch vụ khách hàng đã chọn."
        );
      }

      if (terminalStatus) {
        messages.push(
          "Đơn hàng đã hoàn thành hoặc đã hủy nên không thể lập báo giá."
        );
      }

      /* Bị khoá theo luật lập lại báo giá thì khung khoá phía trên đã nói lý do. */
      if (
        !terminalStatus &&
        !orderIsQuotable &&
        !requoteLocked
      ) {
        messages.push(
          quotationAccepted
            ? "Khách đã chấp nhận báo giá của đơn này nên không lập báo giá mới được. Phí phát sinh đi qua đợt thanh toán cuối."
            : `Đơn đang ở trạng thái ${orderStatus.label} nên không lập báo giá được.`
        );
      }

      if (
        hasSentQuotation &&
        !terminalStatus
      ) {
        messages.push(
          "Vừa gửi báo giá cho đơn này. Tải lại trang nếu cần gửi bản khác."
        );
      }

      if (requiresOverrideReason) {
        messages.push(
          "Có khoản nhập khác bảng giá: bắt buộc ghi lý do ở mục Thông tin bổ sung, và báo giá sẽ chờ Admin duyệt."
        );
      }

      return messages;
    }, [
      packageCount,
      totalWeightKg,
      selectedWarehouse,
      selectedServicePricing,
      terminalStatus,
      orderIsQuotable,
      requoteLocked,
      quotationAccepted,
      orderStatus.label,
      hasSentQuotation,
      requiresOverrideReason,
      routeCountryCodes
        .originCountry,
    ]);

  const buildQuotationPayload =
    useCallback(() => {
      if (!canCreateQuotation) {
        throw new Error(
          validationMessages[0] ||
          "Chưa đủ điều kiện lập báo giá."
        );
      }

      /*
       * additionalFees gửi lên CHỈ gồm hai loại dòng:
       *
       * 1. Dòng có `orderItemId` + `feeId`: sửa số tiền dịch vụ của ĐÚNG kiện đó
       *    (enabled: false = miễn phí). Chỉ gửi những dòng Sale thật sự đã sửa —
       *    gửi lại nguyên danh sách cũ là vô ích, và gửi dòng không sửa gì thì
       *    backend vẫn so số nên dễ sinh chênh lệch làm tròn.
       * 2. Dòng KHÔNG có `orderItemId`: phụ phí cả đơn Sale chủ động thêm.
       *
       * Phí thùng gỗ và dịch vụ theo kiện mà khách đã chọn thì KHÔNG gửi lại:
       * backend tự tính, gửi lại chỉ bị bỏ qua (hoặc cộng hai lần nếu gửi sai).
       */
      const itemFeeOverrideRows =
        itemFeeGroups.flatMap((group) =>
          group.fees
            .filter(
              (fee) =>
                fee.editable &&
                fee.isOverridden
            )
            .map((fee) => ({
              /* ID QUY TẮC PHÍ, không phải ID dòng phí (QUOTATION_FEES.id). */
              feeId: fee.pricingRuleId,
              orderItemId:
                group.orderItemId,
              code: fee.code,
              label: fee.label,
              amount: fee.enabled
                ? roundMoney(fee.amount)
                : 0,
              enabled: fee.enabled,
            }))
        );

      const orderFeeRows =
        selectedOrderFeeRows.map(
          (row) => ({
            feeId: row.id,
            code: row.code,
            label: row.label,
            amount: roundMoney(
              row.amount
            ),
            enabled: true,
          })
        );

      /*
       * Chụp thời gian đúng lúc người dùng mở bước xác nhận.
       * Payload này được giữ nguyên cho đến khi gửi thành công,
       * tránh tạo nhiều mốc thời gian khác nhau khi nhấn xác nhận.
       */
      const clientUtcPayload =
        getClientUtcPayload();

      return {
        ...clientUtcPayload,

        warehouseId:
          selectedWarehouse.id,

        servicePricingId:
          selectedServicePricing.id,

        serviceType:
          normalizeServiceTypeCode(
            detail?.consignmentType
          ),

        weightKg:
          roundToDecimals(
            totalWeightKg,
            4
          ),

        volumeM3:
          roundToDecimals(
            totalVolumeM3,
            6
          ),

        packageCount,
        declaredValue:
          roundMoney(declaredValue),

        salesNote:
          normalizeText(
            watchedSalesNote
          ),

        overrideReason:
          normalizeText(
            watchedOverrideReason
          ),

        quotation: {
          servicePricingId:
            selectedServicePricing.id,

          serviceType:
            normalizeServiceTypeCode(
              detail?.consignmentType
            ),

          additionalFees: [
            ...orderFeeRows,
            ...itemFeeOverrideRows,
          ],

          /* null = không ghi đè, để backend tính theo cấu hình thuế. */
          vat: vatOverride,
          importTax: importTaxOverride,

          salesNote:
            normalizeText(
              watchedSalesNote
            ),
        },
      };
    }, [
      canCreateQuotation,
      validationMessages,
      selectedWarehouse,
      selectedServicePricing,
      detail?.consignmentType,
      totalWeightKg,
      totalVolumeM3,
      packageCount,
      declaredValue,
      watchedSalesNote,
      watchedOverrideReason,
      itemFeeGroups,
      selectedOrderFeeRows,
      vatOverride,
      importTaxOverride,
    ]);

  const buildConfirmationData =
    useCallback((calculation = null) => {
      const exactTaxAndDuty =
        getFiniteMoney(
          calculation?.taxAndDuty,
          taxAndDuty
        );

      const exactTotalEstimatedCost =
        getFiniteMoney(
          calculation?.totalEstimatedCost,
          calculation?.total,
          totalEstimatedCost
        );

      return {
        consignmentCode:
          detail?.consignmentCode ||
          "Đơn ký gửi",

        customerName:
          detail?.customer?.fullName ||
          "Khách hàng",

        customerPhone:
          detail?.customer?.phone ||
          "—",

        route:
          detail?.route || "—",

        serviceName:
          translateConsignmentType(
            detail?.consignmentType
          ),

        warehouseName:
          selectedWarehouse?.name ||
          "—",

        warehouseAddress:
          selectedWarehouse?.address ||
          "—",

        pricingName:
          `${translateConsignmentType(
            selectedServicePricing
              ?.serviceType
          )} • ${getCountryName(
            routeCountryCodes
              .originCountry
          )} → ${getCountryName(
            routeCountryCodes
              .destinationCountry
          )}`,

        unitPrice,
        unitType,
        billingQuantity,

        freightCharge,
        domesticShippingFee,
        packageConfigurationFee,
        woodCrateFee,
        packagingFeeTotal,

        /* Danh sách phí hiện trong popup xác nhận = đúng thứ sẽ gửi lên. */
        optionalFees: hasDraftFees
          ? [
            ...itemFeeGroups.flatMap(
              (group) =>
                group.fees
                  .filter(
                    (fee) => fee.enabled
                  )
                  .map((fee) => ({
                    id: fee.key,
                    code: fee.code,
                    label: `${fee.label} · ${group.itemName || "Kiện hàng"}`,
                    amount: fee.amount,
                  }))
            ),
            ...draftOrderFeeRows
              .filter(
                (fee) => fee.enabled
              )
              .map((fee) => ({
                id: fee.id || fee.code,
                code: fee.code,
                label: fee.label,
                amount: fee.amount,
              })),
            ...selectedOrderFeeRows.map(
              (row) => ({
                id: row.id,
                code: row.code,
                label: row.label,
                amount: row.amount,
              })
            ),
          ]
          : otherSurchargeRows,

        discountPercent,
        discountAmount,

        taxAndDuty:
          exactTaxAndDuty,

        declaredValue,
        totalEstimatedCost:
          exactTotalEstimatedCost,

        salesNote:
          normalizeText(
            watchedSalesNote
          ),

        packageRows:
          selectedPackageRows,

        /*
         * ĐỦ THÔNG TIN TRƯỚC KHI GỬI: hộp xác nhận trước đây không có hàng của đơn, người
         * nhận, và không báo trước báo giá sẽ phải chờ Admin duyệt giá. Thêm nguyên dữ liệu
         * đã có (chi tiết đơn + cờ giá ngoại lệ đang tính trên màn), không tính lại gì.
         */
        items: Array.isArray(detail?.items)
          ? detail.items
          : [],
        receiverName:
          detail?.receiverName || "",
        receiverPhone:
          detail?.receiverPhone || "",
        receiverAddress:
          detail?.receiverAddress || "",
        customerEmail:
          detail?.customer?.email || "",
        totalWeightKg,
        outOfPriceList:
          hasOutOfPriceListEdit,
        overrideReason:
          normalizeText(
            watchedOverrideReason
          ),
        replacesPendingApproval:
          pendingPriceApproval,
      };
    }, [
      totalWeightKg,
      hasOutOfPriceListEdit,
      watchedOverrideReason,
      pendingPriceApproval,
      detail,
      selectedWarehouse,
      selectedServicePricing,
      routeCountryCodes,
      unitPrice,
      unitType,
      billingQuantity,
      freightCharge,
      domesticShippingFee,
      packageConfigurationFee,
      woodCrateFee,
      packagingFeeTotal,
      otherSurchargeRows,
      hasDraftFees,
      itemFeeGroups,
      draftOrderFeeRows,
      selectedOrderFeeRows,
      discountPercent,
      discountAmount,
      taxAndDuty,
      declaredValue,
      totalEstimatedCost,
      watchedSalesNote,
      selectedPackageRows,
    ]);

  const handleOpenConfirmation =
    async () => {
      if (
        sending ||
        hasSentQuotation ||
        quotationSubmitLockRef.current
      ) {
        if (hasSentQuotation) {
          AuthNotify.warning(
            "Báo giá đã được gửi",
            "Không thể xác nhận hoặc gửi lại báo giá cho đơn hàng này."
          );
        }

        return;
      }

      try {
        await form.validateFields();

        const payload =
          buildQuotationPayload();

        setPendingPayload(payload);

        setConfirmationData(
          buildConfirmationData(
            payload.quotation
          )
        );

        setConfirmationOpen(true);
      } catch (formError) {
        if (formError?.errorFields) {
          return;
        }

        AuthNotify.error(
          "Chưa thể mở xác nhận báo giá",
          formError?.response?.data?.message ||
          formError?.response?.data?.error ||
          formError?.message ||
          "Vui lòng kiểm tra lại thông tin."
        );
      }
    };

  const handleConfirmQuotation =
    async () => {
      if (
        sending ||
        quotationSubmitted ||
        hasSentQuotation ||
        quotationSubmitLockRef.current ||
        !pendingPayload
      ) {
        return;
      }

      quotationSubmitLockRef.current =
        true;

      try {
        setSending(true);

        const result =
          await sendQuotationApi(
            orderId,
            pendingPayload
          );

        setQuotationSubmitted(true);
        setPendingPayload(null);

        /*
         * Hai kết cục khác hẳn nhau, phải nói rõ cho Sale:
         *  - QUOTATION_SENT: khách đã thấy báo giá, chờ khách xác nhận.
         *  - PENDING_PRICE_APPROVAL: có giá ngoài bảng giá, đang chờ Admin duyệt;
         *    khách CHƯA thấy gì cả.
         */
        const waitingPriceApproval =
          result?.status ===
          "PENDING_PRICE_APPROVAL";

        if (waitingPriceApproval) {
          AuthNotify.warning(
            "Báo giá chờ Admin duyệt giá",
            result?.message ||
            "Báo giá có khoản ngoài bảng giá nên đã chuyển Admin duyệt. Khách hàng chưa nhìn thấy báo giá này."
          );
        } else {
          AuthNotify.success(
            "Gửi báo giá thành công",
            result?.message ||
            "Báo giá chính thức đã được gửi đến khách hàng."
          );
        }

        setConfirmationOpen(false);

        navigate(
          `/sale/consignments/${orderId}`,
          {
            replace: true,
            state: {
              orderId,
              quotationSent: true,
              refreshQuotation: true,
            },
          }
        );
      } catch (sendError) {
        quotationSubmitLockRef.current =
          false;

        /*
         * 409: trong lúc Sale soạn, báo giá của đơn đã tới tay khách (Admin vừa
         * duyệt, hoặc Sale khác vừa gửi). Tải lại để khung khoá hiện ra.
         */
        if (
          sendError?.response?.status ===
          409
        ) {
          setConfirmationOpen(false);
          loadPageData();
        }

        const message =
          sendError?.response?.data
            ?.message ||
          sendError?.response?.data
            ?.error ||
          sendError?.message ||
          "Không thể gửi báo giá. Vui lòng thử lại.";

        AuthNotify.error(
          "Gửi báo giá thất bại",
          message
        );
      } finally {
        setSending(false);
      }
    };

  if (loading) {
    return <PageLoading />;
  }

  if (error || !detail) {
    return (
      <main className="quotation-create-page">
        <section className="quotation-create-error">
          <InboxOutlined />

          <h2>
            Không thể mở màn hình lập báo giá
          </h2>

          <p>
            {error ||
              "Không tìm thấy thông tin đơn ký gửi."}
          </p>

          <div>
            <Button
              icon={
                <ArrowLeftOutlined />
              }
              onClick={() =>
                navigate(-1)
              }
            >
              Quay lại
            </Button>

            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadPageData}
            >
              Tải lại
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="quotation-create-page">
      <div className="quotation-create-shell">
        <div className="quotation-create-topbar">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() =>
              navigate(-1)
            }
            className="quotation-create-back"
          >
            Quay lại chi tiết đơn
          </Button>

          <div className="quotation-create-topbar__tags">
            {draftQuotation && (
              <Tag
                color={requoteGuard.tone}
                className="quotation-requote-state"
              >
                Báo giá: {requoteGuard.label}
              </Tag>
            )}

            <Tag
              className={`quotation-order-status ${orderStatus.className}`}
            >
              {orderStatus.label}
            </Tag>
          </div>
        </div>

        {warningMessage && (
          <Alert
            type="warning"
            showIcon
            message="Một số dữ liệu chưa tải được"
            description={
              warningMessage
            }
            action={
              <Button
                size="small"
                onClick={loadPageData}
              >
                Tải lại
              </Button>
            }
            className="quotation-create-warning"
          />
        )}

        <section className="quotation-create-hero">
          <div className="quotation-create-hero__content">
            <span>
              BÁO GIÁ CHÍNH THỨC
            </span>

            <h1>
              {detail
                ?.consignmentCode ||
                "Đơn ký gửi"}
            </h1>

            <p>
              Các thông tin về tuyến vận chuyển,
              kho xử lý và bảng giá được hệ thống
              tự xác định theo lựa chọn của khách
              hàng.
            </p>
          </div>

          <div className="quotation-create-hero__summary">
            <div>
              <span>Số kiện</span>
              <strong>
                {packageCount} kiện
              </strong>
            </div>

            <div>
              <span>
                Trọng lượng thực
              </span>
              <strong>
                {formatMeasurement(
                  totalWeightKg,
                  4
                )}{" "}
                kg
              </strong>
            </div>

            <div>
              <span>
                Khối lượng tính cước
              </span>
              <strong>
                {formatMeasurement(
                  chargeableWeightKg,
                  4
                )}{" "}
                kg
              </strong>
            </div>

            <div>
              <span>
                Giá trị khai báo
              </span>
              <strong>
                {formatCurrency(
                  declaredValue
                )}
              </strong>
            </div>
          </div>
        </section>

        {requoteLocked && (
          <Alert
            type={
              requoteGuard.state ===
              "ORDER_NOT_QUOTABLE"
                ? "info"
                : "success"
            }
            showIcon
            icon={<LockOutlined />}
            message={
              REQUOTE_LOCK_TITLES[
              requoteGuard.state
              ] || requoteGuard.label
            }
            description={
              requoteGuard.reason ||
              "Không lập lại báo giá cho đơn này được."
            }
            action={
              <Button
                icon={<EyeOutlined />}
                onClick={() =>
                  navigate(
                    `/sale/consignments/${orderId}`,
                    {
                      state: {
                        orderId,
                        refreshQuotation: true,
                      },
                    }
                  )
                }
              >
                Xem báo giá
              </Button>
            }
            className="quotation-create-warning quotation-requote-lock"
          />
        )}

        {pendingPriceApproval && (
          <Alert
            type="info"
            showIcon
            message="Đơn này đang có một báo giá chờ Admin duyệt giá"
            description="Khách hàng chưa nhìn thấy báo giá đó. Gửi báo giá mới ở đây sẽ thay thế bản đang chờ duyệt."
            className="quotation-create-warning"
          />
        )}

        {!requoteLocked &&
          validationMessages.length >
          0 && (
            <Alert
              type="warning"
              showIcon
              message="Chưa đủ điều kiện gửi báo giá"
              description={
                <ul className="quotation-validation-list">
                  {validationMessages.map(
                    (message) => (
                      <li key={message}>
                        {message}
                      </li>
                    )
                  )}
                </ul>
              }
              className="quotation-create-validation"
            />
          )}

        {/* Khoá toàn bộ ô nhập khi không được lập lại báo giá. */}
        <ConfigProvider
          componentDisabled={
            requoteLocked
          }
        >
        <div className="quotation-create-layout">
          <section className="quotation-create-main">
            <article className="quotation-section-card">
              <div className="quotation-section-heading">
                <div className="quotation-section-heading__icon">
                  <EnvironmentOutlined />
                </div>

                <div>
                  <span>01</span>
                  <h2>
                    Tuyến và kho xử lý
                  </h2>
                  <p>
                    Chỉ hiển thị các kho phù hợp với
                    quốc gia gửi. Bạn có thể chọn kho
                    xử lý khi có nhiều kho.
                  </p>
                </div>
              </div>

              <div className="quotation-locked-grid">
                <div className="quotation-locked-card">
                  <span>Tuyến vận chuyển</span>
                  <strong>
                    {getCountryName(
                      routeCountryCodes
                        .originCountry
                    )}{" "}
                    →{" "}
                    {getCountryName(
                      routeCountryCodes
                        .destinationCountry
                    )}
                  </strong>
                  <small>
                    {getRouteLabel(detail?.route, "—")}
                  </small>
                </div>

                <div className="quotation-locked-card quotation-warehouse-card">
                  <span>Kho gửi hàng</span>

                  {matchedWarehouses.length > 0 ? (
                    <>
                      <Select
                        value={
                          selectedWarehouseId ||
                          undefined
                        }
                        onChange={
                          setSelectedWarehouseId
                        }
                        options={warehouseOptions}
                        optionFilterProp="searchText"
                        filterOption={(input, option) =>
                          normalizeSearchText(
                            option?.searchText
                          ).includes(
                            normalizeSearchText(input)
                          )
                        }
                        showSearch
                        className="quotation-warehouse-select"
                        popupClassName="quotation-warehouse-select-popup"
                        placeholder="Chọn kho gửi hàng"
                        notFoundContent="Không có kho phù hợp"
                      />

                      {selectedWarehouse && (
                        <div className="quotation-warehouse-selected">
                          <strong>
                            {selectedWarehouse.name}
                          </strong>
                          <small>
                            {selectedWarehouse.address ||
                              "Chưa cập nhật địa chỉ"}
                          </small>
                          <Tag>
                            {matchedWarehouses.length > 1
                              ? `${matchedWarehouses.length} kho phù hợp`
                              : "Kho phù hợp với tuyến"}
                          </Tag>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <strong>
                        Chưa tìm thấy kho phù hợp
                      </strong>
                      <small>
                        Vui lòng kiểm tra lại tuyến
                        hàng và danh sách kho.
                      </small>
                    </>
                  )}
                </div>
              </div>
            </article>

            <article className="quotation-section-card">
              <div className="quotation-section-heading">
                <div className="quotation-section-heading__icon">
                  <DollarOutlined />
                </div>

                <div>
                  <span>02</span>
                  <h2>
                    Bảng giá vận chuyển
                  </h2>
                  <p>
                    Bảng giá được khóa theo loại
                    dịch vụ khách hàng đã chọn.
                  </p>
                </div>
              </div>

              {selectedServicePricing ? (
                <div className="quotation-pricing-card">
                  <div className="quotation-pricing-card__main">
                    <Tag>
                      {translateConsignmentType(
                        selectedServicePricing
                          .serviceType
                      )}
                    </Tag>

                    <strong>
                      {getCountryName(
                        normalizeCountryCode(
                          selectedServicePricing
                            .originCountry
                        )
                      )}{" "}
                      →{" "}
                      {getCountryName(
                        normalizeCountryCode(
                          selectedServicePricing
                            .destinationCountry
                        )
                      )}
                    </strong>

                    <span>
                      {
                        getUnitTypeLabel(
                          selectedServicePricing
                            .unitType
                        )
                      }
                    </span>
                  </div>

                  <div className="quotation-pricing-card__price">
                    <span>Đơn giá</span>
                    <strong>
                      {formatCurrency(
                        unitPrice
                      )}
                    </strong>
                    <small>
                      /{" "}
                      {getUnitSuffix(
                        unitType
                      )}
                    </small>
                  </div>

                  <div className="quotation-pricing-card__lock">
                    <SafetyCertificateOutlined />
                    Không thể thay đổi
                  </div>
                </div>
              ) : (
                <Empty
                  image={
                    Empty
                      .PRESENTED_IMAGE_SIMPLE
                  }
                  description="Không tìm thấy bảng giá phù hợp với tuyến và dịch vụ của đơn hàng."
                />
              )}
            </article>

            {selectedPackageRows.length >
              0 && (
                <article className="quotation-section-card">
                  <div className="quotation-section-heading">
                    <div className="quotation-section-heading__icon">
                      <ShoppingOutlined />
                    </div>

                    <div>
                      <span>03</span>
                      <h2>
                        Cấu hình đóng gói
                      </h2>
                      <p>
                        Chỉ hiển thị cấu hình khách
                        hàng đã chọn cho từng kiện.
                      </p>
                    </div>
                  </div>

                  <div className="quotation-package-list">
                    {selectedPackageRows.map(
                      (row) => (
                        <div
                          key={row.id}
                          className="quotation-package-row"
                        >
                          <div>
                            <strong>
                              {row.name}
                            </strong>
                            <span>
                              {
                                row.configurationName
                              }
                            </span>
                          </div>

                          <strong>
                            {formatCurrency(
                              row.fee
                            )}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                </article>
              )}

            {/* ============ DỊCH VỤ & PHÍ THEO KIỆN (hệ thống đã tính) ============ */}

            {itemFeeGroups.length > 0 && (
              <article className="quotation-section-card">
                <div className="quotation-section-heading">
                  <div className="quotation-section-heading__icon">
                    <CheckCircleOutlined />
                  </div>

                  <div>
                    <span>04</span>
                    <h2>
                      Dịch vụ &amp; phí theo từng kiện
                    </h2>
                    <p>
                      Hệ thống đã tính sẵn theo thùng gỗ và dịch vụ khách chọn cho
                      từng kiện — bạn không phải nhập lại. Chỉ sửa khi thật sự cần:
                      mọi số khác bảng giá đều phải ghi lý do và chờ Admin duyệt.
                    </p>
                  </div>
                </div>

                <div className="quotation-item-fee-list">
                  {itemFeeGroups.map((group) => (
                    <div
                      key={group.orderItemId}
                      className="quotation-item-fee-group"
                    >
                      <div className="quotation-item-fee-group__head">
                        <strong>
                          {group.itemName || "Kiện hàng"}
                        </strong>

                        <strong>
                          {formatCurrency(group.total)}
                        </strong>
                      </div>

                      {group.fees.map((fee) => (
                        <div
                          key={fee.key}
                          className={`quotation-item-fee-row ${fee.enabled ? "" : "is-disabled"
                            }`}
                        >
                          <div className="quotation-item-fee-row__label">
                            <span>{fee.label}</span>

                            {fee.isOverridden && (
                              <Tag className="quotation-override-tag">
                                Sửa từ{" "}
                                {formatCurrency(
                                  fee.originalAmount
                                )}
                              </Tag>
                            )}

                            {!fee.editable && (
                              <small>
                                Phí đóng thùng — hệ thống tính theo cỡ thùng, không sửa được
                              </small>
                            )}
                          </div>

                          {fee.editable ? (
                            <div className="quotation-item-fee-row__controls">
                              <Switch
                                size="small"
                                checked={fee.enabled}
                                disabled={sending}
                                checkedChildren="Tính phí"
                                unCheckedChildren="Miễn phí"
                                onChange={(checked) =>
                                  setItemFeeOverrides(
                                    (previous) => ({
                                      ...previous,
                                      [fee.key]: {
                                        amount: checked
                                          ? fee.amount
                                          : 0,
                                        enabled: checked,
                                      },
                                    })
                                  )
                                }
                              />

                              <InputNumber
                                value={fee.amount}
                                min={0}
                                step={1000}
                                disabled={
                                  sending || !fee.enabled
                                }
                                className="quotation-item-fee-input"
                                formatter={(value) =>
                                  `${value}`.replace(
                                    /\B(?=(\d{3})+(?!\d))/g,
                                    "."
                                  )
                                }
                                parser={(value) =>
                                  String(value ?? "").replace(
                                    /\./g,
                                    ""
                                  )
                                }
                                onChange={(value) =>
                                  setItemFeeOverrides(
                                    (previous) => ({
                                      ...previous,
                                      [fee.key]: {
                                        amount:
                                          normalizePositiveNumber(
                                            value
                                          ),
                                        enabled: true,
                                      },
                                    })
                                  )
                                }
                              />

                              {fee.isOverridden && (
                                <Button
                                  size="small"
                                  type="link"
                                  disabled={sending}
                                  onClick={() =>
                                    setItemFeeOverrides(
                                      (previous) => {
                                        const next = {
                                          ...previous,
                                        };
                                        delete next[fee.key];
                                        return next;
                                      }
                                    )
                                  }
                                >
                                  Trả về bảng giá
                                </Button>
                              )}
                            </div>
                          ) : (
                            <strong>
                              {formatCurrency(fee.amount)}
                            </strong>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}

                  {draftOrderFeeRows.length > 0 && (
                    <div className="quotation-item-fee-group">
                      <div className="quotation-item-fee-group__head">
                        <strong>Phụ phí cả đơn đã có</strong>

                        <strong>
                          {formatCurrency(draftOrderFeeTotal)}
                        </strong>
                      </div>

                      {draftOrderFeeRows.map((fee) => (
                        <div
                          key={fee.id || fee.code}
                          className="quotation-item-fee-row"
                        >
                          <div className="quotation-item-fee-row__label">
                            <span>{fee.label}</span>
                          </div>

                          <strong>
                            {formatCurrency(fee.amount)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            )}

            {/* ============ PHỤ PHÍ CẢ ĐƠN SALE THÊM ============ */}

            {orderFeeCandidates.length > 0 && (
              <article className="quotation-section-card">
                <div className="quotation-section-heading">
                  <div className="quotation-section-heading__icon">
                    <DollarOutlined />
                  </div>

                  <div>
                    <span>05</span>
                    <h2>
                      Phụ phí cả đơn (tuỳ chọn)
                    </h2>
                    <p>
                      Chỉ dùng cho khoản áp cho TOÀN ĐƠN, không gắn kiện nào. Bỏ
                      trống nếu không cần — phí nội địa, VAT và thuế nhập khẩu do
                      hệ thống tự thêm.
                    </p>
                  </div>
                </div>

                <div className="quotation-order-fee-list">
                  {orderFeeCandidates.map((row) => (
                    <div
                      key={row.id}
                      className="quotation-order-fee-row"
                    >
                      <Checkbox
                        checked={row.selected}
                        disabled={sending}
                        onChange={(event) =>
                          setOrderFeeSelections(
                            (previous) => {
                              const next = {
                                ...previous,
                              };

                              if (event.target.checked) {
                                next[row.id] = {
                                  amount:
                                    row.suggestedAmount,
                                  enabled: true,
                                };
                              } else {
                                delete next[row.id];
                              }

                              return next;
                            }
                          )
                        }
                      >
                        <span>{row.label}</span>
                      </Checkbox>

                      <div className="quotation-order-fee-row__controls">
                        <small>
                          Bảng giá:{" "}
                          {formatCurrency(
                            row.suggestedAmount
                          )}
                        </small>

                        <InputNumber
                          value={row.amount}
                          min={0}
                          step={1000}
                          disabled={
                            sending || !row.selected
                          }
                          className="quotation-item-fee-input"
                          onChange={(value) =>
                            setOrderFeeSelections(
                              (previous) => ({
                                ...previous,
                                [row.id]: {
                                  amount:
                                    normalizePositiveNumber(
                                      value
                                    ),
                                  enabled: true,
                                },
                              })
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )}

            <article className="quotation-section-card">
              <div className="quotation-section-heading">
                <div className="quotation-section-heading__icon">
                  <FileTextOutlined />
                </div>

                <div>
                  <span>06</span>
                  <h2>
                    Thông tin bổ sung
                  </h2>
                  <p>
                    Ghi chú gửi khách, lý do giá ngoại lệ và (nếu cần) số thuế chốt tay.
                  </p>
                </div>
              </div>

              <Form
                form={form}
                layout="vertical"
                requiredMark={false}
                autoComplete="off"
                className="quotation-create-form"
              >
                <div className="quotation-create-form__grid">
                  <div className="quotation-readonly-value">
                    <span>
                      Giá trị khai báo
                    </span>
                    <strong>
                      {formatCurrency(
                        declaredValue
                      )}
                    </strong>
                    <small>
                      Giá trị do khách hàng khai báo
                      trong đơn.
                    </small>
                  </div>

                  <Form.Item
                    name="salesNote"
                    label="Ghi chú gửi khách hàng"
                    className="quotation-create-form__full"
                  >
                    <Input.TextArea
                      rows={4}
                      maxLength={500}
                      showCount
                      placeholder="Nhập nội dung cần thông báo thêm cho khách hàng"
                      disabled={sending}
                    />
                  </Form.Item>

                  {/*
                    Lý do giá ngoại lệ: backend BẮT BUỘC có khi phát hiện khoản
                    nhập khác bảng giá (overrideReason hoặc salesNote), nếu không
                    sẽ trả 400 kèm danh sách khoản bị lệch.
                  */}
                  <Form.Item
                    name="overrideReason"
                    label={
                      hasOutOfPriceListEdit
                        ? "Lý do nhập giá khác bảng giá (bắt buộc)"
                        : "Lý do nhập giá khác bảng giá"
                    }
                    className="quotation-create-form__full"
                    validateStatus={
                      requiresOverrideReason
                        ? "error"
                        : undefined
                    }
                    help={
                      requiresOverrideReason
                        ? "Có khoản khác bảng giá — ghi lý do ở đây (hoặc trong ghi chú gửi khách) thì mới gửi được."
                        : "Chỉ cần điền khi bạn sửa phí dịch vụ của kiện, thêm phụ phí khác công thức, hoặc chốt tay thuế."
                    }
                  >
                    <Input.TextArea
                      rows={3}
                      maxLength={500}
                      showCount
                      placeholder="Ví dụ: giảm phí kiểm hàng cho khách quen theo duyệt của trưởng phòng"
                      disabled={sending}
                    />
                  </Form.Item>

                  <Form.Item
                    name="vatOverride"
                    label="VAT chốt tay (để trống = hệ thống tự tính)"
                  >
                    <InputNumber
                      min={0}
                      step={1000}
                      disabled={sending}
                      placeholder="Hệ thống tự tính"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="importTaxOverride"
                    label="Thuế nhập khẩu chốt tay (để trống = hệ thống tự tính)"
                  >
                    <InputNumber
                      min={0}
                      step={1000}
                      disabled={sending}
                      placeholder="Hệ thống tự tính"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </div>
              </Form>
            </article>
          </section>

          <aside className="quotation-create-summary">
            <div className="quotation-summary-header">
              <span>
                TỔNG HỢP BÁO GIÁ
              </span>

              <strong>
                {formatCurrency(
                  totalEstimatedCost
                )}
              </strong>

              <small>
                Số liệu ở đây là BẢN XEM TRƯỚC. Khi gửi, hệ thống tính lại toàn bộ
                theo bảng giá và cấu hình thuế — con số cuối cùng là của hệ thống.
              </small>
            </div>

            <div className="quotation-summary-metrics">
              <div>
                <span>
                  Trọng lượng thực
                </span>
                <strong>
                  {formatMeasurement(
                    totalWeightKg,
                    4
                  )}{" "}
                  kg
                </strong>
              </div>

              <div className="is-highlight">
                <span>
                  Khối lượng tính cước
                </span>
                <strong>
                  {formatMeasurement(
                    chargeableWeightKg,
                    4
                  )}{" "}
                  kg
                </strong>
              </div>
            </div>

            <div className="quotation-summary-lines">
              <div>
                <span>
                  Phí vận chuyển quốc tế
                </span>
                <strong>
                  {formatCurrency(
                    freightCharge
                  )}
                </strong>
              </div>

              {domesticShippingFee >
                0 && (
                  <div className="is-domestic-fee">
                    <span>
                      Phí vận chuyển nội địa
                    </span>
                    <strong>
                      {formatCurrency(
                        domesticShippingFee
                      )}
                    </strong>
                  </div>
                )}

              {packageConfigurationFee >
                0 && (
                  <div>
                    <span>
                      Phí cấu hình thùng theo kiện
                    </span>
                    <strong>
                      {formatCurrency(
                        packageConfigurationFee
                      )}
                    </strong>
                  </div>
                )}

              {woodCrateFee > 0 && (
                <div>
                  <span>
                    Phí đóng thùng gỗ (1 lần/đơn)
                  </span>
                  <strong>
                    {formatCurrency(
                      woodCrateFee
                    )}
                  </strong>
                </div>
              )}

              {packagingFeeTotal > 0 && (
                <div className="is-packaging-total">
                  <span>
                    Tổng phí đóng gói
                  </span>
                  <strong>
                    {formatCurrency(
                      packagingFeeTotal
                    )}
                  </strong>
                </div>
              )}

              {otherSurchargeTotal > 0 && (
                <div>
                  <span>
                    Phụ phí khác khách đã chọn
                  </span>
                  <strong>
                    {formatCurrency(
                      otherSurchargeTotal
                    )}
                  </strong>
                </div>
              )}

              <div>
                <span>Thành tiền trước thuế</span>
                <strong>
                  {formatCurrency(
                    subtotal
                  )}
                </strong>
              </div>

              {discountAmount > 0 && (
                <div className="is-discount">
                  <span>
                    Chiết khấu (
                    {discountPercent}%)
                  </span>
                  <strong>
                    -
                    {formatCurrency(
                      discountAmount
                    )}
                  </strong>
                </div>
              )}

              {taxAndDuty > 0 ? (
                <div className="is-tax-and-duty">
                  <span>
                    Thuế và phí nhập khẩu
                  </span>
                  <strong>
                    {formatCurrency(
                      taxAndDuty
                    )}
                  </strong>
                </div>
              ) : (
                <div className="is-tax-pending">
                  <span>
                    Thuế và phí nhập khẩu
                  </span>
                  <strong>
                    Được hệ thống xác định khi gửi báo giá
                  </strong>
                </div>
              )}
            </div>

            <div className="quotation-summary-total">
              <span>
                Tổng chi phí dự kiến
              </span>
              <strong>
                {formatCurrency(
                  totalEstimatedCost
                )}
              </strong>
            </div>

            <Button
              type="primary"
              size="large"
              icon={
                hasSentQuotation ? (
                  <CheckCircleOutlined />
                ) : requoteLocked ? (
                  <LockOutlined />
                ) : (
                  <SendOutlined />
                )
              }
              loading={sending}
              disabled={
                sending ||
                !canCreateQuotation ||
                hasSentQuotation
              }
              onClick={
                handleOpenConfirmation
              }
              block
              className={`quotation-confirm-button ${hasSentQuotation
                  ? "is-submitted"
                  : ""
                }`}
            >
              {hasSentQuotation
                ? "Đã gửi báo giá"
                : requoteLocked
                  ? "Không lập lại được báo giá"
                  : "Xem lại và gửi báo giá"}
            </Button>

            <div className="quotation-summary-note">
              <SafetyCertificateOutlined />

              <span>
                Hệ số quy đổi thể tích:{" "}
                {dimDivisor > 0
                  ? formatMeasurement(
                    dimDivisor,
                    0
                  )
                  : "Chưa có cấu hình"}
                .
              </span>
            </div>
          </aside>
        </div>
        </ConfigProvider>
      </div>

      <ConfirmConsignmentQuotation
        open={confirmationOpen}
        loading={sending}
        submitted={
          quotationSubmitted ||
          hasSentQuotation
        }
        data={confirmationData}
        onCancel={() => {
          if (!sending) {
            setConfirmationOpen(
              false
            );
          }
        }}
        onConfirm={
          handleConfirmQuotation
        }
        formatCurrency={
          formatCurrency
        }
        formatMeasurement={
          formatMeasurement
        }
        getUnitSuffix={
          getUnitSuffix
        }
      />
    </main>
  );
}
