# SydneyHarborBridge

一个约 3 分钟的浏览器 3D 演示，用交互式时间轴解释悉尼海港大桥在 1923—1932 年间的主要施工过程。

## 本地运行

```bash
npm install
npm run dev
```

按终端显示的地址在浏览器中打开。

## 生产构建

```bash
npm run build
npm run preview
```

构建结果输出到 `dist/`。

## 操作

- 首屏“开始演示”：进入约三分钟的施工叙事
- “受力示意”（默认开启）：蓝色＝拱肋受压、红色＝临时钢缆受拉，附流动光点与方向箭头
- 空格：播放或暂停
- 左右方向键：前后移动 5 秒
- 拖动时间轴：跳转到任意施工阶段
- 鼠标拖动：旋转镜头
- 滚轮：缩放
- “自由观察”：暂停自动镜头，保持用户视角

## 呈现说明

- 主拱按真实桁架结构（上下弦 + 腹杆 + 上下平联）程序化生成
- 金属通过环境贴图获得反射，叠加泛光（Bloom）与遮蔽（SSAO）后期处理
- 第 4 章中段会短暂演示“钢缆失效 → 半拱向海中倾倒”，再恢复，用于说明钢缆的拉力如何把悬臂拉住

## 历史准确性

演示采用真实的施工顺序和关键工程原理，但为保证浏览器性能和叙事清晰度，简化了构件、锚索、机车和施工人员数量。受力颜色属于教学示意，不是有限元分析结果。

主要资料入口：

- Museums of History NSW：Sydney Harbour Bridge 档案与施工照片
- State Library of New South Wales：Sydney Harbour Bridge 专题馆藏
- Transport for NSW：Sydney Harbour Bridge 历史与遗产资料
