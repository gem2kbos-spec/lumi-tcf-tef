# 用户题库导入

把整理后的题目写入 `questions.json`。数组顺序会被保留；也可以显式设置 `order`。

每题字段：

- `id`：稳定且唯一的编号
- `type`：`grammar`、`vocabulary` 或 `reading`
- `level`：`A2` 或 `B1`
- `topic`、`skill`：主题和可合并统计的考点
- `passage`：阅读原文，其他类型使用空字符串
- `audioText`：兼容字段，固定使用空字符串
- `prompt`：问题
- `options`：四个选项
- `answer`：正确选项位置，从 0 开始
- `explanation`：解析
- `order`：可选，原题由易到难的顺序

用户提供材料后，应先转写、去重、校对答案并运行验证，再放入正式题库。不要在未经授权的公开仓库中提交受版权保护的原题内容。
