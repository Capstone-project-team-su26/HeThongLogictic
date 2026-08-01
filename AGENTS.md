# HeThongLogictic — Agent guide

Repo **FE nội bộ cũ** (Vite). App code: **`AdminVietNamLogictic/`**.

Khung FE **mới**: [`vcl-forntend`](https://github.com/Capstone-project-team-su26/vcl-forntend).

Rules/skills nằm trong **`.cursor/`** — commit cùng repo để mọi máy clone đều dùng được.

## Rules (luôn / theo ngữ cảnh)

| Rule | Mục đích |
|------|----------|
| `project-context` | Repo này vs vcl-forntend |
| `use-bun` | Agent dùng Bun; giữ npm lock cho đồng đội |
| `legacy-vite-fe` | Sửa code Vite trong `AdminVietNamLogictic/` |
| `fe-architecture` | Kiến trúc target Next.js |
| `legacy-fe-map` | Map route/code cũ → mới |
| `auth-roles` / `module-facade` / `pages-colocation` | Chi tiết target |
| `ponytail` | Diff nhỏ, reuse trước |
| `vcl-dev-links` | URL môi trường (không password) |

## Skills

| Skill | Khi nào |
|-------|---------|
| `legacy-vite-fix` | Sửa FE Vite hiện tại |
| `migrate-legacy-page` | Port màn sang vcl-forntend |
| `add-feature` | Feature mới trên khung Next |
| `wire-module-mock-api` | Scaffold module mock/API trên target |

## Lệnh — Bun (mặc định agent)

Từ **root** repo:

```bash
bun run install:app
bun run dev
```

Hoặc trong app:

```bash
cd AdminVietNamLogictic
bun install
bun run dev
```

## Lệnh — npm (đồng đội vẫn dùng được)

```bash
cd AdminVietNamLogictic
npm install
npm run dev
```

Giữ cả `bun.lock` và `package-lock.json`. **Không** xóa lockfile npm.