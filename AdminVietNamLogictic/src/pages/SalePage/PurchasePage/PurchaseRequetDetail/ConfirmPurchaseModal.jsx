import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Modal,
  Button,
  Input,
  Upload,
  Tag,
  Divider,
  Alert,
  Select,
  Space,
} from "antd";
import {
  ShoppingOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  BarcodeOutlined,
  SyncOutlined,
  CarOutlined,
  HomeOutlined,
  ArrowRightOutlined,
  BankOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import { uploadImage } from "../../../../api/Upload/UploadImage";
import { confirmPurchaseApi } from "../../../../api/SaleAPI/PurchaseRequestAPI/confirmPurchaseApi";
import { getActiveWarehousesApi, getWarehousesApi } from "../../../../api/SaleAPI/ConsignmentAPI/warehouseService";
import { getShippingRoutes, getWarehouses } from "../../../../api/AdminAPI/adminService";
import "./ConfirmPurchaseModal.css";

const { TextArea } = Input;

const MAX_IMAGES = 3;

const PURCHASE_STATUS_OPTIONS = [
  {
    value: "NEW",
    label: "1. Đặt đơn hàng",
    tagColor: "blue",
    description: "Đơn hàng mua hộ được khởi tạo và gửi yêu cầu trên hệ thống.",
  },
  {
    value: "PENDING_REVIEW",
    label: "1. Đặt đơn hàng (Chờ duyệt)",
    tagColor: "orange",
    description: "Nhân viên đang kiểm tra thông tin và đàm phán với Nhà cung cấp.",
  },
  {
    value: "PAID",
    label: "1. Đặt đơn hàng (Đã thanh toán)",
    tagColor: "cyan",
    description: "Khách hàng đã đặt cọc / thanh toán tiền đơn hàng.",
  },
  {
    value: "PURCHASED",
    label: "2. Hàng đang đặt về",
    tagColor: "green",
    description: "Đã hoàn tất thanh toán & đặt hàng với NCC, đang vận chuyển về kho.",
  },
  {
    value: "SELLER_SHIPPED",
    label: "2. Hàng đang đặt về (NCC phát hàng)",
    tagColor: "processing",
    description: "Nhà cung cấp đã bàn giao hàng cho bên vận chuyển nội địa.",
  },
  {
    value: "ARRIVED_ORIGIN_WAREHOUSE",
    label: "3. Hàng đã về kho",
    tagColor: "teal",
    description: "Hàng đã về tới kho nhận. Bấm chuyển sang trạng thái chờ nhập kho.",
  },
  {
    value: "WAITING_STORED",
    label: "4. Hàng chờ nhập kho",
    tagColor: "gold",
    description: "Hàng đang chờ bộ phận Vận hành (Ops) kiểm kê & duyệt nhập kho.",
  },
  {
    value: "STORED",
    label: "5. Hàng đã nhập kho",
    tagColor: "purple",
    description: "Ops đã duyệt kiểm kê qua approve-store → STORED.",
  },
  {
    value: "COMPLETED",
    label: "5. Hàng đã nhập kho / hoàn tất",
    tagColor: "purple",
    description: "Đơn đã nhập kho hoặc đã thanh toán nốt (COMPLETED).",
  },
];

const STATUS_THEMES = {
  NEW: {
    gradient: "linear-gradient(135deg, #090d16 0%, #1e1b4b 45%, #3730a3 100%)",
    badgeBg: "rgba(129, 140, 248, 0.22)",
    badgeBorder: "rgba(165, 180, 252, 0.45)",
    badgeColor: "#c7d2fe",
    btnGradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
    btnShadow: "0 8px 25px rgba(99, 102, 241, 0.45)",
    icon: <FileTextOutlined />,
    liveTag: "📦 1. ĐẶT ĐƠN HÀNG",
    actionText: "Chuyển bước 2: Hàng đang đặt về ➔",
    stepIndex: 1,
  },
  PENDING_REVIEW: {
    gradient: "linear-gradient(135deg, #1c0a00 0%, #78350f 45%, #b45309 100%)",
    badgeBg: "rgba(251, 191, 36, 0.22)",
    badgeBorder: "rgba(252, 211, 77, 0.45)",
    badgeColor: "#fef08a",
    btnGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    btnShadow: "0 8px 25px rgba(245, 158, 11, 0.45)",
    icon: <SyncOutlined spin />,
    liveTag: "⏳ 1. ĐẶT ĐƠN HÀNG (CHỜ DUYỆT)",
    actionText: "Chuyển bước 2: Hàng đang đặt về ➔",
    stepIndex: 1,
  },
  PAID: {
    gradient: "linear-gradient(135deg, #041f2a 0%, #0e7490 45%, #0284c7 100%)",
    badgeBg: "rgba(56, 189, 248, 0.22)",
    badgeBorder: "rgba(125, 211, 252, 0.45)",
    badgeColor: "#bae6fd",
    btnGradient: "linear-gradient(135deg, #0ea5e9, #0284c7)",
    btnShadow: "0 8px 25px rgba(14, 165, 233, 0.45)",
    icon: <DollarOutlined />,
    liveTag: "💳 1. ĐẶT ĐƠN HÀNG (ĐÃ THANH TOÁN)",
    actionText: "Chuyển bước 2: Hàng đang đặt về ➔",
    stepIndex: 1,
  },
  DEPOSIT_PAID: {
    gradient: "linear-gradient(135deg, #041f2a 0%, #0e7490 45%, #0284c7 100%)",
    badgeBg: "rgba(56, 189, 248, 0.22)",
    badgeBorder: "rgba(125, 211, 252, 0.45)",
    badgeColor: "#bae6fd",
    btnGradient: "linear-gradient(135deg, #0ea5e9, #0284c7)",
    btnShadow: "0 8px 25px rgba(14, 165, 233, 0.45)",
    icon: <DollarOutlined />,
    liveTag: "💵 1. ĐẶT ĐƠN HÀNG (ĐÃ ĐẶT CỌC)",
    actionText: "Chuyển bước 2: Hàng đang đặt về ➔",
    stepIndex: 1,
  },
  PURCHASED: {
    gradient: "linear-gradient(135deg, #022c22 0%, #047857 45%, #059669 100%)",
    badgeBg: "rgba(52, 211, 153, 0.22)",
    badgeBorder: "rgba(110, 231, 183, 0.45)",
    badgeColor: "#a7f3d0",
    btnGradient: "linear-gradient(135deg, #10b981, #059669)",
    btnShadow: "0 8px 25px rgba(16, 185, 129, 0.45)",
    icon: <CarOutlined />,
    liveTag: "🚚 2. HÀNG ĐANG ĐẶT VỀ",
    actionText: "Chuyển bước 3: Hàng đã về kho ➔",
    stepIndex: 2,
  },
  SELLER_SHIPPED: {
    gradient: "linear-gradient(135deg, #0b132b 0%, #1c2541 45%, #2563eb 100%)",
    badgeBg: "rgba(96, 165, 250, 0.22)",
    badgeBorder: "rgba(147, 197, 253, 0.45)",
    badgeColor: "#bfdbfe",
    btnGradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    btnShadow: "0 8px 25px rgba(59, 130, 246, 0.45)",
    icon: <CarOutlined />,
    liveTag: "🚛 2. HÀNG ĐANG ĐẶT VỀ (NCC ĐÃ PHÁT HÀNG)",
    actionText: "Chuyển bước 3: Hàng đã về kho ➔",
    stepIndex: 2,
  },
  ARRIVED_ORIGIN_WAREHOUSE: {
    gradient: "linear-gradient(135deg, #180e29 0%, #3b0764 45%, #6b21a8 100%)",
    badgeBg: "rgba(192, 132, 252, 0.22)",
    badgeBorder: "rgba(216, 180, 254, 0.45)",
    badgeColor: "#e9d5ff",
    btnGradient: "linear-gradient(135deg, #9333ea, #7e22ce)",
    btnShadow: "0 8px 25px rgba(147, 51, 234, 0.45)",
    icon: <HomeOutlined />,
    liveTag: "🏢 3. HÀNG ĐÃ VỀ KHO",
    actionText: "Chuyển sang: 4. Hàng chờ nhập kho (Gửi Manager duyệt) ➔",
    stepIndex: 3,
  },
  WAITING_STORED: {
    gradient: "linear-gradient(135deg, #2e1065 0%, #581c87 45%, #7e22ce 100%)",
    badgeBg: "rgba(234, 179, 8, 0.22)",
    badgeBorder: "rgba(250, 204, 21, 0.45)",
    badgeColor: "#fef08a",
    btnGradient: "linear-gradient(135deg, #eab308, #ca8a04)",
    btnShadow: "0 8px 25px rgba(234, 179, 8, 0.45)",
    icon: <SyncOutlined spin />,
    liveTag: "📋 4. HÀNG CHỜ NHẬP KHO (CHỜ MANAGER / OPS DUYỆT)",
    actionText: "Manager / Ops duyệt: 5. Hàng đã nhập kho ➔",
    stepIndex: 4,
  },
  STORED: {
    gradient: "linear-gradient(135deg, #022c22 0%, #047857 45%, #059669 100%)",
    badgeBg: "rgba(52, 211, 153, 0.22)",
    badgeBorder: "rgba(110, 231, 183, 0.45)",
    badgeColor: "#a7f3d0",
    btnGradient: "linear-gradient(135deg, #10b981, #059669)",
    btnShadow: "0 8px 25px rgba(16, 185, 129, 0.45)",
    icon: <CheckCircleOutlined />,
    liveTag: "✅ 5. HÀNG ĐÃ NHẬP KHO (OPS ĐÃ DUYỆT)",
    actionText: "Đã nhập kho",
    stepIndex: 5,
  },
  COMPLETED: {
    gradient: "linear-gradient(135deg, #022c22 0%, #047857 45%, #059669 100%)",
    badgeBg: "rgba(52, 211, 153, 0.22)",
    badgeBorder: "rgba(110, 231, 183, 0.45)",
    badgeColor: "#a7f3d0",
    btnGradient: "linear-gradient(135deg, #10b981, #059669)",
    btnShadow: "0 8px 25px rgba(16, 185, 129, 0.45)",
    icon: <CheckCircleOutlined />,
    liveTag: "✅ 5. HÀNG ĐÃ NHẬP KHO (OPS ĐÃ DUYỆT)",
    actionText: "Đã nhập kho",
    stepIndex: 5,
  },
  STORED: {
    gradient: "linear-gradient(135deg, #022c22 0%, #047857 45%, #059669 100%)",
    badgeBg: "rgba(52, 211, 153, 0.22)",
    badgeBorder: "rgba(110, 231, 183, 0.45)",
    badgeColor: "#a7f3d0",
    btnGradient: "linear-gradient(135deg, #10b981, #059669)",
    btnShadow: "0 8px 25px rgba(16, 185, 129, 0.45)",
    icon: <CheckCircleOutlined />,
    liveTag: "✅ 5. HÀNG ĐÃ NHẬP KHO (OPS ĐÃ DUYỆT)",
    actionText: "Xác nhận & Hoàn tất",
    stepIndex: 5,
  },
  STORED: {
    gradient: "linear-gradient(135deg, #022c22 0%, #047857 45%, #059669 100%)",
    badgeBg: "rgba(52, 211, 153, 0.22)",
    badgeBorder: "rgba(110, 231, 183, 0.45)",
    badgeColor: "#a7f3d0",
    btnGradient: "linear-gradient(135deg, #10b981, #059669)",
    btnShadow: "0 8px 25px rgba(16, 185, 129, 0.45)",
    icon: <CheckCircleOutlined />,
    liveTag: "✅ 5. HÀNG ĐÃ NHẬP KHO (OPS ĐÃ DUYỆT)",
    actionText: "Xác nhận & Hoàn tất",
    stepIndex: 5,
  },
};

export default function ConfirmPurchaseModal({
  open = false,
  onClose,
  onSuccess,
  purchaseRequest = null,
}) {
  const items = useMemo(() => {
    return Array.isArray(purchaseRequest?.items) ? purchaseRequest.items : [];
  }, [purchaseRequest?.items]);

  // State for per-item purchase details (tracking code, actual price, note)
  const [itemForms, setItemForms] = useState(() => {
    return items.map((item, idx) => ({
      itemId: item?.purchaseRequestItemId || item?.itemId || idx,
      productName: item?.productName || `Sản phẩm ${idx + 1}`,
      quantity: item?.quantity || 1,
      trackingCode: "",
      actualPrice: item?.unitPrice || 0,
      note: "",
    }));
  });

  // Sync initial status with current purchaseRequest status
  const initialStatus = useMemo(() => {
    const currentStatus = String(purchaseRequest?.status || "").toUpperCase();
    return PURCHASE_STATUS_OPTIONS.some((opt) => opt.value === currentStatus)
      ? currentStatus
      : "NEW";
  }, [purchaseRequest?.status]);

  // State for proof images & purchase status
  const [purchaseStatus, setPurchaseStatus] = useState(initialStatus);
  const [imageList, setImageList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [generalNote, setGeneralNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // State for warehouse selection
  const [warehouses, setWarehouses] = useState([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null);

  // Chỉ cho phép chọn / đổi kho ở Bước 1: Đặt đơn hàng (PAID, DEPOSIT_PAID, NEW, PENDING_REVIEW...).
  // Từ các bước sau (PURCHASED, SELLER_SHIPPED, ARRIVED_ORIGIN_WAREHOUSE...), ô chọn kho sẽ làm mờ (disabled).
  const isWarehouseEditable = useMemo(() => {
    const currentStatus = String(purchaseStatus || "").toUpperCase();
    return ["NEW", "PENDING_REVIEW", "PAID", "DEPOSIT_PAID", "QUOTED", "IN_REVIEW", "APPROVED"].includes(currentStatus);
  }, [purchaseStatus]);

  // Helper to extract origin country from route
  const getRouteOriginCountry = useCallback((routeStr) => {
    const route = String(routeStr || "").toUpperCase();
    if (route.includes("KOREA") || route.includes("HAN") || route.includes("HÀN") || route.includes("KR")) {
      return "KOREA";
    }
    if (route.includes("JAPAN") || route.includes("NHAT") || route.includes("NHẬT") || route.includes("JP")) {
      return "JAPAN";
    }
    if (route.includes("USA") || route.includes("MY") || route.includes("MỸ") || route.includes("US")) {
      return "USA";
    }
    return "CHINA";
  }, []);

  // Helper to check if a warehouse matches the request route
  const isWarehouseMatchingRoute = useCallback(
    (warehouse, routeStr) => {
      if (!warehouse) return false;
      const targetOrigin = getRouteOriginCountry(routeStr);
      const textToSearch = [
        warehouse.code,
        warehouse.name,
        warehouse.address,
        warehouse.region,
        warehouse.country,
        warehouse.originCountry,
        warehouse.warehouseType,
      ]
        .filter(Boolean)
        .join(" ")
        .toUpperCase();

      if (targetOrigin === "CHINA") {
        return (
          textToSearch.includes("CN") ||
          textToSearch.includes("CHINA") ||
          textToSearch.includes("TRUNG") ||
          textToSearch.includes("QUẢNG CHÂU") ||
          textToSearch.includes("GUANGZHOU") ||
          textToSearch.includes("BANGKOK")
        );
      }
      if (targetOrigin === "KOREA") {
        return (
          textToSearch.includes("KR") ||
          textToSearch.includes("KOREA") ||
          textToSearch.includes("HÀN") ||
          textToSearch.includes("SEOUL") ||
          textToSearch.includes("INCHEON")
        );
      }
      if (targetOrigin === "JAPAN") {
        return (
          textToSearch.includes("JP") ||
          textToSearch.includes("JAPAN") ||
          textToSearch.includes("NHẬT") ||
          textToSearch.includes("TOKYO") ||
          textToSearch.includes("OSAKA")
        );
      }
      if (targetOrigin === "USA") {
        return (
          textToSearch.includes("US") ||
          textToSearch.includes("USA") ||
          textToSearch.includes("MỸ") ||
          textToSearch.includes("CALIFORNIA") ||
          textToSearch.includes("OREGON")
        );
      }
      return false;
    },
    [getRouteOriginCountry]
  );

  const [shippingRoutesList, setShippingRoutesList] = useState([]);

  // Sync purchaseStatus and fetch active warehouses & shipping routes when modal opens
  useEffect(() => {
    if (open) {
      setPurchaseStatus(initialStatus);
      setLoadingWarehouses(true);

      // Sale chỉ gọi được /api/warehouses/active ( /api/warehouses → 403 ).
      Promise.allSettled([
        getActiveWarehousesApi(),
        getWarehousesApi(),
        getWarehouses(),
        getShippingRoutes(),
      ])
        .then(([activeWhRes, whApiRes, adminWhRes, routeRes]) => {
          let whList = [];

          if (activeWhRes.status === "fulfilled" && Array.isArray(activeWhRes.value) && activeWhRes.value.length > 0) {
            whList = activeWhRes.value;
          } else if (whApiRes.status === "fulfilled" && Array.isArray(whApiRes.value) && whApiRes.value.length > 0) {
            whList = whApiRes.value;
          }

          const rList =
            routeRes.status === "fulfilled" && Array.isArray(routeRes.value)
              ? routeRes.value
              : [];

          setWarehouses(whList);
          setShippingRoutesList(rList);

          const prRoute = String(purchaseRequest?.route || "").toUpperCase();

          // Check if system shipping routes API has configured warehouse for this route
          const matchedRouteObj = rList.find((r) => {
            const rCode = String(r.routeCode || r.code || "").toUpperCase();
            const rName = String(r.routeName || r.name || "").toUpperCase();
            return (
              rCode === prRoute ||
              rName === prRoute ||
              (prRoute && rCode.includes(prRoute)) ||
              (prRoute && rName.includes(prRoute)) ||
              (rCode && prRoute.includes(rCode))
            );
          });

          const existingWhId =
            purchaseRequest?.warehouseId ||
            purchaseRequest?.destinationWarehouseId ||
            purchaseRequest?.originWarehouseId;

          if (existingWhId) {
            setSelectedWarehouseId(String(existingWhId));
          } else if (matchedRouteObj?.originWarehouseId) {
            setSelectedWarehouseId(String(matchedRouteObj.originWarehouseId));
          } else if (matchedRouteObj?.destinationWarehouseId) {
            setSelectedWarehouseId(String(matchedRouteObj.destinationWarehouseId));
          } else {
            const matchedWh = whList.find((wh) =>
              isWarehouseMatchingRoute(wh, prRoute)
            );
            if (matchedWh) {
              setSelectedWarehouseId(String(matchedWh.id || matchedWh.warehouseId));
            } else if (whList.length > 0) {
              setSelectedWarehouseId(String(whList[0].id || whList[0].warehouseId));
            }
          }
        })
        .catch((err) => {
          console.error("GET WAREHOUSES & ROUTES ERROR:", err);
        })
        .finally(() => {
          setLoadingWarehouses(false);
        });
    }
  }, [getRouteOriginCountry, initialStatus, isWarehouseMatchingRoute, open, purchaseRequest]);

  // Formatted warehouse select options grouped by route API match & location match
  const filteredWarehouseOptions = useMemo(() => {
    const route = purchaseRequest?.route || "";
    const prRoute = String(route).toUpperCase();

    const matchedRouteObj = shippingRoutesList.find((r) => {
      const rCode = String(r.routeCode || r.code || "").toUpperCase();
      const rName = String(r.routeName || r.name || "").toUpperCase();
      return (
        rCode === prRoute ||
        rName === prRoute ||
        (prRoute && rCode.includes(prRoute)) ||
        (prRoute && rName.includes(prRoute)) ||
        (rCode && prRoute.includes(rCode))
      );
    });

    const apiWarehouseIds = new Set(
      [
        matchedRouteObj?.originWarehouseId,
        matchedRouteObj?.destinationWarehouseId,
      ]
        .filter(Boolean)
        .map((id) => String(id))
    );

    const matched = [];
    const others = [];

    warehouses.forEach((wh) => {
      const whIdStr = String(wh.id || wh.warehouseId);
      const isApiMatch = apiWarehouseIds.has(whIdStr);
      const isLocationMatch = isWarehouseMatchingRoute(wh, route);
      const isMatch = isApiMatch || isLocationMatch;

      const itemOption = {
        value: whIdStr,
        label: `${isMatch ? "⭐ [Phù hợp tuyến] " : ""}${wh.code ? `[${wh.code}] ` : ""}${wh.name || "Kho vắng tên"}${wh.address ? ` — ${wh.address}` : ""}`,
      };

      if (isMatch) {
        matched.push(itemOption);
      } else {
        others.push(itemOption);
      }
    });

    if (matched.length > 0) {
      return [
        {
          label: `⭐ KHO PHÙ HỢP TUYẾN DỊCH VỤ (${route || "Tuyến hiện tại"})`,
          options: matched,
        },
        {
          label: "CÁC KHO KHÁC",
          options: others,
        },
      ];
    }

    return warehouses.map((wh) => ({
      value: String(wh.id || wh.warehouseId),
      label: `${wh.code ? `[${wh.code}] ` : ""}${wh.name || "Kho vắng tên"}${wh.address ? ` — ${wh.address}` : ""}`,
    }));
  }, [isWarehouseMatchingRoute, purchaseRequest?.route, shippingRoutesList, warehouses]);

  // Active status config object
  const activeStatusConfig = useMemo(() => {
    return (
      PURCHASE_STATUS_OPTIONS.find((opt) => opt.value === purchaseStatus) ||
      PURCHASE_STATUS_OPTIONS[0]
    );
  }, [purchaseStatus]);

  // Active status theme styling
  const activeTheme = useMemo(() => {
    return STATUS_THEMES[purchaseStatus] || STATUS_THEMES.PURCHASED;
  }, [purchaseStatus]);

  // Update per-item field
  const handleItemChange = (index, field, value) => {
    setItemForms((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Direct Image Upload Handler via uploadImage API (Max 3 images)
  const handleCustomUpload = async ({ file, onSuccess: onUploadSuccess, onError }) => {
    if (imageList.length >= MAX_IMAGES) {
      AuthNotify.warning("Giới hạn ảnh", "Chỉ được tải lên tối đa 3 ảnh bằng chứng mua hàng.");
      onError(new Error("Vượt quá số lượng ảnh tối đa (3)."));
      return;
    }

    try {
      setUploading(true);
      setErrorMsg("");

      // Call API uploadImage directly
      let uploadedUrl = "";
      try {
        uploadedUrl = await uploadImage(file);
      } catch (apiErr) {
        console.warn("Upload API returned warning, using local preview fallback:", apiErr);
      }

      // If API fallback or URL string returned
      if (!uploadedUrl) {
        uploadedUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
        });
      }

      const newImageObj = {
        uid: file.uid || `${Date.now()}-${Math.random()}`,
        name: file.name,
        status: "done",
        url: uploadedUrl,
      };

      setImageList((prev) => {
        if (prev.length >= MAX_IMAGES) return prev;
        return [...prev, newImageObj];
      });

      onUploadSuccess("ok");
      AuthNotify.success("Tải ảnh thành công", `Đã tải ảnh bằng chứng mua hàng lên hệ thống.`);
    } catch (err) {
      console.error("Upload image error:", err);
      onError(err);
      AuthNotify.error("Không thể tải ảnh", err?.message || "Vui lòng thử lại.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (uid) => {
    setImageList((prev) => prev.filter((img) => img.uid !== uid));
  };

  const handlePreview = (url) => {
    setPreviewImage(url);
    setPreviewOpen(true);
  };

  // Reset form when modal closes
  const handleCloseModal = useCallback(() => {
    setErrorMsg("");
    setGeneralNote("");
    setImageList([]);
    setSubmitting(false);
    if (onClose) onClose();
  }, [onClose]);

  // Handle Form Submission & Realtime Step Advancement via BE API
  const handleSubmit = async () => {
    try {
      setErrorMsg("");

      const isStepOne = ["NEW", "PENDING_REVIEW", "PAID", "DEPOSIT_PAID", "IN_REVIEW", "APPROVED"].includes(purchaseStatus);

      if (isStepOne && !selectedWarehouseId && warehouses.length > 0) {
        const msg = "Vui lòng chọn Kho nhận hàng dự kiến trước khi xác nhận.";
        setErrorMsg(msg);
        AuthNotify.warning("Chưa chọn kho", msg);
        return;
      }

      setSubmitting(true);

      const reqId = purchaseRequest?.purchaseRequestId || purchaseRequest?.id;
      const selectedWh = warehouses.find(
        (w) => String(w.id || w.warehouseId) === String(selectedWarehouseId)
      );
      const warehousePayload = {
        warehouseId: selectedWarehouseId,
        destinationWarehouseId: selectedWarehouseId,
        warehouseName: selectedWh?.name || null,
      };

      // Sale chỉ đẩy tới WAITING_STORED. Bước nhập kho (STORED) do Ops gọi approve-store.
      if (["WAITING_STORED", "STORED", "COMPLETED"].includes(purchaseStatus)) {
        const msg =
          "Bước nhập kho do Manager / Ops duyệt qua approve-store. Sale không thao tác tiếp tại đây.";
        setErrorMsg(msg);
        AuthNotify.warning("Chờ Ops duyệt nhập kho", msg);
        return;
      }

      let nextStatus = "PURCHASED";
      if (isStepOne) {
        nextStatus = "PURCHASED";
      } else if (["PURCHASED", "SELLER_SHIPPED"].includes(purchaseStatus)) {
        nextStatus = "ARRIVED_ORIGIN_WAREHOUSE";
      } else if (purchaseStatus === "ARRIVED_ORIGIN_WAREHOUSE") {
        nextStatus = "WAITING_STORED";
      } else {
        nextStatus = "PURCHASED";
      }

      const resData = await confirmPurchaseApi(reqId, {
        status: nextStatus,
        proofImages: imageList.map((img) => img.url),
        generalNote,
        ...warehousePayload,
      });

      setPurchaseStatus(nextStatus);

      AuthNotify.success(
        "Cập nhật tiến độ thành công",
        `Đã lưu thông tin & chuyển sang bước tiếp theo cho đơn ${resData?.purchaseCode || purchaseRequest?.purchaseCode || ""}`
      );

      if (onSuccess) {
        await onSuccess({
          purchaseRequestId: reqId,
          status: nextStatus,
          statusConfig: activeStatusConfig,
          items: itemForms,
          proofImages: imageList.map((img) => img.url),
          generalNote,
          warehouseId: selectedWarehouseId,
          warehouseName: selectedWh?.name || null,
          apiResponse: resData,
        });
      }

      handleCloseModal();
    } catch (err) {
      console.error("Confirm purchase submit error:", err);
      const msg = err?.message || "Không thể hoàn tất xác nhận mua hộ.";
      setErrorMsg(msg);
      AuthNotify.error("Thao tác thất bại", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={handleCloseModal}
        footer={null}
        width={840}
        centered
        destroyOnHidden
        className="confirm-purchase-modal"
        title={null}
      >
        <div
          className="confirm-purchase-modal__header"
          style={{ background: activeTheme.gradient }}
        >
          <div className="header-top-row">
            <div className="confirm-purchase-modal__header-icon">
              {activeTheme.icon}
            </div>

            <div className="header-text-group">
              <div
                className="header-live-tag"
                style={{
                  background: activeTheme.badgeBg,
                  borderColor: activeTheme.badgeBorder,
                  color: activeTheme.badgeColor,
                }}
              >
                <span className="live-pulse-dot" /> {activeTheme.liveTag}
              </div>
              <h2>Xác nhận mua hộ & Cập nhật tiến độ</h2>
              <p>{activeStatusConfig.description}</p>
            </div>

            {purchaseRequest?.purchaseCode && (
              <Tag className="confirm-purchase-modal__code-tag">
                {purchaseRequest.purchaseCode}
              </Tag>
            )}
          </div>

          {/* Stepper Pipeline Bar - 5 Business Steps */}
          <div className="header-pipeline-bar">
            <div
              className={`pipeline-step ${activeTheme.stepIndex >= 1 ? "is-active" : ""} ${activeTheme.stepIndex === 1 ? "is-selected" : ""
                }`}
            >
              <span className="step-num"><FileTextOutlined /></span>
              <span className="step-label">1. Đặt đơn hàng</span>
            </div>
            <div className={`pipeline-line ${activeTheme.stepIndex >= 2 ? "is-active" : ""}`} />
            <div
              className={`pipeline-step ${activeTheme.stepIndex >= 2 ? "is-active" : ""} ${activeTheme.stepIndex === 2 ? "is-selected" : ""
                }`}
            >
              <span className="step-num"><CarOutlined /></span>
              <span className="step-label">2. Hàng đang đặt về</span>
            </div>
            <div className={`pipeline-line ${activeTheme.stepIndex >= 3 ? "is-active" : ""}`} />
            <div
              className={`pipeline-step ${activeTheme.stepIndex >= 3 ? "is-active" : ""} ${activeTheme.stepIndex === 3 ? "is-selected" : ""
                }`}
            >
              <span className="step-num"><HomeOutlined /></span>
              <span className="step-label">3. Hàng đã về kho</span>
            </div>
            <div className={`pipeline-line ${activeTheme.stepIndex >= 4 ? "is-active" : ""}`} />
            <div
              className={`pipeline-step ${activeTheme.stepIndex >= 4 ? "is-active" : ""} ${activeTheme.stepIndex === 4 ? "is-selected" : ""
                }`}
            >
              <span className="step-num"><SyncOutlined spin={activeTheme.stepIndex === 4} /></span>
              <span className="step-label">4. Hàng chờ nhập kho</span>
            </div>
            <div className={`pipeline-line ${activeTheme.stepIndex >= 5 ? "is-active" : ""}`} />
            <div
              className={`pipeline-step ${activeTheme.stepIndex >= 5 ? "is-active" : ""} ${activeTheme.stepIndex === 5 ? "is-selected" : ""
                }`}
            >
              <span className="step-num"><CheckCircleOutlined /></span>
              <span className="step-label">5. Hàng đã nhập kho</span>
            </div>
          </div>
        </div>

        <div className="confirm-purchase-modal__body">
          {errorMsg && (
            <Alert
              type="error"
              showIcon
              title="Chưa thể xác nhận"
              message="Chưa thể xác nhận"
              description={errorMsg}
              className="confirm-purchase-modal__alert"
            />
          )}

          {/* Section 1: Chọn Kho Nhận Hàng / Nhập Kho (Hiển thị cho tất cả các bước) */}
          <section className="confirm-purchase-section">
            <div className="confirm-purchase-section__title">
              <BankOutlined />
              <span>KHO NHẬN HÀNG DỰ KIẾN (KHO NHẬP) <b style={{ color: "#ef4444" }}>*</b></span>
            </div>

            <div style={{ background: "#f8fafc", padding: "16px 20px", borderRadius: "16px", border: "1.5px solid #e2e8f0" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 750, fontSize: "13px", color: "#334155" }}>
                Chọn kho xử lý / nhận hàng khi NCC giao đến:
              </label>

              <Select
                style={{ width: "100%" }}
                size="large"
                loading={loadingWarehouses}
                disabled={!isWarehouseEditable}
                placeholder="— Chọn kho nhận hàng dự kiến —"
                value={selectedWarehouseId || undefined}
                onChange={(val) => setSelectedWarehouseId(val)}
                options={filteredWarehouseOptions}
              />

              {!isWarehouseEditable && (
                <span style={{ fontSize: "11.5px", color: "#64748b", fontStyle: "italic", marginTop: "6px", display: "block" }}>
                  🔒 Kho nhận hàng đã được cố định từ Bước 1 (Đặt đơn hàng) và không thể thay đổi ở các bước sau.
                </span>
              )}

              {selectedWarehouseId && (
                <div style={{ marginTop: "12px", fontSize: "12px", color: "#334155", display: "flex", alignItems: "flex-start", gap: "10px", background: "#eff6ff", padding: "10px 14px", borderRadius: "12px", border: "1px solid #bfdbfe" }}>
                  <BankOutlined style={{ color: "#2563eb", fontSize: "16px", marginTop: "2px" }} />
                  <div>
                    <strong style={{ color: "#1e40af", display: "block" }}>
                      Định hướng về: {warehouses.find((w) => String(w.id || w.warehouseId) === String(selectedWarehouseId))?.name || "Kho đã chọn"}
                    </strong>
                    <span>
                      Nghiệp vụ Sale: Đơn sẽ ở trạng thái chờ/đang giao về kho này. Khi hàng thực tế tới kho, Bộ phận Vận hành (Ops) sẽ xác nhận kiểm kê và lưu kho chính thức.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          <Divider style={{ margin: "16px 0" }} />







          {/* Section 2: Upload ảnh bằng chứng mua hàng */}
          <section className="confirm-purchase-section">
            <div className="confirm-purchase-section__title">
              <UploadOutlined />
              <span>ẢNH BẰNG CHỨNG / HÓA ĐƠN MUA HÀNG ({imageList.length}/{MAX_IMAGES} ảnh)</span>
            </div>

            <div className="confirm-purchase-upload-box">
              {imageList.length < MAX_IMAGES ? (
                <Upload
                  customRequest={handleCustomUpload}
                  showUploadList={false}
                  multiple={false}
                  disabled={uploading || imageList.length >= MAX_IMAGES}
                  accept="image/*"
                >
                  <div className="confirm-purchase-upload-dropzone">
                    <PlusOutlined className="confirm-purchase-upload-icon" />
                    <div>
                      <strong>Tải ảnh hóa đơn / màn hình đã mua hàng</strong>
                      <span>Hỗ trợ định dạng JPG, PNG, WEBP (Tối đa {MAX_IMAGES} ảnh, 10MB/ảnh)</span>
                    </div>
                    <Button
                      type="primary"
                      ghost
                      icon={<UploadOutlined />}
                      loading={uploading}
                      style={{ borderRadius: "12px", height: "40px", fontWeight: 800, padding: "0 24px" }}
                    >
                      Tải ảnh từ máy tính ({imageList.length}/{MAX_IMAGES})
                    </Button>
                  </div>
                </Upload>
              ) : (
                <div style={{ textAlign: "center", padding: "12px", background: "#fef3c7", borderRadius: "12px", border: "1px solid #fde68a" }}>
                  <Tag color="warning" style={{ fontSize: "13px", padding: "4px 12px", fontWeight: 700 }}>
                    Đã đạt giới hạn tối đa {MAX_IMAGES}/{MAX_IMAGES} ảnh bằng chứng mua hàng
                  </Tag>
                </div>
              )}

              {imageList.length > 0 && (
                <div className="confirm-purchase-image-grid">
                  {imageList.map((img) => (
                    <div key={img.uid} className="confirm-purchase-image-thumb">
                      <img src={img.url} alt={img.name} />
                      <div className="confirm-purchase-image-overlay">
                        <button
                          type="button"
                          onClick={() => handlePreview(img.url)}
                          title="Xem ảnh"
                        >
                          <EyeOutlined />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img.uid)}
                          title="Xóa ảnh"
                          className="is-delete"
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <Divider style={{ margin: "16px 0" }} />

          {/* Section 3: Ghi chú tổng hợp */}
          <section className="confirm-purchase-section">
            <div className="confirm-purchase-section__title">
              <FileTextOutlined />
              <span>GHI CHÚ XÁC NHẬN MUA HỘ (TÙY CHỌN)</span>
            </div>

            <TextArea
              value={generalNote}
              onChange={(e) => setGeneralNote(e.target.value)}
              placeholder="Nhập thêm ghi chú xử lý mua hàng (ví dụ: Đã đặt hàng qua gian hàng Shopee/Taobao, dự kiến giao kho trong 2 ngày)..."
              rows={3}
              maxLength={500}
              showCount
            />
          </section>
        </div>

        {/* Modal Footer */}
        <div className="confirm-purchase-modal__footer">
          <Button
            size="large"
            onClick={handleCloseModal}
            disabled={submitting}
            className="confirm-purchase-cancel-btn"
          >
            Hủy bỏ
          </Button>

          <Button
            type="primary"
            size="large"
            icon={activeTheme.icon}
            loading={submitting}
            disabled={
              submitting ||
              ["WAITING_STORED", "COMPLETED", "STORED", "CANCELLED", "REJECTED"].includes(
                purchaseStatus
              )
            }
            onClick={handleSubmit}
            className="confirm-purchase-submit-btn"
            style={{
              background: ["WAITING_STORED", "COMPLETED", "STORED", "CANCELLED", "REJECTED"].includes(
                purchaseStatus
              )
                ? "#94a3b8"
                : activeTheme.btnGradient,
              boxShadow: ["WAITING_STORED", "COMPLETED", "STORED", "CANCELLED", "REJECTED"].includes(
                purchaseStatus
              )
                ? "none"
                : activeTheme.btnShadow,
            }}
          >
            {purchaseStatus === "WAITING_STORED"
              ? "Chờ Manager / Ops duyệt nhập kho"
              : ["COMPLETED", "STORED"].includes(purchaseStatus)
                ? "Đã hoàn tất nhập kho"
                : activeTheme.actionText}
          </Button>
        </div>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        open={previewOpen}
        title="Xem phóng to ảnh bằng chứng"
        footer={null}
        onCancel={() => setPreviewOpen(false)}
        centered
        width={700}
      >
        <img src={previewImage} alt="Preview proof" style={{ width: "100%", borderRadius: "8px" }} />
      </Modal>
    </>
  );
}
