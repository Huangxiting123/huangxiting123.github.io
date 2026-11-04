# 续在 Windows EXE 开发体验版

Windows 10/11 64位，使用系统.NET Framework。双击 Stillhere-Preview.exe：

1. 首次解压内置Node.js运行环境至 %LOCALAPPDATA%\Stillhere，之后复用。
2. 启动本机服务，自动选择可用端口，避免与4317旧服务冲突。
3. 优先用Edge或Chrome的独立应用窗口显示界面，找不到时用默认浏览器。
4. 在控制台点击“复制”，将所有者访问凭证粘贴到登录页。
5. 控制台关闭时停止自身启动的服务，保留本地数据。

数据：%LOCALAPPDATA%\Stillhere\data\persona.json
日志：%LOCALAPPDATA%\Stillhere\runtime.log
访问凭证：%LOCALAPPDATA%\Stillhere\owner.token

这是内置运行环境的桌面启动版，界面仍使用电脑上的浏览器引擎。无需手动安装Node.js，尚非手机App，也没有视频通话或音色复刻。真实模型、向量、ASR/TTS服务仍需在界面配置；密钥仅在服务进程内存中保存。

EXE不包含真实用户资料、录音或服务密钥。现有开发目录的资料不会自动迁入此独立数据目录。不要同时运行其他服务写入同一资料文件。用户自行备份资料及访问凭证。

构建：使用Windows自带C#编译器，嵌入Node.js二进制和本项目源码。build_exe.py参数为Node.exe绝对路径。包含Node.js许可证与第三方许可声明。构建源文件也保留在内置资源的build-source目录。

自检：STILLHERE_HOME指定一次性测试目录后执行 --self-test，会验证启动、认证、记忆对话、重启持久性和进程停止，并写出self-test.json。测试应清空第三方模型服务环境变量，避免实际服务调用。桌面窗口与真实浏览器/音频设备效果尚需交互验收。

本次只交付EXE体验，不更新官网或公开源码。


当前打包版本：0.7.0-dev.8。已整合示例引导、五工作区导航及记忆搜索筛选。内置自检包含四个浏览器模块资源可加载验证，但不代替实际页面操作和设备验收。
