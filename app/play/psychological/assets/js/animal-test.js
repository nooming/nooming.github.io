// ========== 动物塑测试 · 题库与原型匹配 ==========
// 20 题映射 20 组倾向；与原型权重做匹配，取最高分动物。

(function () {
    'use strict';

    var STORAGE_PREFIX = 'animal_q';
    var SPRITE = '../../../../assets/icons/ui/animal-sprite.svg';

    var QUESTIONS = [
        { q: '在社交场合，你更倾向于', a: '主动与他人交流', b: '观察和倾听', dim: 'active_observe' },
        { q: '面对压力时，你更可能', a: '直接面对并解决', b: '需要时间思考', dim: 'direct_think' },
        { q: '你更喜欢', a: '有计划的行动', b: '灵活应变', dim: 'plan_flexible' },
        { q: '在团队中，你更倾向于', a: '领导他人', b: '支持他人', dim: 'lead_support' },
        { q: '你更关注', a: '细节和具体', b: '整体和概念', dim: 'detail_whole' },
        { q: '你更倾向于', a: '表达自己的想法', b: '倾听他人意见', dim: 'express_listen' },
        { q: '你更喜欢', a: '稳定的环境', b: '变化的环境', dim: 'stable_change' },
        { q: '做决定时，你更依赖', a: '逻辑分析', b: '直觉感受', dim: 'logic_intuition' },
        { q: '你更倾向于', a: '独立工作', b: '团队合作', dim: 'independent_team' },
        { q: '你更喜欢', a: '安静的环境', b: '热闹的环境', dim: 'quiet_lively' },
        { q: '你更可能', a: '坚持自己的观点', b: '适应他人', dim: 'persist_adapt' },
        { q: '你更关注', a: '现在和当下', b: '未来和可能', dim: 'present_future' },
        { q: '你更倾向于', a: '快速行动', b: '深思熟虑', dim: 'fast_deliberate' },
        { q: '你更喜欢', a: '明确的规则', b: '自由的空间', dim: 'rule_free' },
        { q: '你更可能', a: '直接表达情绪', b: '控制情绪', dim: 'emo_control' },
        { q: '你更倾向于', a: '竞争和挑战', b: '合作和和谐', dim: 'compete_cooperate' },
        { q: '你更喜欢', a: '熟悉的事物', b: '新鲜的事物', dim: 'familiar_new' },
        { q: '你更可能', a: '主动寻求变化', b: '保持现状', dim: 'seekchange_keep' },
        { q: '你更倾向于', a: '关注他人需求', b: '关注自己需求', dim: 'others_self' },
        { q: '你更喜欢', a: '结构化的方式', b: '自由的方式', dim: 'structured_freestyle' }
    ];

    var TRAIT_LABELS = {
        active: '偏活跃外向', observe: '偏观察倾听',
        direct: '偏直接应对', think: '偏先想再动',
        plan: '偏计划推进', flexible: '偏灵活应变',
        lead: '偏主导推进', support: '偏支援配合',
        detail: '偏细节具体', whole: '偏整体概念',
        express: '偏表达己见', listen: '偏倾听他人',
        stable: '偏好稳定环境', change: '偏好变化环境',
        logic: '偏逻辑分析', intuition: '偏直觉感受',
        independent: '偏独立工作', team: '偏团队合作',
        quiet: '偏好安静', lively: '偏好热闹',
        persist: '偏坚持己见', adapt: '偏适应他人',
        present: '偏关注当下', future: '偏关注未来',
        fast: '偏快速行动', deliberate: '偏深思熟虑',
        rule: '偏明确规则', free: '偏自由空间',
        emo: '偏直接表达情绪', control: '偏控制情绪',
        compete: '偏竞争挑战', cooperate: '偏合作和谐',
        familiar: '偏好熟悉事物', new: '偏好新鲜事物',
        seekchange: '偏主动求变', keep: '偏保持现状',
        others: '偏关注他人', self: '偏关注自我',
        structured: '偏结构化方式', freestyle: '偏自由方式'
    };

    // 原型权重：正值表示该侧更贴合
    var PROTOTYPES = {
        lion: {
            lead: 2, compete: 2, direct: 2, persist: 1.5, active: 1.5,
            express: 1, fast: 1, self: 0.5, structured: 0.5
        },
        eagle: {
            independent: 2, future: 2, whole: 1.5, direct: 1.5, self: 1.5,
            free: 1, persist: 1, seekchange: 0.5, logic: 0.5
        },
        dolphin: {
            active: 2, lively: 2, team: 1.5, cooperate: 1.5, express: 1.5,
            flexible: 1, emo: 1, new: 0.5, others: 0.5
        },
        bear: {
            stable: 2, structured: 2, plan: 1.5, support: 1.5, familiar: 1.5,
            keep: 1, rule: 1, deliberate: 0.5, present: 0.5
        },
        wolf: {
            team: 2, cooperate: 2, others: 1.5, persist: 1, lead: 1,
            active: 0.5, logic: 0.5, structured: 0.5, present: 0.5
        },
        fox: {
            flexible: 2, adapt: 2, seekchange: 1.5, intuition: 1.5, new: 1.5,
            observe: 1, freestyle: 1, fast: 0.5, change: 0.5
        },
        cat: {
            independent: 2, quiet: 2, free: 1.5, self: 1.5, control: 1.5,
            observe: 1, freestyle: 1, think: 0.5, keep: 0.5
        },
        rabbit: {
            support: 2, cooperate: 1.5, others: 1.5, intuition: 1.5, observe: 1.5,
            quiet: 1, adapt: 1, emo: 0.5, familiar: 0.5
        }
    };

    var ANIMALS = {
        lion: { iconId: 'a-lion', name: '狮子', description: '你更像狮子：偏主导、直接、敢竞争。擅长把目标推到前面，有时会显得强势，需要留意是否压到他人节奏。' },
        eagle: { iconId: 'a-eagle', name: '老鹰', description: '你更像老鹰：独立、看远、少依赖群体。善于从高处看问题并独自推进，有时会显得疏离或难以被靠近。' },
        dolphin: { iconId: 'a-dolphin', name: '海豚', description: '你更像海豚：活跃、合群、爱互动。沟通与协作通常是你的舒适区，深度专注和长期收束有时会差点劲。' },
        bear: { iconId: 'a-bear', name: '熊', description: '你更像熊：稳重、重结构、求安全。可靠和耐心是优势，变化太快或规则被打破时可能显得保守。' },
        wolf: { iconId: 'a-wolf', name: '狼', description: '你更像狼：重团队、讲配合、在群体里找位置。忠诚与协作感强，独自决策或脱离集体时可能不那么自在。' },
        fox: { iconId: 'a-fox', name: '狐狸', description: '你更像狐狸：灵活、善变通、观察快。适应环境是强项，有时会显得跳脱或不够坚持同一条路。' },
        cat: { iconId: 'a-cat', name: '猫', description: '你更像猫：独立、安静、按自己的节奏来。独处与边界感清晰，有时会让人觉得难懂或不够主动。' },
        rabbit: { iconId: 'a-rabbit', name: '兔子', description: '你更像兔子：温和、敏感、重视氛围。善于体察细节与他人感受，压力大时可能更容易退缩或过度在意评价。' }
    };

    var els = {
        progressText: document.getElementById('progress-text'),
        progressFill: document.getElementById('progress-fill'),
        progressBar: document.getElementById('progress-bar'),
        questionContainer: document.getElementById('questions-container'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        controls: document.getElementById('quiz-controls'),
        resultContainer: document.getElementById('result-container'),
        resultAnimal: document.getElementById('result-animal'),
        resultType: document.getElementById('result-type'),
        resultDescription: document.getElementById('result-description'),
        resultTraits: document.getElementById('result-traits'),
        resultResume: document.getElementById('result-resume'),
        live: document.getElementById('quiz-live'),
        restartBtn: document.getElementById('restart-btn'),
        copyBtn: document.getElementById('copy-result-btn'),
        shareBtn: document.getElementById('share-result-btn')
    };

    var lastShareText = '';

    function emptyScores() {
        var scores = {};
        QUESTIONS.forEach(function (question) {
            var parts = question.dim.split('_');
            scores[parts[0]] = 0;
            scores[parts[1]] = 0;
        });
        return scores;
    }

    function tally(answers) {
        var scores = emptyScores();
        answers.forEach(function (answer, index) {
            if (!answer) return;
            var parts = QUESTIONS[index].dim.split('_');
            scores[answer === 'A' ? parts[0] : parts[1]] += 1;
        });
        return scores;
    }

    function matchScore(scores, prototype) {
        return Object.keys(prototype).reduce(function (sum, key) {
            return sum + (scores[key] || 0) * prototype[key];
        }, 0);
    }

    function pickAnimal(scores) {
        var best = 'rabbit';
        var bestScore = -Infinity;

        Object.keys(PROTOTYPES).forEach(function (key) {
            var score = matchScore(scores, PROTOTYPES[key]);
            if (score > bestScore) {
                bestScore = score;
                best = key;
            }
        });

        return { key: best, score: bestScore };
    }

    function topTendencies(scores, animalKey, limit) {
        var prototype = PROTOTYPES[animalKey] || {};
        var ranked = Object.keys(prototype)
            .filter(function (key) { return (scores[key] || 0) > 0 && TRAIT_LABELS[key]; })
            .sort(function (a, b) {
                return (scores[b] * prototype[b]) - (scores[a] * prototype[a]) || a.localeCompare(b);
            })
            .map(function (key) { return TRAIT_LABELS[key]; });

        if (ranked.length >= limit) return ranked.slice(0, limit);

        var extra = Object.keys(scores)
            .filter(function (key) {
                return scores[key] > 0 && TRAIT_LABELS[key] && !ranked.includes(TRAIT_LABELS[key]);
            })
            .sort(function (a, b) { return scores[b] - scores[a] || a.localeCompare(b); })
            .map(function (key) { return TRAIT_LABELS[key]; });

        return ranked.concat(extra).slice(0, limit);
    }

    function renderTraits(tendencies) {
        els.resultTraits.replaceChildren();

        var heading = document.createElement('h3');
        heading.textContent = '主要倾向';

        var list = document.createElement('ul');
        tendencies.forEach(function (trait) {
            var item = document.createElement('li');
            item.textContent = trait;
            list.appendChild(item);
        });

        els.resultTraits.appendChild(heading);
        els.resultTraits.appendChild(list);
    }

    function renderAnimalIcon(name, iconId) {
        els.resultAnimal.replaceChildren();

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'result-animal-svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', name + '图示');

        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', SPRITE + '#' + iconId);
        svg.appendChild(use);

        els.resultAnimal.appendChild(svg);
    }

    function buildShareText(animal, tendencies) {
        return [
            '我的动物塑是 ' + animal.name,
            animal.description,
            '主要倾向：' + tendencies.join('、'),
            '',
            '来自 noomings.com 的 20 题轻量测试'
        ].join('\n');
    }

    function onFinish(answers, meta) {
        var scores = tally(answers);
        var picked = pickAnimal(scores);
        var animal = ANIMALS[picked.key];
        var tendencies = topTendencies(scores, picked.key, 3);

        renderAnimalIcon(animal.name, animal.iconId);
        els.resultType.textContent = animal.name;
        els.resultType.setAttribute('aria-label', '最接近的动物是 ' + animal.name);
        els.resultDescription.textContent = animal.description;
        renderTraits(tendencies);
        els.resultResume.hidden = !meta.resumed;

        lastShareText = buildShareText(animal, tendencies);
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
                title: '我的动物塑是 ' + els.resultType.textContent,
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
