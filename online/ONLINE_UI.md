# 原生四人线上前端

位置：实际Sites源码checkout内的public。本轮只新增/修改public和本说明，没有改worker、hosting manifest、数据库或密钥。

public来自root完整服务器版本，使用真实fetch /api请求，没有demoTransport、浏览器经营引擎或本地模拟房间。书籍、教学实验、札记、程序化四人圆桌、预设与照片头像都保留。阅读/札记仍是浏览器保存；房间/行动/头像由服务端API处理。

## 邀请链接契约

链接：`https://<线上域名>/?room=ROOM_ID#/tavern`。

- 只含公开房间号，不含Human/Agent token。
- 新访客打开后切到“加入房间”、预填房间号，必须填写称呼并点击入席，不自动创建匿名玩家。
- 已有此room线上凭据则直接继续该桌。成功续桌/入席时消费room query，之后返回酒馆不会被旧邀请反复劫回原桌。
- query包含room且没有hash时也进入酒馆；已进入其他阅读hash时不会主动打断阅读。
- 复制按钮提供真实邀请URL；剪贴板不可用时弹出可手动复制的链接。
- practice房不假装可邀请，点击解释需另建四人同桌。

## 模式、等待与来源

默认新建四人同桌，单人practice作为可选模式且明确另三席为脚本。等候操作栏显示四个席位已入席/等待状态；满四位后才允许房主开局。主画面继续使用人物与头像，没有还原四张玩家卡片。

大厅从GET /api/health读取真实host配置、启用、成功和调用额度；当前每条对局播报显示state.god.provider，失败/达到上限时显示模板回退，游戏操作仍照常开放。没有在前端伪造DeepSeek或Agent连接；Agent提示词和自检仍调用真实服务器协议。

## 本地状态隔离

线上席位凭据仅使用`ga:online:v1:sessions`（异常恢复键`ga:online:v1:recovered:sessions`），完全不读取旧Demo的ga:sessions，因此D开头或其他旧本地假房间不会被当作真实线上席位。ga:notes/progress等阅读数据继续沿用，不删除旧Demo数据。

本轮只做app语法、CSS配平和源文件范围检查；按用户要求未做长视觉验收、未使用filechooser/setFiles、未调用真实模型。上线API与外部部署由总控集成。
