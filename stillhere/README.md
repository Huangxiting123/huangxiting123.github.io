# 续在 STILLHERE 产品官网

品牌暂定名：续在；寓意“故事的延续，关系里的存在”。标语：记忆有回声，陪伴有续章。英文 STILLHERE。未进行商标或域名可用性核查。

官网路径为现有 GitHub Pages 仓库中的 /stillhere/。站点独立于仓库中的其他产品，采用构建无依赖的HTML/CSS/JS。产品体验是明示的预设示例，不接收用户个人记忆，不直接连接付费AI服务。

## 发布约定

后续每次开发版发布，都同步更新官网：独立ZIP、版本说明、releases.json 中的版本/日期/变化/限制/大小/SHA-256。保留历史包；禁止覆盖旧版本。完成软件测试后再发布，不能把规划功能写为已完成。

从仓库根目录运行示例：

```text
node stillhere/tools/release.mjs v0.6.0 ABSOLUTE_ZIP_PATH ABSOLUTE_NOTES_JSON_PATH
node stillhere/tools/check.mjs
```

备注JSON格式：

```json
{"title":"版本标题","date":"YYYY-MM-DD","changes":["已实现的变化"],"limitations":"真实验证范围与未完成项目"}
```

检查通过后提交并推送 stillhere/ 目录至现有 Pages 发布分支 main，等待 Pages 发布完成并验证官网和新下载链接。此脚本准备文件，不会伪装已上传。版本变更由页面读取同一份清单，首页版本、下载中心与日志一起更新。

此官网对应0.5及以前的开发源码包，不提供尚未存在的手机安装包、EXE或视频通话功能。公开目录不得加入数据文件、密钥或个人音视频。

早期开发包的内部界面可能仍显示“留声”或 Digital Persona；续在是本次确立的产品品牌，后续程序界面会逐步统一。

## 公开下载状态

官网内容可公开访问；当前五个开发源码ZIP尚未获公开发布授权，因此清单publicDownload为false且file为null，官网显示公开下载待开放。ZIP只保留本地并由.gitignore排除，不随本次官网提交。用户明确批准这些具体源码包公开后，才上传对应ZIP、设置file链接并将publicDownload改为true。未来发版脚本默认准备未公开状态，不能把准备文件当成已经发布。
