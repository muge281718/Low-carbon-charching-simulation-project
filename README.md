# 停车场充电低碳评估

一个完全在浏览器本地运行的静态单页工具，用轻量规则估算停车场电动汽车充电需求、服务能力、逐时负荷、运行阶段碳排与低碳评分。

## 运行方式

推荐通过静态 HTTP 服务运行。在项目根目录运行：

```bash
python -m http.server 8000
```

然后访问 [http://localhost:8000](http://localhost:8000)。页面不依赖运行时网络、后端服务或第三方图表库。

如果系统没有 Python 但有 Node.js，也可以在项目根目录运行等价的内置静态服务器：

```bash
node -e "const h=require('node:http'),f=require('node:fs'),p=require('node:path');h.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const t=p.join(process.cwd(),u==='/'?'index.html':u);f.readFile(t,(e,d)=>{if(e){s.writeHead(404);s.end();return}s.setHeader('Content-Type',{'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'}[p.extname(t)]||'application/octet-stream');s.end(d)})}).listen(8000,()=>console.log('http://localhost:8000'))"
```

也可以直接在 Edge、Chrome 等浏览器中双击打开 `index.html`。项目为 `file://` 场景提供了预生成的经典脚本回退文件 `js/app.standalone.js`，因此不依赖本地服务器也能调整参数和查看结果。HTTP 模式仍使用标准 ES Module。

## 测试

```bash
npm test
```

等价命令：

```bash
node --test
```

测试使用 Node 内置测试运行器，不安装任何依赖。

## 文件地图

| 文件 | 职责 |
| --- | --- |
| `index.html` | 页面骨架、参数控件、KPI、图表容器、结论区和计算依据抽屉 |
| `css/styles.css` | 视觉系统、响应式布局、交互状态与打印样式 |
| `js/config.js` | 默认值、范围、预设、光伏曲线、评分权重、阈值、颜色和模型版本 |
| `js/model.js` | 无 DOM 依赖的纯计算模型，输出统一结果对象 |
| `js/charts.js` | 将模型输出的 `series` 渲染为原生 SVG 柱状图和折线图 |
| `js/ui.js` | 输入错误呈现、数字格式化、KPI、警告、结论与计算依据更新 |
| `js/app.js` | 初始化、输入同步、参数校验、调用模型与更新视图 |
| `js/app.standalone.js` | 由模块源码自动生成的经典脚本，供浏览器直接打开 `file://` 页面时使用 |
| `scripts/build-standalone.mjs` | 无依赖的本地打包脚本，生成直接打开兼容文件 |
| `docs/model.md` | 符号、算法、公式、评分、警告、假设和版本记录 |
| `tests/model.test.js` | 默认、高光伏、供给瓶颈、边界和守恒测试 |
| `tests/standalone.test.js` | 检查直接打开回退文件与模块源码保持同步 |
| `package.json` | ES Module 类型和 `node --test` 测试脚本 |

修改 `js/config.js`、`js/model.js`、`js/charts.js`、`js/ui.js` 或 `js/app.js` 后，需要重新生成直接打开版本：

```bash
node scripts/build-standalone.mjs
```

## 模型摘要

车辆在充电时段内均匀到达，并依次分配到最早空闲的充电桩。已经开始充电的车辆允许在充电时段结束后继续充满；无法在结束时刻前开始的车辆计为未服务。逐时数据使用 24 个一小时区间。

主要计算关系：

```text
E_pile = served × power × duration
E_car = E_pile × efficiency
E_pv = E_pile × pvShare
E_grid = E_pile - E_pv
C_total = E_grid × gridFactor + E_pv × pvFactor
```

低碳评分：

```text
carbonScore = 100 × clamp(1 - C_total / C_baseline, 0, 1)
pvScore = 100 × pvShare
totalScore = 0.7 × carbonScore + 0.3 × pvScore
```

当车辆数、桩数或实际桩端取电量为 0 时，总分无效并显示“—”。评分只衡量已服务车辆的运行排放，不会因未服务车辆而自动扣分，因此界面会单独提示服务缺口。

## 假设与限制

- 车辆在充电时段内均匀到达，桩选择只按最早空闲时刻，不模拟排队策略、随机到达或用户偏好。
- `pvShare` 是用户输入的假设占比，按桩端取电量直接分配，不随光伏逐时可用性缩放。
- 碳排边界仅覆盖运行阶段：电网购电与光伏生命周期排放。不含设备制造、停车场建设、电池制造、电价、储能、V2G 或配电扩容成本。
- 逐时序列固定为 0–23 时；允许充电跨过时段结束时刻，但不会扩展到第二天的 24 小时序列。
- 第一版不支持跨午夜充电时段。
- 工具适合方案对比和量级估算，不构成工程、财务或投资建议。

## 验收场景

默认写字楼场景得到已服务 40 辆、桩端取电 560 kWh、总碳排 140.0 kgCO₂e、总分 58（一般）。光伏占比改为 80% 后总碳排 78.4 kgCO₂e、总分 77（良好）。车辆数改为 80 时服务 50 辆、未服务 30 辆，服务完成率 62.5%，评分卡同时显示评分范围提示。
