// ========== MBTI 测试 · 题库与计分 ==========
// 20 题轻量问卷：四维倾向统计后交给 QuizEngine 展示结果。

(function () {
    'use strict';

    var STORAGE_PREFIX = 'mbti_q';

    var QUESTIONS = [
        { q: '在聚会中，你通常', a: '主动与很多人交流', b: '与少数人深入交谈', dim: 'EI' },
        { q: '感觉精力不足时，你更想', a: '找人一起做事或聊天', b: '独自待着静一静', dim: 'EI' },
        { q: '遇到新想法时，你更常', a: '边说边理清思路', b: '先想清楚再开口', dim: 'EI' },
        { q: '在压力下，你更可能', a: '变得更想活动、找人商量', b: '变得更想安静、自己消化', dim: 'EI' },
        { q: '学习或工作时，你更舒服的是', a: '和他人一起推进', b: '独自专注完成', dim: 'EI' },

        { q: '学习新事物时，你更依赖', a: '动手实践和具体例子', b: '概念框架和抽象理解', dim: 'SN' },
        { q: '你更关注', a: '事实和细节', b: '可能性和整体', dim: 'SN' },
        { q: '描述一件事时，你更常', a: '讲清楚具体发生了什么', b: '讲其中的含义和模式', dim: 'SN' },
        { q: '做方案时，你更看重', a: '当下可验证、可落地的信息', b: '方向、愿景和长远可能', dim: 'SN' },
        { q: '回忆一段经历时，你更容易想起', a: '具体场景和细节', b: '整体氛围和启发', dim: 'SN' },

        { q: '做决定时，你更注重', a: '逻辑和客观分析', b: '价值观和他人感受', dim: 'TF' },
        { q: '给出反馈时，你更可能', a: '直接指出问题', b: '先照顾对方感受', dim: 'TF' },
        { q: '你更重视', a: '公正和原则', b: '和谐与体谅', dim: 'TF' },
        { q: '争论时，你更在意', a: '道理是否站得住', b: '关系会不会受伤', dim: 'TF' },
        { q: '衡量对错时，你更依赖', a: '客观标准', b: '个人价值观', dim: 'TF' },

        { q: '安排日程时，你更喜欢', a: '提前规划好再开始', b: '保留弹性、到时再定', dim: 'JP' },
        { q: '对待截止日期，你更常', a: '尽早完成', b: '临近时再集中冲刺', dim: 'JP' },
        { q: '面对选择，你更倾向', a: '尽快定下来并执行', b: '多留几种可能观望', dim: 'JP' },
        { q: '工作方式上，你更喜欢', a: '一件事做完再开下一件', b: '几件事交叉推进', dim: 'JP' },
        { q: '对规则和流程，你更觉得', a: '有结构更安心', b: '能灵活调整更舒服', dim: 'JP' }
    ];

    var TYPE_DESCRIPTIONS = {
        'INTJ': '建筑师 - 你偏战略思考，喜欢独立推进，追求创新和效率。善于分析复杂问题、制定长期计划。',
        'INTP': '逻辑学家 - 你对理论和抽象概念更有热情，善于发现模式、拆解问题，对重复琐事可能兴趣较低。',
        'ENTJ': '指挥官 - 你偏果断、有目标感，善于组织推进，追求效率与结果，有时会显得强势。',
        'ENTP': '辩论家 - 你好奇、爱挑战既有说法，点子多、反应快，对收尾细节可能耐心不足。',
        'INFJ': '提倡者 - 你重意义与洞察，愿意支持他人成长，理想感强，偶尔会把自己逼得太紧。',
        'INFP': '调停者 - 你重个人价值观与共情，追求和谐与表达，有时会过于敏感或理想化。',
        'ENFJ': '主人公 - 你善于带动他人、关注共同目标，同理心强，也可能过度卷入别人的需求。',
        'ENFP': '竞选者 - 你热情、爱探索新可能，创造力强，专注与纪律有时会跟不上热情。',
        'ISTJ': '物流师 - 你务实、可靠、重条理，擅长按计划执行，灵活性有时不是你的第一选择。',
        'ISFJ': '守护者 - 你细心负责、重视稳定与照顾他人，可能偏保守、不爱轻易打破惯例。',
        'ESTJ': '总经理 - 你组织力强、做事干脆，重视责任与效率，情感层面的细腻沟通可能不是强项。',
        'ESFJ': '执政官 - 你热情负责、善于社交，关心他人与氛围，有时会过于在意别人看法。',
        'ISTP': '鉴赏家 - 你务实、动手能力强，喜欢灵活解决问题，长期规划未必是优先项。',
        'ISFP': '探险家 - 你重感受与美感，活在当下、追求自在，计划性可能偏弱。',
        'ESTP': '企业家 - 你行动快、善于应对现场变化，务实敢试，长期规划有时跟不上节奏。',
        'ESFP': '表演者 - 你热情、爱互动，享受当下氛围，深度沉淀与长期规划可能较少。'
    };

    var DIMENSIONS = [
        { left: 'E', right: 'I', label: '精力方向' },
        { left: 'S', right: 'N', label: '信息获取' },
        { left: 'T', right: 'F', label: '决策方式' },
        { left: 'J', right: 'P', label: '生活节奏' }
    ];

    var els = {
        progressText: document.getElementById('progress-text'),
        progressFill: document.getElementById('progress-fill'),
        progressBar: document.getElementById('progress-bar'),
        questionContainer: document.getElementById('questions-container'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        controls: document.getElementById('quiz-controls'),
        resultContainer: document.getElementById('result-container'),
        resultType: document.getElementById('result-type'),
        resultDescription: document.getElementById('result-description'),
        dimensionBars: document.getElementById('dimension-bars'),
        resultTies: document.getElementById('result-ties'),
        resultResume: document.getElementById('result-resume'),
        live: document.getElementById('quiz-live'),
        restartBtn: document.getElementById('restart-btn'),
        copyBtn: document.getElementById('copy-result-btn'),
        shareBtn: document.getElementById('share-result-btn')
    };

    var lastShareText = '';

    function tally(answers) {
        var scores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
        answers.forEach(function (answer, index) {
            if (!answer) return;
            var dim = QUESTIONS[index].dim;
            scores[answer === 'A' ? dim[0] : dim[1]] += 1;
        });
        return scores;
    }

    function pickLetter(left, right, scores) {
        var leftScore = scores[left];
        var rightScore = scores[right];
        return {
            letter: leftScore >= rightScore ? left : right,
            tied: leftScore === rightScore,
            left: left,
            right: right,
            leftScore: leftScore,
            rightScore: rightScore
        };
    }

    function renderDimensions(dims) {
        els.dimensionBars.replaceChildren();

        dims.forEach(function (dim) {
            var total = dim.leftScore + dim.rightScore || 1;
            var leftPercent = (dim.leftScore / total) * 100;

            var row = document.createElement('div');
            row.className = 'dim-row';

            var labels = document.createElement('div');
            labels.className = 'dim-labels';

            var left = document.createElement('span');
            left.textContent = dim.left + ' ' + dim.leftScore;

            var right = document.createElement('span');
            right.textContent = dim.rightScore + ' ' + dim.right;

            labels.appendChild(left);
            if (dim.tied) {
                var tie = document.createElement('span');
                tie.className = 'dim-tie-tag';
                tie.textContent = '打平';
                labels.appendChild(tie);
            }
            labels.appendChild(right);

            var track = document.createElement('div');
            track.className = 'dim-track';
            track.setAttribute('role', 'img');
            track.setAttribute(
                'aria-label',
                dim.left + ' ' + dim.leftScore + '，' + dim.right + ' ' + dim.rightScore
            );

            var fill = document.createElement('div');
            fill.className = 'dim-fill dim-fill-left';
            fill.style.width = leftPercent.toFixed(1) + '%';

            track.appendChild(fill);
            row.appendChild(labels);
            row.appendChild(track);
            els.dimensionBars.appendChild(row);
        });
    }

    function buildShareText(type, description, dims) {
        var lines = [
            '我的 MBTI 类型是 ' + type,
            description,
            '',
            dims.map(function (dim) {
                return dim.left + '/' + dim.right + '：' + dim.leftScore + ' / ' + dim.rightScore;
            }).join('　'),
            '',
            '来自 noomings.com 的 20 题轻量测试'
        ];
        return lines.join('\n');
    }

    function onFinish(answers, meta) {
        var scores = tally(answers);
        var dims = DIMENSIONS.map(function (dim) {
            return pickLetter(dim.left, dim.right, scores);
        });
        var type = dims.map(function (dim) { return dim.letter; }).join('');
        var description = TYPE_DESCRIPTIONS[type] || ('你的 MBTI 类型是 ' + type);

        els.resultType.textContent = type;
        els.resultType.setAttribute('aria-label', '你的 MBTI 类型是 ' + type);
        els.resultDescription.textContent = description;
        renderDimensions(dims);

        var ties = dims.filter(function (dim) { return dim.tied; });
        els.resultTies.textContent = ties.length
            ? ties.map(function (dim) {
                return dim.left + '/' + dim.right + ' 维度打平（各 ' + dim.leftScore + '），字母暂取 ' + dim.letter;
            }).join('；') + '。'
            : '';

        els.resultResume.hidden = !meta.resumed;

        lastShareText = buildShareText(type, description, dims);
    }

    function copyResult() {
        if (!lastShareText) return;
        if (typeof copyToClipboard === 'function') {
            copyToClipboard(lastShareText, '结果已复制');
            return;
        }
        navigator.clipboard.writeText(lastShareText).then(function () {
            if (typeof showToast === 'function') showToast('结果已复制', 'success');
        }).catch(function () {
            if (typeof showToast === 'function') showToast('复制失败，请手动选择文本', 'error');
        });
    }

    function shareResult() {
        if (!lastShareText) return;

        if (navigator.share) {
            navigator.share({
                title: '我的 MBTI 类型是 ' + els.resultType.textContent,
                text: lastShareText,
                url: location.href
            }).catch(function () {
                // 用户取消分享时不提示
            });
            return;
        }

        copyResult();
    }

    els.copyBtn.addEventListener('click', copyResult);
    els.shareBtn.addEventListener('click', shareResult);

    new QuizEngine({
        prefix: STORAGE_PREFIX,
        questions: QUESTIONS,
        els: els,
        onFinish: onFinish
    });
})();
