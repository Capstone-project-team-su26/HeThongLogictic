---
name: cursor-rules-lookup
description: >
  Tra cứu và áp dụng các best practice coding rules từ awesome-cursorrules.
  Trigger khi: hỏi về best practice cho một tech stack, cần coding convention,
  cần rule cụ thể cho React Native / Expo / TypeScript / JavaScript.
---

# Cursor Rules Lookup Skill

Kho rules nằm tại: `.agents/awesome-cursorrules/rules/`

## Rules quan trọng nhất cho project VCL

| File | Khi nào dùng |
|------|-------------|
| `react-native-expo-cursorrules-prompt-file.mdc` | React Native / Expo best practices |
| `clean-code.mdc` | Code quality, naming, structure |
| `git-conventional-commit-messages.mdc` | Commit message format |
| `javascript-typescript-code-quality-cursorrules-pro.mdc` | JS/TS quality |
| `typescript-expo-jest-detox-cursorrules-prompt-file.mdc` | TypeScript + Expo |
| `anti-sycophancy-code-discipline-cursorrules-prompt-file.mdc` | Code discipline |

## Cách tra cứu

Khi cần rule cụ thể, đọc file `.mdc` tương ứng bằng view_file tool.

Ví dụ tìm rule liên quan đến "git":
```
ls .agents/awesome-cursorrules/rules/ | grep git
```

## Cập nhật rules

```bash
cd .agents/awesome-cursorrules
git pull
```
