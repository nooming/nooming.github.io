/* global $ */
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
