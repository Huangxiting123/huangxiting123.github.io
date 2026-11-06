# dev32-E1：模型安装到E盘修复补丁

[下载小补丁](https://github.com/Huangxiting123/huangxiting123.github.io/releases/download/stillhere-dev32-e1/Stillhere-dev32-E-drive-fix.zip)

[验收目录 F01—F05](Stillhere-dev32-E-drive-acceptance.md)

旧版误将模型、Python和下载缓存按C盘资料目录检查，软件放E盘仍可能要求C盘15GB。本补丁分离大型模型目录，新增“安装模型到E盘.cmd”，固定E:\Stillhere-Models；原有资料与凭证保留原位置。独立Ollama服务的模型库也放E盘，不修改全局GUI配置。

先关闭报错窗口并停止主程序。将ZIP直接解压到已有软件目录（能看到启动本机版.cmd与runtime的那一层），同名覆盖，再双击“安装模型到E盘.cmd”。不需要重新下载完整软件、不需要卸载Ollama、不需要移动凭证或旧数据。补丁不含Node运行环境，单独解压到新目录不能用。

开始应显示“模型安装器 dev32-E1”、模型路径E:\Stillhere-Models以及E盘可用空间。若仍显示旧文案，检查解压层级。完整安装、驱动和真实模型推理仍待实机验收；158项Node与4项Python协议测试通过不等于Windows安装已通过。
