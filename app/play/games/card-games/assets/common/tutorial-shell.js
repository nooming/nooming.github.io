/* global $, window */
var sso = {
    realname: '游客',
    oid: '',
    paused: [],
    user: '',
    priv: 1,
    pushKey: '',
    isTea: 0,
    rot: '',
    root: ''
}

$(function () {
    try {
        var q = new URLSearchParams(location.search)
        var nick = q.get('nick')
        if (nick) {
            nick = decodeURIComponent(nick).trim().slice(0, 32)
            if (nick) localStorage.setItem('SDSZ_STANDALONE_NICK', nick)
        }
        var stored = localStorage.getItem('SDSZ_STANDALONE_NICK')
        if (stored && stored.trim()) sso.realname = stored.trim().slice(0, 32)
    } catch (e) {}
})

(function () {
    function open(opts) {
        opts = opts || {}
        $('.list-all').hide()
        $('.chat').show()
        $('.decor').hide()
        $('.tutor').show()
        $('.tutor-svg').show()
        $('.tutor-svg-2').html('')
        $('.btn-exit').removeClass('btn-danger')
        if (typeof opts.onOpen === 'function') opts.onOpen()
    }

    function close(opts) {
        opts = opts || {}
        $('.list-all').show()
        $('.chat').hide()
        $('.decor').show()
        $('.tutor').hide()
        if (typeof opts.onClose === 'function') opts.onClose()
    }

    window.TutorialShell = {
        open: open,
        close: close
    }
})()
