# 续在 STILLHERE dev.32：本人信息与声音对话原型

[下载完整Windows x64软件包（约448MiB）](https://github.com/Huangxiting123/huangxiting123.github.io/releases/download/stillhere-dev32/Stillhere-dev32-Windows-x64.zip)

[功能验收目录 E00起](Stillhere-dev32-acceptance.md) · [SHA256](Stillhere-dev32-SHA256.txt)

目标测试设备：用户提供的16GB内存＋RTX3060Ti。请先停止旧版、完整解压。先从 https://ollama.com/download/windows 安装Ollama，再运行包内“安装本地对话与声音模型.cmd”。需预留至少15GB并首次下载数GB模型/依赖；本软件包不含Qwen对话与声音权重。完成安装后重新启动主程序。

“我的分身”入口支持：明确确认私有事实记忆，单独确认表达示例，选本人5—15秒清晰声样和准确原文，授权后对回复做参考声音生成。可撤销声样、清除表达示例；不会把示例当成新经历，也不使用预设音色假装本人声音。文本默认CPU、声音CUDA，原素材保留。

这是本地原型，不是已完成真实声音验收的产品。154项Node、3项Python协议与浏览器模拟服务测试通过；真实Qwen推理、Windows安装、3060Ti显存/速度及声音相似度均需用户按验收目录实测。没有宣称用模拟音频验证了声音复刻。

先验收E00安装，再分别评价事实是否记住、表达方式是否相似、音色是否相似。尚无实时语音或数字人视频通话；本轮不是微调或重新训练。

独立下载分支不修改main网站，不包含个人素材、访问凭证或服务密钥。parts仅用于发布流水线，用户下载Release中的完整ZIP即可。
