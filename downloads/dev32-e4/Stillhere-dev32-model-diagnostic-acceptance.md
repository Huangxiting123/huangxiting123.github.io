# dev32-E4 本机文字模型检查

当前HTTP500未能确认模型文件缺失。旧分类把某些运行组件“not found”也当成模型缺失，本补丁收窄分类并提供独立固定测试。

1. 在软件启动黑窗口按Ctrl+C停止服务。
2. 将ZIP解压到原软件目录，覆盖同名文件；与runtime文件夹在同一层，不是E盘模型库目录。
3. 双击“检查文字模型.cmd”。本工具启动自己的本机Ollama，使用已配置模型目录，以固定公开句子测试CPU推理，最长等待约3分钟；不自动下载、不删除模型、不读取个人记忆/声样/访问凭证。
4. 完成后窗口保留，并在原软件目录生成Stillhere-model-diagnostic.txt。提供该文件内容或黑窗口检查结果即可，不需要截图含凭证的原启动窗口。

## 验收目录
|编号|检查项|
|---|---|
|D01|显示Ollama executable和Model directory，确认模型目录是E盘原有ollama-models。|
|D02|Target model listed应为true；false表示当前配置库未列出该模型，报告后再处理，不自行删除文件。|
|D03|若Chat HTTP为500，Ollama error会显示固定测试的实际错误。若成功则显示TEXT_INFERENCE_OK。|
|D04|生成Stillhere-model-diagnostic.txt，报告不包含所有者凭证、个人记忆和声样。|

开发验证：3项Node诊断测试与6项Python桥接测试通过；真实Windows及模型推理仍待检查。此包用于确定故障原因，不保证直接修复所有HTTP500。
