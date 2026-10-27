# 停车项目 · 贴近真实运营的实施计划

## 目标分层

| 层级 | 名称 | 状态 | 说明 |
|------|------|------|------|
| A | 静态规划 | 已有 | 一次性匈牙利/PSO，方案设计与对比 |
| B | 到达压力仿真 | **已实施** | 错时到达 + 入口容量 + 排队指标 |
| C | 在线滚动分配 | **已实施** | FIFO + 空车位贪心，不预知未来到达 |

## 信息假设（贴近真实）

- **运营决策（滚动分配）**：仅使用已到达车辆与当前空车位，**不需要**知道下一辆何时到。
- **到达曲线**：用于 **仿真与对比实验**（均匀 / 扎堆），不代表系统联网预测。

## 后端 API

| 端点 | 用途 |
|------|------|
| `POST /api/parking/optimize` | 静态最优分配 |
| `POST /api/parking/simulate` | 对已有 `result` 做到达回放（`schedule.realistic` + `entrance_capacity`） |
| `POST /api/parking/simulate-rolling` | 场景 + schedule → 滚动分配 + 仿真 |

### schedule 字段

- `mode`: `uniform` | `burst` | `explicit`
- `duration_min`, `burst_gap_sec`, `arrivals_sec`
- `realistic`（默认 true）
- `entrance_capacity`（默认 1）

## 前端（仿真 Tab · 主路径）

- **默认**：在线滚动 + 高峰扎堆 + 入口容量 1
- **实时条**：已到达 k/N、排队、驶入/步行/完成
- **一键对照**：同一 schedule 下滚动 vs 全信息优化回放（表格）
- 总览工作流：布位 → **仿真** → 全信息基准（可选）

## 后续（未实施）

- 离场释放车位（`dwell_min` 已预留解析）
- 显式到达时间编辑器、`explicit` 模式 UI
- 对照结果导出 HTML
- 真实小区数据接入
