(function (root) {
  'use strict';
  // 一条主线，从幼到老。内容全部来自八字引擎的 report.story，这里只负责配上画面。
  const SCENES = { origin: 'opening', child: 'childhood', school: 'school', exam: 'bg-exam', campus: 'bg-campus', depart: 'departure', bond: 'bg-relationship', work: 'work', turn: 'midlife', late: 'elder', now: 'together', end: 'opening' };
  function create(result) {
    const { natal, report } = result;
    const dominant = Object.entries(natal.counts.grp).sort((a, b) => b[1] - a[1])[0][0];
    const route = ['印', '官杀'].includes(dominant) ? 'structure' : dominant === '食伤' ? 'create' : dominant === '财' ? 'practical' : 'independent';
    return report.story.map((b) => Object.assign({}, b, { scene: SCENES[b.key], chapter: b.title, route, ageShown: b.key === 'end' ? 86 : b.key === 'origin' ? 0 : b.age }));
  }
  root.LifeStory = { create };
})(typeof window !== 'undefined' ? window : globalThis);
