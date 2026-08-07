**Figure II-2 Vietnam Logistics Staff Web Package Diagram**

### Package Descriptions

| No | Package | Path | Description |
|----|---------|------|-------------|
| 01 | src | `src/` | Root package of the Vite + React staff web app (`AdminVietNamLogictic`). |
| 02 | routing | `src/routes` | App entry routing layer: `AppRoutes` and `PrivateRoute` role guard. |
| 03 | routes | `src/routes` | Registers screens and enforces auth/role before rendering pages. |
| 04 | presentation | `src/pages`, `src/components`, `src/layouts` | UI layer: role-based screens, reusable components, app shell. |
| 05 | pages | `src/pages` | UI screens organized by business role. |
| 06 | AdminPage | `src/pages/AdminPage` | Administration: users, warehouses, carriers, pricing, etc. |
| 07 | SalePage | `src/pages/SalePage` | Sales: consignments, customers, purchase requests, chat, history. |
| 08 | OperationsPage | `src/pages/OperationsPage` | Operations manager screens. |
| 09 | LoginPage | `src/pages/LoginPage` | Staff login screen. |
| 10 | components | `src/components` | Shared/feature UI (`SaleComponents`, `UserComponents`, `AddressComponents`). |
| 11 | layouts | `src/layouts` | App shell: `HeaderLayout`, `SidebarLayout`, `mainLayout`. |
| 12 | data access | `src/api` | Axios HTTP services (`*Service.js`) calling the backend API. |
| 13 | api | `src/api` | Domain API clients: Auth, AdminAPI, SaleAPI, OperationsAPI, AddressAPI, Upload. |
| 14 | infrastructure | `src/utils`, `src/assets` | Helpers and static assets shared across the app. |
| 15 | utils | `src/utils` | Cross-cutting helpers (`authSession`, loaders, time helpers). |
| 16 | assets | `src/assets` | Static images/logos used by the staff UI. |
