# CLAUDE.md（workspace 根）

工作区规则见 `AGENTS.md`；治理规则见 `governance/`。

## 铁律：工作目录必须停在 workspace 根

- cwd 必须始终停在 workspace 根目录，**禁止裸 `cd` 进任何子目录/子模块**。
- 需要在子模块执行命令时，一律用子 shell：`(cd backend && <cmd>)`，命令结束 cwd 自动回到根。
- 优先使用绝对路径，避免依赖 cwd。
- 若发现 cwd 已漂到子目录，先复位再继续。
