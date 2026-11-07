// ========== 心理测试 · 问卷引擎 ==========
// 职责：题目渲染、作答持久化、进度、结果面板切换。
// 计分与结果渲染由各页传入的 onFinish(answers, meta) 负责。

(function (global) {
    'use strict';

    function safeGet(key) {
        try {
            return global.localStorage.getItem(key);
        } catch (err) {
            return null;
        }
    }

    function safeSet(key, value) {
        try {
            global.localStorage.setItem(key, value);
        } catch (err) {
            // 隐私模式/配额满时静默降级：本次会话仍可作答
        }
    }

    function safeRemove(key) {
        try {
            global.localStorage.removeItem(key);
        } catch (err) {
            // 同上
        }
    }

    function QuizEngine(config) {
        this.prefix = config.prefix;
        this.questions = config.questions;
        this.onFinish = config.onFinish;
        this.els = config.els;
        this.answers = new Array(this.questions.length).fill(null);
        this.index = 0;
        this.finished = false;
        this.restarting = false;

        this.load();
        this.bindEvents();
        this.start();
    }

    QuizEngine.prototype.storageKey = function (index) {
        return this.prefix + index;
    };

    QuizEngine.prototype.load = function () {
        for (var i = 0; i < this.questions.length; i++) {
            var saved = safeGet(this.storageKey(i));
            this.answers[i] = saved === 'A' || saved === 'B' ? saved : null;
        }
    };

    QuizEngine.prototype.firstUnanswered = function () {
        for (var i = 0; i < this.answers.length; i++) {
            if (!this.answers[i]) return i;
        }
        return 0;
    };

    QuizEngine.prototype.allAnswered = function () {
        return this.answers.every(function (answer) {
            return answer === 'A' || answer === 'B';
        });
    };

    QuizEngine.prototype.start = function () {
        // 全部答过：直接回到结果，避免停在最后一题却无路可走
        if (this.allAnswered()) {
            this.finish(true);
            return;
        }
        this.goTo(this.firstUnanswered());
    };

    QuizEngine.prototype.goTo = function (index) {
        this.index = index;
        this.render();
    };

    QuizEngine.prototype.render = function () {
        var self = this;
        var question = this.questions[this.index];
        var answered = this.answers[this.index];

        var wrapper = document.createElement('div');
        wrapper.className = 'question-container active';

        var title = document.createElement('h2');
        title.className = 'question';
        title.id = 'quiz-question';
        title.tabIndex = -1;
        title.textContent = question.q;
        wrapper.appendChild(title);

        var options = document.createElement('div');
        options.className = 'options';
        options.setAttribute('role', 'group');
        options.setAttribute('aria-labelledby', 'quiz-question');

        [['A', question.a], ['B', question.b]].forEach(function (item) {
            var letter = item[0];
            var text = item[1];

            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'option';
            button.dataset.option = letter;
            button.setAttribute('aria-pressed', answered === letter ? 'true' : 'false');
            if (answered === letter) button.classList.add('selected');

            var label = document.createElement('span');
            label.className = 'option__text';
            label.textContent = text;

            button.appendChild(label);
            options.appendChild(button);
        });

        wrapper.appendChild(options);
        this.els.questionContainer.replaceChildren(wrapper);

        this.updateProgress();
        this.updateButtons();

        // 移动焦点到题干，方便读屏念出题目
        try {
            title.focus({ preventScroll: true });
        } catch (err) {
            title.focus();
        }

        this.announce('第 ' + (this.index + 1) + ' 题，共 ' + this.questions.length + ' 题。' + question.q);
    };

    QuizEngine.prototype.select = function (letter) {
        if (this.finished) return;
        if (letter !== 'A' && letter !== 'B') return;

        this.answers[this.index] = letter;
        safeSet(this.storageKey(this.index), letter);

        var buttons = this.els.questionContainer.querySelectorAll('.option');
        for (var i = 0; i < buttons.length; i++) {
            var button = buttons[i];
            var active = button.dataset.option === letter;
            button.classList.toggle('selected', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        }

        this.updateButtons();
        this.announce('已选择第 ' + (letter === 'A' ? 1 : 2) + ' 项。');
    };

    QuizEngine.prototype.next = function () {
        if (this.finished || !this.answers[this.index]) return;
        if (this.index < this.questions.length - 1) {
            this.goTo(this.index + 1);
        } else {
            this.finish(false);
        }
    };

    QuizEngine.prototype.prev = function () {
        if (this.finished || this.index === 0) return;
        this.goTo(this.index - 1);
    };

    QuizEngine.prototype.updateProgress = function () {
        var progress = ((this.index + 1) / this.questions.length) * 100;
        this.els.progressFill.style.width = progress.toFixed(2) + '%';
        this.els.progressText.textContent =
            '问题 ' + (this.index + 1) + ' / ' + this.questions.length;

        if (this.els.progressBar) {
            this.els.progressBar.setAttribute('aria-valuenow', String(this.index + 1));
            this.els.progressBar.setAttribute('aria-valuemax', String(this.questions.length));
        }
    };

    QuizEngine.prototype.updateButtons = function () {
        var answered = Boolean(this.answers[this.index]);
        var last = this.index === this.questions.length - 1;

        if (this.els.prevBtn) this.els.prevBtn.disabled = this.index === 0;
        if (this.els.nextBtn) {
            this.els.nextBtn.disabled = !answered;
            this.els.nextBtn.textContent = last && answered ? '查看结果' : '下一题';
        }
    };

    QuizEngine.prototype.finish = function (resumed) {
        this.finished = true;

        this.els.progressText.hidden = true;
        this.els.progressBar.hidden = true;
        this.els.controls.hidden = true;

        this.onFinish(this.answers.slice(), { resumed: Boolean(resumed) });

        this.els.resultContainer.classList.add('show');
        this.els.resultContainer.tabIndex = -1;
        try {
            this.els.resultContainer.focus({ preventScroll: true });
        } catch (err) {
            this.els.resultContainer.focus();
        }

        var summary = this.els.resultType ? this.els.resultType.textContent : '';
        this.announce((resumed ? '已恢复上次结果' : '结果已生成') + (summary ? '：' + summary : ''));    };

    QuizEngine.prototype.restart = function () {
        for (var i = 0; i < 100; i++) {
            safeRemove(this.storageKey(i));
        }

        this.answers = new Array(this.questions.length).fill(null);
        this.finished = false;

        this.els.resultContainer.classList.remove('show');
        this.els.progressText.hidden = false;
        this.els.progressBar.hidden = false;
        this.els.controls.hidden = false;

        this.goTo(0);
        this.announce('已重新开始。');
    };

    QuizEngine.prototype.announce = function (message) {
        if (!this.els.live) return;
        var live = this.els.live;
        live.textContent = '';
        global.setTimeout(function () {
            live.textContent = message;
        }, 30);
    };

    QuizEngine.prototype.bindEvents = function () {
        var self = this;

        this.els.questionContainer.addEventListener('click', function (event) {
            var button = event.target.closest('.option');
            if (!button || !self.els.questionContainer.contains(button)) return;
            self.select(button.dataset.option);
        });

        this.els.prevBtn.addEventListener('click', function () {
            self.prev();
        });

        this.els.nextBtn.addEventListener('click', function () {
            self.next();
        });

        var restartBtn = this.els.restartBtn;
        if (restartBtn) {
            restartBtn.addEventListener('click', function () {
                self.restart();
            });
        }
    };

    global.QuizEngine = QuizEngine;
})(window);
