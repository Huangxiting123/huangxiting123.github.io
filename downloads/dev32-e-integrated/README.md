# dev.32 E盘修复整合版

[下载完整整合包（约448MiB）](https://github.com/Huangxiting123/huangxiting123.github.io/releases/download/stillhere-dev32-e-integrated/Stillhere-dev32-E-drive-integrated-Windows-x64.zip)

[整合版验收目录 G01—G05](Stillhere-dev32-E-drive-integrated-acceptance.md)

完整软件与dev32-E1修复已合成一份，无须再手工覆盖补丁。

关闭旧程序，把整包完整解压到E盘的新文件夹，进入Stillhere文件夹，双击“安装模型到E盘.cmd”。模型、Python环境、下载缓存及安装临时文件使用E:\Stillhere-Models；原记忆、素材与凭证保留原位置。安装结束后双击本目录“启动本机版.cmd”。现有Ollama可以沿用。

本包内置Node与ASR组件；Qwen对话/声音权重仍需安装工具首次联网下载数GB，E盘需至少15GB空闲。当前是本地原型，Windows安装、GPU性能及声音相似度需实际验收。代码158项Node与4项Python协议测试通过；归档、源文件、补丁和模型哈希已核对。

parts只用于发布流水线，请下载Release里的单个完整ZIP。此分支不修改main网站，不含个人数据或凭证。
