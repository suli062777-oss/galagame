# 真实三维场景性能改动与验证契约

适用文件：`public/roundtable-scene.js`、`scene-runtime.js`、`tavern-models.js`、`tavern-environment.js`。

## 已实现

- 静止时停止请求 RAF。输入、实际经营变化、头像加载和尺寸变化只安排一帧；连续旋转才持续绘制。多个输入在同一帧合并。重复玩家快照不触发三维绘制或头像重建；姓名与提交小点仅更新 DOM。
- 页面隐藏或场景离开视口时取消帧；后台玩家更新延迟到场景重新可见才应用。截图接口在后台返回 `null`，不偷偷重新提交绘制。
- 头像比较直接比较预设ID或已有图片字符串，不重复 JSON 序列化上传图片。诊断仅在显式 getter 或尺寸变化时计算；头部投影缓存到下一次尺寸变化。
- 重复杆件使用单位长度几何再缩放；其他重复基础几何共享资源。相同木纹在同一场景共享纹理。静态环境、桌体、椅子按材质合并为实际三维几何批次；头像、身体、手和可交互球体保持独立。
- 家具和人体阴影只在首次绘制、占席变化或质量切换后重绘。经济球体本身不投影，因此拖动球体无需反复绘制家具阴影。静态模型冻结本地矩阵；球体继续真实旋转和缩放。
- `quality: 'auto' | 'high' | 'low'` 可初始化；原 `lowPerformance: true` 仍兼容。返回值增加同步 `setQuality(mode)`。保留所有旧接口和同步场景PNG截图接口。
- `auto` 依据视口、粗指针、CPU核数和设备内存保守选择，不声称测得手机FPS。低档使用 DPR≤1、关闭实时阴影、较少球面分段和经济标记、隐藏远景蕨叶；高档 DPR≤1.5。四席、头像、桌椅、灯窗与份额始终是真正几何。抗锯齿是创建WebGL context时的固定属性，运行时不伪造切换；诊断返回实际值。

## 可复核指标

读取 `document.querySelector('.roundtable-scene').getSceneDiagnostics()`：

- `quality`：请求/实际质量、原因、DPR、阴影、标记预算、实际抗锯齿。
- `frameCount` / `renderCount`：RAF回调和实际WebGL提交总数。`fps` / `callbackFps` 是过去1000毫秒对应次数；静止时应回到0。
- `performance.scheduler`：是否有待执行帧、连续模式、是否暂停。
- `performance.idleUpdates`、`idleCallbacks`、`projectionCount`、`diagnosticReads`：确认相同快照未唤醒场景、没有每秒诊断投影。
- `performance.renderCpuMs`：CPU侧提交耗时（含首次编译），不是GPU帧耗时。
- `drawCalls`、`triangles`、`geometryCount`、`textureCount` 来自 Three WebGLRenderer；`staticBatches` 为真实合批计数。

## 已完成的本地检查

运行 `node --test tests/scene-models.test.mjs tests/scene-performance.test.mjs`，7项通过。调度检查涵盖空闲零帧、50次合并成1帧、连续模式、暂停/恢复/销毁与质量选择。真实Three几何检查保留四个人头及8只手；批次前后精确世界包围和三角形一致。

当前几何fixture：468个Mesh → 189个Mesh（减少59.6%），三角形保持37298。该fixture只用假Canvas画笔绘制纹理，其余均为实际Three几何；这证明静态绘制对象减少，不等同于真实浏览器GPU性能。

旧浏览器证据 `docs/evidence/browser-qa-0801d2a9-cbc1-4fcd-84e7-ff6d45c5d55b-progress-1794883005396.json` 记录 `drawCalls:479`、`geometryCount:374`、`callbackFps:180`。它属于旧场景版本，供历史对比，不能当作当前设备帧率。新的实际浏览器空闲/活动/质量切换/隐藏后复验由总控记录。

## 浏览器验收步骤

1. 头像全部加载后，停止旋转，采两次诊断，间隔至少2秒并持续正常房间轮询。`frameCount`、`renderCount` 和 `projectionCount` 应不增长（经营内容未变化），`idleUpdates` 可增长。
2. 从真实菜单开启旋转2秒，再停止。确认实际 `renderCount` 增长、画面旋转；停止后再次静止，无永久RAF。缩放到上下限核对原有 `.13` 桌面间距。
3. 菜单切换低/高档，确认实际 canvas 像素尺寸、阴影、球体分段和标记预算变化；再次换头像确认仍绑定本人，正常提交完整一轮。
4. 页面切后台或把场景滚出视口，采 `suspended` 与计数并恢复；确认期间不绘制，回来以后显示最新真实状态。
5. 分别查看手机与桌面真实PNG，确认合批未移动桌椅/灯窗或改变材质。PNG只作证据，产品始终由真实WebGL渲染。
