// ========== 终末地抽卡规划 ==========
document.addEventListener("DOMContentLoaded", () => {
    const G = {
        CHAR_P: 0.008,
        CHAR_FIVE_P: 0.08,
        SOFT_START: 65,
        SOFT_INC: 0.05,
        HARD_SIX: 80,
        HARD_UP: 120,
        UP_RATE: 0.5,
        MILESTONE_FREE_AT: 30,
        MILESTONE_FREE_COUNT: 10,
        LIMITED_TOKEN_STEP: 240,
        WEAPON_P: 0.04,
        WEAPON_FIVE_P: 0.15,
        WEAPON_APPLY_HARD_SIX: 4,
        WEAPON_UP_RATE: 0.25,
        WEAPON_APPLY_HARD_UP: 8,
        WUKU_FROM_SIX: 2000,
        WUKU_FROM_FIVE: 200,
        WUKU_FROM_FOUR: 20,
        WUKU_PER_APPLY: 1980,
        BAOZHANG_FROM_SIX: 50,
        BAOZHANG_FROM_FIVE: 10,
        BAOZHANG_PER_PULL: 25,
        MAX_EXCHANGE_PULLS: 20000,
        SIM_N: 32000,
        SIM_CHART: 32000
    };

    function medianSorted(arr) {
        arr.sort((a, b) => a - b);
        const m = Math.floor(arr.length / 2);
        return arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
    }

    function mean(arr) {
        let s = 0;
        for (let i = 0; i < arr.length; i++) {
            s += arr[i];
        }
        return s / arr.length;
    }

    function drawFiveStarGivenNoSix(rng, pSix) {
        const remain = 1 - pSix;
        if (remain <= 0) {
            return false;
        }
        const pFiveGivenNoSix = Math.min(1, G.CHAR_FIVE_P / remain);
        return rng() < pFiveGivenNoSix;
    }

    function drawWeaponFiveGivenNoSix(rng, pSix) {
        const remain = 1 - pSix;
        if (remain <= 0) {
            return false;
        }
        const pFiveGivenNoSix = Math.min(1, G.WEAPON_FIVE_P / remain);
        return rng() < pFiveGivenNoSix;
    }

    function sixStarPityProb(fail, pBase, softStart, softInc, hardSix) {
        if (fail >= hardSix - 1) {
            return 1;
        }
        if (fail >= softStart) {
            return Math.min(1, pBase + softInc * (fail - softStart + 1));
        }
        return pBase;
    }

    function simulateCharacterSessionWithExchange(
        basePulls,
        pBase,
        softStart,
        softInc,
        hardSix,
        hardUp,
        upRate,
        milestoneAt,
        milestoneBonus,
        initialSixFail,
        initialFiveFail,
        useBaozhangExchange,
        initialBaozhang,
        rng
    ) {
        let sixTotal = 0;
        let fiveTotal = 0;
        let fourTotal = 0;
        let upTotal = 0;
        let sixFail = Math.max(0, Math.min(hardSix - 1, initialSixFail));
        let fiveFail = Math.max(0, Math.min(9, initialFiveFail));
        let paidNoUp = 0;
        let hardUpAvailable = true;
        let paidPullsTarget = Math.max(0, basePulls);
        let paidPullsDone = 0;
        let exchangedPulls = 0;
        let milestoneGranted = false;
        let baozhangBank = Math.max(0, initialBaozhang);

        while (paidPullsDone < paidPullsTarget) {
            paidPullsDone++;

            let gotSix = false;
            let gotFive = false;
            let gotUp = false;

            if (hardUpAvailable && paidNoUp === hardUp - 1) {
                gotSix = true;
                gotUp = true;
                hardUpAvailable = false;
            } else {
                const pSix = sixStarPityProb(sixFail, pBase, softStart, softInc, hardSix);
                if (rng() < pSix) {
                    gotSix = true;
                    gotUp = rng() < upRate;
                } else if (fiveFail >= 9 || drawFiveStarGivenNoSix(rng, pSix)) {
                    gotFive = true;
                }
            }

            if (gotSix) {
                sixTotal++;
                if (gotUp) {
                    upTotal++;
                    if (hardUpAvailable) {
                        hardUpAvailable = false;
                    }
                }
                sixFail = 0;
                fiveFail = 0;
            } else if (gotFive) {
                fiveTotal++;
                sixFail++;
                fiveFail = 0;
            } else {
                fourTotal++;
                sixFail++;
                fiveFail++;
            }

            if (gotUp) {
                paidNoUp = 0;
            } else {
                paidNoUp++;
            }

            if (!milestoneGranted && paidPullsDone >= milestoneAt) {
                milestoneGranted = true;
                let bonusFiveFail = 0;
                for (let i = 0; i < milestoneBonus; i++) {
                    const pSixBonus = pBase;
                    let bonusGotSix = false;
                    let bonusGotFive = false;
                    if (rng() < pSixBonus) {
                        sixTotal++;
                        bonusGotSix = true;
                        if (rng() < upRate) {
                            upTotal++;
                        }
                        bonusFiveFail = 0;
                    } else if (bonusFiveFail >= 9 || drawFiveStarGivenNoSix(rng, pSixBonus)) {
                        fiveTotal++;
                        bonusGotFive = true;
                        bonusFiveFail = 0;
                    } else {
                        fourTotal++;
                        bonusFiveFail++;
                    }

                    baozhangBank += bonusGotSix ? G.BAOZHANG_FROM_SIX : 0;
                    baozhangBank += bonusGotFive ? G.BAOZHANG_FROM_FIVE : 0;
                    if (useBaozhangExchange) {
                        while (
                            baozhangBank >= G.BAOZHANG_PER_PULL &&
                            exchangedPulls < G.MAX_EXCHANGE_PULLS
                        ) {
                            baozhangBank -= G.BAOZHANG_PER_PULL;
                            paidPullsTarget++;
                            exchangedPulls++;
                        }
                    }
                }
            }

            baozhangBank += gotSix ? G.BAOZHANG_FROM_SIX : 0;
            baozhangBank += gotFive ? G.BAOZHANG_FROM_FIVE : 0;

            if (useBaozhangExchange) {
                while (
                    baozhangBank >= G.BAOZHANG_PER_PULL &&
                    exchangedPulls < G.MAX_EXCHANGE_PULLS
                ) {
                    baozhangBank -= G.BAOZHANG_PER_PULL;
                    paidPullsTarget++;
                    exchangedPulls++;
                }
            }
        }

        const baozhangTotal = sixTotal * G.BAOZHANG_FROM_SIX + fiveTotal * G.BAOZHANG_FROM_FIVE;
        const wukuTotal =
            sixTotal * G.WUKU_FROM_SIX + fiveTotal * G.WUKU_FROM_FIVE + fourTotal * G.WUKU_FROM_FOUR;
        const milestoneBonusPulls = milestoneGranted ? milestoneBonus : 0;
        const totalPulls = paidPullsDone + milestoneBonusPulls;

        return {
            sixTotal,
            fiveTotal,
            fourTotal,
            upTotal,
            baozhangTotal,
            wukuTotal,
            baozhangBank,
            exchangedPulls,
            paidPullsDone,
            milestoneBonusPulls,
            totalPulls
        };
    }

    function simulateWeaponSession(applyCount, pSix, upRate, hardSixApply, hardUpApply, rng) {
        let sixTotal = 0;
        let upTotal = 0;
        let fiveTotal = 0;
        let fourTotal = 0;
        let noSixApplyStreak = 0;
        let noUpApplyStreak = 0;
        let hardUpAvailable = true;

        for (let a = 1; a <= applyCount; a++) {
            const forceUpThisApply = hardUpAvailable && noUpApplyStreak >= hardUpApply - 1;
            const forceSixThisApply = !forceUpThisApply && noSixApplyStreak >= hardSixApply - 1;
            if (forceUpThisApply) {
                hardUpAvailable = false;
            }

            let sixInApply = 0;
            let upInApply = 0;
            let fiveInApply = 0;
            let fourInApply = 0;

            for (let slot = 0; slot < 10; slot++) {
                if (forceUpThisApply && slot === 0) {
                    sixInApply++;
                    upInApply++;
                    continue;
                }

                if (forceSixThisApply && slot === 0) {
                    sixInApply++;
                    if (rng() < upRate) {
                        upInApply++;
                    }
                    continue;
                }

                if (rng() < pSix) {
                    sixInApply++;
                    if (rng() < upRate) {
                        upInApply++;
                    }
                } else if (drawWeaponFiveGivenNoSix(rng, pSix)) {
                    fiveInApply++;
                } else {
                    fourInApply++;
                }
            }

            if (sixInApply + fiveInApply === 0) {
                fiveInApply++;
                fourInApply = Math.max(0, fourInApply - 1);
            }

            sixTotal += sixInApply;
            upTotal += upInApply;
            fiveTotal += fiveInApply;
            fourTotal += fourInApply;

            if (sixInApply > 0) {
                noSixApplyStreak = 0;
            } else {
                noSixApplyStreak++;
            }

            if (upInApply > 0) {
                noUpApplyStreak = 0;
            } else {
                noUpApplyStreak++;
            }
        }

        return { sixTotal, upTotal, fiveTotal, fourTotal };
    }

    function weaponRewardSummary(applyCount) {
        const t = Math.max(0, Math.floor(applyCount));
        if (t < 10) {
            return { upBonus: 0, nonUpSixBonus: 0 };
        }
        const rewardCount = Math.floor((t - 10) / 8) + 1;
        const nonUpSixBonus = Math.ceil(rewardCount / 2);
        const upBonus = Math.floor(rewardCount / 2);
        return { upBonus, nonUpSixBonus };
    }

    function mulberry32(seed) {
        return function () {
            let t = (seed += 0x6d2b79f5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function estimateSingleProbability(simCount, seedStart, hitTrial) {
        let hits = 0;
        let seed = seedStart;
        for (let i = 0; i < simCount; i++) {
            const rng = mulberry32((seed = (seed + 0x9e3779b9) >>> 0));
            if (hitTrial(rng)) {
                hits++;
            }
        }
        return hits / simCount;
    }

    function limitedTokenBonus(pulls) {
        return Math.floor(Math.max(0, pulls) / G.LIMITED_TOKEN_STEP);
    }

    function getNonNegativeInt(id) {
        return Math.max(0, Math.floor(Number(document.getElementById(id).value)));
    }

    function getBoundedInt(id, min, max, fallback) {
        const v = Math.floor(Number(document.getElementById(id).value));
        if (!Number.isFinite(v)) {
            return fallback;
        }
        return Math.min(max, Math.max(min, v));
    }

    function getBool(id) {
        const el = document.getElementById(id);
        return !!(el && el.checked);
    }

    const p = G.CHAR_P;
    const ss = G.SOFT_START;
    const si = G.SOFT_INC;
    const h6 = G.HARD_SIX;
    const wp = G.WEAPON_P;
    const wah = G.WEAPON_APPLY_HARD_SIX;
    const wup = G.WEAPON_UP_RATE;
    const wakho = G.WEAPON_APPLY_HARD_UP;
    const simN = G.SIM_N;
    const simC = G.SIM_CHART;

    document.getElementById("up-calc-summary").addEventListener("click", () => {
        const baseN = getNonNegativeInt("up-n");
        const sixRemain = getBoundedInt("shared-pity-six-remain", 1, G.HARD_SIX, G.HARD_SIX);
        const fiveRemain = getBoundedInt("shared-pity-five-remain", 1, 10, 10);
        const initialSixFail = G.HARD_SIX - sixRemain;
        const initialFiveFail = 10 - fiveRemain;
        const useBaozhang = getBool("shared-use-baozhang");
        const initBaozhang = getNonNegativeInt("shared-init-baozhang");
        const rngSix = mulberry32(0x9e3779b9);
        const samplesSix = [];
        const samplesBaozhang = [];
        const samplesWuku = [];
        const samplesExchange = [];
        const samplesTotalPulls = [];

        for (let i = 0; i < simN; i++) {
            const r = simulateCharacterSessionWithExchange(
                baseN,
                p,
                ss,
                si,
                h6,
                G.HARD_UP,
                G.UP_RATE,
                G.MILESTONE_FREE_AT,
                G.MILESTONE_FREE_COUNT,
                initialSixFail,
                initialFiveFail,
                useBaozhang,
                initBaozhang,
                rngSix
            );
            samplesSix.push(r.sixTotal + limitedTokenBonus(r.paidPullsDone));
            samplesBaozhang.push(r.baozhangTotal);
            samplesWuku.push(r.wukuTotal);
            samplesExchange.push(r.exchangedPulls);
            samplesTotalPulls.push(r.totalPulls);
        }

        const rngUp = mulberry32(0xdeadbeef);
        const samplesUp = [];
        for (let i = 0; i < simN; i++) {
            const r = simulateCharacterSessionWithExchange(
                baseN,
                p,
                ss,
                si,
                h6,
                G.HARD_UP,
                G.UP_RATE,
                G.MILESTONE_FREE_AT,
                G.MILESTONE_FREE_COUNT,
                initialSixFail,
                initialFiveFail,
                useBaozhang,
                initBaozhang,
                rngUp
            );
            samplesUp.push(r.upTotal + limitedTokenBonus(r.paidPullsDone));
        }

        document.getElementById("up-out-summary").innerHTML =
            `<div><strong>六星（含当期与信物折算）</strong>：期望 <strong>${mean(samplesSix).toFixed(3)}</strong>，中位数 <strong>${medianSorted(samplesSix.slice())}</strong></div>` +
            `<div style="margin-top:8px"><strong>当期（含 240 抽信物）</strong>：期望 <strong>${mean(samplesUp).toFixed(3)}</strong>，中位数 <strong>${medianSorted(samplesUp.slice())}</strong></div>` +
            `<div style="margin-top:8px"><strong>保障配额（估算）</strong>：期望 <strong>${mean(samplesBaozhang).toFixed(2)}</strong>，中位数 <strong>${medianSorted(samplesBaozhang.slice()).toFixed(0)}</strong></div>` +
            `<div style="margin-top:8px"><strong>武库配额（估算）</strong>：期望 <strong>${mean(samplesWuku).toFixed(0)}</strong>，中位数 <strong>${medianSorted(samplesWuku.slice()).toFixed(0)}</strong></div>` +
            `<div style="margin-top:8px;font-size:0.75rem;color:#666666">${simN.toLocaleString()} 次模拟；基础抽数 ${baseN}，6星保底剩余 ${sixRemain}，5星保底剩余 ${fiveRemain}；保障换抽 ${useBaozhang ? "开启" : "关闭"}（初始 ${initBaozhang}，期望额外换抽 ${mean(samplesExchange).toFixed(2)}），平均总抽数 ${mean(samplesTotalPulls).toFixed(2)}；规则详见上方「抽卡口径」。</div>`;
    });

    document.getElementById("up-up-calc").addEventListener("click", () => {
        const k = Math.max(1, Math.floor(Number(document.getElementById("up-up-k").value)));
        const baseN = getNonNegativeInt("up-up-n");
        const sixRemain = getBoundedInt("shared-pity-six-remain", 1, G.HARD_SIX, G.HARD_SIX);
        const initialSixFail = G.HARD_SIX - sixRemain;
        const initialFiveFail = 10 - getBoundedInt("shared-pity-five-remain", 1, 10, 10);
        const useBaozhang = getBool("shared-use-baozhang");
        const initBaozhang = getNonNegativeInt("shared-init-baozhang");
        const pullSamples = [];
        const tokenSamples = [];

        const prob = estimateSingleProbability(simC, 0xbadcafe, (rng) => {
            const r = simulateCharacterSessionWithExchange(
                baseN,
                p,
                ss,
                si,
                h6,
                G.HARD_UP,
                G.UP_RATE,
                G.MILESTONE_FREE_AT,
                G.MILESTONE_FREE_COUNT,
                initialSixFail,
                initialFiveFail,
                useBaozhang,
                initBaozhang,
                rng
            );
            pullSamples.push(r.totalPulls);
            const tokenBonus = limitedTokenBonus(r.paidPullsDone);
            tokenSamples.push(tokenBonus);
            const upCount = r.upTotal + tokenBonus;
            return upCount >= k;
        });

        const avgToken = mean(tokenSamples);
        document.getElementById("up-up-out").innerHTML =
            `<strong>基础抽数 n = ${baseN}</strong>（6星保底剩余 ${sixRemain}）时，<strong>当期个数 ≥ ${k}</strong> 的概率约为 <strong>${(prob * 100).toFixed(2)}%</strong>` +
            `<div style="margin-top:8px;font-size:0.75rem;color:#666666">已计入信物约 ${Math.round(avgToken)} 个</div>` +
            `<div style="margin-top:8px;font-size:0.75rem;color:#666666">${simC.toLocaleString()} 次模拟；保障换抽${useBaozhang ? "开启" : "关闭"}（初始 ${initBaozhang}），平均总抽数 ${mean(pullSamples).toFixed(2)}；规则详见上方「抽卡口径」。</div>`;
    });

    document.getElementById("wp-calc").addEventListener("click", () => {
        const T = getNonNegativeInt("wp-t");
        const reward = weaponRewardSummary(T);
        const rngSix = mulberry32(0xc2b2ae35);
        const samplesSix = [];

        for (let i = 0; i < simN; i++) {
            const r = simulateWeaponSession(T, wp, wup, wah, wakho, rngSix);
            samplesSix.push(r.sixTotal + reward.upBonus + reward.nonUpSixBonus);
        }

        const rngUp = mulberry32(0x7f4a7c15);
        const samplesUp = [];
        for (let i = 0; i < simN; i++) {
            samplesUp.push(simulateWeaponSession(T, wp, wup, wah, wakho, rngUp).upTotal + reward.upBonus);
        }

        document.getElementById("wp-out").innerHTML =
            `<div><strong>六星武器</strong>：期望 <strong>${mean(samplesSix).toFixed(3)}</strong>，中位数 <strong>${medianSorted(samplesSix.slice())}</strong></div>` +
            `<div style="margin-top:8px"><strong>当期武器</strong>：期望 <strong>${mean(samplesUp).toFixed(3)}</strong>，中位数 <strong>${medianSorted(samplesUp.slice())}</strong></div>` +
            `<div style="margin-top:8px;font-size:0.75rem;color:#666666">${simN.toLocaleString()} 次模拟；${T} 次申领（总 ${10 * T} 件）；已计入限定赠礼额外当期 UP 武器 ${reward.upBonus} 把与补充武库箱 ${reward.nonUpSixBonus} 把（计入非当期六星）；规则详见上方「抽卡口径」。</div>`;
    });

    document.getElementById("wp-up-calc-prob").addEventListener("click", () => {
        const k = Math.max(1, Math.floor(Number(document.getElementById("wp-up-k").value)));
        const t = getNonNegativeInt("wp-up-t-prob");
        const reward = weaponRewardSummary(t);

        const prob = estimateSingleProbability(simC, 0x1f123bb5, (rng) => {
            const upCount = simulateWeaponSession(t, wp, wup, wah, wakho, rng).upTotal + reward.upBonus;
            return upCount >= k;
        });

        document.getElementById("wp-up-prob-out").innerHTML =
            `<strong>申领 T = ${t}</strong>（总 ${10 * t} 件）时，<strong>当期武器个数 ≥ ${k}</strong> 的概率约为 <strong>${(prob * 100).toFixed(2)}%</strong>` +
            `<div style="margin-top:8px;font-size:0.75rem;color:#666666">${simC.toLocaleString()} 次模拟；已计入限定赠礼额外当期 UP 武器 ${reward.upBonus} 把；规则详见上方「抽卡口径」。</div>`;
    });

    document.getElementById("combo-calc").addEventListener("click", () => {
        const baseN = getNonNegativeInt("combo-char-n");
        const initWuku = getNonNegativeInt("combo-wuku-init");
        const useBaozhang = getBool("shared-use-baozhang");
        const initBaozhang = getNonNegativeInt("shared-init-baozhang");
        const sixRemain = getBoundedInt("shared-pity-six-remain", 1, G.HARD_SIX, G.HARD_SIX);
        const fiveRemain = getBoundedInt("shared-pity-five-remain", 1, 10, 10);
        const initialSixFail = G.HARD_SIX - sixRemain;
        const initialFiveFail = 10 - fiveRemain;

        let hits = 0;
        let sumUpChar = 0;
        let sumUpWeapon = 0;
        let sumApply = 0;
        let sumWuku = 0;
        let sumExchange = 0;
        let charSeed = 0x5f3759df;
        let weaponSeed = 0x9e3779b1;

        for (let i = 0; i < simC; i++) {
            const rngChar = mulberry32((charSeed = (charSeed + 0x9e3779b9) >>> 0));
            const charR = simulateCharacterSessionWithExchange(
                baseN,
                p,
                ss,
                si,
                h6,
                G.HARD_UP,
                G.UP_RATE,
                G.MILESTONE_FREE_AT,
                G.MILESTONE_FREE_COUNT,
                initialSixFail,
                initialFiveFail,
                useBaozhang,
                initBaozhang,
                rngChar
            );

            const upCharTotal = charR.upTotal + limitedTokenBonus(charR.paidPullsDone);
            const totalWuku = initWuku + charR.wukuTotal;
            const applyCount = Math.floor(totalWuku / G.WUKU_PER_APPLY);
            const reward = weaponRewardSummary(applyCount);

            const rngWeapon = mulberry32((weaponSeed = (weaponSeed + 0x85ebca6b) >>> 0));
            const weaponR = simulateWeaponSession(applyCount, wp, wup, wah, wakho, rngWeapon);
            const upWeaponTotal = weaponR.upTotal + reward.upBonus;

            if (upCharTotal >= 6 && upWeaponTotal >= 6) {
                hits++;
            }

            sumUpChar += upCharTotal;
            sumUpWeapon += upWeaponTotal;
            sumApply += applyCount;
            sumWuku += totalWuku;
            sumExchange += charR.exchangedPulls;
        }

        const prob = hits / simC;
        document.getElementById("combo-out").innerHTML =
            `<div><strong>6+6 达成概率</strong>：<strong>${(prob * 100).toFixed(2)}%</strong></div>` +
            `<div style="margin-top:8px"><strong>当期角色期望</strong>：${(sumUpChar / simC).toFixed(3)}，<strong>当期武器期望</strong>：${(sumUpWeapon / simC).toFixed(3)}</div>` +
            `<div style="margin-top:8px"><strong>总武库配额期望</strong>：${(sumWuku / simC).toFixed(0)}，<strong>可申领次数期望</strong>：${(sumApply / simC).toFixed(2)}</div>` +
            `<div style="margin-top:8px;font-size:0.75rem;color:#666666">${simC.toLocaleString()} 次模拟；角色基础抽数 ${baseN}，现有武库配额 ${initWuku}；保障换抽${useBaozhang ? "开启" : "关闭"}（初始 ${initBaozhang}，角色侧期望额外换抽 ${(sumExchange / simC).toFixed(2)}）；角色产出的武库配额已计入武器申领。规则详见上方「抽卡口径」。</div>`;
    });
});
