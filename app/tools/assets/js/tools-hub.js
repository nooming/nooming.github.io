// ========== 工具目录 · 即时筛选 ==========
// 按卡片文本过滤，空分组与空分组标题一并隐藏。

(function () {
    'use strict';

    var input = document.getElementById('tools-search');
    var empty = document.getElementById('tools-empty');
    var count = document.getElementById('tools-count');
    if (!input) return;

    var cards = Array.prototype.slice.call(document.querySelectorAll('.feature-card'));
    var groups = Array.prototype.slice.call(document.querySelectorAll('.features'));
    var titles = Array.prototype.slice.call(document.querySelectorAll('.tools-group-title'));
    var total = cards.length;

    function normalize(text) {
        return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function apply() {
        var query = normalize(input.value);
        var visible = 0;

        cards.forEach(function (card) {
            var match = !query || normalize(card.textContent).indexOf(query) !== -1;
            card.hidden = !match;
            if (match) visible += 1;
        });

        groups.forEach(function (group) {
            group.hidden = !group.querySelector('.feature-card:not([hidden])');
        });

        titles.forEach(function (title) {
            var group = title.nextElementSibling;
            title.hidden = !group || group.hidden;
        });

        if (empty) empty.hidden = visible !== 0;
        if (count) {
            count.textContent = query
                ? visible + ' / ' + total + ' 个工具'
                : total + ' 个工具';
        }
    }

    input.addEventListener('input', apply);
    apply();
})();
