/* global sso, cur, tt, socket, drawTexasAll, drawTable, drawButtons, procHover, $ */

const texasAi = {
    enabled: false,
    timer: null,
    dealer: 0,
    acted: {},
    deck: []
}

function stopTexasAiTimer() {
    if (!texasAi.timer) return
    clearTimeout(texasAi.timer)
    texasAi.timer = null
}

function startAIBattle() {
    if (socket) socket.close()
    texasAi.enabled = true
    socket = {
        send: handleTexasAiCommand,
        close: () => {
            stopTexasAiTimer()
            socket = null
            $('.list-all').show()
            $('.chat').hide()
            $('.decor').show()
            $('.texas-svg').html('')
            $('.texas-btns').html('')
            $('.texas-btns-down').html('')
        }
    }
    $('.list-all').hide()
    $('.chat').show()
    $('.decor').hide()
    $('.btn-exit').removeClass('btn-danger')
    initTexasAiTable()
}

function initTexasAiTable() {
    const players = [0, 1, 2, 3]
    cur = {
        num: 4,
        plist: players,
        you: 0,
        name: { 0: sso.realname || '你', 1: 'AI-1', 2: 'AI-2', 3: 'AI-3' },
        cards: { n: [], p: { 0: [], 1: [], 2: [], 3: [] } },
        isIngame: { 0: 1, 1: 1, 2: 1, 3: 1 },
        isReady: { 0: 0, 1: 1, 2: 1, 3: 1 },
        isOffline: {},
        givenup: { 0: 0, 1: 0, 2: 0, 3: 0 },
        cash: { 0: 200, 1: 200, 2: 200, 3: 200 },
        in: { 0: 0, 1: 0, 2: 0, 3: 0 },
        winner: { 0: 0, 1: 0, 2: 0, 3: 0 },
        won: { 0: 0, 1: 0, 2: 0, 3: 0 },
        type: { 0: [10], 1: [10], 2: [10], 3: [10] },
        bb: 10,
        initCash: 200,
        dstep: 0,
        dstepped: 0,
        up: 0,
        now: -1,
        st: 0,
        readyCnt: 3,
        wasReady: -1
    }
    tt = 0
    drawTable()
    drawButtons()
}

function handleTexasAiCommand(cmd) {
    if (!texasAi.enabled || !socket) return
    if (cmd == 'closing') return socket.close()
    if (cmd == 'ready' && (tt == 0 || tt == 5)) return startTexasAiRound()
    if (cmd.startsWith('hover ')) return handleTexasHover(cmd.slice(6))
    if (tt >= 5) return
    if (cmd == 'follow') return texasFollow(cur.now)
    if (cmd == 'nope') return texasFold(cur.now)
    if (cmd.startsWith('up ')) return texasRaise(cur.now, parseFloat(cmd.split(' ')[1] || '0'))
}

function handleTexasHover(payload) {
    if (!payload || payload == 'nothing') return drawTable()
    procHover(payload.split(' '), cur.now)
}

function startTexasAiRound() {
    stopTexasAiTimer()
    const players = cur.plist || [0, 1, 2, 3]
    texasAi.dealer = (texasAi.dealer + 1) % players.length
    texasAi.deck = drawTexasAll()
    texasShuffle(texasAi.deck)
    cur.cards = { n: [], p: { 0: [], 1: [], 2: [], 3: [] } }
    for (let i = 0; i < 2; i++) for (let p = 0; p < players.length; p++) cur.cards.p[players[p]].push(texasAi.deck.pop())
    for (let i = 0; i < 5; i++) cur.cards.n.push(texasAi.deck.pop())
    players.forEach(uid => {
        cur.givenup[uid] = 0
        cur.isIngame[uid] = 1
        cur.in[uid] = 0
        cur.winner[uid] = 0
        cur.won[uid] = 0
        cur.type[uid] = [10]
        const reliefBase = texasReliefBase()
        if (cur.cash[uid] < reliefBase) cur.cash[uid] += (reliefBase - cur.cash[uid])
    })
    cur.isReady = { 0: 0, 1: 1, 2: 1, 3: 1 }
    cur.readyCnt = 3
    cur.wasReady = -1
    cur.st = 1
    tt = 1
    cur.dstep = 1
    cur.dstepped = 0
    cur.up = 0
    cur.now = texasNextActive(players[texasAi.dealer])
    texasAiResetActed()
    drawTable()
    drawButtons()
    scheduleTexasAiTurn()
}

function texasReliefBase() {
    return Math.max(cur.bb, cur.initCash / 10)
}

function texasShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const t = arr[i]
        arr[i] = arr[j]
        arr[j] = t
    }
}

function texasAiResetActed() {
    texasAi.acted = { 0: 0, 1: 0, 2: 0, 3: 0 }
}

function texasPay(uid, amount) {
    amount = Math.max(0, Math.floor(amount))
    const pay = Math.min(amount, cur.cash[uid])
    cur.cash[uid] -= pay
    cur.in[uid] += pay
    if (cur.in[uid] > cur.up) cur.up = cur.in[uid]
    return pay
}

function texasRaise(uid, amount) {
    if (uid != cur.now) return
    if (cur.dstep == 1) {
        texasPay(uid, Math.ceil(cur.bb / 2))
        cur.dstep = 2
        cur.now = texasNextActive(uid)
        drawTable(); drawButtons(); scheduleTexasAiTurn()
        return
    }
    if (cur.dstep == 2) {
        texasPay(uid, cur.bb)
        cur.dstep = 0
        cur.dstepped = 1
        texasAiResetActed()
        cur.now = texasNextActive(uid)
        drawTable(); drawButtons(); scheduleTexasAiTurn()
        return
    }
    const need = Math.max(0, cur.up - cur.in[uid])
    const minRaise = Math.max(cur.bb, amount)
    texasPay(uid, need + minRaise)
    cur.dstepped = 1
    texasAiResetActed()
    texasAi.acted[uid] = 1
    texasAdvanceAfterAction(uid)
}

function texasFollow(uid) {
    if (uid != cur.now || cur.dstep == 1 || cur.dstep == 2) return
    texasPay(uid, Math.max(0, cur.up - cur.in[uid]))
    texasAi.acted[uid] = 1
    texasAdvanceAfterAction(uid)
}

function texasFold(uid) {
    if (uid != cur.now) return
    cur.givenup[uid] = 1
    cur.isIngame[uid] = 0
    texasAi.acted[uid] = 1
    texasAdvanceAfterAction(uid)
}

function texasAdvanceAfterAction(uid) {
    const alive = texasAlivePlayers()
    if (alive.length <= 1) return texasFinishByLast(alive[0])
    if (texasBettingRoundDone()) return texasAdvanceStreet()
    cur.now = texasNextActive(uid)
    drawTable(); drawButtons(); scheduleTexasAiTurn()
}

function texasAlivePlayers() {
    const players = cur.plist || [0, 1, 2, 3]
    return players.filter(uid => !cur.givenup[uid])
}

function texasBettingRoundDone() {
    const alive = texasAlivePlayers()
    for (let i = 0; i < alive.length; i++) {
        const uid = alive[i]
        if (cur.cash[uid] <= 0) continue
        if (!texasAi.acted[uid] || cur.in[uid] != cur.up) return false
    }
    return true
}

function texasAdvanceStreet() {
    if (cur.st >= 4) return texasShowdown()
    cur.st += 1
    tt = cur.st
    cur.dstep = 0
    cur.dstepped = 0
    texasAiResetActed()
    cur.now = texasNextActive(cur.plist[texasAi.dealer])
    drawTable(); drawButtons(); scheduleTexasAiTurn()
}

function texasShowdown() {
    tt = 5
    cur.st = 5
    const alive = texasAlivePlayers()
    let bestUid = alive[0]
    let bestScore = -1
    alive.forEach(uid => {
        const score = texasPseudoScore(uid)
        cur.type[uid] = [Math.max(0, Math.min(9, Math.floor(score / 3)))]
        if (score > bestScore) { bestScore = score; bestUid = uid }
    })
    texasFinishByLast(bestUid)
}

function texasPseudoScore(uid) {
    const cards = [...(cur.cards.p[uid] || []), ...(cur.cards.n || [])]
    let score = 0
    cards.forEach(c => {
        const r = '23456789XJQKA'.indexOf(c[1])
        score += r + (c[0] == 'H' || c[0] == 'D' ? 1 : 0)
    })
    return score
}

function texasFinishByLast(uid) {
    tt = 5
    cur.st = 5
    const pot = Object.values(cur.in).reduce((a, b) => a + b, 0)
    cur.winner = { 0: 0, 1: 0, 2: 0, 3: 0 }
    cur.won = { 0: 0, 1: 0, 2: 0, 3: 0 }
    if (uid !== undefined && uid !== null) {
        cur.winner[uid] = 1
        cur.won[uid] = pot
        cur.cash[uid] += pot
        cur.now = uid
    }
    cur.readyCnt = 3
    cur.isReady = { 0: 0, 1: 1, 2: 1, 3: 1 }
    cur.wasReady = -1
    stopTexasAiTimer()
    drawTable()
    drawButtons()
}

function texasNextActive(uid) {
    const plist = cur.plist || [0, 1, 2, 3]
    let idx = plist.indexOf(uid)
    for (let g = 0; g < plist.length; g++) {
        idx = (idx + 1) % plist.length
        const cand = plist[idx]
        if (!cur.givenup[cand] && cur.isIngame[cand]) return cand
    }
    return uid
}

function scheduleTexasAiTurn() {
    stopTexasAiTimer()
    if (!texasAi.enabled || tt >= 5 || cur.now == cur.you) return
    texasAi.timer = setTimeout(() => {
        const uid = cur.now
        if (cur.dstep == 1) return socket.send(`up ${Math.ceil(cur.bb / 2)}`)
        if (cur.dstep == 2) return socket.send(`up ${cur.bb}`)
        const need = Math.max(0, cur.up - cur.in[uid])
        const cash = cur.cash[uid]
        const roll = Math.random()
        if (need > 0) {
            if (cash <= need || roll < 0.65) return socket.send('follow')
            if (roll < 0.85) return socket.send('nope')
            return socket.send(`up ${Math.max(cur.bb, Math.floor(cash / 4))}`)
        }
        if (roll < 0.7) return socket.send('follow')
        return socket.send(`up ${Math.max(cur.bb, Math.floor(cash / 6))}`)
    }, 700)
}
