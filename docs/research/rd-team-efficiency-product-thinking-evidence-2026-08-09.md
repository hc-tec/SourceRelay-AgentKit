# 研发团队提效调研：证据登记（2026-08-09 最终版）

更新时间：2026-08-09（Asia/Shanghai）
状态：最终证据登记，配套报告见 [rd-team-efficiency-product-thinking-report-2026-08-09.md](rd-team-efficiency-product-thinking-report-2026-08-09.md)
研究主题：① 别人如何给研发团队提效（含“小工具”实践与产品思维）；② 研发过程中常见且可改进的痛点；③ 新员工（仅比同事更懂 AI）如何落地

## 1. 证据边界与采集方式

- Collector Core release：`0.7.17`；Gateway 由用户维护（`poc/collector-gateway/dist`），MCP Tools 共 18 个 typed Tools，本会话已挂载。
- 知乎使用官方 Provider（`zhihu.search.public_content.v1` / `zhihu.hot_list.public_content.v1` / `web.search.global.zhihu_provider.v1`），`runtimeState=ready`，走官方 API，不读 Cookie/Token。
- B 站使用 `bilibili.native_search_batch`、`bilibili.video_detail`（schemaVersion=2 含 `subtitle` 字段）、`bilibili.discussion`，绑定使用安全别名 `binding-1`（用户日常浏览器 + MV3 扩展）。
- 小红书使用 `xiaohongshu.public_notes_search` 探针；5 次尝试均被平台前置条件拦截，按 Core 真实终态登记，不伪装为“无结果”。
- 本次没有读取 Cookie、Token、Profile、浏览器身份、Network response body；详情与讨论 Artifact 均带 `risk` 字段且 `rateLimited=false`、`sourceUnavailable=false`、`verificationRequired=false`（除明确登记的验证码/受限项）。
- 原始 JSON（含 Operation/Artifact/chunks/SHA-256）保留在 `runtime/research-pain-points-2026-08-07/raw/`（gitignore，不入库）；本文件只登记身份与摘要。

## 采集总览

| 平台/能力 | 实际执行 | 结果 | 可用于报告的证据 |
| --- | --- | --- | --- |
| 知乎站内搜索 | 30 组查询（s1-s8、a1-a10、b1-b12），每组 10 条 | 30 个 `completed` / `official_api_response_ready` | 300 条公开内容条目 |
| 知乎热榜 | 2 次，每次 30 条 | 2 个 `completed` / `official_api_response_ready` | 60 条热榜条目 |
| 全网搜索（知乎官方 Provider） | 6 组英文查询（web-a1..a3、web-b1..b3），每组 20 条 | 6 个 `completed` / `official_api_response_ready` | 120 条公开网页/文章条目 |
| B 站站内搜索 | 12 组批量搜索 × 2 页（bili-b1..b12） | 12 个 `completed` / `search_batch_ready` | 288 张搜索卡片（另有 2 个单页探针 40 张，合计 328 张） |
| B 站详情 | 46 个首批详情 + 字幕修复后重跑 + 字幕探针 | 103 个唯一 `completed` / `detail_ready` Artifact | 103 个详情投影；其中 27 个含完整字幕全文（71~2545 分段，819~28901 字符） |
| B 站评论区 | 22 次讨论操作 | 16 个 `completed` / `discussion_ready`、4 个 `partial`、2 个 `failed`（后已重跑成功） | 225 条根评论（20 个视频中有 16 个成功） |
| 小红书 | 5 次公开笔记搜索探针 | 5 个 `stopped` / `postcondition_unmet` | 只能证明平台前置条件不足，无笔记内容结论 |

分类统计（480 条知乎/全网条目，可多主题归属，共 1396 次归并）：发布/环境 273、质量/测试 261、需求/协作 170、知识库/文档 160、度量/DORA 154、采纳/使用率 121、AI 工作流 102、平台/内部工具 84、未分类 71。

## 2. 知乎 / 全网 Operation 登记（官方 Provider，不走浏览器）

| 标签/查询 | Operation | Artifact | SHA-256 | 终态 |
| --- | --- | --- | --- | --- |
| zhihu-s1：研发效能 提升 方法 | `1a092262-d36b-4584-8f81-027c49ec4a5c` | `3d601811-7605-4ba3-bea9-e82dd3eeeb61` | `sha256:8f7254f4030987d8a517e2685f886a4b80e304fa1e71eb8c4da0cf9bbef0637e` | official_api_response_ready |
| zhihu-s2：程序员 效率工具 | `4562a6aa-c62d-4fdc-8e40-a78f14628eab` | `9673c9fc-c0c6-48fe-8ddf-210a281aa71f` | `sha256:2aa2e0960c312c520947370828e3bef586b8d0c0e33b0781fa5bc43a02e60899` | official_api_response_ready |
| zhihu-s3：AI 编程 提效 | `5852f7c8-5988-4853-b2d3-e8e2d10f4a4c` | `7e168fc3-c0e9-46ca-a80f-a3cdfcb4db72` | `sha256:93a8e16a443c5a66dbd0e64c5f0c3e2a999006b9fb1794d55608bbd7c7fe87d2` | official_api_response_ready |
| zhihu-s4：研发团队 痛点 | `daa31294-3052-4f21-9b8b-1b6328dc1b14` | `03d8a7ce-6b45-40c4-91a1-82683260e50d` | `sha256:728b822ed4644d4234c4b5e1999a2143ee73efd83c9036199fae9215244806cb` | official_api_response_ready |
| zhihu-s5：需求变更 开发 返工 | `ccc1f4f9-b94a-4357-afb1-245386fb043b` | `f15d4b14-dbf6-41e1-9f47-4eea0386fd5f` | `sha256:17a966a05d3a3a9e88b11880a9c899ec1ca9c22c349502669dbfe0f43aa24fa9` | official_api_response_ready |
| zhihu-s6：技术债 代码质量 | `dca0ba03-6bab-497e-aaf7-34f7d989f2d2` | `ea764206-2936-4132-915e-bd8effcabeda` | `sha256:aa0a02fb401d037e384841fb1586e8ad027485476b68c6a1c8423f576f976685` | official_api_response_ready |
| zhihu-s7：新员工 上手 项目 | `e6643515-1ff8-4416-966b-b59d14535292` | `91b57ba5-03a9-408f-9d1c-21d4b2ded39b` | `sha256:7393f1e8a3f2814f93a5cbcdccee537c99260507f6d008a56d09a6b57b70ab4d` | official_api_response_ready |
| zhihu-s8：代码审查 测试 效率 | `b545a3a5-2f6f-48a7-bf78-50ba62d89f90` | `6c015123-8c52-404f-af99-2ff91b7977e7` | `sha256:341537c847b0871f18200c1cecba9a6dd3c53159f6ab661194f8be5c0d83bafe` | official_api_response_ready |
| zhihu-hot：zhihu-hot | `6996cb48-b497-4c78-add3-00fb1c2441e7` | `4d0daa79-d78e-4587-8308-9542636c3935` | `sha256:18c241e3f22c40d7029be268da4fdea2c8561d39650ede426ac7ae45eefcfefe` | official_api_response_ready |
| zhihu-a1：研发效能 平台 落地 使用率 | `74f3ad3c-67d7-4ba3-b7b3-8fd4c32cc57d` | `c48cb88d-6871-43db-86a1-45cb63b188ef` | `sha256:42cb09f59c6ca92c392690c64fbcee17a793292224eee6def781624f5c2ceec5` | official_api_response_ready |
| zhihu-a2：内部工具 推广 程序员 不用 | `93d9eb75-58b8-4d4c-b9b4-eadfe579d5b8` | `e7fdb711-08c3-464f-ab47-b0eb555f6e80` | `sha256:651f670791b3c193799b9cf12f30e6ef25c8cbed029ebeee828e879de01ed006` | official_api_response_ready |
| zhihu-a3：研发团队 提效 产品思维 | `3dffb08d-f473-435f-8a32-a6e89a7b2407` | `e214ed3e-ade3-49d7-99a3-a3235687e428` | `sha256:ca63df2d49730985e470efc71fc7dd16fb6eed4059430e5bf781c8ed67df2722` | official_api_response_ready |
| zhihu-a4：程序员 效率工具 推荐 | `6c607084-8d4d-407a-9873-6964579473ee` | `4b33f1aa-1fa0-4a50-9b04-c23d2b0d7ef6` | `sha256:1cf7ad691ae6441265ba7c06eea09a3a2c96d2209f494bcfe036fbb090ba609f` | official_api_response_ready |
| zhihu-a5：研发过程 痛点 流程 | `315903ed-32fd-4b7e-b9bb-dd05f35660c4` | `a75737fc-6249-44dd-9673-9340a0586679` | `sha256:cc6398dd39926b915e49c21ae4e5b7d877a50adc7ee391e72465482a3c503ac4` | official_api_response_ready |
| zhihu-a6：需求变更 沟通 开发 返工 | `eaaa05c1-d52d-4563-acbf-c283443fbcd6` | `fe039ac2-fc53-4e50-8c04-783bbf925744` | `sha256:a72b2c1f6ae657317602360e13559fe32446385972acfeb1c2e949e0ec0a4cd8` | official_api_response_ready |
| zhihu-a7：技术债 治理 代码质量 | `b96c777e-23a4-499a-9f18-901f65b80c04` | `0b98d8cc-3951-4bd1-b0ae-b2c2cc2187b3` | `sha256:5ec55344654b160faeca1580a7ce135b0c48f621c32ad1331fa89a0a356e62b8` | official_api_response_ready |
| zhihu-a8：新员工 上手 团队 融入 | `ba53b2ce-1e48-4149-8f7e-41506825b149` | `f71020f7-5557-48e1-85c0-8ca73f5de389` | `sha256:d46d3799bf7589c2915c800f250b47f4790172fb713df84206f41f2b5aeb18bf` | official_api_response_ready |
| zhihu-a9：测试 自动化 落地 效率 | `f8ff3511-299c-44d6-ad72-0e5e6bbd5ca9` | `155c3434-8575-42c5-9cf9-2db24d96ee40` | `sha256:6c059f82f7c25563bb716bbdd9cdbf9ddf52123095acaabc3decd9b036b483f7` | official_api_response_ready |
| zhihu-a10：知识库 文档 团队 建设 | `ba897a0d-83a9-400a-8fc9-08db983142ca` | `21c400a6-8c43-4dfb-8f55-64d840b4dc46` | `sha256:fdf884dffddbe947e78f7be308694108d07192a039af5660da3c9f6575fe5f70` | official_api_response_ready |
| zhihu-hot：zhihu-hot | `26b79f52-ac2f-4900-acbd-53506d2e9040` | `0e12c04c-2e52-4bb9-a303-d8a20e644aa7` | `sha256:4de21d7a4abc9def466b449e219a0b927755712c1693d01b2f2b498ec7c89548` | official_api_response_ready |
| web-a1：internal developer tools adoption why engineers don't use them | `dfd9ae15-844a-48b2-82b0-a2c2489622db` | `ffd5bde2-ede9-4b1d-9719-48a4ae7b399a` | `sha256:2a95e3c932a1365897af8c249fc5fcfd4a74a4e4fe7a47036f9b348154d85175` | official_api_response_ready |
| web-a2：developer productivity engineering team process pain points | `b14eafc3-7e10-48ae-a5ae-01c375985611` | `ca598172-f0fc-4738-a45f-560d84d34dbc` | `sha256:9908d01cb9b1c5d1e3a30383f87d2016644070b43520064392e27576d6fa03ab` | official_api_response_ready |
| web-a3：how teams build internal tools product thinking adoption | `c7ad6292-016b-4f0a-b862-166d8140d426` | `a767657b-09fa-4f52-a119-d0443a830855` | `sha256:4c99cebe572f9251827ec607ca13b35a3b531e1b1c8727e08b6faac9a8917af8` | official_api_response_ready |
| zhihu-b1：内部开发者平台 推广 使用率 | `768cfda7-7daf-448e-9b26-321923790220` | `e28aba8c-2543-4263-b43f-12c6c07a0ba5` | `sha256:2bf78561909462215df3e2022c8ffe0856c35d3b5a4ed4f281940401f3c9e97c` | official_api_response_ready |
| zhihu-b2：研发工具 没人用 原因 | `27f96f5c-e9b6-4b7f-af92-b65b7c0cc2a7` | `926c4c5b-66a8-4940-bf15-409df61f6bd0` | `sha256:72b421e8f2348e8e7d00b3937d1921f0c35d6b70da32a213ba4364e8868adeb6` | official_api_response_ready |
| zhihu-b3：程序员 效率 小工具 自己开发 | `f51c723e-37c7-4482-9478-3ebaab9ef703` | `9d9758fe-44c7-4cd2-9c39-daa21ec00a90` | `sha256:fb2f64098bcd7c8ff66815ebb990de9a10fe0059bdcb9c822f7e8740ee872f81` | official_api_response_ready |
| zhihu-b4：团队 知识库 没人看 | `1639547a-6b54-4c0e-abcb-2874ca6b7acb` | `c91c1a71-11f2-4979-bc97-a3fe116d26df` | `sha256:cf90272fbe8a6ccec3c0f34f851151a75e703ec65674a5353de3e0741430ae1f` | official_api_response_ready |
| zhihu-b5：代码评审 低效 问题 | `39461914-fe78-41b5-b721-5ada2a95a722` | `8ac20ff1-1981-4f0c-b224-b334f88551df` | `sha256:06946a5f3e47c5305bf9bd44e08990bd8eb751359a9781e3196a6aef2219e0eb` | official_api_response_ready |
| zhihu-b6：需求评审 沟通 开发 低效 | `978ee784-eced-44a4-9613-9528c49b9cab` | `cc136989-320c-493b-830f-8359960a02a1` | `sha256:8fd216cc921750a4ed8cfea080606afd53e6ebb3495aade7b805ad0f08a5c9b5` | official_api_response_ready |
| zhihu-b7：测试环境 搭建 痛点 | `d1215549-1231-4688-9382-32f826897d9d` | `8f0a1d20-0e61-4653-96e7-1d2aaf3475f4` | `sha256:02d8f9f1cfbbc8f1fa7062d8235f38f4b66d91109f2fa3dfe83ab44b2da52e2b` | official_api_response_ready |
| zhihu-b8：线上故障 排查 效率 | `bcc33b41-0a82-454c-8c9a-7ec4e40e1e23` | `bff4e046-97ab-466e-8ac0-6a384a2c88c5` | `sha256:0fd4aab8f9125644917d6672eb8be6365d4f10b7912a00f4fe04f54d13d95b03` | official_api_response_ready |
| zhihu-b9：项目交接 文档 缺失 | `8e3a2762-746a-4aef-b08e-2c6c88c9cae1` | `28cbd1f8-0757-4261-98ba-cc7ad9bc1358` | `sha256:b9eb2435d081ff3b63ccf5a0a86ed953e93a01e1f28cb98f79bc291acb32224e` | official_api_response_ready |
| zhihu-b10：研发效能 度量 指标 落地 | `42c75af9-0757-4967-a6d9-4f9a3a61ce64` | `9c125e8e-06f2-404c-83a0-a5b26b2f9333` | `sha256:dd9f5a5ef1be68de36fa9e0e251190da4cd9753ef9ba7426f59d15f83a062e69` | official_api_response_ready |
| zhihu-b11：开发文档 过期 问题 | `ac465a96-f9bd-40d1-9f87-e89d6636891a` | `94087539-3e1d-49fd-82d1-abebeb48ff5c` | `sha256:e207588bca5e38fd600285b7e45e4f63654da27424176e2ab8973d091d7ed9a0` | official_api_response_ready |
| zhihu-b12：AI 编程 代码质量 隐患 | `f0414756-c43f-458f-a907-b9257a00f911` | `fc6ff5ff-220f-4276-be50-a2e21f079183` | `sha256:99c6bb83da35ef51385b29b20e8890bce3cfe14285dcdc9a63f908342eb7e1c4` | official_api_response_ready |
| web-b1：internal tools developer adoption failure reasons | `4d672091-d762-47b4-8edf-4ea5480b7c76` | `c104a81e-8043-4e81-94fc-12ef04861754` | `sha256:da6cc21d670eaa5f53f6b9743cf9fdd04c9bd60b865973151f4f80b030359a82` | official_api_response_ready |
| web-b2：developer experience improving team productivity | `7e3d11f8-bf23-425a-b53a-bf05120d28dc` | `760128bd-ad35-4fc6-af0b-bdd4a3218807` | `sha256:7ee94bc8ac5afd259aeb37f9ae280ac6c0cbd6375324068d2486d834b70b388c` | official_api_response_ready |
| web-b3：engineering productivity metrics pitfalls | `55ddb16b-415d-4766-8e5e-01ce0c7f2f64` | `20e4d7a4-ee97-40f6-b44d-15460883cf96` | `sha256:6ff110d9ac0f8f0a3faf4ffb77c150d837336a0a13061be8ae0dbcb7b27f5f84` | official_api_response_ready |

## 3. B 站站内搜索 Operation 登记（native_search_batch，两页）

| 标签/查询 | Operation | Artifact | SHA-256 | 终态 | 卡片数 |
| --- | --- | --- | --- | --- | ---: |
| bili-b1：研发效能 平台 落地 使用率 | `251bac93-1337-49f2-8cbc-f984c2992dba` | `3ab11083-2d46-43ed-8ec2-eac908b75e76` | `sha256:f3f8ad26d4a3f93c7c098dcac1ade3e987f6db3c80559e2d9ce4cd7115eaca7f` | search_batch_ready | 24 |
| bili-b2：内部工具 为什么 没人用 | `e7b4577c-8adc-4596-9b07-5c3e8e343b7a` | `fa50800c-1237-4c85-b59f-a520f5e48030` | `sha256:b3db595db5fc6f3a2bde5490fee99554c7638f5fbf29071cfd8ca7374ccce6c9` | search_batch_ready | 24 |
| bili-b3：程序员 效率工具 推广 落地 | `9630907b-b054-4c46-8815-99849a1b573c` | `c8a13780-4c6c-486e-96ad-6873ededec4d` | `sha256:8adedf505ff95b09ddd451152424aa5f3ed15e43f54bfd74b0d8a9e1815b263a` | search_batch_ready | 24 |
| bili-b4：研发 工具链 建设 团队 | `a5880d74-4eb8-4724-873f-423337edd538` | `bfc4b5ca-f610-4116-ab5e-1bb5c396cb3e` | `sha256:3dd9527e84f4543ec834feeed5892acec691d58da43dc7955ba9a9275e37108c` | search_batch_ready | 24 |
| bili-b5：开发体验 改进 工程师 | `d173bd6c-cce4-4074-aa01-916bd6a4415d` | `99117d42-bbce-4929-9b49-dc4cf2c1b963` | `sha256:275514d144f959aec0078dce3d9847c1a1e988b82cfda1cf9227282f0979e114` | search_batch_ready | 24 |
| bili-b6：代码评审 流程 效率 | `3f50eec3-6aeb-4ea9-8528-5faa4209773a` | `9d5be035-56ce-44cd-9b6a-fc2812d5b974` | `sha256:dfde9b03a8ccb0beb5552c14e70aeec54bb9102de785a108ef80ec56912f1a37` | search_batch_ready | 24 |
| bili-b7：需求 沟通 协作 开发 痛点 | `37f9631a-f852-4b2b-b645-827da83bae93` | `864643ec-a9b1-4698-9631-70b529fe6206` | `sha256:80420f0a5c1b4bc0dd627762ea4f9a6f815434658295d7b2705bcc9fbaef4426` | search_batch_ready | 24 |
| bili-b8：测试 自动化 落地 效率 | `3665887e-8290-4fbb-bd6f-efa6d35ea153` | `4089413e-15d5-4e37-b58a-494161275102` | `sha256:2e39ede81cbf84eda805b592c73879bbb236baf5c51110ab2ff8b9b00c7132ba` | search_batch_ready | 24 |
| bili-b9：技术债 治理 团队 | `89376210-c8f5-4c35-a08d-db5b06c56ae9` | `34c7f6f8-b60d-47bd-9495-5ac7d628adac` | `sha256:4888bc5604d422457337692358173979042a64f70fa7305de88d65646f9fd0e1` | search_batch_ready | 24 |
| bili-b10：知识库 文档 建设 团队 | `7e7fe37a-b6f4-4d45-b93b-51fb138ad47c` | `653b0cc2-dd10-452c-92b2-1c7fce46ea82` | `sha256:43a3344f29aaaab56fd1357f6d9e7403d782af6d4ea167d9d8cd700ff227b2f2` | search_batch_ready | 24 |
| bili-b11：新员工 入职 上手 项目 | `82ccade3-f606-4a08-9e15-287494c54293` | `1d035819-98d4-4d5d-856c-db1ab1ea85d2` | `sha256:597f50bc921de1a8ba717f7d0ce99f9605630ed4b0a6c7bae323b359317060df` | search_batch_ready | 24 |
| bili-b12：AI 编程 提效 团队 落地 | `716e2f6a-0791-4777-8d5f-012527267762` | `9796544d-125c-41c7-a61a-a50f237974a4` | `sha256:a78d75b4940ebc688f5289bf2333b0d65fbf632838e198a829e95aebe68c3b27` | search_batch_ready | 24 |

## 4. B 站评论区 Operation 登记

| 标签 | BV | Operation | Artifact | SHA-256 | 终态 | 根评论数 |
| --- | --- | --- | --- | --- | --- | ---: |
| bili-c01 | BV1zp421U7R3 | `e7fc8e78-e952-47a7-833b-d71d8af59ff4` | `941bc218-71fe-445b-940e-59d7d9d9cace` | `sha256:6089ec2697a4f633cf8bb8d6529d6e1b50e1ed532ed137077ce3289645c6889b` | completed/discussion_ready | 20 |
| bili-c02 | BV16K411v7dU | `46cd04f6-0b16-4cb0-b2ec-84c74ea07950` | `5237f435-e48f-44ba-8dcc-60237324aa32` | `sha256:848d563eb749f32d40a8a235b1d722c06ee7355d1b6e674e8afc5903f896b9e2` | completed/discussion_ready | 20 |
| bili-c03 | BV1mvQzBpED3 | `34f06d96-6a4f-42ca-a1a0-94608984a4fe` | `847a4ba9-a39b-4865-9742-2f24aa8de46d` | `sha256:a4daec4f351065caf56a12bf856a06cf390f557af967e5732af06087d520f7b3` | completed/discussion_ready | 4 |
| bili-c04 | BV1mW4y1B7GM | `d0dafc9f-1613-46c1-bc01-b9f744791315` | `5899013a-1d0b-49fa-ad41-35ae84fe8d20` | `sha256:c3f6234d27caac1a28a28b1ab05add957e752a5dad7dded4a398420044a0bc66` | completed/discussion_ready | 5 |
| bili-c05 | BV1E8411m77j | `89efdceb-850b-47ae-89b4-d23f0195bf8a` | `4727e32a-3eb2-438d-84c2-a96acff7698b` | `sha256:1570e00f33d7c08bb42e0e14295114c1d6fc1cb4cf3d7efba244f9a84dfe6682` | completed/discussion_ready | 7 |
| bili-c06 | BV1Kx9aBPEMk | `6a2514c3-7100-4d9f-a885-8e7fc02e2864` | `f1a9a28b-24e3-4e17-84e7-2045b9088764` | `sha256:c18d81c44474df21f8b6117e453486dac853685d140429fd30c8d5d23c49f18b` | completed/discussion_ready | 3 |
| bili-c07 | BV1eiM26CEXR | `312df7f0-93c3-4a17-b175-c9875d3cc010` | `a79f75f7-db11-4548-8be9-827a65f96b81` | `sha256:d0ce371d29e2e8b772cdba219d687b1ca6cc82a334870c07a91bc86c9f8627a1` | partial/discussion_partial（bilibili_video_discussion_dom_not_ready） | 0 |
| bili-c08 | BV19HGM6VEJM | `76226506-ab5f-4c1a-a516-b4893a267fa0` | `96f27f00-f4b2-40fd-9c6f-09374e9a0c86` | `sha256:3d27fa1bcf97e15a25e37cd19cc51c8715ee07ec3602d0c537ccafbf6e8afe67` | completed/discussion_ready | 19 |
| bili-c09 | BV1bRQbBfE8i | `6decacc1-c9e7-443f-ac4f-9944f87cacfc` | `5e3b0163-b7f5-46a3-86a9-741f8a34c8f3` | `sha256:4338c2f28e8717215b7300a0f206bff60193ecfcd792472b54346c687aac02f3` | completed/discussion_ready | 20 |
| bili-c10 | BV1vV4y1L7YM | `c2b108ab-c099-46f0-bba8-841f08def06f` | `68fb887d-0b52-4f34-a455-3bc4ccfd397c` | `sha256:91831f1422a99289c5002de38a094f74b24943dbeb0a403465dde50ee79cb111` | partial/discussion_partial（bilibili_video_discussion_dom_not_ready） | 0 |
| bili-c11 | BV15cuw6XE5Z | `c41e03a9-df10-465a-8b86-328c78d5d712` | `2f5428b5-fda9-4b84-81b8-f70ffbc253d9` | `sha256:ede986727e1aa1d5e77953f6b15d6d2223e8b2d0c783310e56ea22d59531239d` | completed/discussion_ready | 20 |
| bili-c12 | BV16vQ6BGELf | `ea4b23a7-2af4-4774-bf38-204c1f41bfd1` | `657580f4-c2f5-421d-bd68-5c94876b2983` | `sha256:2975b77c8464366cbff157391e8667c2e756e0afc801d8b8417b4370f87843c8` | failed/work_tab_user_taken_over（work_tab_user_taken_over） | 0 |
| bili-c13 | BV1vNL36YEid | `58c05d93-9af5-410e-9ed8-3b1770fcbfbf` | `4d04506c-e971-452e-9fbe-2f165b3fc6f0` | `sha256:86a84e53d73c0c054aded2efcc66706ea9423ab49b3189789af829c41e152abc` | completed/discussion_ready | 20 |
| bili-c14 | BV1xNfnB2Ewe | `a1b64dfd-ac6b-4de5-a14a-5ce274e36db9` | `4c97bf9b-d52f-453d-9340-68bdc7a9d969` | `sha256:5b9dfc9e66e1ebfada8fcbcea51ae4edf2beaa0dc36df239f3cd48007bde2c28` | partial/discussion_partial（bilibili_video_discussion_dom_not_ready） | 0 |
| bili-c15 | BV1LZFezrEtZ | `de74fe10-fd8e-4add-9f17-edbfc3d53eda` | `2e5cb9b1-d6e1-4ff2-8e54-e670f74e55ca` | `sha256:d83333bf4549e88fe79bf485029b479e36f4f5257b8c9ba95be59618f13a5103` | completed/discussion_ready | 16 |
| bili-c16 | BV1E77C6aEJi | `08576220-1980-4bd7-9f69-6cc5f702f478` | `80894e20-438d-4121-be50-96d1f31ea4f7` | `sha256:4985cefd7243db0433f681393b35f379e575b19cfb8bf85e39e61de596f4d95a` | partial/discussion_partial（bilibili_video_discussion_dom_not_ready） | 0 |
| bili-c17 | BV1sbTU6AEAS | `e7a49ffa-4148-48c7-966c-a58372143561` | `878afb67-6e16-4521-8e40-6615d9591387` | `sha256:fe8abcc47cd57e958f4ab16d6a1aab26a249d00fbc3fa7a41c712b2342846506` | failed/work_tab_user_taken_over（work_tab_user_taken_over） | 0 |
| bili-c12 | BV16vQ6BGELf | `879507cd-a85b-4d12-949f-7a8e3198c0ad` | `e0909901-8236-4883-81c3-03ebff6cc2f9` | `sha256:33d4e11f215b37aacbf79e32029a9ca4f38c9a455f11347803e116206d66b1ff` | completed/discussion_ready | 20 |
| bili-c17 | BV1sbTU6AEAS | `b9116fac-277e-4f76-8a26-35d5193d1644` | `4383b1e9-3cbb-4ae1-bc6b-671e318ab366` | `sha256:2ff71b731174bb8e050556e7ceb9fc33ec60d232a0f7fec97c110b496a075ffa` | completed/discussion_ready | 20 |
| bili-c18 | BV1f1Gb67ESR | `b3e7ff24-9ee9-4f5f-a039-2601957bc64d` | `b98975d2-1365-4d0d-9566-7fd52248597e` | `sha256:0d25497e586ac490677ec1c9156892853b5b81820f5c68a0cdd5e52dfff248d4` | completed/discussion_ready | 20 |
| bili-c19 | BV1i64y1E7XG | `a157c25f-8bcd-43b0-a0d4-0087e7abf89f` | `8bbf874b-0cda-4719-b416-e573aae97f5b` | `sha256:d821e0e328de7ac45179edfdc4b5da8127560aa3cf8eb391bbaac103e594bc9c` | completed/discussion_ready | 4 |
| bili-c20 | BV1YY411W7Ss | `66e98899-9103-4828-ad40-57b1eb04ebf5` | `28fefd67-417a-4b21-8d6a-c54a3ea78946` | `sha256:e5b0217a531d19960f55cfefcf6c7e7acec28121dbbe09c1fde68b8b006d3e49` | completed/discussion_ready | 7 |

## 5. 小红书探针记录（平台前置条件不足，未读取笔记内容）

| 标签 | 查询意图 | Operation | Artifact | SHA-256 | 终态 | 错误码 |
| --- | --- | --- | --- | --- | --- | --- |
| xhs-s1 | 程序员提效 | `b2af07d4-9182-4498-ae40-e17996c73827` | `d1c3e1ec-e7e7-4f8e-9491-31d66e569d18` | `sha256:eb6ddb4e444867f0af796c6a03531093d5b375d9b9d16afb57fffa484def2d8a` | stopped/postcondition_unmet | xiaohongshu_explore_navigation_not_ready |
| xhs-s2 | 研发效能 | `708d339d-d907-4b0a-8997-bb274487787d` | `56841804-9e5a-40d2-b2cd-d645f0a01b73` | `sha256:1cdaa2bce079b7d39a8781bd200e112f73dfa09c3c20f0d55e559ef490da8ec0` | stopped/postcondition_unmet | work_tab_user_taken_over |
| xhs-p1 | 程序员提效 | `3b6a0250-e575-4174-bb12-d13fdd02c3d3` | `5be12f0e-a855-4949-9fdb-47d487c09ebe` | `sha256:9ac631c37447f137c0b4d3cc68d1d83721b8cab30e09eaf8d9da0024de984fa0` | stopped/postcondition_unmet | work_tab_user_taken_over |
| xhs-r1 | 程序员提效 | `d0b96b4e-0bff-425b-a880-f3d13464b37f` | `87dcee22-f6ed-4e68-acdf-6ff6584a888a` | `sha256:2ec2995b431845a36268b7c51ef928c3a9ee69b74198a806fb29198c31912e31` | stopped/postcondition_unmet | xiaohongshu_explore_navigation_not_ready |
| xhs-r2 | 程序员提效 | `dbf4f04e-81be-4813-ab58-b14bf2097da8` | `44e3e09e-10e2-47d6-b986-ef22e24a0e17` | `sha256:32cdb84bcf973b9668c70b8608e677f9a6904626d45c80206af48a58d7d5c8e2` | stopped/postcondition_unmet | xiaohongshu_search_execution_failed |
## 6. B 站详情 Operation 登记（去重后 103 个唯一 completed Artifact）

说明：`bili-d01..d47` 为第一批 46 个详情；`bili-x01..x47` 为字幕能力修复后的重跑；`sub-probe/sd/fix` 为字幕探针。下面只登记两类：6.1 拿到完整字幕全文的 27 个；6.2 首批 46 个详情的标签/BV/标题映射。其余探针与重跑详情可在 `raw/` 与 `summary/readable-bili-detail.md` 中复核。

### 6.1 含完整字幕全文的 27 个视频（schemaVersion=2，subtitle.captureStatus=captured）

| 标签 | BV | 标题 | 字幕分段数 | 字幕字符数 | Operation | Artifact | SHA-256 |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| bili-x01 | BV1zp421U7R3 | 互联网企业的研发效能提升实践 | 866 | 10992 | `90a7a365-d930-42ca-b8c1-b738e81bcc8d` | `9c527c57-3781-4bad-9054-d8cfc2973940` | `sha256:ad0abaa21a8efb0067ffacbe9aba419559e6bfdad1db07bbd91cd868bf2f1ad2` |
| bili-x06 | BV1Kx9aBPEMk | 从工具提效到组织升级：Qoder 在中小规模研发型企业中的 AI Coding 实践 | 642 | 6501 | `5bdb2eb3-a3e8-447a-aa1a-abd550d7d897` | `52b203ce-3b39-474a-84fa-b775eb60d2ba` | `sha256:4f720fa4491cb55e23e3254f623c89ff85a5e23513a5263b6d974d267d680108` |
| bili-x08 | BV1eiM26CEXR | 代码生成越快，交付却变慢了？效率瓶颈原来不在写代码本身 | 159 | 1857 | `200b043b-4beb-4e27-9a27-505096ef0e5c` | `8c7ce0b4-f6e2-46f6-8a66-7917604177d0` | `sha256:ebdf1211dbf7027de9f4f90fe595dc445af2afe7e741f979c730cee4e69dd3b5` |
| bili-x09 | BV19HGM6VEJM | 以弱胜强! 为什么需要开发属于自己的AI工具？ | 777 | 8955 | `a04bb34c-8404-4423-8ed1-2cac0c1faef7` | `171b418b-2cbc-4b74-97a3-aad307e3329d` | `sha256:df201d3e2781bee022449b2952343c9c428a45f56116ac2c09731d3ef5a417fe` |
| bili-x10 | BV1bRQbBfE8i | 为什么没人愿意改革工具？ | 94 | 1037 | `97845177-85ff-48c6-a475-180fdd84303d` | `cb27dff0-8625-420e-83d8-1ff3fac617e2` | `sha256:4c1203a6b9776b7849f3a5273d94e5322aada67098bf6dc6b156ef3c0492ba09` |
| bili-x11 | BV1vV4y1L7YM | 为什么知识库内容没人用？ | 122 | 1299 | `b8f2f725-b237-4b2a-947a-a804d99c08bc` | `676af0c1-0796-43f3-8fcc-96ccb2555629` | `sha256:3aed0587f295e65a2e17ffe208df33f6a59dc4571c572a2a2468a154ca598ae4` |
| bili-x13 | BV1ZZAFzWEPJ | 我开源的 AI PPT 工具 37000 星了：PPT-Master 作者完整用法演示 | 451 | 5206 | `2273bf58-b526-4ced-88e3-e6e69fe23b73` | `55883be9-37f9-4629-b639-ca3b7ede4eb5` | `sha256:f67c770cc4705d3a1405f491fd44dbc6f7930f72d885faa188faec41cd4a66c7` |
| bili-x15 | BV1TkN26fEqY | 爆肝一个企业级开源DataAgent！！支持28种数据源，统一语义，Trace可审计可追溯！ | 145 | 1972 | `7c584092-04e3-4831-89b5-60bd69a95e64` | `ce0be655-264a-495d-a56b-a8034fb190f0` | `sha256:e9c7ee0e2a543c52fcbb1844f5aac05a0f8a37d9861f77426c68a5fe09e40b63` |
| bili-x16 | BV1vNL36YEid | 90%代码由AI生成！美团31万行代码重构实践阅读 —— 约束AI才是系统关键 | 814 | 9814 | `ca65679c-8775-4e6d-88ee-a42708a5ee07` | `a6510831-614d-45bd-9d34-5f6a96ca9400` | `sha256:87fb3502287321991b374c5efbf2cf5c149dc1f9f03d3c7968432b5270741637` |
| bili-x17 | BV1xNfnB2Ewe | 人机协作的新型AI开发范式——学习得物团队的AI编程最佳实践分享 | 522 | 6237 | `8aae3c5b-ae7e-4423-a516-023cd664af86` | `37633dca-9676-4796-80d1-0149efd892a2` | `sha256:6f99733e5750003cd7e2aefaa1f64ca13831757715cc0fe0c4b9b9213cde8064` |
| bili-x18 | BV1LZFezrEtZ | AI编程效率翻倍！Claude团队的10个内部技巧 | 466 | 6092 | `12f92b5e-8a9e-4111-8c7d-9a20c99df370` | `0957677b-e06d-4784-8453-c184064d5290` | `sha256:53639aa07abf2a5e71bf4f4c1c3b0357cde755b8ab827941094641cb29b298c0` |
| bili-x19 | BV1E77C6aEJi | 团队 AI 落地方法论：Spec 规范 + CR Skill 沉淀，把经验变成流水线能力，AI提效不只是工具是体系，打造 | 180 | 2077 | `46eaf4f4-abaa-4f97-babb-af168e97038c` | `761bdd7f-6f1f-4a54-94e0-3229f02d21ee` | `sha256:9e4947173b65f60f941d2952422459ed8db47298704af8d48dd931718246f9a6` |
| bili-x21 | BV1f1Gb67ESR | 我就问你，你们有啥都不懂的领导用ai写代码，然后我们给他擦屁股的吗？#程序员 #打工牛马＃职场 #seko #seko  | 217 | 2283 | `5ffacf8e-1af4-4454-8f98-1afd75084eba` | `4e405487-3322-406d-9679-30a273d87420` | `sha256:5afebfededd5ee6ed29004b4021c53b799bfe940d645cee52decd85b25ed8926` |
| bili-x23 | BV1i64y1E7XG | 不止会写代码，工程师的自我迭代——如何与组织一起成长 | 1236 | 13810 | `ed36e3dd-b4da-47c5-a199-5cb46ad1104f` | `172a2b51-d871-4c80-b1be-6724c1f11532` | `sha256:3bfb06bf3aa4260b9ea84b6c0fb64e7d18b8c9ceb8a144f6d8310b669328f1f7` |
| bili-x29 | BV1Hpp9eTE1N | 手把手教你做产品经理：需求评审流程及注意事项 | 423 | 4914 | `6d1f1bb5-69de-43e8-a141-a5d588714230` | `f4d3bc3b-8f53-4ce3-a8af-050fe6ec6bf4` | `sha256:50a6fc3b6f783abd3e254a13a60e38ab4e726430fe513bd58a178323efd98cce` |
| bili-x30 | BV1ZN7A67Exg | 人类与人工智能协作开发中架构决策记录 (ADR)、产品需求文档 (PRD) 和行为驱动开发 (BDD) 等核心工具能为复 | 201 | 2121 | `b8a82722-800f-44e4-91dc-62461d23c702` | `aa33a47e-ea60-4a33-837f-e7f66c0f5548` | `sha256:bab409fa06ed6b53c4ab6a0c6f12d2661c2e928ffbd0aba9d9b94a907acd73f7` |
| bili-x31 | BV1RT2FB6EXY | 分享一个挖掘用户需求的方法 | 71 | 819 | `8cb42cf7-531a-4cf8-a96c-69d5e2b4792d` | `821d0b98-bf84-4ca0-94ec-b28ed1063f4f` | `sha256:40875f4a50e99c586081b773ef37da72820bc1889eb3ab437227a7701f4fe9a6` |
| bili-x32 | BV1ffTL6YEXj | Loop Engineering落地实践 提高项目测试效率 测试 -> AGENT -> 研发 | 444 | 5730 | `74a102c7-9329-4e00-98c1-ec5461002f79` | `5efd688b-c476-4a58-871a-a210e972d005` | `sha256:cef10a8d71f4e2b7fb5c4900f5f4bb50a23b8dd72377d81e2c6c5616f94dfbb6` |
| bili-x33 | BV1HgjEzjEac | 1-Multi Agent驱动的UI自动化测试新范式- 繁珏 | 829 | 10502 | `9368832c-76b6-4580-93ce-f137bab77c84` | `435e200c-2a7d-48cd-b804-0ece0da56130` | `sha256:4293c843fe2c001bc3fcc5f0870e58acc1cee557624b1d6e182b1544e99f5353` |
| bili-x34 | BV1AQAfzeEQh | 自动化测试，别再瞎设计搭建框架了，大厂都在用的测试框架设计，从0到1搭建企业级测试框架，看完直接落地！ | 2545 | 28901 | `fabb995f-74c4-4998-93a0-1ea5e4933e77` | `6ef0ec16-b3be-40a3-96d2-41762f2e2911` | `sha256:5ad0ce820de3fe921f8652a78616c71bc86bcdd5043da4f75b307c22728e26d8` |
| bili-x35 | BV1AGRtBnE3S | 别手动写测试用例了!2026最新Claude Code+Skills实现需求文档生成全量用例｜全流程AI驱动软件测试落地 | 362 | 4278 | `1c1a72c7-112b-4417-b5ac-586df1c4f657` | `ebc6af3a-2616-4ccc-a32c-c4a7551a7345` | `sha256:9c55eeb79e6f7e7618c7bc6aefac6c9320e52e899cae093b3fe9621394527438` |
| bili-x36 | BV1u5Ej6CEb6 | 【2026最新版】AI+自动化测试从入门到精通,从基础认知到源码项目,手把手带你落地 | 30 | 404 | `0e4093b2-a7c7-4caa-b12f-dac1395f3a61` | `c39aabb2-36c6-48c9-a350-18c048627803` | `sha256:a1dba635f40bf6177e92ec2ec943e455a82a196d626930e31482566a51597200` |
| bili-x37 | BV1otokBpENn | 【大模型RAG】2026年B站最全最细的RAG知识库搭建系统教程，手把手教你搭建私有知识库，从入门到实战全流程教学！全程 | 522 | 5864 | `56e437a9-c9ae-483b-8109-bf77638f30fa` | `f5c6a2f0-5930-4f21-acdc-4551caec0dfd` | `sha256:88e3f8ad6b3d5f52aecc8aeac26237e7543494be3510f9598d85bf0e9aa4d605` |
| bili-x38 | BV1JiL3zpEHd | 企业知识库搭建三步法 | 180 | 2254 | `328825ad-a934-4001-83e2-c6ad5ade5da5` | `e81deb43-1def-4c1e-a396-3a26f7ac8370` | `sha256:e77f411618caf41bd3c80f01bc3b4fea8f57cb4ae5f08796003347ded65d58f5` |
| bili-x41 | BV1dyg96ME4q | 如何用AI重构老项目，让老项目可以融入AI工作流 | 505 | 5693 | `6ca1230c-367c-4366-bdce-1c44bdc5057a` | `497977f2-0cd5-45ee-bc91-ea7c1d2504d2` | `sha256:69420febae03782cb144608cb818b949343037f694bd25c28542d85f077b7d37` |
| bili-x42 | BV1vaN56LEhf | 电商人狂喜！Codex+skills一个人成一个团队 | 246 | 3015 | `892b8b9e-73f4-4d13-a18c-ef875b061eb6` | `c591b852-441e-4711-adb8-c21551572182` | `sha256:ff79672035e55adf69411fabe3dc432803bb7657aa151b41a6e8d38b13e45355` |
| bili-x43 | BV1kEm8BBEwm | 程序员如何用ai提升能力：大厂程序员的建议 | 208 | 2513 | `4f9ad145-5a46-4ef4-bf27-58ce75858c86` | `9f01db95-4244-4fea-83c5-9890f5d7ed7f` | `sha256:dc0c91ff7cec630db30da758689ded52fa21f281f126dfee73bd7b300633e4b3` |

### 6.2 首批 46 个详情（bili-d01..d47，含标题与选择理由）

| 标签 | BV | 标题 | 说明（描述/标签摘要） |
| --- | --- | --- | --- |
| bili-d01 | BV1zp421U7R3 | 互联网企业的研发效能提升实践 | 从涵盖组织模式、工具链建设、流程再造等多个维度，实现业务效能的整体提升。（标签：华为、课程、科技、知识、研发效能、软件分享） |
| bili-d02 | BV16K411v7dU | 小米集团信息技术部：面向多业务的研发效能体系建设与实践 | 业务急剧扩张，人员急速增长，管理压力加大？想要将研发效能大幅提升难上加难？ 来听小米集团——信息技术部（ MIT），项目经理骆晓然，分享 MIT 如何通过拉齐标（标签：科技、小米、知识、项目管理PMP、软件应用、案例分析） |
| bili-d03 | BV1mvQzBpED3 | AI工具落地与规模化应用实现企业效能提升 | （标签：人工智能、学习、AI、企业赋能、企业、工具） |
| bili-d04 | BV1mW4y1B7GM | 国内外互联网大厂是如何度量研发效能的？｜研发管理大师课 | 一堂课，手把手教你搭建研发效能度量体系（标签：教程、研发管理、研发效能、项目管理、办公技巧、科技猎手计划2022第三期） |
| bili-d05 | BV1E8411m77j | 软件企业自研低代码平台思路-非产品化，优先解决自身研发效能问题 | 软件企业自研低代码平台思路-非产品化，优先解决自身研发效能问题（标签：软件、编程、低代码平台、研发、IT行业） |
| bili-d06 | BV1Kx9aBPEMk | 从工具提效到组织升级：Qoder 在中小规模研发型企业中的 AI Coding 实践 | （标签：AI、团队提效、Qoder、AI Coding实践） |
| bili-d07 | BV1Rt9YBDERe | 传统研发的 AI 化转型：从 AI 原生工程到 AI 原生团队 | （标签：AI、人工智能、Qoder） |
| bili-d08 | BV1eiM26CEXR | 代码生成越快，交付却变慢了？效率瓶颈原来不在写代码本身 | AI 生成代码越来越快，但很多团队的交付速度反而被卡死了？你以为的瓶颈，其实压根就不是瓶颈！本期用 GitHub 和 Cloudflare 两个真实工程案例把这（标签：AI、人工智能、研发效能、Stacked PR、流程、编码） |
| bili-d09 | BV19HGM6VEJM | 以弱胜强! 为什么需要开发属于自己的AI工具？ | （标签：数学、人工智能、学习、AI、计算工具、计算） |
| bili-d10 | BV1bRQbBfE8i | 为什么没人愿意改革工具？ | （标签：HOTO、工具革命、工具、HOTO小猴） |
| bili-d11 | BV1vV4y1L7YM | 为什么知识库内容没人用？ | 大部分知识管理实施和知识库搭建的机构其实低估了这件事情的难度，并且容易将知识管理等同于管理知识，将知识等同于文档。 知识库和知识管理的软件系统很容易买，存一些内（标签：知识管理系统、田志刚、知识库软件、KMCenter、问题端、田志刚知识管理） |
| bili-d12 | BV15cuw6XE5Z | 关于因为找不到好用的 SSH 终端所以自己做了个然后开源出来这档事｜Devlog · 24 | 关于因为找不到好用的 SSH 终端所以自己做了个然后开源出来这档事｜Devlog · 24 Made with Flutter 了解更多关于 MaidKit 和（标签：人工智能、生活记录、编程、记录、SSH、工具推荐） |
| bili-d13 | BV1ZZAFzWEPJ | 我开源的 AI PPT 工具 37000 星了：PPT-Master 作者完整用法演示 | github 仓库地址：https://github.com/hugohe3/ppt-master atomgit 仓库地址：https://atomgit.c（标签：AI生成PPT、PPT-Master、开源、PPT制作、Kimi、AI工具） |
| bili-d14 | BV16vQ6BGELf | 我做了一个更自由的开源效率工具：ZTools | Github：https://github.com/ZToolsCenter/ZTools 欢迎大家和我一起共建（标签：黑科技、软件、Mac工具、vibecoding、开源、免费） |
| bili-d15 | BV1TkN26fEqY | 爆肝一个企业级开源DataAgent！！支持28种数据源，统一语义，Trace可审计可追溯！ | 熬了几个大夜，爆肝了一个企业级的开源DataAgent，欢迎宝子们围观，并一起构建交流！ 详情大家可以在链接中查看并支持哦： github链接：https://（标签：程序员、编程、编程开发） |
| bili-d16 | BV1vNL36YEid | 90%代码由AI生成！美团31万行代码重构实践阅读 —— 约束AI才是系统关键 | 今天和大家分享近期美团公众号发布的AI编码实践经验的阅读，一起学习进步。欢迎沟通交流. V: Web3SecTc Git: TangCYXY（标签：AI、人工智能、得物、AI CR、约束、美团） |
| bili-d17 | BV1xNfnB2Ewe | 人机协作的新型AI开发范式——学习得物团队的AI编程最佳实践分享 | 今天和大家分享得物团队之前的AI编程相关经验的技术分享，欢迎沟通交流。 Git: TangCYXY Email: tc9926271333@gmail.com（标签：AI、人工智能、实践经验、得物、claude code、编程范式） |
| bili-d18 | BV1LZFezrEtZ | AI编程效率翻倍！Claude团队的10个内部技巧 | 本视频介绍 来自Claude Code 官方团队分享的10 个 AI 编程技巧 1、使用 git worktree 并行开发 2、复杂任务多用 Plan 模式 （标签：claude、AI编程工具、AI编程技巧、AI编程） |
| bili-d19 | BV1E77C6aEJi | 团队 AI 落地方法论：Spec 规范 + CR Skill 沉淀，把经验变成流水线能力，AI提效不只是工具是体系，打造团队的AI提效引擎 | （标签：人工智能、AI、提效、智能体、前端、前端开发） |
| bili-d20 | BV1sbTU6AEAS | 团队AI编程提效-实际效果远低于预期 | 团队AI编程提效-实际效果远低于预期（标签：AI、人工智能、AI软件工程、大模型、AI编程） |
| bili-d21 | BV1f1Gb67ESR | 我就问你，你们有啥都不懂的领导用ai写代码，然后我们给他擦屁股的吗？#程序员 #打工牛马＃职场 #seko #seko 全能模式 | -（标签：职场、程序员、AI、打工牛马、互联网、领导） |
| bili-d23 | BV1i64y1E7XG | 不止会写代码，工程师的自我迭代——如何与组织一起成长 | 🧬AGI 时代，挑战与机遇并存。每个技术人都一直在思考“如何与组织一起成长”，实现成就公司与个人成长的双赢。 🧬作为一名工程师，如何不断迭代自己的技能和知识（标签：组织、人工智能、技术、自我迭代、团队合作、个人成长） |
| bili-d24 | BV1YY411W7Ss | 【新人必看】真实项目开发的难点：需求 / 团队 / 工期…… | 问：刚入行的程序员，如何才能装得像个老鸟的样子 答：很难！但如果你能在接到需求之后先琢磨点时间，再提出一两个问题，人家一定会高看你两眼…… 对一个项目而言，新人（标签：软件工程、开发、编程、真实项目、大飞哥、一起帮） |
| bili-d25 | BV11qBkYAECT | 什么是程序员的第一效率杀手【让编程再次伟大#23】 | -（标签：程序员、计算机、学习、编程、让编程再次伟大、交流） |
| bili-d26 | BV1ka4y1Q7J1 | 我终于悟了！原来用户痛点是这样被挖掘的！ | -（标签：创业、需求、商业思维、用户痛点、用户洞察） |
| bili-d27 | BV1QZDLBxENe | 项目管理核心思维 + 需求变更管理 | 做项目总被需求变更搞崩？核心思维没吃透，再忙都是瞎忙！ 干货学习圈限时开放！👉 地裘呺：qh202522备注：小破站【67】，带你进圈高效进阶！（标签：职场、学习、项目管理思维、PMP、项目、管理） |
| bili-d28 | BV1SyRdYQEva | 跨部门沟通与协作 | 公司跨部门工作有时会出现鸡同鸭讲，沟而不通，导致合作失败的局面。因此，为了顺利实现彼此的共同目标，必须加强跨部门沟通与协作。本课程将针对跨部门沟而不通的原因进行（标签：知识、职场、技巧、学习） |
| bili-d29 | BV1Hpp9eTE1N | 手把手教你做产品经理：需求评审流程及注意事项 | 1、需求评审的流程 2、参与评审的角色 3、需要注意的事项（标签：需求评审、互联网、产品经理） |
| bili-d30 | BV1ZN7A67Exg | 人类与人工智能协作开发中架构决策记录 (ADR)、产品需求文档 (PRD) 和行为驱动开发 (BDD) 等核心工具能为复杂的代码逻辑提供清晰的意图解释 | 人类与人工智能协作开发中架构决策记录 (ADR)、产品需求文档 (PRD) 和行为驱动开发 (BDD) 等核心工具能为复杂的代码逻辑提供清晰的意图解释（标签：context engineering、智能体、BDD、Hermes、skill、ARD） |
| bili-d31 | BV1RT2FB6EXY | 分享一个挖掘用户需求的方法 | 分享一个用数据找灵感和验证用户需求的方法，帮你发现那些有真实流量却被忽视的机会，避免在“伪需求”上浪费时间（标签：产品需求、灵感、独立开发、互联网、用户需求、需求） |
| bili-d32 | BV1ffTL6YEXj | Loop Engineering落地实践 提高项目测试效率 测试 -> AGENT -> 研发 | 今天和大家分享最近很火的loop engineering的的落地实战和讨论，最终对项目测试的过程进行效率提升。一起学习进步。欢迎沟通交流. V: Web3Sec（标签：AI、claude code、Loop Engineering、github、issue、skills） |
| bili-d33 | BV1HgjEzjEac | 1-Multi Agent驱动的UI自动化测试新范式- 繁珏 | 繁珏，美团高级技术专家 2016年加入美团，现负责搜索推荐质量保证、专项测试工具开发与优化，以及研发效能改进等工作。 分享议题：《Multi Agent 驱动的（标签：测试） |
| bili-d34 | BV1AQAfzeEQh | 自动化测试，别再瞎设计搭建框架了，大厂都在用的测试框架设计，从0到1搭建企业级测试框架，看完直接落地！ | （标签：计算机、编程、测试技巧、自动化测开、自动化、框架） |
| bili-d35 | BV1AGRtBnE3S | 别手动写测试用例了!2026最新Claude Code+Skills实现需求文档生成全量用例｜全流程AI驱动软件测试落地方案,测试效率翻10倍！ | 全栈课一共分为6大块内容 第一块：AI智能体开发基础(AI大模型、工具、记忆、MCP、中间件、Skills等核心内容) 第二块：Claude Code,Trea（标签：AI、测试、软件测试、Python、自动化测试） |
| bili-d36 | BV1u5Ej6CEb6 | 【2026最新版】AI+自动化测试从入门到精通,从基础认知到源码项目,手把手带你落地 | 勉费领取视频全套资料/文档/学习笔记点击：https://www.bilibili.com/read/cv38114879/?jump_opus=1（标签：程序员、AI自动化测试、性能测试、软件测试、Python、AI测试） |
| bili-d37 | BV1otokBpENn | 【大模型RAG】2026年B站最全最细的RAG知识库搭建系统教程，手把手教你搭建私有知识库，从入门到实战全流程教学！全程干货！少走99%的弯路！ | 【大模型RAG】2026年B站最全最细的RAG知识库搭建系统教程，手把手教你搭建私有知识库，从入门到实战全流程教学！全程干货！少走99%的弯路！（标签：人工智能、AI、langchain、检索增强生成、大模型RAG、RAG知识库搭建） |
| bili-d38 | BV1JiL3zpEHd | 企业知识库搭建三步法 | 知识库不是企业云盘，随意堆放知识无法发挥价值！真正高效的知识库需要：明确业务场景、精准检索机制、持续更新迭代。影刀AI Power助您构建智能知识库，让大模型成（标签：学习、I智能体大语言模型、企业、知识库） |
| bili-d39 | BV1Uz4y187Eb | 文档管理系统推荐！简化你的文档管理｜知识管理｜知识库 | 项目管理、任务管理、日程管理、项目管理工具、项目管理软件、研发管理、需求管理、测试管理、敏捷开发、效能度量、知识管理、文档管理 适用于团队及个人知识管理五款软件（标签：职场、文档管理、知识管理、软件分享、团队协作、管理系统） |
| bili-d40 | BV1KcT16RE4V | 企业级知识库经验分享（LLM Wiki vs RAG） | 企业知识库不是把文档扔进向量数据库，也不是接一个大模型聊天框。它本质上是一套知识生产、知识治理、知识检索、知识消费和反馈修正的系统工程。 我对企业知识库的判断是（标签：生活记录、fastgpt、mineru、Docling、LLMWIKI、Obsidian） |
| bili-d41 | BV1dyg96ME4q | 如何用AI重构老项目，让老项目可以融入AI工作流 | 当有真实的需求出现，那么就要有对应的拆解和落地思路。视频主要分享团队或者个人想对有一定规模化老项目（传统开发的项目）进行重构，以便接入AI工作流进行提效的方法。（标签：人工智能、AI、编程、AI重构、团队协作、AI编程） |
| bili-d42 | BV1vaN56LEhf | 电商人狂喜！Codex+skills一个人成一个团队 | -（标签：AI、干货、电商、跨境电商、干货分享、大模型） |
| bili-d43 | BV1kEm8BBEwm | 程序员如何用ai提升能力：大厂程序员的建议 | （标签：AI、程序员、编程、RD280U、#程序员礼物） |
| bili-d44 | BV1BEd3BNEze | 复杂多模态应用，吃透 Harness，AI编程落地提效必看 | 截至26年4月，最火的几个AI 新词 【理念】 Harness 【工具】 images 2.0 【模型】seedance 2.0 这期视频，我们就尝试把这些AI（标签：Cursor、AI换装、fitcheck、vibe coding、Seedance、images 2.0） |
| bili-d45 | BV1ZU5T6XE3y | 从个人提效到组织进化：Qoder在中小团队中的AI Coding实践 | （标签：人工智能、AI Coding、Qoder） |
| bili-d46 | BV1eADaBME5z | Claude Code: 从零搭建你的 AI 工作团队（Skills + Agents）｜ 回到Axton | （标签：AI、Microsoft、Google、ChatGPT、OpenAI、GPT） |
| bili-d47 | BV1C8Kh6yEB7 | AI 为什么每次都从零开始？如何让AI帮你完成一个完整项目【ChatGPT、Claude code等Agent通用】 | 模型能力一直在升级，但它不会因此自动理解你的项目目标、历史决定和工作方法。 模型能力决定它能做什么；项目上下文决定它为什么做、该怎么做。 这期我从一份最小的项目（标签：AI、AI Agent、AI IN ALL!、Claude code、独立开发、HERMES） |

## 7. 平台受限与失败事实登记（不伪装为“无结果”）

| 类型 | 数量 | 说明 |
| --- | --- | --- |
| 小红书 `xiaohongshu_explore_navigation_not_ready` | 1 | 绑定无已打开公开 Explore 页 |
| 小红书 `work_tab_user_taken_over` | 1 | 扩展工作标签被占用/关闭 |
| 小红书 `xiaohongshu_search_execution_failed` | 1 | 搜索执行失败，`queryEchoed=false` 等运行期限制 |
| B 站 `work_tab_user_taken_over` | 14（含搜索/详情/讨论） | 用户重启/浏览器状态后恢复，重跑成功 |
| B 站 `bilibili_verification_required` | 1 | 触发平台验证码，按规则不解锁、不绕过，等待用户 Console 人工解锁 |
| B 站详情字幕 `menu_unavailable` | 3 | 字幕面板不可用（x02/x07/x24） |
| B 站详情字幕 `transcript_timeout` | 2 | 字幕转录超时，partial=true（x12/x44） |
| B 站详情无字幕 `player_unavailable` | 3 | 播放器不可用（x45/x46/x47） |
| B 站评论区 `bilibili_video_discussion_dom_not_ready` | 4 | 评论区 DOM 未就绪，partial，未重跑或重跑未完成 |
| `submission_conflict` | 若干 | 同一 binding 并发提交导致 409，串行化后重跑成功 |

## 8. 原始数据位置

- 原始 Artifact JSON：`runtime/research-pain-points-2026-08-07/raw/`（operation/artifact/sha256/chunks）
- 操作台账：`runtime/research-pain-points-2026-08-07/summary/operations.jsonl`（244 行）
- 可读解析：`summary/readable-bili-search.md`（328 卡片）、`summary/readable-bili-detail.md`（详情投影）、`summary/readable-zhihu-web.md`、`summary/classified-zhihu-web.md`（480 条分类）
- 任务文件：`runtime/research-pain-points-2026-08-07/tasks/phase*.json`