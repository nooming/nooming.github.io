/* global sso, cur, me, tt, socket, drawTable, drawButtons, drawUnoAll, validCard, $ */

const unoAi = {
    enabled: false,
    timer: null,
    deck: [],
    discard: [],
    pendingPenalty: 0,
    penaltyMax: 0,
    drawnThisTurn: false,
    pendingWild: null
}

function stopUnoAiTimer() {
    if (!unoAi.timer) return
    clearTimeout(unoAi.timer)
    unoAi.timer = null
}

function startAIBattle() {
    if (socket) socket.close()
    unoAi.enabled = true
    socket = {
        send: handleUnoAiCommand,
        close: () => {
            stopUnoAiTimer()
            socket = null
            $('.list-all').show()
            $('.chat').hide()
            $('.decor').show()
            $('.uno-svg').html('')
            $('.uno-btns').html('')
            $('.uno-btns-down').html('')
        }
    }
    $('.list-all').hide()
    $('.chat').show()
    $('.decor').hide()
    $('.btn-exit').removeClass('btn-danger')
    initUnoAiRound()
}

function handleUnoAiCommand(cmd) {
    if (!unoAi.enabled || !socket) return
    if (cmd === 'closing') return socket.close()
    if (cmd === 'ready' && (tt == 0 || tt == 3)) return initUnoAiRound()
    if (cmd.startsWith('hover')) return
    if (cmd === 'down') return unoAiDrawAction()
    if (cmd.startsWith('sel ')) return unoAiSelectColor(cmd.split(' ')[1] || 'R')
    if (cmd.startsWith('up ')) {
        const payload = cmd.slice(3)
        if (payload === 'skip') return unoAiSkipAction()
        return unoAiPlayCard(cur.now, payload, true)
    }
}

function initUnoAiRound() {
    stopUnoAiTimer()
    const players = [0, 1, 2, 3]
    const names = { 0: sso.realname || '你', 1: 'AI-1', 2: 'AI-2', 3: 'AI-3' }
    unoAi.deck = drawUnoAll()
    unoAiShuffle(unoAi.deck)
    unoAi.discard = []
    unoAi.pendingPenalty = 0
    unoAi.penaltyMax = 0
    unoAi.drawnThisTurn = false
    unoAi.pendingWild = null
    const hands = { 0: [], 1: [], 2: [], 3: [] }
    for (let r = 0; r < 7; r++) for (let i = 0; i < players.length; i++) hands[players[i]].push(unoAiDrawCard())
    let starter = unoAiDrawCard()
    if (starter[0] == '!') starter = unoAiNormalizeWild(starter, 'R')
    unoAi.discard.push(starter)
    cur = {
        num: 4,
        plist: players,
        cards: hands,
        name: names,
        isIngame: { 0: 1, 1: 1, 2: 1, 3: 1 },
        isReady: { 0: 0, 1: 1, 2: 1, 3: 1 },
        isOffline: {},
        left: { 0: 7, 1: 7, 2: 7, 3: 7 },
        won: { 0: 0, 1: 0, 2: 0, 3: 0 },
        wonList: [],
        history: [[0, 0]],
        cen: starter,
        you: 0,
        now: 0,
        rot: 1,
        ban: 0,
        banDraw: 0,
        toDraw: 0,
        st: 1,
        initLeft: 7,
        readyCnt: 3,
        wasReady: -1,
        allLeft: unoAi.deck.length
    }
    tt = 1
    me.card = ''
    unoAiUpdateTurnFlags()
    drawTable()
    drawButtons()
    scheduleUnoAiTurn()
}

function unoAiDrawCard() {
    if (!unoAi.deck.length) {
        const top = unoAi.discard.pop()
        unoAi.deck = [...unoAi.discard]
        unoAi.discard = top ? [top] : []
        unoAiShuffle(unoAi.deck)
    }
    return unoAi.deck.pop()
}

function unoAiShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const t = arr[i]
        arr[i] = arr[j]
        arr[j] = t
    }
}

function unoAiNormalizeWild(card, color) {
    if (card[0] != '!') return card
    return card.length >= 3 ? card : (card + color)
}

function unoAiCountColor(uid) {
    const cnt = { R: 0, G: 0, B: 0, Y: 0 }
    ;(cur.cards[uid] || []).forEach(c => { if (cnt[c[0]] !== undefined) cnt[c[0]]++ })
    return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || 'R'
}

function unoAiApplyTurnAdvance(nextUid) {
    cur.now = nextUid
    unoAi.drawnThisTurn = false
    me.card = ''
    unoAiUpdateTurnFlags()
    drawTable()
    drawButtons()
    scheduleUnoAiTurn()
}

function unoAiUpdateTurnFlags() {
    const players = cur.plist || []
    players.forEach(uid => cur.left[uid] = (cur.cards[uid] || []).length)
    cur.allLeft = unoAi.deck.length
    if (unoAi.pendingPenalty > 0) {
        if (!unoAi.penaltyMax || unoAi.pendingPenalty > unoAi.penaltyMax) unoAi.penaltyMax = unoAi.pendingPenalty
        cur.ban = '+'
        cur.banDraw = unoAi.penaltyMax
        cur.toDraw = unoAi.pendingPenalty
    } else {
        cur.ban = 0
        cur.banDraw = 0
        cur.toDraw = unoAi.drawnThisTurn ? 1 : 0
        unoAi.penaltyMax = 0
    }
    cur.st = tt
}

function unoAiNextPlayer(uid, step = 1) {
    const plist = cur.plist || [0, 1, 2, 3]
    let idx = plist.indexOf(uid)
    for (let s = 0; s < step; s++) idx = (idx + (cur.rot ? 1 : -1) + plist.length) % plist.length
    return plist[idx]
}

function unoAiEndRound(winnerUid) {
    stopUnoAiTimer()
    tt = 3
    cur.st = 3
    cur.now = winnerUid
    cur.won = { 0: 0, 1: 0, 2: 0, 3: 0 }
    cur.won[winnerUid] = 1
    cur.wonList = [winnerUid]
    cur.readyCnt = 3
    cur.wasReady = -1
    unoAi.pendingPenalty = 0
    unoAi.drawnThisTurn = false
    unoAiUpdateTurnFlags()
    drawTable()
    drawButtons(`${cur.name[winnerUid]} 获胜。<br><br>`)
}

function unoAiPlayCard(uid, card, fromHuman = false) {
    if (tt != 1 || uid != cur.now) return
    const hand = cur.cards[uid] || []
    if (!hand.includes(card) || !validCard(cur.cen, card)) return
    hand.splice(hand.indexOf(card), 1)
    cur.cards[uid] = hand
    let played = card
    if (card[0] == '!') {
        const color = uid == cur.you && fromHuman ? null : unoAiCountColor(uid)
        if (!color) {
            unoAi.pendingWild = { uid: uid, card: card }
            tt = 2
            cur.st = 2
            drawTable()
            drawButtons()
            return
        }
        played = unoAiNormalizeWild(card, color)
    }
    unoAi.pendingWild = null
    cur.history.push([uid, Math.random() * 10 - 5])
    cur.cen = played
    unoAi.discard.push(played)
    if (!cur.cards[uid].length) return unoAiEndRound(uid)
    const num = played[1]
    if (num == '+') {
        unoAi.pendingPenalty += (played[0] == '!' ? 4 : 2)
        return unoAiApplyTurnAdvance(unoAiNextPlayer(uid))
    }
    if (num == '-') return unoAiApplyTurnAdvance(unoAiNextPlayer(uid, 2))
    if (num == 'R') {
        cur.rot = cur.rot ? 0 : 1
        return unoAiApplyTurnAdvance(unoAiNextPlayer(uid))
    }
    unoAi.pendingPenalty = 0
    return unoAiApplyTurnAdvance(unoAiNextPlayer(uid))
}

function unoAiSelectColor(color) {
    if (tt != 2 || !unoAi.pendingWild) return
    const p = unoAi.pendingWild
    const played = unoAiNormalizeWild(p.card, color)
    tt = 1
    cur.st = 1
    cur.history.push([p.uid, Math.random() * 10 - 5])
    cur.cen = played
    unoAi.discard.push(played)
    if (!cur.cards[p.uid].length) return unoAiEndRound(p.uid)
    if (played[1] == '+') {
        unoAi.pendingPenalty += 4
        unoAi.pendingWild = null
        return unoAiApplyTurnAdvance(unoAiNextPlayer(p.uid))
    }
    unoAi.pendingWild = null
    unoAi.pendingPenalty = 0
    return unoAiApplyTurnAdvance(unoAiNextPlayer(p.uid))
}

function unoAiDrawAction() {
    if (tt != 1 || cur.now != cur.you) return
    if (unoAi.pendingPenalty > 0) {
        cur.cards[cur.you].push(unoAiDrawCard())
        unoAi.pendingPenalty = Math.max(0, unoAi.pendingPenalty - 1)
        if (!unoAi.pendingPenalty) return unoAiApplyTurnAdvance(unoAiNextPlayer(cur.you))
        unoAiUpdateTurnFlags()
        drawTable()
        drawButtons()
        return
    }
    cur.cards[cur.you].push(unoAiDrawCard())
    unoAi.drawnThisTurn = true
    unoAiUpdateTurnFlags()
    drawTable()
    drawButtons()
}

function unoAiSkipAction() {
    if (tt != 1) return
    const uid = cur.now
    if (unoAi.pendingPenalty > 0) {
        for (let i = 0; i < unoAi.pendingPenalty; i++) cur.cards[uid].push(unoAiDrawCard())
        unoAi.pendingPenalty = 0
        return unoAiApplyTurnAdvance(unoAiNextPlayer(uid))
    }
    if (!unoAi.drawnThisTurn) {
        cur.cards[uid].push(unoAiDrawCard())
        unoAi.drawnThisTurn = true
        if ((cur.cards[uid] || []).some(c => validCard(cur.cen, c))) {
            unoAiUpdateTurnFlags()
            drawTable()
            drawButtons()
            return
        }
    }
    return unoAiApplyTurnAdvance(unoAiNextPlayer(uid))
}

function scheduleUnoAiTurn() {
    stopUnoAiTimer()
    if (!unoAi.enabled || tt != 1 || cur.now == cur.you) return
    unoAi.timer = setTimeout(() => {
        const uid = cur.now
        if (unoAi.pendingPenalty > 0) {
            const chain = (cur.cards[uid] || []).find(c => c[1] == '+' && validCard(cur.cen, c))
            if (chain) return unoAiPlayCard(uid, chain, false)
            return unoAiSkipAction()
        }
        const playable = (cur.cards[uid] || []).filter(c => validCard(cur.cen, c))
        if (playable.length) {
            const nonWild = playable.filter(c => c[0] != '!')
            return unoAiPlayCard(uid, (nonWild.length ? nonWild[0] : playable[0]), false)
        }
        cur.cards[uid].push(unoAiDrawCard())
        const afterDrawPlayable = (cur.cards[uid] || []).filter(c => validCard(cur.cen, c))
        if (afterDrawPlayable.length) return unoAiPlayCard(uid, afterDrawPlayable[0], false)
        return unoAiApplyTurnAdvance(unoAiNextPlayer(uid))
    }, 650)
}
