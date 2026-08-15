# data/ 原始接口返回数据

本目录保存 Collector MCP 采集到的**原始接口返回**，与 report.md / evidence-ledger.md 配套，防止数据丢失。

## 目录

- `raw/`：每个采集任务的原始返回
  - `<operationId>.artifact.json`：知乎/全局搜索/小红书搜索 Artifact 原始 JSON
  - `<operationId>.bilibili-*.json`：B 站搜索 results/manifest、视频详情 detail.json
  - `<operationId>.index.json`：该任务的查询词、clientRequestId、终态、条目数、SHA-256 索引

## 命名与溯源

- 文件名 = Core Operation ID，可通过 `collector://operations/<operationId>` 复核
- 数据全部来自 Collector MCP 实时能力（知乎官方开放平台 / 小红书扩展 / B站扩展）
- 保留精确终态；平台不可用/部分失败均如实记录，不改写为"无结果"

## 2026-08-14 已保存任务（20 个 Operation，严格串行）

### A. 知乎官方搜索（zhihu.search.public_content.v1）
| op | 查询词 | 终态 | 条目 |
| --- | --- | --- | --- |
| 080b2a01 | 中小学生个性化教育AI学习 | completed | 10 |
| 8690631a | 中小学 补课 辅导 家长 焦虑 孩子 学习 | completed | 10 |
| 67428187 | AI个性化学习 产品 学习机 作业帮 学而思 体验 | completed | 10 |

### B. B站（bilibili.native_search / bilibili.video_detail，严格串行）
| op | 类型/视频 | 终态 | 内容 |
| --- | --- | --- | --- |
| a8b4615f | 搜索"AI学习机 测评 家长 值不值得买" | completed | 20 条视频（含149万播放《万元学习机是智商税吗》） |
| d8739c71 | 搜索"AI个性化教育 苏格拉底 启发式 学习 孩子" | completed | 20 条视频（AI盖茨对谈AI苏格拉底等） |
| cab9da73 | 搜索"辅导作业 崩溃 家长 孩子 学习 焦虑" | completed | 20 条视频（914万播放崩溃视频等） |
| aa4905d4 | 详情 BV1Rw4m1Q7NG 万元学习机是智商税吗 | **partial** | 字幕播放器不可用；详情+20条热评已捕获 |
| abd9f321 | 详情 BV1kb7Y6VEL5 北大毕业给孩子讲题崩溃怒测3台AI学习机 | completed | 字幕 559 段 + 20 条热评 |
| 1e6346bf | 详情 BV1GSFZzNERS 五大学习机优缺点 | completed | 字幕 290 段 + 8 条评论 |
| 14d5a945 | 详情 BV1ma4y1V7nt AI盖茨对谈AI苏格拉底 | completed | 字幕 101 段 + 20 条热评 |

### C. 小红书公开笔记搜索（xiaohongshu.search.public_notes.v1，严格串行）
| op | 查询词 | 终态 | 条目 | 详情/评论 |
| --- | --- | --- | --- | --- |
| 5b00edb3 | AI学习机 测评 避坑 家长 真实 | stopped(rank_unavailable) | 16 | 详情动作6/8完成未投影 |
| bada89c4 | 辅导作业 崩溃 妈妈 孩子 学习 怎么办 | stopped(comment_scroll_container_unavailable) | 17 | 详情动作3/6完成未投影 |
| a1eae967 | 学而思 学习机 真实体验 踩坑 值不值得 | **completed** | 17 | **详情 6/6 + 评论区已捕获** |
| 648faa5e | AI 个性化学习 孩子 提分 家教 体验 | stopped(comment_scroll_container_unavailable) | 20 | 详情动作1/6完成未投影 |
| 129a9cf7 | Socratopia 破卷 AI 学习 | stopped(comment_scroll_container_unavailable) | 20 | 详情动作3/6完成未投影 |
| 6942662d | 科大讯飞 学习机 真实评价 后悔 智商税 | **completed** | 17 | **详情 6/6 + 评论区已捕获** |

> 经验：小红书搜索带 `comments.maximumScrolls=1`（不展开回复楼）可稳定完成；`maximumScrolls=2` 或 `replies.maximumThreads` 会触发平台后置条件失败；stopped 时详情动作不投影内容（平台行为）。

### D. 全局网页搜索（web.search.global.zhihu_provider.v1）
| op | 查询词 | 终态 | 条目 |
| --- | --- | --- | --- |
| 44c4ae91 | 中小学 AI 个性化教育 市场规模 学习机 2026 | completed | 10 |
| a3aa724b | AI教育 市场规模 报告 亿元 智能学习机 出货量 2025 2026 | completed | 10 |
| 88271636 | 双减 政策 AI教育 个性化学习 学习机 家长 2026 | completed | 10 |
| efa9aeca | AI智习室 松鼠AI 加盟 个性化 自习室 市场 争议 | completed | 10 |

### E. 关键长文全文（open_page 辅助阅读，非采集）
- 搜狐《万元AI学习机，正在收割中国家长》（2026-08-04）——市场规模/销量下滑/头部集中/痛点
- 锋行链盟《2026年AI教育行业发展研究报告》——全球600亿美元/中国380亿元/个性化42%份额
- cnblogs《2026暑假严禁补课，AI学习机成刚需？》——双减深化/学习平板出货+23.4%/家长投入数据

> 配套报告：report.md（主交付）；证据：evidence-ledger.md
