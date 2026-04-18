/**
 * 在转盘 / 抛硬币脚本之前同步执行：清理损坏的 localStorage，避免 JSON.parse 抛错导致整页脚本中断。
 * 常见成因：历史代码把 undefined 写入存储、或手动改坏数据。
 */
(function () {
    function removeIfBadJson(key) {
        try {
            var raw = localStorage.getItem(key);
            if (raw == null) return;
            if (raw === 'undefined' || raw === 'null') {
                localStorage.removeItem(key);
                return;
            }
            JSON.parse(raw);
        } catch (err) {
            try {
                localStorage.removeItem(key);
            } catch (e2) { /* ignore */ }
        }
    }

    var keys = [];
    var i;
    for (i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
    }

    for (i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!k) continue;
        if (/_AllPresets$/.test(k) && /^base_/.test(k)) {
            removeIfBadJson(k);
            continue;
        }
        if (/^base_KqT8oo80_coinRecentResults$/.test(k) || /^base_Ku8K3cGn_coinRecentResults$/.test(k)) {
            removeIfBadJson(k);
        }
    }
})();
