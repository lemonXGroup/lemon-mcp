# URL、Query 与 HTTP 重定向

本参考适用于生成或修改请求目标的规则，合同核对日期 2026-11-14。先读 GET /api/rewrite/capabilities，确认 request_target_rewrite.supported=true、version=1。更新后的 MCP upsert 会执行能力检查；直接 HTTP 需要自己检查。能力缺失或设备不可达时不能假设可用。

| 需求 | action | 解码后的 config |
| --- | --- | --- |
| 内部更换 URL，保留方法和 body | url_rewrite | {"target":"/v2/items","query_policy":"auto"} |
| 只修改参数 | query_mod | {"operations":[{"op":"set","key":"page","value":"2"}]} |
| 客户端收到真正 3xx | redirect | {"target":"/next","query_policy":"auto","status":307} |

三种动作仅允许 scope=request，在请求头执行。redirect 始终表示真正的 HTTP 重定向；旧数据只有 target 时直接采用 status=307、query_policy=auto，不识别或转换成其他动作。url_rewrite 才是内部修改 URL。

target 支持完整 HTTP(S) URL、/ 开头路径、? 开头 Query（保留当前路径）。禁止用户信息、#片段、控制字符、空格、反斜杠、未编码非 ASCII 和 //host；输入与最终 URL 最长16KiB。内部跨协议/主机/端口会同步上游 Host/TLS/SNI/ALPN，保留方法和 body。跨目标仍受拒绝、MITM 绕过、保护域名、DNS/Hosts、上游代理策略限制。

query_policy 默认为 auto：目标显式 Query（包括空 ?）优先；否则同源保留原 Query、跨源清空。同源比较协议、主机和有效端口。preserve 使用原 Query；replace 只用目标 Query；merge 保留原不冲突项再追加目标全部项，目标同名键优先；clear 清空。不要默认将跨源敏感参数带到新站点；用户明确需要时使用 preserve/merge。

query_mod 的 operations 按顺序执行，最多128项。set/append 需要 op/key/value；remove 只需 op/key；clear 只需 op。未知字段或错类型会拒绝。键区分大小写；set/remove 作用于全部同名键。输入是解码文本，修改项按 UTF-8 表单编码（空格为 +）；未修改项保留字节编码、顺序、重复键、标记和空项。修改可能导致业务签名失效，不会自动重签。

HTTP redirect 默认307；支持301/302/303/307/308。307/308在客户端跟随时保留方法/body；301/302/303可能改成GET。客户端自己决定跟随，ATS可能阻止HTTP目标。内部URL修改没有客户端跳转。H1/H2仍先做既有原站初始TCP/TLS协商，握手失败可能使本地规则无法执行；无业务数据发送到原站不等于无连接。

请求头脚本可返回 {url:"/v2/items",queryPolicy:"auto"}；只改 ctx.request.url 不生效。其他方向/阶段返回这些字段报错。真实3xx用原生 redirect。

包含这三种动作的导出分享/DRM文档为schema6，云/本地恢复为7；旧客户端应拒绝。读取时仍接受较早格式中的 redirect，缺字段直接用默认值；url_rewrite/query_mod 要求分享至少6、备份至少7。MCP rule_json 是规则元数据字符串，groups_json 是数组字符串，action.config 仍是JSON字符串。不要把分享schema_version塞入本地rule元数据。

匹配基于原始捕获URL，目标动作按顺序应用。真实重定向在其位置确定Location；建议放在目标修改后。验证保存读回、runtime_applied和新请求：核对实际原站收到的方法/body/URL及响应Location，不只看规则命中。

更多实例：[完整合同](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/request-target.md)。
