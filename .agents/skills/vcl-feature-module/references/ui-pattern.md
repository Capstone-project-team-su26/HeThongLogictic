# Pattern viết UI Helpers & Components — VCL Warehouse Staff

## File locations

```
src/hook/<sharedFolder>/<featureName>/
├── <featureName>Ui.js           ← Colors, status meta, format functions
└── <FeatureName>Components.jsx  ← Shared UI components (React Native)
```

---

## 1. UI Helpers file — `<featureName>Ui.js`

### Template chuẩn

```js
import { formatUtcToDeviceTime, getDeviceTimeInfo } from "../../../utils/UTCTime/DeviceTimeService";
import { FEATURE_STATUS } from "./<featureName>Store";

// ─── COLORS ──────────────────────────────────────────────────────────────────
export const FEATURE_COLORS = Object.freeze({
  background: "#F3F6FB",
  surface: "#FFFFFF",
  surfaceSoft: "#F8FAFD",
  primary: "#0D55D9",
  primaryDark: "#063EAD",
  primarySoft: "#EAF2FF",
  text: "#0A1633",
  textSoft: "#5F6F89",
  textMuted: "#94A3B8",
  border: "#DCE5F0",
  green: "#169447",
  greenSoft: "#E9F8ED",
  orange: "#E78708",
  orangeSoft: "#FFF3D9",
  purple: "#6D5BE7",
  purpleSoft: "#F0EDFF",
  red: "#DC3545",
  redSoft: "#FFF0F2",
  white: "#FFFFFF",
});

// ─── STATUS META ─────────────────────────────────────────────────────────────
// Map mỗi status → { label, color, background, icon }
export const FEATURE_STATUS_META = Object.freeze({
  [FEATURE_STATUS.PENDING]: {
    label: "Chờ xử lý",
    color: FEATURE_COLORS.orange,
    background: FEATURE_COLORS.orangeSoft,
    icon: "clock-outline",
  },
  [FEATURE_STATUS.ACTIVE]: {
    label: "Đang xử lý",
    color: FEATURE_COLORS.primary,
    background: FEATURE_COLORS.primarySoft,
    icon: "progress-clock",
  },
  [FEATURE_STATUS.COMPLETED]: {
    label: "Hoàn thành",
    color: FEATURE_COLORS.green,
    background: FEATURE_COLORS.greenSoft,
    icon: "check-circle-outline",
  },
});

const DEFAULT_STATUS_META = Object.freeze({
  label: "Chờ xử lý",
  color: FEATURE_COLORS.orange,
  background: FEATURE_COLORS.orangeSoft,
  icon: "clock-outline",
});

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

// Lấy metadata của status (không bao giờ return null)
export const getFeatureStatus = (status) => {
  const key = String(status || "").trim().toUpperCase();
  return FEATURE_STATUS_META[key] || DEFAULT_STATUS_META;
};

// Format số theo locale Việt Nam
export const formatFeatureNumber = (value, maximumFractionDigits = 2) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits }).format(
    Number(value) || 0
  );

// Format UTC timestamp → hiển thị theo timezone thiết bị
export const formatFeatureDate = (value, options = {}) => {
  if (!value) return "Chưa cập nhật";
  try {
    return formatUtcToDeviceTime(value, {
      locale: "vi-VN",
      formatOptions: options.dateOnly
        ? { day: "2-digit", month: "2-digit", year: "numeric" }
        : {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          },
    });
  } catch {
    return String(value);
  }
};

// Caption timezone cho UI
export const getFeatureTimeCaption = () => {
  const deviceInfo = getDeviceTimeInfo();
  return `${deviceInfo.timeZone} · ${deviceInfo.utcOffset}`;
};

// Normalize chuỗi tìm kiếm (bỏ dấu, lowercase)
export const normalizeFeatureSearch = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase();
```

### Quy tắc

1. **COLORS** phải dùng `Object.freeze({})` với bảng màu chuẩn của project (copy từ wroUi.js)
2. **STATUS_META** map từng status key → `{ label, color, background, icon }`
3. `icon` dùng tên icon của **react-native-vector-icons/MaterialCommunityIcons**
4. **getFeatureStatus()** KHÔNG bao giờ return undefined — luôn có DEFAULT fallback
5. **formatFeatureDate()** dùng `formatUtcToDeviceTime` — KHÔNG dùng `new Date().toLocaleString()`
6. Tên label tiếng Việt, có dấu

---

## 2. Components file — `<FeatureName>Components.jsx`

### Quy tắc components

```jsx
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { FEATURE_COLORS, getFeatureStatus, formatFeatureDate } from "./featureUi";

// ─── COMPONENT: StatusBadge ───────────────────────────────────────────────────
export function FeatureStatusBadge({ status, style }) {
  const meta = getFeatureStatus(status);
  return (
    <View style={[styles.badge, { backgroundColor: meta.background }, style]}>
      <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

// ─── COMPONENT: Card ─────────────────────────────────────────────────────────
export function FeatureCard({ item, onPress, style }) {
  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={() => onPress?.(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardCode}>{item.code}</Text>
        <FeatureStatusBadge status={item.status} />
      </View>
      <Text style={styles.cardDate}>{formatFeatureDate(item.createdAt)}</Text>
    </TouchableOpacity>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    backgroundColor: FEATURE_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: FEATURE_COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardCode: {
    fontSize: 15,
    fontWeight: "700",
    color: FEATURE_COLORS.text,
  },
  cardDate: {
    fontSize: 12,
    color: FEATURE_COLORS.textMuted,
  },
});
```

### Quy tắc Components

1. **KHÔNG** dùng inline styles — luôn dùng `StyleSheet.create({})`
2. **Props optional** — dùng `onPress?.(item)` thay vì kiểm tra if
3. **Không** fetch data trong component — data phải được truyền qua props từ store
4. Import màu từ `featureUi.js`, KHÔNG hardcode hex trong component
5. Mỗi component export **named export** (không default export cho component)
6. `activeOpacity={0.7}` cho tất cả `TouchableOpacity`

---

## Ví dụ thực tế

- `src/hook/sharedFoderSaunayfix/wro/wroUi.js` — WRO UI helpers
- `src/hook/sharedFoderSaunayfix/wro/WroComponents.jsx` — WRO components
