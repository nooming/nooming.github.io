/* global iziToast, window */
(function () {
    function promptDuplicateKick(data, sendFn) {
        if (!data || !data.targets || !data.targets.length) return
        var targets = data.targets
            .map(function (id) { return parseInt(id, 10) })
            .filter(function (id) { return !Number.isNaN(id) })
        if (!targets.length) return
        var names = (data.names || []).map(function (name, idx) {
            return name && name.length ? name : '玩家 #' + targets[idx]
        })
        var listText = names.join('、')
        iziToast.question({
            timeout: false,
            closeOnEscape: true,
            overlay: true,
            drag: false,
            class: 'myToast',
            title: '重复登录',
            message: listText + ' 正在使用同一个账号。要踢出他们吗？',
            buttons: [
                ['<button>踢出</button>', function (instance, toast) {
                    if (typeof sendFn === 'function') sendFn('kick same ' + targets.join(','))
                    instance.hide({ transitionOut: 'fadeOut' }, toast, 'button')
                }, true],
                ['<button>暂不</button>', function (instance, toast) {
                    instance.hide({ transitionOut: 'fadeOut' }, toast, 'button')
                }]
            ]
        })
    }

    window.DuplicateModal = {
        prompt: promptDuplicateKick
    }
})()
