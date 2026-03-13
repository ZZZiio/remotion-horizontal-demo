Original prompt: Continue iterative UX upgrades for the Remotion stick-scene editor, especially around beats, bubbles, timeline interaction, and preview tooling.

2026-03-10
- Added beat drag Shift-snap support with selectable 2f / 5f / 10f grid in the preview beat timeline.
- Added drag tooltip feedback so the current frame also shows the active snap grid while Shift is held.
- Added bubble-level "Generate Beat" shortcut that infers a matching beat from tone / punctuation / emphasis.
- Validation pending: npm run check, npm run editor:build, npm run test:stick.

TODO
- If requested, add dedupe/replace behavior when generating a beat from a bubble that already has a matching beat.
- If requested, surface the inferred beat type inline before insertion.

Validation
- npm run check ✅
- npm run editor:build ✅
- npm run test:stick ✅
- Bubble -> beat 现在会优先替换同 actor、邻近时间的自动生成 beat，并清理邻近重复自动 beat；满 8 个 beat 时只要能替换也允许执行。
- Validation rerun: npm run check, npm run editor:build, npm run test:stick all passed.
- Practical run: launched `npm run editor -- --host 127.0.0.1 --port 4173`, imported `examples/stick-animation-demo.json`, and exercised bubble -> beat plus Shift-snap beat dragging in the browser.
- Verified same-bubble repeated generation switches to `Replace Beat` and does not keep adding duplicate auto beats.
- Verified Shift + drag with `10f` grid snapped a marker from `18f` to `60f`, and the tooltip showed `60f | 10f grid` during drag.
- Playwright screenshot capture failed once with `Page.captureScreenshot: Unable to capture screenshot`, but DOM snapshot and interaction results were successful and browser console had no errors.
- Fixed stick editor Chinese labels for beat types and stick preset labels, so the action type dropdown now shows 转身 / 点头 / 摇头 / 入场 / 退场 / 问号 / 感叹号.
- Added bulk stick conversion buttons in the segment list: 全部转简笔动画 / 选中后续段落. The conversion reuses the current segment's stick template, defaulting to stick-dialogue.
- Improved preview targeting: clicking into another segment's inputs/selects/buttons now jumps the preview to that segment, each segment card has a 预览本段 button, and the preview pane shows 当前定位 with frame range plus a 定位到当前段 shortcut.
- Browser verification: restored the default project, confirmed all segment visual presets switched from orb/nodes/dashboard/... to stick-dialogue via 全部转简笔动画; confirmed focusing the “对话示范” card input updated 当前定位 from 开场 to 对话示范.
