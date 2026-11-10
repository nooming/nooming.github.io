/* 排盘 worker：只有点“展开我的平行人生”时才创建，算完即弃。
   引擎以 importScripts 加载，避免把 bazi.js 源码 fetch 下来再拼 blob（CSP / file:// 都不友好）。 */
importScripts('bazi.js');

self.onmessage = function (event) {
  var payload = event.data || {};
  try {
    var result = BAZI.run(payload.input, payload.opts);
    // 结构化克隆前先转成纯数据，避免 report 里带上任何非可克隆的值
    self.postMessage({ result: JSON.parse(JSON.stringify(result)) });
  } catch (error) {
    self.postMessage({ error: (error && error.message) || String(error) });
  }
};
