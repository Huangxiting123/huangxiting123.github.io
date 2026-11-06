# 续在 STILLHERE dev.31 — 转写准确性专项

[下载完整Windows x64运行包（448MiB）](https://github.com/Huangxiting123/huangxiting123.github.io/releases/download/stillhere-dev31/Stillhere-dev31-Windows-x64.zip)

[功能验收目录 D01—D08](Stillhere-dev31-acceptance.md) · [公开样本对比及局限](Stillhere-dev31-benchmark.md) · [SHA256](Stillhere-dev31-SHA256.txt)

完整包内置中文通用与川渝方言Paraformer模型。普通话或带四川口音的普通话先试第一项，四川话/重庆话再试第二项。未入库素材可切换模型复测，并查看上次识别结果。按停顿分段、低音量补偿与收音提示；没有大模型润色，也不承诺所有用户录音都改善。

停止旧版、完整解压新版，用新版启动本机版.cmd启动。旧素材和凭证保留。不要只刷新旧版网页。无需密钥或云端上传，识别结果仍需校对。

149项Node测试及真实音视频/双模型/历史/取消/版本保护验证通过，Windows与实际用户录音待验收。公开6段川渝样本CER明显降低，但不是客户准确率证明。详见报告与验收目录。

parts文件用于GitHub发布流水线校验重组，客户只需下载Release中的完整ZIP。此分支不修改main网站，不含用户素材、凭证或服务密钥。
