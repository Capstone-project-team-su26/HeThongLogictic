# Quy tắc Folder Structure — VCL Warehouse Staff

## Tổng quan cấu trúc project

```
VCL-WAREHOUSE-Staff/
├── src/
│   ├── config/
│   │   └── api/
│   │       ├── axios.js                    ← Axios instance dùng chung
│   │       ├── <FeatureName>/              ← PascalCase (VD: WRO, Inventory, Shipping)
│   │       │   └── <featureName>ApiService.js   ← camelCase (VD: wroApiService.js)
│   │       └── <featureName>/              ← camelCase cho domain nhỏ (VD: shipping/)
│   │           └── <featureName>ApiService.js
│   ├── hook/
│   │   ├── sharedFoderSaunayfix/           ← Kho quốc tế (Quảng Châu, v.v.)
│   │   │   └── <featureName>/              ← camelCase (VD: wro/, storage/, inbound/)
│   │   │       ├── <featureName>Store.js   ← State management + business logic
│   │   │       ├── <featureName>Ui.js      ← Colors, status meta, format helpers
│   │   │       └── <FeatureName>Components.jsx  ← Shared UI components
│   │   └── sharedbenkhovietnam/            ← Kho Việt Nam
│   │       └── <featureName>/
│   │           ├── <featureName>Store.js
│   │           ├── <featureName>Ui.js
│   │           └── <FeatureName>Components.jsx
│   └── screen/
│       ├── KhoQT/                          ← Kho Quốc Tế
│       │   └── <FeatureName>/              ← PascalCase module (VD: WRO/, KienHang/)
│       │       └── <ScreenName>Screen/     ← PascalCase (VD: WarehouseReleaseDetailScreen/)
│       │           └── <ScreenName>Screen.jsx
│       └── KhoVN/                          ← Kho Việt Nam
│           └── <FeatureName>/
│               └── <ScreenName>Screen/
│                   └── <ScreenName>Screen.jsx
```

## Quy tắc đặt tên

### Folder
| Layer | Naming | Ví dụ |
|-------|--------|-------|
| API folder | PascalCase | `WRO/`, `Inventory/`, `KhoVN/` |
| Hook folder | camelCase | `wro/`, `storage/`, `inbound/` |
| Screen module | PascalCase | `WRO/`, `KienHang/`, `Ship/` |
| Screen folder | PascalCase + "Screen" suffix | `WarehouseReleaseDetailScreen/` |

### File
| File type | Pattern | Ví dụ |
|-----------|---------|-------|
| API service | `<feature>ApiService.js` | `wroApiService.js` |
| Store | `<feature>Store.js` | `wroStore.js` |
| UI helpers | `<feature>Ui.js` | `wroUi.js` |
| Components | `<Feature>Components.jsx` | `WroComponents.jsx` |
| Screen | `<ScreenName>Screen.jsx` | `WarehouseReleaseDetailScreen.jsx` |
| Mock data | `<feature>MockData.js` | `storageManagementMockData.js` |

## Ví dụ cụ thể — Tạo module "Inbound"

```
src/config/api/Inbound/
└── inboundApiService.js

src/hook/sharedFoderSaunayfix/inbound/
├── inboundStore.js
├── inboundUi.js
└── InboundComponents.jsx

src/screen/KhoQT/
└── Inbound/
    ├── InboundListScreen/
    │   └── InboundListScreen.jsx
    └── InboundDetailScreen/
        └── InboundDetailScreen.jsx
```

## Kho nào dùng shared folder nào?

| Kho | Shared Hook Folder |
|-----|-------------------|
| Kho Quốc Tế (KhoQT) | `src/hook/sharedFoderSaunayfix/` |
| Kho Việt Nam (KhoVN) | `src/hook/sharedbenkhovietnam/` |

## KHÔNG làm

- ❌ KHÔNG tạo file store trong folder screen
- ❌ KHÔNG mix API logic vào component JSX
- ❌ KHÔNG dùng tên tiếng Việt cho file (dùng folder screen thì OK: `KhoQT/`, `KhoVN/`)
- ❌ KHÔNG tạo file `index.js` barrel export (project không dùng)
