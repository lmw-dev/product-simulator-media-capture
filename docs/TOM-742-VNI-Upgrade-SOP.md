# TOM-742: Script Snap VNI 内容质量升级规范 (SOP)

## 1. 核心目标 (Objective)
将 Script Snap 产物从“内容摘录”升级为“数字增长资产”。通过 Daedalus (事实求真) 与 Hermes (灵魂注入) 的双 Agent 协同，输出具备 Tech Influencer 人设的高质量推文。

---

## 2. 协同方案与实现 (Implementation Spec)

### 2.1 职责分工
- **Daedalus**: 负责提取事实、维护术语准确性、审计执行结果。
- **Hermes**: 负责 VNI 审计。基于 X 平台逻辑执行“去 AI 味”、Hook 强化与人设校准。

### 2.2 自动化集成 (Post-run Hook)
在 `run-daily.sh` 脚本末尾集成以下自动化链路：
1. **Trigger**: 识别 `evidence-pack.json` 生成。
2. **Dispatch**: 通过 `openclaw sessions_send` 异步调用 Hermes 进入 **VNI 联调模式**。
3. **Wait & Log**: Hermes 返回优化结果，并写入 `hermes-vni-refinement.md`。
4. **Discord Feed**: 回传消息必须包含 `[Hermes VNI Active]` 标识及审计评分。

---

## 3. 内容生成规范 (The Refinement Logic)

### 3.1 人设定义 (Persona)
- **Role**: 资深硬核科技评论员。
- **Voice**: 犀利、技术深度、反 AI 废话。

### 3.2 增长逻辑 (VNI Tenets)
- **Hook 优先**: 打破预期，直接指出产品痛点（如“生产力税”）。
- **Builder-native**: 使用 SysAdmin, Band-aid, Meta 等地道开发者词汇。
- **共情先行**: 吐槽要吐在真实痛点上，避免营销感。

---

## 4. 产品迭代闭环 (Feedback Loop)
Daedalus 基于 Hermes 的反馈执行以下动作：
- **Bug Fix**: 修正术语提取偏差。
- **Prompt 迭代**: 若内容太薄，优化主提取 Prompt 洞察密度。
- **UI 优化**: 根据产物呈现效果，优化结果页模块设计。

---
**Status**: Active / Confirmed
**Related**: `TOM-742-influencer-tweets-test-output.md` (测试样稿)
