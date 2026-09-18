import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "tools"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      /*
       * Hai luật React Compiler mới của eslint-plugin-react-hooks v7 được hạ xuống "warn":
       * - set-state-in-effect: mọi màn của app tải dữ liệu theo mẫu
       *   `useEffect(() => { load(); }, [load])` (load bật spinner rồi gọi API). Đây là mẫu
       *   tải dữ liệu chuẩn của dự án, không phải lỗi đúng/sai; viết lại hàng chục màn chỉ để
       *   chiều luật này là rủi ro lớn hơn lợi ích.
       * - preserve-manual-memoization: chỉ báo useMemo/useCallback thủ công không tối ưu được
       *   bằng compiler — ảnh hưởng hiệu năng, không ảnh hưởng hành vi.
       * Vẫn hiện cảnh báo để ai sửa màn nào thì dọn luôn màn đó.
       */
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
]);
