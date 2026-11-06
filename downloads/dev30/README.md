# 续在 STILLHERE dev.30 — 视频与声音本地自动转写

[下载完整Windows x64运行包（约100MB，内置识别模型）](https://raw.githubusercontent.com/Huangxiting123/huangxiting123.github.io/stillhere-downloads-dev30/downloads/dev30/Stillhere-dev30-Windows-x64.zip)

[本轮功能验收目录 C01—C14](Stillhere-dev30-acceptance.md) · [SHA256校验](Stillhere-dev30-SHA256.txt)

停止旧版，完整解压运行包，双击“启动本机版.cmd”，用新打开的地址和原凭证登录。原素材库保留；请不要只替换网页文件或删除runtime/asr。

素材库选择视频/录音 → 整理/校对入库 → 勾选本机转写同意 → 自动转写声音 → 纠正错字 → 保存校对稿并确认片段入库。

无需云端转写密钥、朗读服务或通话身份。转写已保存素材无需再开设备。识别只在运行软件的电脑上完成，不向外部推理服务上传。每条最多65秒，当前按中文识别；方言、人名、数字和时间须本人校对。原视频不变，自动结果只是待校对稿，不是自动训练或事实认证。

完整包内置官方Node v22.23.4、官方sherpa-onnx v2.0.1与多语言Whisper tiny int8。许可证、来源与SHA256在包内。145项Node测试及真实中文音视频本地模型、浏览器验证通过；Windows与iPhone实机待用户按目录验收。

WAV、WebM/Opus和MP4/AAC链路已验证。长素材后40秒才有声音仍可识别。支持关闭整理取消与版本冲突保护；已入库稿不可自动覆盖。暂未接入专属声音/形象训练及完整数字人视频通话。

此独立下载分支不修改main网站，也不包含个人资料、访问凭证或服务密钥。
