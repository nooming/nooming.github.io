/**
 * Hearts frontend controller.
 * Mirrors the backend logic in libs/ws.js to provide card validation,
 * UNO-like trick animations, and a square four-seat layout.
 */
/* global $, sso, iziToast */

let socket = null
const AI_ONLY_MODE = true

const CARD_ORDER = '23456789XJQKA'

const state = {
    cur: { plist: [], hands: {} },
    tt: 0,
    selected: new Set(),
    lastSt: -1,
    passQueued: false,
    aiRoundIndex: 0,
    aiTimer: null,
    turnRepairing: false
}

window.heartsSelectCard = handleCardClick
window.heartsAutoAct = quickAct

$(init)

function init() {
    hookExitForAi()
    bindUI()
    renderDecor()
    renderAiLobby()
}

function bindUI() {
    $('.btn-start-ai').on('click', startAIBattle)
    $('.btn-refresh').on('click', () => {
        renderAiLobby()
        renderDecor()
    })
}

function hookExitForAi() {
    if (!AI_ONLY_MODE || typeof window.endTutor !== 'function') return
    const originalEndTutor = window.endTutor
    window.endTutor = function () {
        stopAiTimer()
        originalEndTutor()
        renderAiLobby()
    }
}

function listTables() {}

function drawTable() {
    const svgParts = []
    svgParts.push(getCardDefs())
    svgParts.push('<rect x="100" y="100" width="300" height="300" rx="50" stroke="#333" stroke-width="1.5" fill="transparent"></rect>')
    if (state.cur && state.tt === 1) svgParts.push(renderPassBacks())
    if (state.cur && state.cur.recentTrick) svgParts.push(renderTrickLayer(state.cur.recentTrick, true))
    if (state.cur && state.cur.trick) svgParts.push(renderTrickLayer(state.cur.trick, false))
    if (state.cur && state.cur.plist && state.cur.plist.length) svgParts.push(renderPlayers())
    $('.hearts-svg').html(svgParts.join(''))
    setTimeout(() => {
        $('.btn-ready').removeClass('btn-danger')
        $('.person-ready').remove()
        $('.person-unready').css('display', 'block')
    }, 120)
}

function renderTrickLayer(stack = [], history = false) {
    if (!stack || !stack.length) return ''
    let winner = null
    if (history) {
        const leadSuit = getSuit(stack[0].card)
        let best = CARD_ORDER.indexOf(getRank(stack[0].card))
        winner = stack[0].player
        for (let i = 1; i < stack.length; i++) {
            const entry = stack[i]
            if (getSuit(entry.card) !== leadSuit) continue
            const rankIdx = CARD_ORDER.indexOf(getRank(entry.card))
            if (rankIdx > best) {
                best = rankIdx
                winner = entry.player
            }
        }
    }
    const seatOrder = computeSeatOrder()
    const seatBias = [
        { x: 0, y: 60 },
        { x: 60, y: 0 },
        { x: 0, y: -60 },
        { x: -60, y: 0 }
    ]
    return stack.map((entry, idx) => {
        const seatIdx = seatOrder.indexOf(entry.player)
        const bias = seatIdx >= 0 ? seatBias[seatIdx] : { x: 0, y: 0 }
        const dx = (entry.dx || 0) * 4 + bias.x
        const dy = (entry.dy || 0) * 4 + bias.y
        const rot = entry.rot || 0
        const x = 250 + dx
        const y = 250 + dy
        return drawCard(x, y, entry.card, {
            rotation: rot,
            faceDown: false,
            clickable: false,
            opacity: history ? (entry.player === winner ? 0.4 : 0.25) : 1,
            extraClass: history ? (entry.player === winner ? 'trick-history trick-history-win' : 'trick-history') : `trick-card trick-${idx}`
        })
    }).join('')
}

function renderPlayers() {
    const seats = computeSeatOrder()
    return seats.map((uid, idx) => drawSeat(uid, idx)).join('')
}

function renderPassBacks() {
    const hasPassed = state.cur?.hasPassed || {}
    const passTargets = state.cur?.passTargets || {}
    if (!Object.keys(hasPassed).length) return ''
    const seats = computeSeatOrder()
    const seatBias = [
        { x: 0, y: 60 },
        { x: 60, y: 0 },
        { x: 0, y: -60 },
        { x: -60, y: 0 }
    ]
    const pieces = []
    const jitter = (fromUid, toUid, idx) => {
        const seed = (fromUid || 0) * 73856093 + (toUid || 0) * 19349663 + idx * 83492791
        const n = Math.sin(seed) * 10000
        const frac = n - Math.floor(n)
        // map frac to roughly [-3,3] then scale to match trick offsets
        const base = (frac * 2 - 1) * 3
        const rot = ((Math.sin(seed * 1.7) * 10000) % 1 - 0.5) * 8
        return { dx: base * 4, dy: ((Math.cos(seed * 1.3) * 10000 % 1) - 0.5) * 6 * 4, rot }
    }
    // show on target seat (the player被传牌的人)
    Object.keys(hasPassed).forEach(key => {
        const uid = parseInt(key, 10)
        if (!hasPassed[uid]) return
        const targetUid = passTargets[uid]
        if (targetUid === undefined || targetUid === null) return
        const seatIdx = seats.indexOf(targetUid)
        if (seatIdx === -1) return
        const bias = seatBias[seatIdx] || { x: 0, y: 0 }
        for (let i = 0; i < 3; i++) {
            const jit = jitter(uid, targetUid, i)
            const x = 250 + bias.x + jit.dx
            const y = 250 + bias.y + jit.dy
            pieces.push(drawCard(x, y, 'C2', { faceDown: true, rotation: jit.rot, clickable: false, extraClass: 'pass-placeholder' }))
        }
    })
    return pieces.join('')
}

function computeSeatOrder() {
    const players = state.cur.plist || []
    if (!players.length) return [undefined, undefined, undefined, undefined]
    const youIdx = players.indexOf(state.cur.you)
    const offset = youIdx === -1 ? 0 : youIdx
    const ordered = []
    for (let i = 0; i < players.length; i++) ordered.push(players[(offset + i) % players.length])
    while (ordered.length < 4) ordered.push(undefined)
    return ordered.slice(0, 4)
}

function drawSeat(uid, seatIdx) {
    if (uid === undefined || uid === null) return ''
    const cur = state.cur
    const name = formatName(uid)
    const youSeat = uid === cur.you && seatIdx === 0
    const hand = (cur.hands || {})[uid] || []
    const count = cur.handCounts && cur.handCounts[uid] !== undefined ? cur.handCounts[uid] : hand.length
    const offline = cur.isOffline && cur.isOffline[uid]
    const parts = []
    parts.push(renderSeatName(uid, name, offline))
    parts.push(renderSeatLamp(name.length, uid))
    parts.push(renderSeatScores(uid))
    parts.push(drawCards(hand, { you: youSeat, count }))
    const rotation = seatIdx ? seatIdx * -90 : 0
    const transform = rotation ? ` transform="rotate(${rotation},250,250)"` : ''
    return `<g${transform}>${parts.join('')}</g>`
}

function renderSeatLamp(nameLength, uid) {
    const x = 258 + nameLength * 8
    if (state.tt === 0 || state.tt === 3) {
        const ready = state.cur.isReady && state.cur.isReady[uid]
        return `<circle cx="${x}" cy="429" r="5" fill="${ready ? '#333' : '#ddd'}"></circle>`
    }
    if (state.tt === 2) {
        if (state.cur.now === uid) return `<circle cx="${x}" cy="429" r="5" fill="#333" class="blink"></circle>`
        return `<circle cx="${x}" cy="434" r="5" fill="transparent" stroke-width="1"></circle>`
    }
    return ''
}

function renderSeatName(uid, name, offline) {
    const waitingPhase = state.tt === 0 || state.tt === 3
    const highlight = waitingPhase && state.cur.wasReady !== undefined && state.cur.wasReady !== -1 && state.cur.wasReady === uid
    const baseColor = offline ? '#d9534f' : '#333'
    const base = `<text class="person-unready" data-uid="${uid}" x="250" y="435" text-anchor="middle" fill="${baseColor}" font-size="16"${highlight ? ' style="display:none"' : ''}>${name}</text>`
    if (!highlight) return base
    const flash = `<text class="person-ready" data-uid="${uid}" x="250" y="435" text-anchor="middle" font-size="16">${name}</text>`
    return flash + base
}

function renderSeatScores(uid) {
    const delta = (state.cur.roundScores && state.cur.roundScores[uid]) || 0
    const total = (state.cur.totalScores && state.cur.totalScores[uid]) || 0
    return `<text x="250" y="417" text-anchor="middle" fill="${total ? '#333' : '#777'}" font-size="14">${total || 0} ${delta ? formatSigned(delta) : ''}</text>`
}

function drawCards(cards = [], opts = {}) {
    const you = !!opts.you
    const waitingPhase = state.tt === 0 || state.tt === 3
    const hand = you ? cards : []
    const count = you ? hand.length : (opts.count || cards.length || 0)
    if (!count) return ''
    if (!you) {
        let str = ''
        for (let i = 0; i < count; i++) {
            const offset = i - (count - 1) / 2
            const x = 250 + offset * 18
            const rot = offset * 2
            str += drawCard(x, 465 - 4 * Math.cos(offset / Math.PI) + 4, 'C2', { faceDown: true, rotation: rot, clickable: false })
        }
        return str
    }
    const spread = Math.min(32, 320 / Math.max(hand.length, 1))
    return hand.map((card, idx) => {
        const offset = idx - (hand.length - 1) / 2
        const x = 250 + offset * spread
        const rot = offset * 3
        const canPlay = state.tt === 1 || (state.tt === 2 && state.cur.now === state.cur.you && canPlayCard(card))
        const disabled = waitingPhase || (state.tt === 2 && !canPlay)
        const clickable = !waitingPhase && !disabled && (state.tt === 1 || state.cur.now === state.cur.you)
        return drawCard(x, 465 - 3 * Math.cos(offset / Math.PI) + 3, card, {
            rotation: rot,
            faceDown: waitingPhase,
            clickable,
            selected: !waitingPhase && state.selected.has(card),
            disabled
        })
    }).join('')
}

function renderButtons() {
    if (AI_ONLY_MODE && repairEmptyTurnIfNeeded()) return
    const btns = []
    const detail = []
    if (!socket && !AI_ONLY_MODE) {
        $('.hearts-btns').html('<button class="btn btn-default" disabled>未连接到牌桌</button>')
        $('.hearts-btns-down').html('请选择左侧的牌桌加入对局。')
        return
    }
    const you = state.cur.you
    const playerCount = state.cur.num || (state.cur.plist ? state.cur.plist.length : 0) || 0
    const readySummary = `${state.cur.readyCnt || 0} / ${playerCount}`
    if (state.tt === 0) {
        const offlineNames = listOfflineNames()
        if (offlineNames.length) {
            btns.push(`<div class="hearts-alert">${offlineNames.join('、')} 掉线了。<br>可稍等${(state.cur.num || 0) == 4 ? '，或者' : '。'}</div>`)
        }
        if ((state.cur.num || 0) >= 1) {
            const youReady = state.cur.isReady && state.cur.isReady[you]
            const almostStart = !youReady && (state.cur.readyCnt || 0) === (playerCount - 1)
            const label = almostStart ? '开始' : '准备'
            btns.push(`${buildReadyButton(label, 'play')} ${readySummary}`)
        }
    } else if (state.tt === 1) {
        const alreadyPassed = hasAlreadyPassed()
        const canSubmit = !alreadyPassed && !state.passQueued && state.selected.size === 3
        const passDir = ['arrow-right', 'arrow-left', 'arrow-up', '无需传牌'][state.cur.passDirection] || '传牌'
        const btnText = alreadyPassed ? '已传牌' : (state.passQueued ? '提交中...' : `<span class="glyphicon glyphicon-${passDir}"></span> 传牌 ${state.selected.size} / 3`)
        detail.push(`<button class="btn btn-primary" ${canSubmit ? '' : 'disabled'} onclick="window.heartsSubmitPass && heartsSubmitPass()">${btnText}</button>`)
    } else if (state.tt === 2) {
        const card = Array.from(state.selected)[0]
        const canUse = card && state.cur.now === you && canPlayCard(card)
        if (you == state.cur.now) detail.push(`<button class="btn btn-primary" ${canUse ? '' : 'disabled'} onclick="window.heartsPlay && heartsPlay()">出牌</button>`)
    } else if (state.tt === 3) {
        const you = state.cur.you
        const playerCount = state.cur.num || (state.cur.plist ? state.cur.plist.length : 0) || 0
        const youReady = state.cur.isReady && state.cur.isReady[you]
        const almostStart = !youReady && (state.cur.readyCnt || 0) === (playerCount - 1)
        const label = almostStart ? '开始' : '下一局'
        btns.push(`${buildReadyButton(label, 'play')} ${readySummary}`)
    }
    $('.hearts-btns').html(btns.join(' '))
    $('.hearts-btns-down').html(detail.filter(Boolean).join('<br>'))
    ensureAiProgress()
}

window.heartsPlay = function () {
    if ((!socket && !AI_ONLY_MODE) || state.tt !== 2) return
    const card = Array.from(state.selected)[0]
    if (!card) return
    if (state.cur.now !== state.cur.you || !canPlayCard(card)) return
    if (AI_ONLY_MODE) playLocalCard(state.cur.you, card)
    else socket.send(`play ${card}`)
    state.selected.clear()
}

function handleCardClick(card) {
    if (!card) return
    const hand = (state.cur.hands || {})[state.cur.you] || []
    if (!hand.includes(card)) return
    if (state.tt === 1) {
        if (state.passQueued || hasAlreadyPassed()) return
        if (state.selected.has(card)) state.selected.delete(card)
        else if (state.selected.size < 3) state.selected.add(card)
    } else if (state.tt === 2) {
        state.selected.clear()
        state.selected.add(card)
    }
    drawTable()
    renderButtons()
}

window.heartsSubmitPass = function () {
    if ((!socket && !AI_ONLY_MODE) || state.tt !== 1) return
    if (state.passQueued || hasAlreadyPassed()) return
    if (state.selected.size !== 3) return
    if (AI_ONLY_MODE) submitLocalPass()
    else {
        socket.send(`pass ${Array.from(state.selected).join(' ')}`)
        state.passQueued = true
        renderButtons()
    }
}

function quickAct(card) {
    if (state.tt === 2 && state.cur.now === state.cur.you && canPlayCard(card)) {
        state.selected = new Set([card])
        window.heartsPlay()
    }
}

function canPlayCard(card) {
    if (AI_ONLY_MODE) return isLegalCardFor(state.cur.you, card)
    const hand = (state.cur.hands || {})[state.cur.you] || []
    if (!hand.includes(card)) return false
    if (state.tt !== 2) return true
    const leadSuit = (state.cur.trick && state.cur.trick.length) ? getSuit(state.cur.trick[0].card) : state.cur.leadSuit
    const suit = getSuit(card)
    const isFirstTrick = state.cur.tricksPlayed === 0
    if (!leadSuit || !(state.cur.trick && state.cur.trick.length)) {
        if (isFirstTrick && card !== 'C2') return false
        if (!isFirstTrick && suit === 'H' && !state.cur.heartsBroken && !onlyHearts(hand)) return false
        if (isFirstTrick && isPointCard(card)) {
            const hasNonPoint = hand.some(c => !isPointCard(c))
            if (hasNonPoint) return false
        }
        if (isFirstTrick && (suit === 'H' || (suit === 'S' && getRank(card) === 'Q'))) return false
        return true
    }
    const hasLead = hand.some(c => getSuit(c) === leadSuit)
    if (hasLead && suit !== leadSuit) return false
    if (isFirstTrick && isPointCard(card)) {
        const hasNonPoint = hand.some(c => !isPointCard(c))
        if (hasNonPoint) return false
    }
    return true
}

function getSuit(card) {
    return card ? card[0] : ''
}

function getRank(card) {
    return card ? card[1] : ''
}

function onlyHearts(hand) {
    return hand.every(card => getSuit(card) === 'H')
}

function isPointCard(card) {
    if (!card) return false
    return getSuit(card) === 'H' || card === 'SQ'
}

function hasAlreadyPassed(uid = state.cur.you) {
    return !!(state.cur && state.cur.hasPassed && state.cur.hasPassed[uid])
}

function formatName(uid) {
    if (!state.cur || !state.cur.name) return `玩家 ${uid}`
    return state.cur.name[uid] || `玩家 ${uid}`
}

function buildReadyButton(label, glyph = 'play') {
    const danger = state.cur.wasReady !== undefined && state.cur.wasReady !== -1 ? ' btn-danger' : ''
    const icon = glyph === 'repeat' ? 'repeat' : 'play'
    const action = AI_ONLY_MODE ? "window.heartsReady && heartsReady()" : "socket && socket.send('ready')"
    return `<button class="btn btn-default${danger} btn-ready" onclick="${action}"><span class="glyphicon glyphicon-${icon}"></span> ${label}</button>`
}

function listOfflineNames() {
    const offline = state.cur.isOffline || {}
    const names = []
    Object.keys(offline).forEach(key => {
        if (offline[key]) names.push(formatName(parseInt(key, 10)))
    })
    return names
}

function formatSigned(value) {
    const num = value || 0
    return num > 0 ? `+${num}` : `${num}`
}

function getCardDefs() {
    return `<defs>
            <marker id="arrow" fill="#333" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
            <path id="heart-symbol" d="m12 21.35-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53z" />
            <path id="spade-symbol" d="M12 2C9 7 4 9 4 14c0 2 2 4 4 4 1 0 2 0 3-1 0 0 .32 2-2 5h6c-2-3-2-5-2-5 1 1 2 1 3 1 2 0 4-2 4-4 0-5-5-7-8-12" />
            <path id="diamond-symbol" d="m19 12-7 10-7-10 7-10" />
            <path id="club-symbol" d="M12 2c2.3 0 4.3 2 4.3 4.2a4.45 4.45 0 0 1-2.26 3.8c1-.5 2.46-.5 2.46-.5 2.5 0 4.5 1.8 4.5 4.3S19 18 16.5 18c0 0-1.5 0-3.5-1 0 0-.3 2 2 5H9c2.3-3 2-5 2-5-2 1-3.5 1-3.5 1C5 18 3 16.3 3 13.8s2-4.3 4.5-4.3c0 0 1.46 0 2.46.5-.3-.17-2.17-1.23-2.26-3.8C7.7 4 9.7 2 12 2" />
        </defs>`
}

function drawCard(x, y, card, options = {}) {
    if (!card) return ''
    const rotation = options.rotation || 0
    let rank = card[1]
    if (rank === 'X') rank = '10'
    const suit = card[0]
    const fill = (suit === 'H' || suit === 'D') ? 'red' : '#333'
    const flipped = options.faceDown ? 1 : 0
    const classes = ['card-face']
    if (options.extraClass) classes.push(options.extraClass)
    if (options.faceDown) classes.push('card-back')
    const attrs = []
    if (options.clickable && !options.faceDown && !options.disabled) {
        attrs.push(`onclick="heartsSelectCard('${card}')"`)
        attrs.push(`ondblclick="heartsAutoAct('${card}')"`)
    }
    if (options.selected) attrs.push('data-selected="true"')
    if (options.disabled) attrs.push('data-disabled="true"')
    const opacity = options.opacity !== undefined ? options.opacity : 1
    const attrText = attrs.length ? ' ' + attrs.join(' ') : ''
    const suitId = suit === 'D' ? 'diamond-symbol' : (suit === 'H' ? 'heart-symbol' : (suit === 'S' ? 'spade-symbol' : 'club-symbol'))
    const transform = `rotate(${rotation},${x},${y})`
    let body = ''
    if (flipped) {
        body = `<rect x="${x - 10}" y="${y - 25}" transform="${transform}" width="35" height="50" rx="5" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
    } else {
        body = `<rect x="${x - 10}" y="${y - 25}" transform="${transform}" width="35" height="50" rx="5" fill="white" stroke="#333" stroke-width="1.5"></rect>`
        body += `<use x="${x - 4}" y="${y - 8}" transform="${transform}" href="#${suitId}" fill="${fill}" />`
        body += `<text x="${x - 7}" y="${y - 8}" transform="${transform}" font-size="16" fill="${fill}">${rank}</text>`
    }
    return `<g class="${classes.join(' ')}" opacity="${opacity}"${attrText}>${body}</g>`
}

function renderDecor() {
    const suits = 'CDHS'
    const deck = []
    for (let i = 0; i < suits.length; i++) {
        for (let j = 0; j < CARD_ORDER.length; j++) deck.push(suits[i] + CARD_ORDER[j])
    }
    let str = getCardDefs()
    for (let i = 0; i < 8; i++) {
        const card = deck[Math.floor(Math.random() * deck.length)]
        const x = 60 + Math.random() * 380
        const y = 60 + Math.random() * 320
        const rot = Math.random() * 40 - 20
        str += drawCard(x, y, card, { rotation: rot, faceDown: false, clickable: false })
    }
    $('.decor').html(str)
}

function renderAiLobby() {
    $('.list-table').html('<li class="text-muted" style="cursor:default;">AI 对战模式已启用，点击“开始 AI 对战”。</li>')
}

function startAIBattle() {
    stopAiTimer()
    state.aiRoundIndex = 0
    state.selected.clear()
    state.passQueued = false
    const players = [0, 1, 2, 3]
    state.cur = {
        plist: players,
        you: 0,
        num: 4,
        st: 0,
        now: -1,
        passDirection: 0,
        trick: [],
        recentTrick: [],
        tricksPlayed: 0,
        heartsBroken: false,
        hands: { 0: [], 1: [], 2: [], 3: [] },
        handCounts: { 0: 0, 1: 0, 2: 0, 3: 0 },
        name: { 0: sso.realname || '你', 1: 'AI-1', 2: 'AI-2', 3: 'AI-3' },
        totalScores: { 0: 0, 1: 0, 2: 0, 3: 0 },
        roundScores: { 0: 0, 1: 0, 2: 0, 3: 0 },
        isReady: { 0: 0, 1: 1, 2: 1, 3: 1 },
        readyCnt: 3,
        hasPassed: { 0: false, 1: false, 2: false, 3: false },
        passTargets: {},
        passPick: {},
        isOffline: {},
        wasReady: -1
    }
    state.tt = 0
    $('.list-all').hide()
    $('.chat').show()
    $('.decor').hide()
    $('.btn-exit').removeClass('btn-danger')
    drawTable()
    renderButtons()
}

window.heartsReady = function () {
    if (!AI_ONLY_MODE) return
    if (state.tt !== 0 && state.tt !== 3) return
    state.cur.isReady[state.cur.you] = 1
    state.cur.readyCnt = 4
    state.cur.wasReady = state.cur.you
    startLocalRound()
}

function startLocalRound() {
    stopAiTimer()
    state.selected.clear()
    state.passQueued = false
    const players = state.cur.plist || [0, 1, 2, 3]
    const deck = buildDeck()
    shuffle(deck)
    const hands = { 0: [], 1: [], 2: [], 3: [] }
    for (let i = 0; i < 13; i++) {
        for (let p = 0; p < players.length; p++) hands[players[p]].push(deck.pop())
    }
    players.forEach(uid => hands[uid].sort(compareCards))
    const direction = state.aiRoundIndex % 4
    const passTargets = getPassTargets(players, direction)
    const passPick = {}
    players.forEach(uid => {
        if (uid !== state.cur.you && direction !== 3) {
            passPick[uid] = chooseBotPassCards(hands[uid])
        }
    })
    state.cur.hands = hands
    state.cur.handCounts = getHandCounts(hands)
    state.cur.roundScores = { 0: 0, 1: 0, 2: 0, 3: 0 }
    state.cur.trick = []
    state.cur.recentTrick = []
    state.cur.tricksPlayed = 0
    state.cur.heartsBroken = false
    state.cur.passDirection = direction
    state.cur.passTargets = passTargets
    state.cur.passPick = passPick
    state.cur.hasPassed = { 0: direction === 3, 1: direction === 3, 2: direction === 3, 3: direction === 3 }
    if (direction !== 3) {
        state.cur.hasPassed[1] = true
        state.cur.hasPassed[2] = true
        state.cur.hasPassed[3] = true
    }
    state.cur.st = direction === 3 ? 2 : 1
    state.cur.now = direction === 3 ? findTwoClubOwner(hands) : -1
    state.cur.isReady = { 0: 0, 1: 1, 2: 1, 3: 1 }
    state.cur.readyCnt = 3
    state.cur.wasReady = -1
    state.tt = state.cur.st
    drawTable()
    renderButtons()
    if (state.cur.st === 2) scheduleAiTurn()
}

function submitLocalPass() {
    const players = state.cur.plist || [0, 1, 2, 3]
    const direction = state.cur.passDirection
    if (direction === 3) {
        state.cur.st = 2
        state.tt = 2
        state.cur.now = findTwoClubOwner(state.cur.hands)
        drawTable()
        renderButtons()
        scheduleAiTurn()
        return
    }
    const outgoing = {}
    players.forEach(uid => {
        if (uid === state.cur.you) outgoing[uid] = Array.from(state.selected)
        else outgoing[uid] = [...(state.cur.passPick[uid] || [])]
    })
    players.forEach(uid => {
        state.cur.hands[uid] = state.cur.hands[uid].filter(card => outgoing[uid].indexOf(card) === -1)
    })
    players.forEach(receiver => {
        const sender = players.find(uid => state.cur.passTargets[uid] === receiver)
        if (!sender) return
        state.cur.hands[receiver].push(...outgoing[sender])
        state.cur.hands[receiver].sort(compareCards)
    })
    state.cur.handCounts = getHandCounts(state.cur.hands)
    state.cur.hasPassed = { 0: true, 1: true, 2: true, 3: true }
    state.cur.st = 2
    state.tt = 2
    state.selected.clear()
    state.cur.now = findTwoClubOwner(state.cur.hands)
    drawTable()
    renderButtons()
    scheduleAiTurn()
}

function playLocalCard(uid, card) {
    const hand = state.cur.hands[uid] || []
    if (!hand.includes(card) || !isLegalCardFor(uid, card)) return
    state.cur.hands[uid] = hand.filter((c, idx) => c !== card || idx !== hand.indexOf(card))
    state.cur.handCounts = getHandCounts(state.cur.hands)
    if (getSuit(card) === 'H') state.cur.heartsBroken = true
    state.cur.trick.push({
        player: uid,
        card,
        dx: Math.floor(Math.random() * 3) - 1,
        dy: Math.floor(Math.random() * 3) - 1,
        rot: Math.floor(Math.random() * 9) - 4
    })
    state.selected.clear()
    if (state.cur.trick.length < 4) {
        state.cur.now = nextPlayer(uid)
        drawTable()
        renderButtons()
        scheduleAiTurn()
        return
    }
    const winner = getTrickWinner(state.cur.trick)
    const points = countTrickPoints(state.cur.trick)
    state.cur.roundScores[winner] = (state.cur.roundScores[winner] || 0) + points
    state.cur.recentTrick = state.cur.trick.map(item => ({ ...item }))
    state.cur.trick = []
    state.cur.tricksPlayed = (state.cur.tricksPlayed || 0) + 1
    state.cur.now = winner
    if (state.cur.tricksPlayed >= 13) {
        finishLocalRound()
        return
    }
    drawTable()
    renderButtons()
    scheduleAiTurn()
}

function finishLocalRound() {
    stopAiTimer()
    const players = state.cur.plist || [0, 1, 2, 3]
    const round = { ...state.cur.roundScores }
    const shooter = players.find(uid => round[uid] === 26)
    if (shooter !== undefined) {
        players.forEach(uid => {
            round[uid] = uid === shooter ? 0 : 26
        })
    }
    players.forEach(uid => {
        state.cur.totalScores[uid] = (state.cur.totalScores[uid] || 0) + (round[uid] || 0)
    })
    state.cur.roundScores = round
    state.cur.st = 3
    state.tt = 3
    state.cur.now = -1
    state.cur.isReady = { 0: 0, 1: 1, 2: 1, 3: 1 }
    state.cur.readyCnt = 3
    state.cur.wasReady = -1
    state.aiRoundIndex += 1
    drawTable()
    renderButtons()
}

function scheduleAiTurn() {
    if (!AI_ONLY_MODE) return
    stopAiTimer()
    if (state.cur.st !== 2) return
    if (repairEmptyTurnIfNeeded()) return
    if (state.cur.now === state.cur.you) return
    state.aiTimer = setTimeout(() => {
        try {
            const uid = Number(state.cur.now)
            if (Number.isNaN(uid)) return
            const hand = state.cur.hands[uid] || []
            if (!hand.length) {
                repairEmptyTurnIfNeeded()
                return
            }
            let legal = getLegalCards(uid)
            // 兜底：规则判定异常时，至少打出一张避免卡死
            if (!legal.length && hand.length) legal = [hand[0]]
            if (!legal.length) return
            const pick = chooseBotPlayCard(uid, legal) || legal[0]
            playLocalCard(uid, pick)
        } catch (err) {
            console.error('AI turn failed', err)
            ensureAiProgress()
        }
    }, 650)
}

function stopAiTimer() {
    if (!state.aiTimer) return
    clearTimeout(state.aiTimer)
    state.aiTimer = null
}

function repairEmptyTurnIfNeeded() {
    if (!AI_ONLY_MODE) return false
    if (!state.cur || state.cur.st !== 2) return false
    if (state.turnRepairing) return false
    const uid = Number(state.cur.now)
    if (Number.isNaN(uid)) return false
    const hand = state.cur.hands[uid] || []
    if (hand.length) return false
    state.turnRepairing = true
    try {
        const players = state.cur.plist || [0, 1, 2, 3]
        if (allHandsEmpty(players)) {
            if (state.cur.trick && state.cur.trick.length) {
                const winner = getTrickWinner(state.cur.trick)
                const points = countTrickPoints(state.cur.trick)
                state.cur.roundScores[winner] = (state.cur.roundScores[winner] || 0) + points
                state.cur.recentTrick = state.cur.trick.map(item => ({ ...item }))
                state.cur.trick = []
                state.cur.tricksPlayed = (state.cur.tricksPlayed || 0) + 1
                state.cur.now = winner
            }
            finishLocalRound()
            return true
        }
        let next = nextPlayer(uid)
        let guard = 0
        while (guard < players.length) {
            if ((state.cur.hands[next] || []).length) break
            next = nextPlayer(next)
            guard++
        }
        state.cur.now = next
        drawTable()
        renderButtons()
        scheduleAiTurn()
        return true
    } finally {
        state.turnRepairing = false
    }
}

function allHandsEmpty(players) {
    for (let i = 0; i < players.length; i++) {
        if ((state.cur.hands[players[i]] || []).length) return false
    }
    return true
}

function ensureAiProgress() {
    if (!AI_ONLY_MODE) return
    if (state.cur.st !== 2) return
    if (repairEmptyTurnIfNeeded()) return
    if (state.cur.now === state.cur.you) return
    if (state.aiTimer) return
    state.aiTimer = setTimeout(() => {
        state.aiTimer = null
        scheduleAiTurn()
    }, 120)
}

function getLegalCards(uid) {
    const hand = state.cur.hands[uid] || []
    return hand.filter(card => isLegalCardFor(uid, card))
}

function isLegalCardFor(uid, card) {
    const hand = state.cur.hands[uid] || []
    if (!hand.includes(card)) return false
    if (state.cur.st !== 2) return true
    const trick = state.cur.trick || []
    const leadSuit = trick.length ? getSuit(trick[0].card) : ''
    const suit = getSuit(card)
    const isFirstTrick = (state.cur.tricksPlayed || 0) === 0
    if (!leadSuit) {
        if (isFirstTrick && card !== 'C2') return false
        if (!isFirstTrick && suit === 'H' && !state.cur.heartsBroken && !onlyHearts(hand)) return false
        if (isFirstTrick && isPointCard(card)) {
            const hasNonPoint = hand.some(c => !isPointCard(c))
            if (hasNonPoint) return false
        }
        if (isFirstTrick && (suit === 'H' || card === 'SQ')) return false
        return true
    }
    const hasLead = hand.some(c => getSuit(c) === leadSuit)
    if (hasLead && suit !== leadSuit) return false
    if (isFirstTrick && isPointCard(card)) {
        const hasNonPoint = hand.some(c => !isPointCard(c))
        if (hasNonPoint) return false
    }
    return true
}

function chooseBotPlayCard(uid, legal) {
    const trick = state.cur.trick || []
    const sorted = [...legal].sort(compareCards)
    if (!trick.length) {
        const nonPoint = sorted.filter(c => !isPointCard(c))
        return (nonPoint.length ? nonPoint : sorted)[0]
    }
    const leadSuit = getSuit(trick[0].card)
    const leadCards = trick.filter(t => getSuit(t.card) === leadSuit).map(t => t.card)
    const winningRank = Math.max(...leadCards.map(c => CARD_ORDER.indexOf(getRank(c))))
    const sameSuit = sorted.filter(c => getSuit(c) === leadSuit)
    if (sameSuit.length) {
        const under = sameSuit.filter(c => CARD_ORDER.indexOf(getRank(c)) < winningRank)
        if (under.length) return under[under.length - 1]
        return sameSuit[0]
    }
    const points = sorted.filter(isPointCard)
    if (points.length) {
        return points.sort((a, b) => scoreDanger(b) - scoreDanger(a))[0]
    }
    return sorted[sorted.length - 1]
}

function scoreDanger(card) {
    if (card === 'SQ') return 100
    if (getSuit(card) === 'H') return 20 + CARD_ORDER.indexOf(getRank(card))
    return CARD_ORDER.indexOf(getRank(card))
}

function nextPlayer(uid) {
    uid = Number(uid)
    const players = state.cur.plist || [0, 1, 2, 3]
    const idx = players.indexOf(uid)
    return players[(idx + 1) % players.length]
}

function getTrickWinner(trick) {
    const leadSuit = getSuit(trick[0].card)
    let winner = trick[0].player
    let best = CARD_ORDER.indexOf(getRank(trick[0].card))
    for (let i = 1; i < trick.length; i++) {
        const card = trick[i].card
        if (getSuit(card) !== leadSuit) continue
        const rank = CARD_ORDER.indexOf(getRank(card))
        if (rank > best) {
            best = rank
            winner = trick[i].player
        }
    }
    return winner
}

function countTrickPoints(trick) {
    return trick.reduce((sum, item) => {
        if (item.card === 'SQ') return sum + 13
        if (getSuit(item.card) === 'H') return sum + 1
        return sum
    }, 0)
}

function getHandCounts(hands) {
    return {
        0: (hands[0] || []).length,
        1: (hands[1] || []).length,
        2: (hands[2] || []).length,
        3: (hands[3] || []).length
    }
}

function findTwoClubOwner(hands) {
    const players = [0, 1, 2, 3]
    return players.find(uid => (hands[uid] || []).includes('C2')) || 0
}

function getPassTargets(players, direction) {
    const map = {}
    players.forEach((uid, idx) => {
        if (direction === 0) map[uid] = players[(idx + 1) % players.length]
        else if (direction === 1) map[uid] = players[(idx + players.length - 1) % players.length]
        else if (direction === 2) map[uid] = players[(idx + 2) % players.length]
        else map[uid] = uid
    })
    return map
}

function chooseBotPassCards(hand) {
    return [...hand]
        .sort((a, b) => scoreDanger(b) - scoreDanger(a))
        .slice(0, 3)
}

function buildDeck() {
    const suits = ['C', 'D', 'S', 'H']
    const deck = []
    suits.forEach(s => {
        for (let i = 0; i < CARD_ORDER.length; i++) deck.push(s + CARD_ORDER[i])
    })
    return deck
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const t = arr[i]
        arr[i] = arr[j]
        arr[j] = t
    }
}

function compareCards(a, b) {
    const suitOrder = { C: 0, D: 1, S: 2, H: 3 }
    const sa = suitOrder[getSuit(a)]
    const sb = suitOrder[getSuit(b)]
    if (sa !== sb) return sa - sb
    return CARD_ORDER.indexOf(getRank(a)) - CARD_ORDER.indexOf(getRank(b))
}
