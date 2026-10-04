# 宗谱人物子嗣关系交互图

这是一个静态网页版本的宗谱人物关系交互图，用于浏览族谱人物、父子关系、过继关系、人物详情、统计信息和迁徙分布。

## 发布

当前仓库根目录的 `index.html` 即为可直接部署的网页入口，主页面依赖 `assets/` 下的样式、数据和交互脚本。

后续更新时，在本地重新生成页面后，提交根目录页面和 `assets/` 即可同步线上版本。`outputs/` 是生成过程的完整页面副本，不作为人工编辑入口。

## 访问统计

2026-10-04 起通过 [soxft/busuanzi 作者的公共服务](https://busuanzi.9420.ltd/)记录累计访问，无需注册账号、服务器或 GitHub Secret。

打开 **[网站访问统计](https://wushizupu-commits.github.io/zongpu/analytics.html)** 即可查看全站累计浏览量（PV）、估算访客数（UV）及七个栏目的相应数据。普通页面底部和世系图的搜索侧栏也有“访问统计”链接。纸卷、墨砚两套皮肤共 14 页合并为七个栏目；展开人物、搜索、切换文章锚点不会额外计数，刷新内容页面会增加 PV。统计页只读，打开或刷新统计页不会增加计数。

接入点只有 `assets/site-tools.js`，它统一加载 `assets/site-analytics.js` 和配套样式，后续页面继续引用公共脚本即可。统计客户端直接请求 JSON API，不执行第三方统计脚本。生产范围限定为 `https://wushizupu-commits.github.io/zongpu/`；本地预览、文件预览、其他域名不计数。首页/皮肤自动跳转的中间页面跳过计数。网络失败不会影响族谱功能，也不会自动重试 POST 导致重复计数。

### 数据含义和限制

- 累计数据从接入后开始，无法恢复此前历史。上线验证会产生少量真实测试访问。
- 服务的站点合计按域名汇总；以后若同一 `wushizupu-commits.github.io` 域名下其他项目也接入同一服务，会并入该合计。栏目行仅查询本族谱的路径。各页 UV 不能相加当作全站 UV。
- UV 是估算值：服务用 IP、浏览器信息及返回的访客标识去重，本站将标识保存在 `localStorage` 的 `zongpu-analytics-id` 中；不同设备、清理存储、隐私设置或网络变化可能影响结果。DNT/GPC 开启时不发送计数请求。
- 只发送固定的栏目 URL，不发送人物 ID、搜索文字、查询参数、锚点或来源网址。请求不携带跨站 Cookie；服务仍会收到网络请求的 IP 和浏览器信息。
- 数据公开可查询，没有私有管理后台。公共计数可能被人为重复提交，不能作为审计或计费依据。
- 此方案没有按日趋势、来源渠道/小红书归因、停留时间或点击路径。添加 UTM 参数本身不会产生来源报表。
- 作者明确说明公共服务没有 SLA 或数据完整保证。服务故障、拦截器、禁用 JavaScript 会造成漏计；页面显示“暂不可用”时不代表零访问，也不能保证永久留存。

API 依据：[项目源码](https://github.com/soxft/busuanzi/blob/main/app/controller/api.go)。POST 计数，GET 只查询；使用 `x-bsz-referer` 指定规范化的栏目 URL。端点集中定义在 `assets/site-analytics.js`，便于未来切换自建实例。

### 以后升级到 Cloudflare

优先评估过 Cloudflare Web Analytics，但 GitHub Pages 的非代理站点必须先在 Cloudflare 控制台 **Web Analytics → Add a site** 创建 `wushizupu-commits.github.io`，再从 **Manage site** 获取带 token 的代码；仓库端不能生成 token。参见 [Cloudflare 官方步骤](https://developers.cloudflare.com/web-analytics/get-started/)。

如需更完整的时间趋势、来源等报表，完成上述步骤后，只需提供代码中的公开站点 token（不要提供账户密码或 API 密钥），即可在现有公共入口切换服务。此时数据到 Cloudflare 控制台查看，旧公共累计数不会自动迁入。目前已启用的是上述免账号基础计数方案，没有启用 Cloudflare。

GitHub **Insights → Traffic** 统计的是 GitHub 仓库访问，不是 GitHub Pages 网站浏览量。[官方说明](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-traffic-to-a-repository)。

### 验证

`node --test tests/*.cjs` 可运行静态/逻辑回归；统计验证使用模拟 API，不产生线上计数。实际发布后应确认首页、世系及墨砚皮肤都能发送一次计数请求，统计页刷新仅发送 GET。
