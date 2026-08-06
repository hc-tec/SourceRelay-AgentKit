# 公司内部研发部门痛点调研：证据登记（中间检查点）

更新时间：2026-08-06（Asia/Shanghai）
状态：中间证据登记，不是最终分析报告
研究主题：公司内部研发部门在交付、协作、工程质量、资源配置、绩效与职业发展上的公开痛点

## 1. 当前证据边界

本登记只保存已经通过 Collector MCP 真实能力返回的公开数据和可复核身份。分析由调用方完成；MCP 不生成报告、不保存研究工作流。

- Collector Core release：`0.7.17`；能力目录在本次运行中已读取，验证时间为 `2026-08-06T10:02:29.399Z`。
- B 站使用 `bilibili.native_search_batch`、`bilibili.video_detail`、`bilibili.discussion`，绑定使用安全别名 `binding-1`。
- 小红书已发起一次公开搜索探针，但 Core 明确返回前置条件不足；没有读取笔记内容。
- 知乎官方 Provider 当前能力状态为 `runtimeState=credential_required`，按 Skill 规则没有提交搜索，也没有改用浏览器或站外摘要替代。
- 本次没有读取 Cookie、Token、Profile、浏览器身份或 Network response body。
- B 站搜索 Artifact 中包含公开缩略图 URL，但当前 direct-ready Tool catalog 没有媒体下载/图片保留能力；没有绕过 Collector 直接下载任意 URL，因此本登记没有图片内容结论。

## 2. 采集总览

| 平台 | 实际执行 | 结果 | 可用于最终报告的证据 |
| --- | --- | --- | --- |
| B 站 | 3 组两页站内搜索；6 个视频详情；2 个讨论操作 | 3 个搜索完成，6 个详情完成；1 个讨论完成、1 个讨论 partial | 72 个搜索候选卡片的聚合范围、6 个详情、20 条评论，以及 1 个讨论失败事实 |
| 小红书 | 1 次 `程序员 加班 内耗` 公开笔记搜索探针 | `stopped`；`existing_public_explore_tab_required` | 只能证明本次绑定没有公开 Explore 页，不证明小红书没有结果 |
| 知乎 | 未提交搜索 | 官方 Provider 需要凭据 | 只能记录能力配置缺口，不可写成“知乎无结果” |

## 3. B 站搜索 Operation 登记

所有 B 站搜索均为 `bilibili.native_search_batch`，固定采集两页、综合排序。`itemCount` 是 Core Artifact 的有界投影数量，不等于平台全部结果数。

| 查询 | Operation | Artifact / SHA-256 | 终态 | 数量 |
| --- | --- | --- | --- | ---: |
| `研发团队 协作 沟通 需求变更` | `34061207-0935-4056-bc59-a356a694149b` | `6c62c4e4-65be-4d9c-98e8-d60d21cc58ba` / `sha256:0df5753850b26ddac987207533f55b07641427c9021405bf930c0de2cc9f4d7a` | `completed` / `search_batch_ready` | 24 |
| `技术债 代码质量 测试 发布` | `c60979a1-156c-4aee-b503-62bceca669c2` | `ed6a3ee7-7074-4be8-b715-cd02c11b0d55` / `sha256:7af31820a3af3a7f01603a6b9eeb3f8b36411b6fd4fae7ba707fcd10937ef6af` | `completed` / `search_batch_ready` | 24 |
| `程序员 晋升 绩效 内耗` | `ee4da5bd-b282-4888-8b11-906509da931f` | `7eea58f7-a836-4f08-b1ff-faa18b000a0e` / `sha256:0baa64af9802824ecbac22799573dc8b5900b8acbdefb3e9811e1235116fd3e4` | `completed` / `search_batch_ready` | 24 |

### 3.1 已选搜索卡片

这些卡片是后续详情选择和主题归纳的入口，不代表作者观点已被验证。

| 主题 | BV | 搜索卡片标题 | 卡片可见信息 |
| --- | --- | --- | --- |
| 加班/交付 | [BV1P4cceMECz](https://www.bilibili.com/video/BV1P4cceMECz) | 连续两个月每天11点多下班，互联网大厂程序员的牛马人生 | 96.0万播放、2855、24:45、2025-01-26 |
| 加班/健康 | [BV1NpZGYfEVy](https://www.bilibili.com/video/BV1NpZGYfEVy) | 加班是我在奖励自己，大厂的累都是结构性的累 | 25.4万播放、1127、23:41、2025-03-27 |
| 人力配置 | [BV1KDDtBSEay](https://www.bilibili.com/video/BV1KDDtBSEay) | 求了8个月终于加人 进来那一刻我人都傻了 | 497.3万播放、2628、03:10、04-10 |
| 需求变更 | [BV1qDE166Eut](https://www.bilibili.com/video/BV1qDE166Eut) | 需求变更管理_变更流程救场法 | 22、0、06:17、06-25 |
| 跨部门协作 | [BV1SyRdYQEva](https://www.bilibili.com/video/BV1SyRdYQEva) | 跨部门沟通与协作 | 1.0万播放、3、01:35:15、2025-04-05 |
| 组织协作 | [BV14h411w7Ue](https://www.bilibili.com/video/BV14h411w7Ue) | 组织不成熟，还怎么跨团队协作？ | 2578播放、19、06:22、2023-05-18 |
| 代码质量 | [BV1yAgX67EuP](https://www.bilibili.com/video/BV1yAgX67EuP) | 军工软件代码质量为什么这么差？全生命周期或多或少都有点问题。 | 23.3万播放、0、20:46、07-23 |
| 质量治理 | [BV1EE411o7hm](https://www.bilibili.com/video/BV1EE411o7hm) | 套路拆解:大厂是如何保证代码质量的！ | 10.0万播放、287、08:23、2019-10-17 |
| 单元测试 | [BV1BuoqYDEwS](https://www.bilibili.com/video/BV1BuoqYDEwS) | 做好单元测试：打造高质量代码的最佳实践 | 903播放、0、24:12、2025-03-27 |
| 绩效错配 | [BV1SX3q6QEgR](https://www.bilibili.com/video/BV1SX3q6QEgR) | 为什么你加班到死，也拿不到好绩效？ | 177播放、0、02:53、07-29 |
| 晋升价值 | [BV16T411K7in](https://www.bilibili.com/video/BV16T411K7in) | 老板分配的工作太杂没有价值，感觉晋升没有希望怎么办？ | 3.6万播放、18、10:19、2022-10-02 |
| 绩效制度 | [BV1Tg6nBBEYA](https://www.bilibili.com/video/BV1Tg6nBBEYA) | 你那么努力，为什么还是低绩效？我看所谓互联网大厂绩效制度的劣根性 | 4908播放、3、15:48、01-31 |

## 4. B 站详情 Artifact 登记

| BV | 选择理由 | Operation | Artifact / SHA-256 | 终态 | 详情投影 |
| --- | --- | --- | --- | --- | --- |
| BV1P4cceMECz | 高互动长期加班/交付压力 | `73461699-278d-4296-a3ee-748b7f60b887` | `82642116-f7d8-4c04-afcc-d43239e10cf8` / `sha256:ca6d51a8f849c47297df5defe9fc0a37171091df8a35a1a9685900b43a6ecc76` | `completed` / `detail_ready` | 作者“摩的司机徐师傅”；描述谈到普通一线执行者、长期工作压力；标签含华为、腾讯、大厂程序员、求职等 |
| BV1KDDtBSEay | 小公司人力不足 | `0d4ce775-a5b2-42ce-a3f1-053d326e422f` | `9b33ac81-7fb6-4dcb-b1f1-2e0fb14bc131` / `sha256:bb292fec47e78cf8be29504c9f514ca99695c39e283db2a00e8a9b6624469a83` | `completed` / `detail_ready` | 标题直接呈现“求了8个月终于加人”；描述为 `-`，所以只作为标题/标签弱证据 |
| BV1qDE166Eut | 需求变更与流程治理 | `7810eba8-daec-4303-845f-6888f53c18a1` | `89d69518-fe57-4124-93b7-9bed2ee0a7c6` / `sha256:05c6c5fce70b0de1740b3e21763438df17aa62b564e0ea49f70bcc619995e995` | `completed` / `detail_ready` | 标题为“需求变更管理_变更流程救场法”；标签含需求变更、项目管理、团队管理、需求管理、流程管理 |
| BV1yAgX67EuP | 代码质量的全生命周期问题 | `3be03f7c-37f9-4a40-95e2-ab3254e736c7` | `a9443533-533f-4657-9faf-cc91d7b2f390` / `sha256:c7c2ff53f06c3c06d5a8ffb48477546c959db160394b0c392b671b7aea3e5b0f` | `completed` / `detail_ready` | 标题明确指向“全生命周期或多或少都有点问题”；描述为“已经收着很多了，体制内外完全是两个世界”；标签含军工、程序员、软件、代码 |
| BV1SX3q6QEgR | 加班与绩效错配 | `56d91bd5-87c9-4125-b60c-a9f4ce6021a0` | `8e184c6b-9807-43c0-8a4a-c5cd0cfd4122` / `sha256:cb0cd0c2a43bbf846903611304a7ccee366f3769815042bca20222f3c0deb1b6` | `completed` / `detail_ready` | 标题为“为什么你加班到死，也拿不到好绩效？”；标签含老板、升职、绩效、晋升、向上管理；描述为空 |
| BV16T411K7in | 杂务与晋升价值错配 | `e7c13502-6f10-489d-bb66-ac7cb4a52a1e` | `661d4ac8-6c3f-4b94-851b-9add80d33e26` / `sha256:856ea1248d7ab367e0abd7f708885c71550ca6c7a067f8f21446e88d5bd772ed` | `completed` / `detail_ready` | 标题指向“工作太杂没有价值、晋升没有希望”；标签为 `#晋升`、`#向上管理`；描述为空 |

详情能力统一给出 `risk.rateLimited=false`、`sourceUnavailable=false`、`verificationRequired=false`，但 `accessStatus=indeterminate`；这表示本次公开详情采集成功，不表示视频内容或作者身份的全部事实均已验证。

## 5. B 站讨论 Artifact 登记

### 5.1 完成：BV1P4cceMECz

- Operation：`59b81646-353e-47cb-b882-8dc58bbcca4e`
- Artifact：`d7635689-2b4e-4910-a64a-88cd85b2c187`
- SHA-256：`sha256:4dec2d39ded0cefd739e846434c71df9e0fc812b02ca871532ca2ff19c6636ad`
- 终态：`completed` / `discussion_ready`
- 有界数量：20 条 root comment 文本；`responseBodies=not_read`；1 次导航、1 次语义动作。
- 代表性内容（仅作定性证据）：
  - 有评论描述校招困难、HC 很少和由此产生的职业怀疑；回复中出现“博士毕业也没找到 HC”的个人经历。
  - 有评论质疑“淘汰只看产出”的说法，描述职责被调离核心模块、分配脏活累活、背绩效等组织机制；另一条评论指出技术能力与公司技术栈/业务岗位不匹配时，个人能力不一定转化为组织产出。
  - 多条评论把高强度工作与身体问题、离职后状态改善联系起来；也有评论明确偏好低薪但准时下班，说明诉求不只在收入。
  - 有评论讨论 AI 生成代码后的审核责任，认为核心代码仍需要能看懂代码的人负责审查，反映质量责任和新工具边界的焦虑。
- 噪声：置顶内容是流量卡营销；评论包含“99%/100%”等无来源极端比例，不能当作统计数据。

### 5.2 Partial：BV1qDE166Eut

- Operation：`44063e59-5acf-4bcc-a83b-f6fe446f2597`
- Artifact：`e461155d-3f4e-4ff6-aebf-9b54c928478c`
- SHA-256：`sha256:7c637ad2486956256a77caf893919715bb9b698a095267ee4c5c7beed746dba5`
- 终态：`partial` / `discussion_partial`
- `errorCode=bilibili_video_discussion_dom_not_ready`，`itemCount=0`。
- 解释：详情已完成，但评论区 DOM 未达到能力要求；这不是“没有评论”，也不是“需求变更没有讨论”。不再重试或把它写成零结果。

## 6. 平台阻断登记

### 6.1 小红书

- 查询探针：`程序员 加班 内耗`
- Tool：`xiaohongshu.search.public_notes.v1`
- Operation：`24735f57-2a5f-442a-90ac-3107f1e26897`
- Artifact：`333f3455-8c18-4add-937c-ea32e4d7cbf9`，有界 `itemCount=0`
- 终态：`stopped` / `existing_public_explore_tab_required`
- `errorCode=xiaohongshu_trusted_input_explore_tab_required`
- 事实含义：当前绑定在线，但没有被能力合同接受的现有公开 Explore 页；没有刷新、新开文档、猜 URL 或读取私域页面。不能推断小红书无结果。

### 6.2 知乎

- 当前能力目录中的 `zhihu.search.public_content.v1`、`zhihu.hot_list.public_content.v1` 和 `web.search.global.zhihu_provider.v1` 均要求官方 Provider 凭据，运行时状态为 `credential_required`。
- 本次没有提交知乎 Tool，没有 Operation/Artifact，也没有向用户索要或记录凭据。
- 事实含义：知乎搜索是未完成的外部配置缺口，不是“知乎无结果”。后续若要补齐，需在网关外部配置官方 Provider 凭据，并重新读取 live capability 状态；不能在聊天中粘贴 Secret，也不能改用浏览器 Cookie。

## 7. 当前可安全使用的初步主题标签

这些标签是后续报告的分析入口，不是统计结论：

1. 交付压力与资源错配：长期加班、人力补充慢、一个人承担缺少支援的任务。
2. 需求与协作边界：需求变更、跨部门沟通、需求追溯和变更影响没有形成可执行的闭环。
3. 质量责任后置：代码质量、测试、发布、全生命周期责任与交付速度之间存在张力；AI 生成代码又增加审核边界问题。
4. 绩效/晋升的可解释性：工作量不等于绩效，脏活杂务或非核心职责可能无法转化为可见成果；个人产出与组织预算/岗位匹配也可能脱钩。
5. 可持续性与职业风险：健康损耗、年龄/岗位流动、招聘收缩、转行和离职成为公开叙事的一部分。

## 8. 证据使用规则

- 搜索卡片的播放/评论数字只能用于样本选择和可见互动背景，不用于估计痛点发生率。
- 标题是议题信号；只有详情描述、评论或其他独立来源支持时，才提升为更强的定性证据。
- 评论区是自选样本且噪声很大，极端比例、营销、情绪化表达和单个经历必须标为个人叙事。
- B 站是本检查点唯一完成实网采集的平台；小红书和知乎的未完成状态会在最终报告中单列，不跨平台合并成“用户普遍如此”。
- 所有后续引用必须保留平台、BV/公开来源身份、Operation、Artifact、SHA-256 和终态；若只引用搜索卡片，需注明“搜索卡片证据”。
