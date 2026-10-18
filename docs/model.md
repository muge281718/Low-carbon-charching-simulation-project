# 停车场充电低碳评估模型

模型版本：`0.1.0`

## 1. 模型目的与边界

模型用于停车场的运行阶段轻量估算。输入车辆需求、充电供给和能源假设，输出服务能力、逐时负荷、能量、碳排和评分。它不是工程级电力潮流或配电容量仿真，也不处理电价、储能调度、V2G 或投资回报。

碳排边界只包含：

- 从电网购买的电量所产生的运行排放；
- 光伏电量的生命周期排放。

不包含充电桩、停车场、电池等设备制造排放，也不包含施工、维护和退役阶段。

## 2. 符号与单位

| 符号 | 含义 | 单位 |
| --- | --- | --- |
| `N` | 需要充电的车辆数 | 辆 |
| `M` | 充电桩数 | 个 |
| `d` | 单次充电时长 | h |
| `P` | 单桩功率 | kW |
| `S` | 充电开始时刻 | h |
| `E` | 充电结束时刻 | h |
| `T` | 充电时段长度，`T = E - S` | h |
| `η` | 充电效率 | — |
| `r_pv` | 光伏电量占桩端取电的比例 | — |
| `f_grid` | 电网排放因子 | kgCO₂e/kWh |
| `f_pv` | 光伏生命周期排放因子 | kgCO₂e/kWh |
| `a_i` | 第 `i` 辆车的到达时刻 | h |
| `s_i` | 第 `i` 辆车的实际开始充电时刻 | h |
| `e_i` | 第 `i` 辆车的结束充电时刻 | h |
| `E_demand` | 需求电量 | kWh |
| `E_pile` | 桩端实际取电 | kWh |
| `E_car` | 车端实际充入电量 | kWh |
| `E_loss` | 充电损耗 | kWh |
| `E_pv` | 光伏电量 | kWh |
| `E_grid` | 电网购电 | kWh |
| `C_total` | 总运行碳排 | kgCO₂e |
| `C_baseline` | 全电网基准碳排 | kgCO₂e |

## 3. 输入校验与有效窗口

有效充电时段满足 `E > S`。第一版不支持跨午夜，因此任何 `E <= S` 的输入都不执行仿真，结果序列置零，评分无效，并产生 `INVALID_WINDOW` 校验警告。

浏览器界面还会检查每个参数是否位于配置范围内。输入无效时显示行内错误和结果区阻断状态，不调用模型计算。

## 4. 服务仿真算法

1. 计算时段长度 `T = E - S`。
2. 第 `i` 辆车均匀到达：

   ```text
   a_i = S + i × T / N,  i = 0 … N - 1
   ```

3. 为每个充电桩维护一个空闲时刻，初始均为 `S`。
4. 按到达顺序处理车辆，选择空闲时刻最早的充电桩。
5. 实际开始时刻：

   ```text
   s_i = max(a_i, freeTime)
   ```

6. 若 `s_i < E`，车辆计为已服务，结束时刻为 `e_i = s_i + d`，桩的空闲时刻更新为 `e_i`。车辆可以在 `E` 之后继续充完。
7. 若 `s_i >= E`，车辆计为未服务，不产生充电能量。
8. 桩数不足或为零时，所有未开始车辆均计入未服务。

服务指标：

```text
served / unserved
serviceRate = served / N                         (N > 0)
utilization = min(1, served × d / (M × T))      (M = 0 或 T <= 0 时为 0)
arrivalRate = N / T
```

### 逐时负荷与队列

对每个已服务会话与每小时区间 `[h, h+1)` 求重叠时长，再乘以单桩功率，累加到第 `h` 小时：

```text
load_h = Σ overlap(session, hour h) × P
```

每小时区间为一小时，因此该小时内的千瓦时电量数值与时段平均功率数值相同。输出 `series.load`、`series.pvPower` 和 `series.gridPower` 按 kW 标注；柱状图在 1 小时分箱中按 kWh 展示。

队列在每小时开始时统计“已经到达但尚未开始充电”的车辆：

```text
queue_h = count(a_i <= h and (unserved or s_i > h))
```

峰值负荷为 24 个小时负荷的最大值；队列峰值为 24 个队列值的最大值。

## 5. 能量公式

```text
E_demand = N × P × d
E_pile = served × P × d
E_car = E_pile × η
E_loss = E_pile - E_car
E_pv = E_pile × r_pv
E_grid = E_pile - E_pv
E_unmet = unserved × P × d
```

守恒关系：

```text
E_pv + E_grid = E_pile
E_car + E_loss = E_pile
```

## 6. 碳排公式

```text
C_grid = E_grid × f_grid
C_pv = E_pv × f_pv
C_total = C_grid + C_pv
C_baseline = E_pile × f_grid
C_reduction = C_baseline - C_total
reductionRate = C_reduction / C_baseline        (C_baseline = 0 时为 0)
carbonIntensity = C_total / E_pile              (E_pile = 0 时为 0)
carbonPerVehicle = C_total / served             (served = 0 时为 0)
gridShare = C_grid / C_total                    (C_total = 0 时为 0)
```

模型内部碳强度单位为 kgCO₂e/kWh；界面换算为 gCO₂e/kWh 展示。

## 7. 低碳评分

```text
carbonScore = 100 × clamp(1 - C_total / C_baseline, 0, 1)
pvScore = 100 × r_pv
totalScore = 0.7 × carbonScore + 0.3 × pvScore
```

当 `C_baseline = 0` 时，`carbonScore = 0`。

评分有效条件：

```text
N > 0 and M > 0 and E_pile > 0
```

无效时 `score.total = null`，界面显示“—”，不会显示 0 或 100 分。总分取整展示，分项和中间值保留原始精度。

| 总分区间 | 等级 |
| --- | --- |
| 80–100 | 优秀 |
| 60–79.999 | 良好 |
| 40–59.999 | 一般 |
| 0–39.999 | 高碳 |

评分只针对已服务车辆。若服务完成率低于 90%，界面增加范围提示，但不修改任何评分。

## 8. 光伏时段可行性

配置中的 24 小时光伏可用性曲线为：

```text
[0, 0, 0, 0, 0, 0, 0.05, 0.15, 0.3, 0.5, 0.7, 0.9,
 1.0, 0.95, 0.85, 0.7, 0.5, 0.3, 0.1, 0, 0, 0, 0, 0]
```

充电时段内平均可用性按小时重叠时长加权：

```text
availability = Σ(curve_h × overlap(h, [S, E))) / T
```

| 平均可用性 | 等级 |
| --- | --- |
| `< 0.15` | 低 |
| `0.15–0.45` | 中 |
| `> 0.45` | 高 |

该等级只用于可信度说明。当 `r_pv > 0.5` 且可用性 `< 0.15` 时增加 `PV_LOW_AVAILABILITY` 警告，但能量和碳排仍按输入的 `r_pv` 计算。

## 9. 警告码

| 代码 | 条件 | 对计算的影响 |
| --- | --- | --- |
| `INVALID_WINDOW` | `E <= S` | 不仿真，结果置零，评分无效 |
| `NO_VEHICLES` | `N = 0` | 评分无效，界面显示无法评估 |
| `NO_CHARGERS` | `M = 0` | 所有车辆未服务，评分无效 |
| `SERVICE_BOTTLENECK` | `serviceRate < 0.9` | 不修改评分，只提示服务缺口 |
| `HIGH_PV_SHARE` | `r_pv >= 0.8` | 不修改计算，只提示储能与绿电匹配要求 |
| `LONG_SESSION` | `d >= T` | 不修改计算，只提示最多完成一轮服务 |
| `PV_LOW_AVAILABILITY` | `r_pv > 0.5` 且平均可用性 `< 0.15` | 不修改计算，只提示光伏可信度 |

## 10. 输出对象

`evaluateModel(input)` 返回统一对象：

```text
{
  input, service, energy, carbon, score, series, warnings, assumptions
}
```

必需字段与 `js/model.js` 一致。评分对象额外提供 `pvAvailability`、`pvFeasibility`、`driver`、`carbonContribution` 和 `pvContribution`，供界面展示评分依据；碳排对象额外提供 `gridShare`，供结论规则直接读取。

## 11. 假设与已知限制

- 车辆到达完全均匀，充电桩按最早空闲分配。
- 会话可在 `E` 后结束，但逐时序列只统计 0–23 时。
- 光伏占比是外生假设，不模拟天气、遮挡、逆变器限功率或储能充放电。
- 固定 24 个小时区间，不模拟分钟级功率波动。
- 没有配电容量校验、电价、需量费用、设备寿命或投资分析。

## 12. 版本记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| `0.1.0` | 2026-10-17 | 首个静态版本：均匀到达、最早空闲桩分配、逐时能量、碳排、评分、PV 可行性、警告与原生 SVG 图表 |
