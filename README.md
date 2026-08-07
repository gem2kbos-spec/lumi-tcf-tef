# Lumi TCF · TEF AI Trainer

面向 TCF Tout Public 与 TEF A2–B1 阶段的自适应训练应用。两个考试共用能力档案，覆盖听力、阅读、语言知识、写作和口语入口。

默认备考路径是法国留学预签证 / DAP：TCF Tout Public 的听力、语言结构、阅读和必考书面表达。

## 启动

```bash
cp .env.example .env
npm start
```

打开 `http://localhost:3000`。没有配置 API 密钥时，应用会自动使用内置题库，全部训练和错题功能仍然可用。

如需 AI 动态出题，在 `.env` 中填写 `OPENAI_API_KEY`，然后启动：

```bash
npm start
```

API 密钥仅由服务端读取，不能提交到 Git。默认模型可通过 `OPENAI_MODEL` 修改。

## 第一版范围

- TCF 风格的词汇与语法四选一练习
- 日常通知、邮件、行政信息、叙述、说明和观点文本阅读
- TCF / TEF 听力一次播放训练
- 两类考试的写作任务与口语情境专项
- TCF / TEF 考试中心和全部题型入口
- 连续单题随机训练：每题提交后立即显示正误与解析
- 最近题目短期去重，不再按固定题组结束
- 独立考试蓝图约束 A2/B1 范围、篇幅、技能与材料类型
- A2 / B1 难度和每组题数选择
- OpenAI Responses API + JSON Schema 结构化生成
- 无密钥自动降级为精选本地题库
- 自动批改、法语解析、错题持久化
- 一键错题复习，答对后自动移出待复习列表
- 正确率、连续学习天数与薄弱知识点统计
- 数字键答题、Enter 切换下一题的快捷操作
- AI 请求失败时自动回退，不中断训练
- 服务端不向浏览器泄露答案

## 项目结构

```text
public/                 网页界面
server/index.js         HTTP 服务和 API
server/ai-generator.js  AI 出题与输出约束
server/question-bank.js 内置题库
server/tcf-blueprint.js TCF 范围与出题约束
server/store.js         学习记录和统计
test/                   自动测试
```

## 测试

```bash
npm test
```

## 下一阶段

阅读理解、听力音频、用户账户、间隔复习、完整模拟考试和云端数据库将在后续版本加入。
