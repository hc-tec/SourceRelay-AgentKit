# Chrome DevTools MCP 验证配置

本配置只服务于仓库维护者对真实网页 hover 菜单、MV3 扩展制品和 Service Worker runtime marker
的开发/验证。它不是 Collector MCP 产品能力，也不改变 `collector://capabilities` 或 MCP Tool
catalog。

## 配置

把 [chrome-devtools-mcp.validation.toml](chrome-devtools-mcp.validation.toml)
中的 `[mcp_servers.chrome-devtools]` 段合并到 MCP Host 配置。Windows 当前 Node 安装路径是：

```text
D:\apps\nodejs\npx.cmd
```

至少必须保留：

```text
--categoryExtensions
```

推荐同时保留：

```text
--no-usage-statistics
--no-performance-crux
--redactNetworkHeaders
--user-data-dir <dedicated-validation-profile>
```

修改后必须完整重启 MCP Host；只刷新聊天不会重新创建 Tool catalog。

## 扩展验证顺序

1. 首次用 `install_extension` 加载绝对路径：
   `D:\AIProject\inteligence\poc\collector-extension\dist`。
2. 用 `list_extensions` 记录扩展 ID。
3. 后续构建变更只对项目验证 Profile 使用 `reload_extension`，不要打开
   `chrome://extensions` 手动 Reload。
4. 用 Service Worker evaluation 读取 manifest/runtime marker，并与扩展目录中的
   `runtime-build.json` 精确比对：`collectorVersion`、`controlSurfaceRevision` 和
   `buildFingerprint` 必须全部一致。
5. B 站字幕菜单必须按“视频区域 → 字幕按钮 → 菜单路径 →
   `.bpx-player-ctrl-subtitle-language-item[data-lan="ai-zh"]` 父节点”分段真实 hover；
   菜单弹层消失时结束当前动作链，不补点、不重放。

## 边界

- 不使用 `--browserUrl`、`--wsEndpoint` 或 `--autoConnect` 连接日常浏览器；Extension
  tooling 当前依赖 MCP 自己启动的 pipe 浏览器。
- 不把 `install_extension`、`reload_extension`、CDP、任意 selector、坐标、Network body 或
  tab/window ID 加入 `packages/mcp-server` 的产品 Tool。
- L3/L4 的 Collector capability 证据仍必须通过 released Core + Collector MCP；DevTools MCP
  只证明维护/验证动作，不能把 research-only 能力提升为 `direct_ready`。
