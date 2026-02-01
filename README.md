
# Masks - v2.8.3

## 项目简介
"Masks" 是一个极简主义的网页游戏系列。游戏仅使用基础几何形状，隐喻个体在资本主义流水线与社会规训下的异化（Alienation）。

## 版本更新日志 (v2.8.3)
- **Deployment**:
  - **Cloudflare Fix**: 添加了 `wrangler.json` 配置文件。修复了在 Cloudflare 上部署时因找不到 Worker 入口点或静态资源目录而导致的 `Missing entry-point` 错误。现在部署脚本会正确识别 `./dist` 目录作为静态资源源。

## 版本更新日志 (v2.8.2)
- **Level 3 Audio Fix**:
  - **Drain SFX**: 恢复了第三关（Capital）中按住左键时的 `sfx_level3_drain.mp3` 音效。现在当玩家进行“吸取/抵抗”操作时，会同时听到抵抗背景音乐 (`bgm_level3_resistance`) 和物理吸取音效，增强了能量转移的听觉反馈。

## 版本更新日志 (v2.8.1)
- **Level 1 Audio Logic**:
  - **Audio Ducking**: 添加了专注音效。现在当玩家按下或长按 `Space`（工作/顺从）时，背景的嘈杂噪音 (`bgm_level1_routine`) 会迅速降低（Ducking）。这模拟了人在专注工作时对周遭环境音的“过滤”效果，增强了按键操作的沉浸感与反馈。

## 版本更新日志 (v2.8.0)
- **Level 1 Polish**:
  - **Smoother Revolution**: 调整了第一关（Classroom）的抵抗节奏。减缓了 `REVOLUTION_SPEED`，现在玩家需要持续按住左键约 2.5 秒才能完成对老师的取代，让抵抗的过程更具仪式感和重量感。
  - **Majestic Ascension**: 优化了玩家取代老师位置的动画。添加了 3 秒的平滑过渡（Cubic Bezier），让玩家从座位飞向讲台的过程显得庄严且流畅，而非之前的瞬间弹射。

## 版本更新日志 (v2.7.9)
- **Level 5 Finale Polish**:
  - **Red Resistance**: 当玩家在结局时刻选择逆行（按下左键）时，绿球会因剧烈抵抗而变为红色。这与第一关（Classroom）和第四关（Consumerism）中“抵抗即变红”的视觉语言保持一致，象征着个体的愤怒与觉醒。

## 版本更新日志 (v2.7.8)
- **Level 5 Finale Experience**:
  - **Breaking Free**: 修复了结局体验。现在当玩家在慢动作时间中按下 `LeftArrow` 时，绿球会真正地向左侧逆行并飞出屏幕，视觉上挣脱红色的洪流，而非直接黑屏或白屏。只有当玩家彻底远离群体后，才会触发白屏觉醒结局。
  - **Fail State**: 如果玩家在最后时刻按下 `Space`，则会立即触发黑屏同化结局。

## 版本更新日志 (v2.7.7)
- **Level 5 Cinematic Polish**:
  - **Crash Zoom**: 调整了结局的演出顺序。现在当第10次 Space 按下时，镜头会立刻（0.6s内）急速推近并锁定主角，给予强烈的视觉冲击。
  - **Sequence Timing**: 时间流逝的变慢（Time Dilation）现在会等待镜头几乎推近到位后（600ms延迟）才开始触发。这创造了“在冲击中凝固”的电影化体验。

## 版本更新日志 (v2.7.6)
- **Level 5 Finale Experience**:
  - **Absolute Centering**: 重写了结局时的摄像机逻辑。现在镜头不仅会 Zoom In，还会精准地 Pan 到玩家的**绝对世界坐标**。无论玩家被物理引擎“拖拽”到多远，屏幕中心永远锁定在玩家的绿色球体上。
  - **Time Dilation**: 在最终抉择时刻（Final Choice Mode），世界不再完全静止。红色的球体流（Current）会继续以慢动作（20%速度）向左流逝，模拟出玩家在历史洪流中试图驻足的“子弹时间”感。

## 版本更新日志 (v2.7.5)
- **Level 5 Polish**:
  - **Immediate Cue**: 第五关结局的左箭头提示现在会在第10次操作（最后一次Space）按下后**立即**出现，不再等待物理冻结。这确保了玩家在被“拖拽”的瞬间就能感知到逃离的可能性。
  - **Ghostly UI**: 左箭头提示的视觉效果优化为“若隐若现”的幽灵形态（模糊渐变+重影），暗示这是一种潜意识的呼唤而非硬性的系统指令。
  - **Camera Focus**: 在结局时刻，镜头会自动从宏观网格（Zoom Out）平滑推进至玩家特写（Zoom In），并跟随玩家的物理位移，增强终极抉择的戏剧张力。

## 版本更新日志 (v2.7.4)
- **Audio Polish (Level 5)**:
  - **Infinite Epiphany**: 第五关的背景音乐 (`bgm_level5_epiphany`) 现在被明确设置为无限循环。这首空灵的曲目将作为永恒的背景，直到玩家在终极抉择中做出决定，打破或拥抱这无尽的循环。

## 版本更新日志 (v2.7.3)
- **Level 5 Finale**:
  - **The Final Choice**: 在第五关尾声（第10次操作后），游戏不会立即判定失败。
  - **Visual Cue**: 时间会变慢，玩家（绿色球体）左侧会出现一个呼吸闪烁的左箭头提示。
  - **Agency**: 此时玩家拥有最后一次决策权：再次按下 `Space` 将导致同化（黑屏结局），按下 `ArrowLeft` 将彻底觉醒（白屏结局）。

## 版本更新日志 (v2.7.2)
- **Level 5 Mechanics**:
  - **Lurch vs Jump**: 移除了第五关空格键的垂直跳跃机制。现在按下空格键时，角色会向右侧（顺从方向）猛烈位移，随后被向左离开的红色球流（觉醒/异类）“拖拽”向左侧。这创造了一种试图停留在原地（右侧/舒适区）却被历史洪流裹挟（左侧/未知）的视觉隐喻。

## 版本更新日志 (v2.7.1)
- **Audio Update (Level 5)**:
  - **Epiphany BGM**: 第五关现在拥有独立的背景音乐 `bgm_level5_epiphany`。
  - **Single Track**: 为了烘托顿悟的孤独与专注，本关卡仅播放这一首曲目，并在结局时自动淡出。

## 版本更新日志 (v2.7.0)
- **Audio Update (Level 4)**:
  - **Consumer Soundscape**: 第四关（The Mall）现在拥有了专属的背景音乐与音效。
  - **Interaction**: 按下 `Space` 购买商品时会触发清脆的购买音效 (`sfx_level4_buy`)。
  - **Resistance BGM**: 按住 `ArrowLeft` 进行抵抗时，原本的商场背景音乐 (`bgm_level4_mall`) 会平滑过渡到抵抗背景音乐 (`bgm_level4_resistance`)，增强了对抗消费主义的听觉沉浸感。

## 版本更新日志 (v2.6.0)
- **Audio Overhaul**:
  - **Level 3 Resistance**: 第三关的“吸引”与“抵抗”操作（左键）现在会触发背景音乐的切换（Capital BGM <-> Resistance BGM），而非原本的单一音效循环。这种设计旨在通过音乐的对立来增强意识形态对抗的听觉体验。
  - **Sound Assets**: 移除了 `sfx_level3_drain`，替换为 `bgm_level3_resistance`。

## 版本更新日志 (v2.5.9)
- **Level 4 Polish**:
  - **Dynamic Growth**: 第四关玩家（红球）在按住左键抵抗时，体积会随着时间逐渐膨胀，松开后回缩。
  - **Small Ripples**: 在抵抗过程中，红球会不断向外散发小型的红色脉冲涟漪，频率随体型增大而加快。
  - **Visual Hierarchy**: 建立了“抵抗时的局部小涟漪”与“胜利时的全屏巨型涟漪”之间的视觉层级对比。

## 版本更新日志 (v2.5.8)
- **Level 4 Visual Update**:
  - **Player Avatar**: 右侧生活区域的主角现在显示为一颗绿色的球体，而非原来的黑色圆点。
  - **Resistance Feedback**: 按下左键抵抗时，绿球会变为红色，提供直观的对抗反馈。
  - **Liberation Effect**: 当彻底击退消费主义（左侧画面消失）后，红球会向全屏散发巨大的红色涟漪，取代了原本单一的放大转场效果。

## 版本更新日志 (v2.5.7)
- **Level 1 Visual Fix**:
  - **Resistance Movement**: 修复了第一关按下左键抵抗时，玩家没有视觉上逐渐向左移动的问题。现在随着抵抗程度（变红），玩家会明显地向左侧（教师/权威方向）发生位移。

## 版本更新日志 (v2.5.6)
- **Level 1 Layout**:
  - **Player Focus**: 右侧学生区域重构。现在 9 个 NPC 排列在上方，玩家（绿球）单独位于最下方，且体积更大，强化主角的存在感与差异感。
- **Level 2 Balance**:
  - **Extended Survival**: 增加了死亡边界的距离，现在玩家在没有任何输入的情况下也能存活约 5-6 秒，避免开局即死。
  - **Spacebar Feedback**: 按下空格键时增加了强烈的视觉冲击波特效，给予玩家更强的操作正反馈。
- **Level 5 Expansion**:
  - **10x10 Grid**: 最后一关的网格扩张上限从 5x5 提升至 10x10。
  - **Pacing**: 调整了跳跃节奏，每个阶段需要的跳跃次数对应其网格阶数（Stage N = N Jumps）。

## 操作说明
- **Space**: 开始游戏 / 工作 / 确认 / 购买商品 / 跳跃
- **Arrow Left**: 抵抗 / 吸引 / 减少欲望 / 觉醒与逆行
