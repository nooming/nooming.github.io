/**
 * 牌桌轻音效：只做卡牌点击与操作按钮反馈，不介入每种牌的结算。
 */
(function () {
  'use strict';
  if (!window.SoundFX) return;

  document.addEventListener('click', function (event) {
    var card = event.target.closest(
      '[data-card-slot], [data-hearts-card], .card-face, .card-back'
    );
    if (card) {
      window.SoundFX.play('card');
      return;
    }
    var button = event.target.closest('.card-game-viewport button, .card-game-dock button');
    if (button && !button.disabled) window.SoundFX.play('click');
  }, true);
})();
