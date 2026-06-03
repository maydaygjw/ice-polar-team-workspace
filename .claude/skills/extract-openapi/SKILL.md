---
name: extract-openapi
description: |
  将 workspace 各子项目内部已生成的 OpenAPI JSON 收集到 governance/CONTRACT/ 目录。

  使用场景：
  - 同步 API 文档到 governance/CONTRACT/
  - 提取 / 导出 / 更新 openapi.json
  - 在子项目重新构建后，统一收集到治理目录

  此 skill 不负责生成 OpenAPI JSON（生成是各子项目自己的事情），只做发现和复制。
---

# extract-openapi

将 workspace 各子项目内部已生成的 OpenAPI JSON 复制到 `governance/CONTRACT/` 目录。

## 职责边界

- **子项目负责生成**：每个子项目有自己的生成方式
  - `backend/`: `mvn clean package -Popenapi -DskipTests` → 输出 `backend/openapi.json`
  - `icepolar-dms/`: `python3 scripts/generate-openapi.py` → 输出 `icepolar-dms/openapi.json`
- **本 skill 负责收集**：扫描子项目 → 发现 `openapi.json` → 复制到 `governance/CONTRACT/` → 格式化 → 更新 `CONTRACTS.md` 引用

## 工作目录规则

**所有操作必须在 workspace 根目录执行，不得改变当前工作目录。**

如果需要进入子目录执行命令，必须使用 subshell：
```bash
(cd backend && mvn clean package -Popenapi -DskipTests)
```

严禁使用 `cd backend && cmd` 这种方式，因为它会改变当前 shell 的工作目录。

## 工作流

### Step 1: 扫描子项目

扫描 workspace 根目录下的子模块，寻找 OpenAPI JSON 文件：

| 子项目 | 预期文件 | 生成命令 |
|--------|---------|---------|
| `backend/` | `backend/openapi.json` | `cd backend && mvn clean package -Popenapi -DskipTests` |
| `icepolar-dms/` | `icepolar-dms/openapi.json` | `cd icepolar-dms && python3 scripts/generate-openapi.py` |

查找规则（按优先级）：
1. 子项目根目录下的 `openapi.json`
2. 子项目根目录下以 `-api.json` 或 `-openapi.json` 结尾的文件
3. 子项目根目录下 `target/`、`build/`、`dist/` 目录中的 `openapi.json`

### Step 2: 检查文件

对每个子项目：
- **找到文件**：记录路径、大小、修改时间
- **未找到**：提示用户先在该子项目中生成，给出对应的生成命令，继续处理其他子项目

### Step 3: 复制到 governance/CONTRACT/

命名规则：`<project>-api.json`

```
backend/openapi.json        →  governance/CONTRACT/backend-api.json
icepolar-dms/openapi.json   →  governance/CONTRACT/icepolar-dms-api.json
```

复制后用 `python3 -m json.tool` 格式化：

```bash
python3 -m json.tool "src.json" > "dst.json.tmp" && mv "dst.json.tmp" "dst.json"
```

### Step 4: 更新 CONTRACTS.md 引用

如果 `governance/CONTRACTS.md` 存在且未引用提取的文件：
- 在 Device API Contract 章节追加：
  ```markdown
  > 接口结构以 [backend-api.json](CONTRACT/backend-api.json) 和 [icepolar-dms-api.json](CONTRACT/icepolar-dms-api.json) 为准（自动生成的 OpenAPI 快照）
  ```

## 使用示例

```bash
# 1. 在各子项目中生成（子项目自己负责，使用 subshell 不改变工作目录）
(cd backend && mvn clean package -Popenapi -DskipTests)
(cd icepolar-dms && python3 scripts/generate-openapi.py)

# 2. 运行 skill 收集到 governance/CONTRACT/
#（skill 自动执行：扫描 → 复制 → 格式化 → 更新引用）
```

## 错误处理

- 某子项目缺少 `openapi.json` → 显示生成命令，跳过该项目，继续处理其他子项目
- `governance/CONTRACT/` 不存在 → 自动创建
- 目标文件已存在 → 覆盖（OpenAPI JSON 是可重新生成的产物）
