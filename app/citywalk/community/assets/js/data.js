/**
 * 发现区示例数据。封面为本地 SVG 示意（与城市/主题一致，标注「示例参考」），避免外链图与文案不符。
 * 路径相对 community/index.html。
 */
const SAMPLE_IMG = {
  beijing: 'assets/images/samples/beijing-hutong.svg',
  shanghai: 'assets/images/samples/shanghai-creek.svg',
  chengdu: 'assets/images/samples/chengdu-street.svg',
  hangzhou: 'assets/images/samples/hangzhou-lake.svg',
  guangzhou: 'assets/images/samples/guangzhou-shamian.svg',
  shenzhen: 'assets/images/samples/shenzhen-oct.svg',
  tips: 'assets/images/samples/walk-tips.svg'
};

const ROUTE_SAMPLE_IMG = {
  'beijing-gulou-hutong': SAMPLE_IMG.beijing,
  'shanghai-suzhou-creek': SAMPLE_IMG.shanghai,
  'chengdu-wangping': SAMPLE_IMG.chengdu,
  'hangzhou-westlake-west': SAMPLE_IMG.hangzhou,
  'guangzhou-shamian': SAMPLE_IMG.guangzhou,
  'shenzhen-ocean-oct': SAMPLE_IMG.shenzhen
};

function sampleCover(routeId) {
  return ROUTE_SAMPLE_IMG[routeId] || SAMPLE_IMG.tips;
}

/** 发现区示例路线（均标注「示例参考」，非真实 UGC） */
const routes = [
  {
    id: 'beijing-gulou-hutong',
    city: '北京',
    type: '胡同漫游',
    title: '南锣鼓巷 → 北锣鼓巷 → 五道营｜胡同里慢半拍',
    desc: '短距离、多停留，适合第一次在北京 Citywalk：看门墩、小馆与树影，不赶景点。',
    image: sampleCover('beijing-gulou-hutong'),
    distance: '3.6 km',
    time: '2h',
    level: '轻松',
    likes: '—',
    author: '示例·胡同',
    avatar: '',
    stops: ['南锣鼓巷入口', '北锣鼓巷', '国子监街角', '五道营胡同', '安定门附近'],
    tips: ['建议工作日上午，胡同里更安静。', '部分院落不对外开放，请在门外拍照即可。', '可在中段找一家咖啡馆坐 30 分钟再继续。']
  },
  {
    id: 'shanghai-suzhou-creek',
    city: '上海',
    type: '滨水慢行',
    title: '苏州河 → 天潼路 → 外白渡桥｜沿水看城',
    desc: '步行线贴水而行，桥梁与仓库改造段适合慢慢看立面与河景。',
    image: sampleCover('shanghai-suzhou-creek'),
    distance: '4.1 km',
    time: '2h',
    level: '轻松',
    likes: '—',
    author: '示例·滨江',
    avatar: '',
    stops: ['苏州河步道', '浙江路桥', '天潼路', '北苏州路', '外白渡桥'],
    tips: ['傍晚光线更适合拍河面与城市天际线。', '河边风大，春秋备一件外套。', '周末步道人多，可错峰出发。']
  },
  {
    id: 'chengdu-wangping',
    city: '成都',
    type: '咖啡街区',
    title: '望平街 → 太古里周边 → 镗钯街｜半日晃悠',
    desc: '平路为主、店招密集，站距短、停留多，适合「氛围优先」的半日晃悠。',
    image: sampleCover('chengdu-wangping'),
    distance: '3.8 km',
    time: '2.5h',
    level: '轻松',
    likes: '—',
    author: '示例·巷弄',
    avatar: '',
    stops: ['望平街', '滨河绿道', '东大街口', '镗钯街', '小吃收尾'],
    tips: ['成都节奏偏慢，计划时长宁长勿短。', '中午可在望平街解决一餐再继续。', '雨天地砖略滑，注意鞋防滑。']
  },
  {
    id: 'hangzhou-westlake-west',
    city: '杭州',
    type: '湖西慢行',
    title: '杨公堤 → 茅家埠 → 乌龟潭｜西湖西侧静音线',
    desc: '避开主通道人流，湖、树与小坡交替，强度适中的一下午。',
    image: sampleCover('hangzhou-westlake-west'),
    distance: '5.2 km',
    time: '2.5h',
    level: '中等',
    likes: '—',
    author: '示例·湖西',
    avatar: '',
    stops: ['杨公堤入口', '茅家埠', '浴鹄湾', '乌龟潭', '虎跑路出口'],
    tips: ['节假日杨公堤骑行者多，步行靠内侧。', '春季柳絮多，过敏人群备口罩。', '末段可提前叫车，避免折返。']
  },
  {
    id: 'guangzhou-shamian',
    city: '广州',
    type: '历史街区',
    title: '沙面 → 沿江西路 → 爱群大厦｜江风与老建筑',
    desc: '欧式立面与珠江江风，建筑与拍照向 Walk 的经典组合。',
    image: sampleCover('guangzhou-shamian'),
    distance: '3.5 km',
    time: '2h',
    level: '轻松',
    likes: '—',
    author: '示例·岭南',
    avatar: '',
    stops: ['沙面岛', '人民桥', '沿江西路', '爱群大厦', '海珠广场方向'],
    tips: ['夏季下午注意防暑，建议上午或黄昏。', '沙面适合拍建筑细节，勿进入私人区域。', '江边注意观潮与交通安全。']
  },
  {
    id: 'shenzhen-ocean-oct',
    city: '深圳',
    type: '创意园区',
    title: '华侨城创意园 → 燕晗山绿道 → 海景方向',
    desc: '园区闲逛加短爬升，终点可远眺城市与海面，强度中等。',
    image: sampleCover('shenzhen-ocean-oct'),
    distance: '4.6 km',
    time: '2.5h',
    level: '中等',
    likes: '—',
    author: '示例·园区',
    avatar: '',
    stops: ['OCT 南区', '旧厂房街区', '燕晗山绿道口', '山顶观景台', '下山至滨海方向'],
    tips: ['绿道段有台阶，穿运动鞋。', '园区店铺周末才全开，工作日较静。', '想纯平路可在创意园折返，不必上山。']
  }
];

const routeSpots = {
  'beijing-gulou-hutong': {
    title: '南锣鼓巷 → 北锣鼓巷 → 五道营',
    meta: '北京 · 3.6 km · 约 2h · 轻松',
    spots: [
      { name: '南锣鼓巷入口', type: '街区', meta: '起点 · 20 min', image: sampleCover('beijing-gulou-hutong'), desc: '先感受胡同尺度与人流，不必进店也可以完成热身段。' },
      { name: '北锣鼓巷', type: '胡同', meta: '中段 · 35 min', image: sampleCover('beijing-gulou-hutong'), desc: '相对安静，适合拍照与慢走，注意居民生活区保持安静。' },
      { name: '国子监街角', type: '街景', meta: '停留 · 25 min', image: sampleCover('beijing-gulou-hutong'), desc: '看灰墙、树影与旧式门脸，可作为中段休息拍照点。' },
      { name: '五道营胡同', type: '小店', meta: '终点段 · 40 min', image: sampleCover('beijing-gulou-hutong'), desc: '咖啡与小馆集中，适合把「停留」算进总时长。' }
    ]
  },
  'shanghai-suzhou-creek': {
    title: '苏州河 → 外白渡桥',
    meta: '上海 · 4.1 km · 约 2h · 轻松',
    spots: [
      { name: '苏州河步道', type: '滨水', meta: '起点 · 25 min', image: sampleCover('shanghai-suzhou-creek'), desc: '贴水而行，观察桥梁与仓库改造立面。' },
      { name: '浙江路桥', type: '桥梁', meta: '20 min', image: sampleCover('shanghai-suzhou-creek'), desc: '适合作为路线中的「地标节点」拍全景。' },
      { name: '北苏州路', type: '街区', meta: '中段 · 30 min', image: sampleCover('shanghai-suzhou-creek'), desc: '老建筑与现代塔楼同框，节奏可快可慢。' },
      { name: '外白渡桥', type: '地标', meta: '终点 · 25 min', image: sampleCover('shanghai-suzhou-creek'), desc: '经典收尾机位，建议留 15 分钟拍照再结束。' }
    ]
  },
  'chengdu-wangping': {
    title: '望平街 → 镗钯街',
    meta: '成都 · 3.8 km · 约 2.5h · 轻松',
    spots: [
      { name: '望平街', type: '咖啡', meta: '起点 · 40 min', image: sampleCover('chengdu-wangping'), desc: '建议第一站就坐下，把成都「慢」贯彻到底。' },
      { name: '滨河绿道', type: '绿道', meta: '25 min', image: sampleCover('chengdu-wangping'), desc: '平路缓行，适合聊天与消化上一站咖啡。' },
      { name: '镗钯街', type: '美食', meta: '终点 · 45 min', image: sampleCover('chengdu-wangping'), desc: '小吃与小店集中，可作为 Walk 的「奖励段」。' }
    ]
  },
  'hangzhou-westlake-west': {
    title: '杨公堤 → 乌龟潭',
    meta: '杭州 · 5.2 km · 约 2.5h · 中等',
    spots: [
      { name: '杨公堤', type: '湖堤', meta: '起点 · 35 min', image: sampleCover('hangzhou-westlake-west'), desc: '一侧湖水一侧树，保持靠湖侧行走更安全。' },
      { name: '茅家埠', type: '水岸', meta: '停留 · 30 min', image: sampleCover('hangzhou-westlake-west'), desc: '相对静音，适合拍「非游客照」。' },
      { name: '乌龟潭', type: '园林', meta: '终点 · 40 min', image: sampleCover('hangzhou-westlake-west'), desc: '小坡与水面交替，结束前有完整「收尾感」。' }
    ]
  },
  'guangzhou-shamian': {
    title: '沙面 → 沿江西路',
    meta: '广州 · 3.5 km · 约 2h · 轻松',
    spots: [
      { name: '沙面岛', type: '建筑', meta: '起点 · 45 min', image: sampleCover('guangzhou-shamian'), desc: '欧式立面与榕树，适合建筑摄影向 Walk。' },
      { name: '沿江西路', type: '江岸', meta: '中段 · 30 min', image: sampleCover('guangzhou-shamian'), desc: '江风与旧楼，注意防晒与补水。' },
      { name: '爱群大厦', type: '地标', meta: '终点 · 20 min', image: sampleCover('guangzhou-shamian'), desc: 'Art Deco 线条，适合作为路线封面机位。' }
    ]
  },
  'shenzhen-ocean-oct': {
    title: '华侨城创意园 → 燕晗山',
    meta: '深圳 · 4.6 km · 约 2.5h · 中等',
    spots: [
      { name: 'OCT 创意园', type: '园区', meta: '起点 · 40 min', image: sampleCover('shenzhen-ocean-oct'), desc: '旧厂房与画廊，适合先逛再上山。' },
      { name: '燕晗山绿道', type: '绿道', meta: '爬升 · 35 min', image: sampleCover('shenzhen-ocean-oct'), desc: '短爬升，记得在计划时长里留一点体力余量。' },
      { name: '观景台', type: '视野', meta: '终点 · 25 min', image: sampleCover('shenzhen-ocean-oct'), desc: '可看到城市与海面方向，适合作为 Walk 终点。' }
    ]
  }
};

/** 动态区示例（API 无帖时展示；字段对齐 UGC） */
const demoPosts = [
  {
    id: 'demo-post-01',
    is_demo: true,
    type: '路线',
    city: '北京',
    title: '用规划页生成了胡同线，比跟攻略走省心',
    desc: '起终点加两个必去咖啡，WanderWalk 直接串好顺序，路上只负责慢慢走。',
    image: SAMPLE_IMG.beijing,
    author: '示例·规划',
    tags: ['Citywalk', '规划导入'],
    like_count: 0
  },
  {
    id: 'demo-post-02',
    is_demo: true,
    type: '打卡',
    city: '成都',
    title: '望平街这家窗口位，适合走累了坐 20 分钟',
    desc: '把停留写进计划时长里，Walk 就不会变成赶路。',
    image: SAMPLE_IMG.chengdu,
    author: '示例·咖啡',
    tags: ['望平街', '停留'],
    like_count: 0
  },
  {
    id: 'demo-post-03',
    is_demo: true,
    type: '攻略',
    city: '全国',
    title: '计划 2 小时 Walk，为什么要留 20 分钟「空白」',
    desc: '步行、打卡与自由安排都要算进滑块时长，留一点空白才不赶。',
    image: SAMPLE_IMG.tips,
    author: '示例·攻略',
    tags: ['WalkTips', '时长'],
    like_count: 0
  },
  {
    id: 'demo-post-04',
    is_demo: true,
    type: '夜游',
    city: '上海',
    title: '苏州河一段的夜景，适合放在路线最后 30 分钟',
    desc: '摄影向时段放在终点：白天逛店，傍晚拍桥。',
    image: SAMPLE_IMG.shanghai,
    author: '示例·夜游',
    tags: ['苏州河', '夜景'],
    like_count: 0
  },
  {
    id: 'demo-post-05',
    is_demo: true,
    type: '拍照',
    city: '广州',
    title: '沙面不需要滤镜，下午侧光就够了',
    desc: '建筑 Walk 以立面细节为主，不必赶点位数量。',
    image: SAMPLE_IMG.guangzhou,
    author: '示例·镜头',
    tags: ['沙面', '建筑'],
    like_count: 0
  },
  {
    id: 'demo-post-06',
    is_demo: true,
    type: '路线',
    city: '杭州',
    title: '西湖西侧这条，适合「省力直达」少绕路',
    desc: '站数不多，但每段都有明确停留理由。',
    image: SAMPLE_IMG.hangzhou,
    author: '示例·湖西',
    tags: ['西湖', '路线分享'],
    like_count: 0
  },
  {
    id: 'demo-post-07',
    is_demo: true,
    type: '攻略',
    city: '深圳',
    title: '园区 + 短绿道：爬升段记得穿防滑鞋',
    desc: '途经点过多或某段步行失败时，规划页会有路线说明，出行前看一眼更安心。',
    image: SAMPLE_IMG.shenzhen,
    author: '示例·装备',
    tags: ['华侨城', '实用'],
    like_count: 0
  },
  {
    id: 'demo-post-08',
    is_demo: true,
    type: '打卡',
    city: '上海',
    title: '记录到社区后，足迹里能逐站回看',
    desc: '规划完成 → 记录到社区 → 在「规划导入」里打开点位板。',
    image: SAMPLE_IMG.shanghai,
    author: '示例·足迹',
    tags: ['社区联动', '规划'],
    like_count: 0
  }
];

/** 找搭子示例（API 无数据时前端不读此表；保留供本地演示扩展） */
const buddies = [];
