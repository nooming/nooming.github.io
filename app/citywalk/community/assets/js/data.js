const routes = [
  {
    id:'taipei-zhongshan-dadaocheng',
    city:'台北',type:'街区漫游',title:'中山 → 赤峰街 → 大稻埕｜下午慢慢走',
    desc:'适合周末下午，从文创小店、咖啡馆一路走到老街与河岸。节奏轻松，边走边逛刚刚好。',
    image:'https://images.unsplash.com/photo-1470004914212-05527e49370b?auto=format&fit=crop&w=1200&q=85',
    distance:'4.8 km',time:'2.5h',level:'轻松',likes:'2.8k',author:'小岛日记',avatar:'https://i.pravatar.cc/100?img=16',
    stops:['中山站','赤峰街文创小店','咖啡休息','大稻埕老街','河岸日落'],
    tips:['下午 2 点左右出发，适合把咖啡时间放在中段。','沿途很多小店营业时间不同，可以留出机动时间。','最后一站安排到河岸，适合看夕阳和拍城市夜景。']
  },
  {
    id:'tokyo-shibuya-nakameguro',
    city:'东京',type:'夜游路线',title:'涩谷 → 代官山 → 中目黑｜东京夜晚散步',
    desc:'霓虹、唱片店、街角居酒屋和目黑川，适合想体验东京“生活感”而不是刷景点的人。',
    image:'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=85',
    distance:'5.3 km',time:'3h',level:'轻松',likes:'3.4k',author:'Momo在旅行',avatar:'https://i.pravatar.cc/100?img=32',
    stops:['涩谷十字路口','代官山小店','唱片店','中目黑河岸','深夜拉面'],
    tips:['傍晚开始比较合适，前半段逛店，后半段看夜景。','夜间部分注意末班交通时间。','如果喜欢摄影，可以带一颗适合低光的镜头。']
  },
  {
    id:'kyoto-philosopher-walk',
    city:'京都',type:'小众路线',title:'鸭川 → 祇园 → 哲学之道｜避开赶景点的一天',
    desc:'把京都当成一座适合散步的城市，减少景点打卡，把更多时间留给街巷、寺院和河边。',
    image:'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=85',
    distance:'6.1 km',time:'3.5h',level:'中等',likes:'2.1k',author:'慢慢旅行',avatar:'https://i.pravatar.cc/100?img=35',
    stops:['鸭川河岸','祇园街巷','南禅寺','哲学之道','小巷茶屋'],
    tips:['舒适的鞋比精致的穿搭更重要。','清晨和傍晚的步行体验通常更从容。','春秋热门时段建议提前预留交通时间。']
  },
  {
    id:'shanghai-wukang-anfu',
    city:'上海',type:'建筑路线',title:'武康路 → 安福路 → 新乐路｜梧桐区慢走',
    desc:'老洋房、街角咖啡、独立买手店和树荫下的人行道，一条很适合第一次 CityWalk 的经典城市路线。',
    image:'https://images.unsplash.com/photo-1538428494232-9c0d8a3ab403?auto=format&fit=crop&w=1200&q=85',
    distance:'3.9 km',time:'2h',level:'轻松',likes:'1.9k',author:'城市散步中',avatar:'https://i.pravatar.cc/100?img=25',
    stops:['武康大楼','武康路街角','安福路咖啡','新乐路','梧桐树下'],
    tips:['建议避开正午，树荫和建筑光影更舒服。','沿途适合边走边逛，不建议排过密的行程。','周末热门店可能需要排队。']
  },
  {
    id:'hongkong-central-pmq',
    city:'香港',type:'城市夜游',title:'中环 → PMQ → 荷李活道｜山城夜色',
    desc:'从现代城市天际线走进旧街区与坡道，短距离也能感受到香港城市层次的变化。',
    image:'https://images.unsplash.com/photo-1536599018102-9f803c8cce3c?auto=format&fit=crop&w=1200&q=85',
    distance:'3.4 km',time:'2h',level:'轻松',likes:'2.5k',author:'夜行地图',avatar:'https://i.pravatar.cc/100?img=8',
    stops:['中环街景','PMQ','荷李活道','石板街','太平山附近'],
    tips:['坡道较多，建议穿舒适鞋。','夜间灯光与城市天际线适合摄影。','部分街区会有上下坡，体力安排要留余量。']
  },
  {
    id:'taipei-daan-yongkang',
    city:'台北',type:'咖啡路线',title:'大安 → 永康街 → 师大｜咖啡与小店半日 Walk',
    desc:'把咖啡、选物、书店和小吃串起来，适合一个人独处，也适合找搭子一起闲逛。',
    image:'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=85',
    distance:'4.2 km',time:'2.5h',level:'轻松',likes:'1.6k',author:'周末走走',avatar:'https://i.pravatar.cc/100?img=44',
    stops:['大安森林公园','永康街','独立书店','咖啡馆','师大夜市'],
    tips:['下午开始最舒服，可以把夜市作为终点。','建议每 60–90 分钟留一个休息点。','如果一个人走，路线也很友好。']
  }
];

const routeSpots = {
  'taipei-zhongshan-dadaocheng': {
    title:'中山 → 赤峰街 → 大稻埕',
    meta:'台北 · 4.8 km · 约 2.5h · 轻松',
    spots:[
      {name:'中山站街区',type:'街区入口',meta:'起点 · 建议 20 min',image:'https://images.unsplash.com/photo-1470004914212-05527e49370b?auto=format&fit=crop&w=600&q=80',desc:'从捷运出口开始，先沿街区慢慢热身，适合观察城市店铺与街道尺度。'},
      {name:'赤峰街选物店街区',type:'小店',meta:'路线中段 · 推荐 40 min',image:'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80',desc:'老宅与新品牌共存，适合边走边看，也是路线里停留密度最高的一段。'},
      {name:'中山站街角咖啡',type:'咖啡',meta:'中途休息 · 30–45 min',image:'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80',desc:'适合把咖啡安排在中段，用来休息、整理照片，再继续往大稻埕方向走。'},
      {name:'大稻埕河岸',type:'日落',meta:'终点 · 黄昏推荐',image:'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=80',desc:'建议把最后一站留给河岸，让这条 Walk 从街區慢慢过渡到夕阳与夜景。'}
    ]
  },
  'tokyo-shibuya-nakameguro': {
    title:'涩谷 → 代官山 → 中目黑',
    meta:'东京 · 5.3 km · 约 3h · 轻松',
    spots:[
      {name:'涩谷十字路口',type:'城市地标',meta:'起点 · 15–20 min',image:'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80',desc:'从高密度城市中心出发，适合先拍一组街头人流与霓虹。'},
      {name:'代官山小店',type:'买手店',meta:'中段 · 推荐 45 min',image:'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=600&q=80',desc:'街区尺度更松弛，适合把购物、选物和随手拍放在这一段。'},
      {name:'目黑川夜景',type:'夜游',meta:'傍晚后 · 30 min',image:'https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=600&q=80',desc:'夜色渐深后沿河散步，城市灯光会成为这条路线最自然的背景。'},
      {name:'深夜拉面',type:'美食',meta:'收尾 · 45–60 min',image:'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',desc:'把一碗拉面留给路线最后，适合把步行后的休息时间变成完整的夜游体验。'}
    ]
  },
  'kyoto-philosopher-walk': {
    title:'鸭川 → 祇园 → 哲学之道',
    meta:'京都 · 6.1 km · 约 3.5h · 中等',
    spots:[
      {name:'鸭川河岸',type:'河岸',meta:'起点 · 25 min',image:'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',desc:'先从河岸开始，让步行节奏慢下来，给后续街巷与寺院留出空间。'},
      {name:'祇园街巷',type:'街景',meta:'中段 · 40 min',image:'https://images.unsplash.com/photo-1493780474015-ba834fd0ce2f?auto=format&fit=crop&w=600&q=80',desc:'适合把热门街景与安静巷道一起走，不必把每一个景点都变成打卡任务。'},
      {name:'南禅寺周边',type:'建筑',meta:'停留 · 35 min',image:'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80',desc:'建筑与树影非常适合放慢脚步，也是从城市街区转入自然环境的过渡点。'},
      {name:'哲学之道',type:'散步',meta:'终点段 · 60 min',image:'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80',desc:'最后一段尽量不要赶时间，用连续的散步感结束整条路线。'}
    ]
  },
  'shanghai-wukang-anfu': {
    title:'武康路 → 安福路 → 新乐路',
    meta:'上海 · 3.9 km · 约 2h · 轻松',
    spots:[
      {name:'武康大楼',type:'建筑',meta:'起点 · 20 min',image:'https://images.unsplash.com/photo-1538428494232-9c0d8a3ab403?auto=format&fit=crop&w=600&q=80',desc:'经典城市建筑节点，适合先从外立面、街角关系和人行道观察开始。'},
      {name:'武康路街角',type:'街区',meta:'25 min',image:'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c5?auto=format&fit=crop&w=600&q=80',desc:'梧桐树与老建筑组成路线的主要氛围，适合边走边拍。'},
      {name:'安福路咖啡',type:'咖啡',meta:'中段 · 35 min',image:'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80',desc:'留出一段坐下来休息的时间，避免整条路线变成连续快走。'},
      {name:'新乐路小店',type:'选物',meta:'终点 · 35 min',image:'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80',desc:'适合把独立店铺与街区观察作为最后一段的收尾。'}
    ]
  },
  'hongkong-central-pmq': {
    title:'中环 → PMQ → 荷李活道',
    meta:'香港 · 3.4 km · 约 2h · 轻松',
    spots:[
      {name:'中环街景',type:'城市',meta:'起点 · 20 min',image:'https://images.unsplash.com/photo-1536599018102-9f803c8cce3c?auto=format&fit=crop&w=600&q=80',desc:'从高密度商务区开始，观察楼宇、坡道和行人流线。'},
      {name:'PMQ 元创方',type:'设计',meta:'停留 · 40 min',image:'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=600&q=80',desc:'适合发现独立设计、展览和小店，也可以作为中途休息点。'},
      {name:'荷李活道',type:'街区',meta:'20–30 min',image:'https://images.unsplash.com/photo-1538485399081-7c897a8a2b2c?auto=format&fit=crop&w=600&q=80',desc:'坡道和旧建筑构成很强的城市层次，适合边走边拍。'},
      {name:'石板街夜色',type:'夜景',meta:'收尾 · 30 min',image:'https://images.unsplash.com/photo-1536599018102-9f803c8cce3c?auto=format&fit=crop&w=600&q=80',desc:'灯光亮起后再结束路线，可以把城市夜色作为最后一个画面。'}
    ]
  },
  'taipei-daan-yongkang': {
    title:'大安 → 永康街 → 师大',
    meta:'台北 · 4.2 km · 约 2.5h · 轻松',
    spots:[
      {name:'大安森林公园',type:'自然',meta:'起点 · 30 min',image:'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=80',desc:'从绿色空间开始，把城市 Walk 的节奏先放慢。'},
      {name:'永康街小店',type:'美食',meta:'中段 · 45 min',image:'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=600&q=80',desc:'适合把小吃与选物店组合起来，形成边走边吃的轻路线。'},
      {name:'独立书店',type:'书店',meta:'停留 · 30 min',image:'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=600&q=80',desc:'给路线加入一段安静的室内停留，适合一个人 Walk。'},
      {name:'师大夜市',type:'夜游',meta:'终点 · 45 min',image:'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80',desc:'最后用夜市收尾，把下午的散步自然过渡到晚间城市生活。'}
    ]
  }
};


const posts = [
  {type:'路线',city:'台北',title:'周六下午终于把赤峰街走完了｜路线比想象中更舒服',desc:'从中山一路逛过去，不用赶景点，沿途每隔一小段就会有一家想停下来的小店。',image:'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=85',author:'阿柚去散步',avatar:'https://i.pravatar.cc/100?img=49',likes:'1.2k',tags:['#CityWalk','#台北']},
  {type:'打卡',city:'东京',title:'这家街角唱片店真的很容易一待就是一个小时',desc:'代官山附近散步时偶遇的小店，喜欢音乐和城市闲逛的人应该会懂这种快乐。',image:'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=85',author:'东京慢镜头',avatar:'https://i.pravatar.cc/100?img=31',likes:'2.1k',tags:['#代官山','#打卡点']},
  {type:'攻略',city:'香港',title:'香港 CityWalk 穿什么鞋？走完 2 万步之后的真实答案',desc:'坡道比景点数量更应该写进攻略里。分享一次暴走后的装备经验和路线安排。',image:'https://images.unsplash.com/photo-1538485399081-7c897a8a2b2c?auto=format&fit=crop&w=900&q=85',author:'今天走几步',avatar:'https://i.pravatar.cc/100?img=6',likes:'892',tags:['#香港Walk','#实用攻略']},
  {type:'夜游',city:'上海',title:'晚上九点的武康路，比白天更像电影',desc:'路灯、梧桐和街角小店，建议把夜游安排在路线最后一段。',image:'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c5?auto=format&fit=crop&w=900&q=85',author:'夜里走走',avatar:'https://i.pravatar.cc/100?img=13',likes:'1.7k',tags:['#夜游','#上海']},
  {type:'拍照',city:'京都',title:'京都不用去最热门机位｜这条小路我愿意反复走',desc:'喜欢安静画面的话，可以把路线从大景点稍微错开。光影、街巷和门前小花都很适合拍。',image:'https://images.unsplash.com/photo-1493780474015-ba834fd0ce2f?auto=format&fit=crop&w=900&q=85',author:'柚子镜头',avatar:'https://i.pravatar.cc/100?img=47',likes:'3.0k',tags:['#京都摄影','#小众路线']},
  {type:'打卡',city:'台北',title:'一个人也会去的三家咖啡店｜都在同一条 Walk 上',desc:'把三家店串成一条半日路线，一个人的城市散步也可以很有仪式感。',image:'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=900&q=85',author:'一人也很好',avatar:'https://i.pravatar.cc/100?img=20',likes:'1.4k',tags:['#咖啡路线','#一个人旅行']},
  {type:'路线',city:'上海',title:'梧桐区散步地图｜3 小时刚刚好',desc:'武康路、安福路、新乐路连在一起之后，才发现 CityWalk 最舒服的状态就是不赶。',image:'https://images.unsplash.com/photo-1538428494232-9c0d8a3ab403?auto=format&fit=crop&w=900&q=85',author:'梧桐下',avatar:'https://i.pravatar.cc/100?img=30',likes:'2.0k',tags:['#上海散步','#路线分享']},
  {type:'攻略',city:'东京',title:'东京散步别只看地图：把“停留时间”算进去',desc:'一条 5 km 路线，如果沿途不断停店，实际需要的时间会完全不一样。',image:'https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=900&q=85',author:'Walk Notes',avatar:'https://i.pravatar.cc/100?img=58',likes:'1.1k',tags:['#东京攻略','#WalkTips']}
];

const buddies = [
  {filter:'周末',tags:['摄影','轻松'],user:'小林',avatar:'https://i.pravatar.cc/100?img=5',city:'台北',title:'周六下午｜中山 → 大稻埕慢走',desc:'想约 2–3 个人一起，边走边拍，沿途找咖啡和小店。',date:'10/10 周六 14:00',people:'2 / 4 人'},
  {filter:'今天',tags:['美食'],user:'阿澈',avatar:'https://i.pravatar.cc/100?img=11',city:'东京',title:'今晚 19:30｜中目黑散步 + 拉面',desc:'不赶景点，主要想逛街、拍夜景、最后一起吃一碗拉面。',date:'今天 19:30',people:'3 / 4 人'},
  {filter:'周末',tags:['轻徒步','摄影'],user:'Mia',avatar:'https://i.pravatar.cc/100?img=44',city:'香港',title:'周日｜中环旧街区 Walk',desc:'希望找同样喜欢城市摄影的人，一起完成一条 3 小时路线。',date:'10/11 周日 15:00',people:'1 / 4 人'},
  {filter:'摄影',tags:['摄影'],user:'Ken',avatar:'https://i.pravatar.cc/100?img=32',city:'上海',title:'夜间街拍搭子｜武康路附近',desc:'偏街头摄影，不赶路，看到有趣画面可以随时停下来。',date:'10/10 周六 18:30',people:'2 / 3 人'},
  {filter:'美食',tags:['美食','CityWalk'],user:'小满',avatar:'https://i.pravatar.cc/100?img=24',city:'台北',title:'永康街半日吃吃走走',desc:'路线不长，主要目标是把几家想吃的小店串起来。',date:'10/11 周日 13:30',people:'1 / 4 人'},
  {filter:'轻徒步',tags:['轻徒步'],user:'Leo',avatar:'https://i.pravatar.cc/100?img=15',city:'京都',title:'哲学之道晨间 Walk',desc:'早起慢走，看街区和树影，路线强度低，适合第一次尝试。',date:'10/12 周一 08:30',people:'2 / 4 人'}
];
