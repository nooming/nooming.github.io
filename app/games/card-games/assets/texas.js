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
    let winners = []
    let bestHand = null
    alive.forEach(uid => {
        const hand = texasBestHand(uid)
        cur.type[uid] = [hand[0]]
        if (!bestHand || texasCompareHand(hand, bestHand) > 0) {
            bestHand = hand
            winners = [uid]
        } else if (texasCompareHand(hand, bestHand) === 0) {
            winners.push(uid)
        }
    })
    if (winners.length === 1) return texasFinishByLast(winners[0])
    texasFinishSplit(winners)
}

const TEXAS_RANK_ORDER = '23456789XJQKA'

function texasRankOf(card) {
    return TEXAS_RANK_ORDER.indexOf(card[1])
}

function texasSuitOf(card) {
    return card[0]
}

function texasBoardVisibleCount() {
    if (tt <= 1) return 0
    if (tt === 2) return 3
    if (tt === 3) return 4
    return 5
}

function texasKnownCards(uid) {
    const hole = cur.cards.p[uid] || []
    const board = (cur.cards.n || []).slice(0, texasBoardVisibleCount())
    return [...hole, ...board]
}

function texasCompareHand(a, b) {
    const n = Math.max(a.length, b.length)
    for (let i = 0; i < n; i++) {
        const d = (a[i] || 0) - (b[i] || 0)
        if (d) return d
    }
    return 0
}

function texasEvalFive(cards) {
    const ranks = cards.map(texasRankOf).sort((a, b) => b - a)
    const suits = cards.map(texasSuitOf)
    const counts = {}
    ranks.forEach(r => { counts[r] = (counts[r] || 0) + 1 })
    const byCount = Object.keys(counts)
        .map(Number)
        .sort((a, b) => counts[b] - counts[a] || b - a)
    const isFlush = suits.every(s => s === suits[0])
    const uniq = [...new Set(ranks)].sort((a, b) => b - a)
    let straightHigh = -1
    if (uniq.length === 5 && uniq[0] - uniq[4] === 4) straightHigh = uniq[0]
    // A-5 wheel
    if (uniq.length === 5 && uniq[0] === 12 && uniq[1] === 3 && uniq[2] === 2 && uniq[3] === 1 && uniq[4] === 0) {
        straightHigh = 3
    }
    const isStraight = straightHigh >= 0
    if (isFlush && isStraight) {
        return straightHigh === 12 ? [9, straightHigh] : [8, straightHigh]
    }
    if (counts[byCount[0]] === 4) {
        const kicker = byCount.find(r => r !== byCount[0])
        return [7, byCount[0], kicker]
    }
    if (counts[byCount[0]] === 3 && counts[byCount[1]] === 2) {
        return [6, byCount[0], byCount[1]]
    }
    if (isFlush) return [5, ...ranks]
    if (isStraight) return [4, straightHigh]
    if (counts[byCount[0]] === 3) {
        const kickers = byCount.filter(r => r !== byCount[0])
        return [3, byCount[0], ...kickers]
    }
    if (counts[byCount[0]] === 2 && counts[byCount[1]] === 2) {
        const highPair = Math.max(byCount[0], byCount[1])
        const lowPair = Math.min(byCount[0], byCount[1])
        const kicker = byCount.find(r => counts[r] === 1)
        return [2, highPair, lowPair, kicker]
    }
    if (counts[byCount[0]] === 2) {
        const kickers = byCount.filter(r => r !== byCount[0])
        return [1, byCount[0], ...kickers]
    }
    return [0, ...ranks]
}

function texasBestHand(uid, cardsOverride) {
    const cards = cardsOverride || [...(cur.cards.p[uid] || []), ...(cur.cards.n || [])]
    if (cards.length < 5) {
        const padded = [...cards]
        while (padded.length < 5) padded.push('C2')
        return texasEvalFive(padded.slice(0, 5))
    }
    let best = null
    const n = cards.length
    for (let a = 0; a < n - 4; a++) {
        for (let b = a + 1; b < n - 3; b++) {
            for (let c = b + 1; c < n - 2; c++) {
                for (let d = c + 1; d < n - 1; d++) {
                    for (let e = d + 1; e < n; e++) {
                        const hand = texasEvalFive([cards[a], cards[b], cards[c], cards[d], cards[e]])
                        if (!best || texasCompareHand(hand, best) > 0) best = hand
                    }
                }
            }
        }
    }
    return best
}

function texasPreflopStrength(uid) {
    const hole = cur.cards.p[uid] || []
    if (hole.length < 2) return 0.2
    const r1 = texasRankOf(hole[0])
    const r2 = texasRankOf(hole[1])
    const high = Math.max(r1, r2)
    const low = Math.min(r1, r2)
    const paired = r1 === r2
    const suited = texasSuitOf(hole[0]) === texasSuitOf(hole[1])
    const gap = high - low
    let score = 0.15 + high * 0.035 + low * 0.015
    if (paired) score = 0.45 + high * 0.04
    if (suited) score += 0.06
    if (!paired && gap <= 2) score += 0.05
    if (!paired && gap >= 5) score -= 0.04
    return Math.max(0.05, Math.min(0.95, score))
}

function texasHandStrength(uid) {
    const visible = texasBoardVisibleCount()
    if (visible === 0) return texasPreflopStrength(uid)
    const known = texasKnownCards(uid)
    const hand = texasBestHand(uid, known)
    const category = hand[0]
    // Map category + high cards to 0..1 heuristic (not equity)
    const catBase = [0.18, 0.38, 0.52, 0.62, 0.72, 0.78, 0.88, 0.94, 0.98, 0.995]
    let score = catBase[category] || 0.2
    score += (hand[1] || 0) * 0.004
    if (visible < 5) score *= 0.92 + visible * 0.02
    return Math.max(0.05, Math.min(0.99, score))
}

function texasFinishSplit(uids) {
    tt = 5
    cur.st = 5
    const pot = Object.values(cur.in).reduce((a, b) => a + b, 0)
    const share = Math.floor(pot / uids.length)
    let remain = pot - share * uids.length
    cur.winner = { 0: 0, 1: 0, 2: 0, 3: 0 }
    cur.won = { 0: 0, 1: 0, 2: 0, 3: 0 }
    uids.forEach((uid, i) => {
        const gain = share + (i < remain ? 1 : 0)
        cur.winner[uid] = 1
        cur.won[uid] = gain
        cur.cash[uid] += gain
    })
    cur.now = uids[0]
    cur.readyCnt = 3
    cur.isReady = { 0: 0, 1: 1, 2: 1, 3: 1 }
    cur.wasReady = -1
    stopTexasAiTimer()
    drawTable()
    drawButtons()
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
        const strength = texasHandStrength(uid)
        const pot = Object.values(cur.in).reduce((a, b) => a + b, 0)
        const potOdds = need > 0 ? need / (pot + need) : 0
        const jitter = (Math.random() - 0.5) * 0.08
        const feel = Math.max(0, Math.min(1, strength + jitter))

        if (need > 0) {
            if (cash <= need) return socket.send('follow')
            // Weak vs bet -> fold; strong -> call/raise
            if (feel < Math.max(0.22, potOdds * 0.85)) return socket.send('nope')
            if (feel > 0.78 && cash > need + cur.bb) {
                const raiseAmt = Math.max(cur.bb, Math.floor(Math.min(cash / 3, pot * 0.7 + cur.bb)))
                return socket.send(`up ${raiseAmt}`)
            }
            if (feel > 0.55 || feel >= potOdds) return socket.send('follow')
            if (feel < 0.35 && Math.random() < 0.7) return socket.send('nope')
            return socket.send('follow')
        }
        // No bet: weak check, strong sometimes raise
        if (feel < 0.42 || Math.random() < 0.55) return socket.send('follow')
        if (feel > 0.7 && cash > cur.bb) {
            const raiseAmt = Math.max(cur.bb, Math.floor(Math.min(cash / 4, pot * 0.5 + cur.bb)))
            return socket.send(`up ${raiseAmt}`)
        }
        return socket.send('follow')
    }, 700)
}
