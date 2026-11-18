// 障害者控除いくら？の問題を作る（ブラウザと node の両方で使う）。
// 中身は、国税庁タックスアンサー No.1160「障害者控除」に書いてあることだけ（［令和8年4月1日現在法令等］。2026-11-17 に読んだ。要点は共有フォルダ games/shogai-ikura-research.md）。
// 1問は、本人・同一生計配偶者・扶養親族の障害のようすを読んで、障害者控除の額を選ぶ。正解したら2段目「どの決まり？」を選ぶ。
// 答えはコードで計算する：障害者 27万円・特別障害者 40万円・同居特別障害者 75万円。何人かいれば、1人ずつの額を足す。
//   対象は本人・同一生計配偶者・扶養親族（16歳未満の扶養親族も入る）。同居特別障害者は、特別障害者である同一生計配偶者か扶養親族で、いつも同居している人（本人は入らない）。
//   施設に入所している人は同居に当たらない。所得が多く同一生計配偶者・扶養親族でない人、ほかの人の扶養親族は入らない。
// 税額・住民税・障害者の区分の細かいところ（戦傷病者など）・申告の手続きは扱わない（画面に書く）。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。
// KINDS の並びは最後に足すだけにする（並べ替え・削除をすると過去の日の問題が変わる）。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];
  const AS_OF = "令和8年4月1日現在法令等";

  // 出典（画面の「なぜ」に出す）
  const SRC = {
    a: ["国税庁 タックスアンサー No.1160 障害者控除", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm"],
  };
  const MEDIA = { a: "本人・家族の障害のようす（所得税）" };
  const MAN = 10000;
  // 1人ずつの控除額（No.1160）
  const AMT = { ippan: 270000, toku: 400000, dokyo: 750000, none: 0 };
  const CAT_NAME = { ippan: "障害者", toku: "特別障害者", dokyo: "同居特別障害者", none: "対象外" };

  // 2段目「どの決まり？」
  const GROUPS = {
    ippan: { name: "障害者", sub: "1人27万円", set: "all" },
    toku: { name: "特別障害者", sub: "1人40万円", set: "all" },
    dokyo: { name: "同居特別障害者", sub: "1人75万円", set: "all" },
    awase: { name: "2人以上を足す", sub: "1人ずつの額の合計", set: "all" },
    none: { name: "対象にならない", sub: "扶養親族などでない", set: "all" },
  };
  const GRP_WHY = {
    ippan: "障害者は1人27万円です。身体障害者手帳3〜6級、精神障害者保健福祉手帳2・3級、知的障害者と判定された人（重度でない）、市町村長から障害者に準ずると認められた65歳以上の人などです。",
    toku: "特別障害者は1人40万円です。身体障害者手帳1・2級、精神障害者保健福祉手帳1級、重度の知的障害者と判定された人、寝たきりで複雑な介護が要る人などです。本人や、施設に入所している家族は同居特別障害者になりません。",
    dokyo: "特別障害者である同一生計配偶者や扶養親族が、いつも同居していると1人75万円です。施設に入所している人は同居に当たりません。",
    awase: "障害者控除は1人ずつです。本人・同一生計配偶者・扶養親族に何人かいれば、それぞれの額を足します。",
    none: "対象は本人・同一生計配偶者・扶養親族です。所得が多く扶養親族でない人や、ほかの人の扶養親族は入りません。",
  };
  const KEY = {
    ippan: "障害者は1人27万円",
    toku: "特別障害者は1人40万円（本人・施設に入所している人）",
    dokyo: "同居の特別障害者（同一生計配偶者・扶養親族）は75万円",
    awase: "何人かいれば1人ずつ足す",
    none: "扶養親族などでない人は0円",
  };

  // 人のかけら：[役, 文（＄A 年齢・＄G 等級）, {A, G}: [下限, 上限], 区分]
  const F = {
    s_t3: ["本人", "本人は身体障害者手帳＄G級。", { G: [3, 6] }, "ippan"],
    s_t1: ["本人", "本人は身体障害者手帳＄G級。", { G: [1, 2] }, "toku"],
    s_s1: ["本人", "本人は精神障害者保健福祉手帳1級。", {}, "toku"],
    s_s2: ["本人", "本人は精神障害者保健福祉手帳＄G級。", { G: [2, 3] }, "ippan"],
    s_jun: ["本人", "＄A歳の本人は、市町村長から障害者に準ずると認められた。", { A: [65, 84] }, "ippan"],
    s_junT: ["本人", "＄A歳の本人は、市町村長から特別障害者に準ずると認められた。", { A: [65, 84] }, "toku"],
    s_dok: ["本人", "家族と同居する本人は身体障害者手帳＄G級。", { G: [1, 2] }, "toku"],
    c_t3: ["子", "同居の＄A歳の子（扶養親族）は身体障害者手帳＄G級。", { A: [16, 30], G: [3, 6] }, "ippan"],
    c_t1d: ["子", "同居の＄A歳の子（扶養親族）は身体障害者手帳＄G級。", { A: [16, 30], G: [1, 2] }, "dokyo"],
    c_t1r: ["子", "施設に入所している＄A歳の子（扶養親族）は身体障害者手帳＄G級。", { A: [18, 40], G: [1, 2] }, "toku"],
    c_young: ["子", "同居の＄A歳の子（16歳未満の扶養親族）は精神障害者保健福祉手帳＄G級。", { A: [6, 15], G: [2, 3] }, "ippan"],
    c_youngT: ["子", "同居の＄A歳の子（16歳未満の扶養親族）は重度の知的障害者と判定された。", { A: [3, 15] }, "dokyo"],
    c_chi: ["子", "同居の＄A歳の子（扶養親族）は知的障害者と判定された（重度ではない）。", { A: [16, 30] }, "ippan"],
    p_bet: ["母", "同居の＄A歳の母（扶養親族）は6か月以上寝たきりで、複雑な介護が要る。", { A: [70, 95] }, "dokyo"],
    p_betS: ["父", "施設に入所している＄A歳の父（扶養親族）は6か月以上寝たきりで、複雑な介護が要る。", { A: [70, 95] }, "toku"],
    p_jun: ["父", "同居の＄A歳の父（扶養親族）は、市町村長から障害者に準ずると認められた。", { A: [65, 95] }, "ippan"],
    p_junT: ["母", "同居の＄A歳の母（扶養親族）は、市町村長から特別障害者に準ずると認められた。", { A: [65, 95] }, "dokyo"],
    p_bekkyo: ["母", "ひとり暮らしの＄A歳の母（扶養親族）は身体障害者手帳＄G級。", { A: [65, 95], G: [1, 2] }, "toku"],
    w_t3: ["配偶者", "配偶者（同一生計配偶者）は身体障害者手帳＄G級。", { G: [3, 6] }, "ippan"],
    w_t1d: ["配偶者", "同居の配偶者（同一生計配偶者）は身体障害者手帳＄G級。", { G: [1, 2] }, "dokyo"],
    w_rich: ["配偶者", "配偶者は身体障害者手帳＄G級で、所得が多く同一生計配偶者でない。", { G: [1, 6] }, "none"],
    b_s1: ["きょうだい", "同居の＄A歳のきょうだい（扶養親族）は精神障害者保健福祉手帳1級。", { A: [20, 60] }, "dokyo"],
    n_other: ["祖父", "＄A歳の祖父は身体障害者手帳＄G級で、ほかの人の扶養親族。", { A: [75, 95], G: [1, 6] }, "none"],
    n_rich: ["子", "同居の＄A歳の子は身体障害者手帳＄G級で、所得が多く扶養親族でない。", { A: [20, 40], G: [1, 6] }, "none"],
  };

  // 種類：[id, 難しさ, かけら, ヒント1]（2段目はかけらから決まる）
  const D = [
    ["s_t3", 0, ["s_t3"], "手帳3〜6級は？"],
    ["s_t1", 0, ["s_t1"], "手帳1・2級は？"],
    ["c_t3", 0, ["c_t3"], "扶養親族の障害者は？"],
    ["c_t1d", 0, ["c_t1d"], "特別障害者で同居なら？"],
    ["p_bet", 0, ["p_bet"], "寝たきりで同居なら？"],
    ["w_t3", 0, ["w_t3"], "同一生計配偶者の障害者は？"],
    ["n_rich", 0, ["n_rich"], "扶養親族でないと？"],
    ["s_s1", 0, ["s_s1"], "精神の手帳1級は？"],
    ["p_jun", 0, ["p_jun"], "障害者に準ずると認められたら？"],
    ["c_t1r", 0, ["c_t1r"], "施設に入所していると同居？"],
    ["s_s2", 1, ["s_s2"], "精神の手帳2・3級は？"],
    ["s_jun", 1, ["s_jun"], "障害者に準ずるなら？"],
    ["c_young", 1, ["c_young"], "16歳未満の扶養親族も入る？"],
    ["c_chi", 1, ["c_chi"], "重度でない知的障害は？"],
    ["p_betS", 1, ["p_betS"], "施設に入所していると？"],
    ["w_t1d", 1, ["w_t1d"], "同一生計配偶者の特別障害者で同居なら？"],
    ["n_other", 1, ["n_other"], "ほかの人の扶養親族だと？"],
    ["s_dok", 1, ["s_dok"], "本人も同居特別障害者？"],
    ["p_bekkyo", 1, ["p_bekkyo"], "ひとり暮らしだと？"],
    ["a_sc", 1, ["s_t3", "c_t3"], "1人ずつ足す。"],
    ["a_wp", 1, ["w_t3", "p_jun"], "1人ずつ足す。"],
    ["w_rich", 1, ["w_rich"], "同一生計配偶者でないと？"],
    ["s_junT", 2, ["s_junT"], "特別障害者に準ずるなら？"],
    ["c_youngT", 2, ["c_youngT"], "16歳未満でも同居の特別障害者？"],
    ["p_junT", 2, ["p_junT"], "特別障害者に準ずる人が同居なら？"],
    ["b_s1", 2, ["b_s1"], "きょうだいも扶養親族なら？"],
    ["a_sw", 2, ["s_t1", "w_t1d"], "本人は40万円、同居の配偶者は？"],
    ["a_cp", 2, ["c_t1d", "p_jun"], "1人ずつ区分を見る。"],
    ["a_cc", 2, ["c_t1r", "c_t3"], "施設の子と同居の子を分けて。"],
    ["a_sy", 2, ["s_dok", "c_young"], "本人は同居でも40万円。"],
    ["x_nc", 2, ["n_rich", "c_t3"], "扶養親族でない子は入らない。"],
    ["x_wp", 2, ["w_rich", "p_bet"], "入るのはどちら？"],
    ["a_three", 2, ["s_s2", "p_bekkyo", "c_t3"], "3人を1人ずつ。"],
    ["x_os", 2, ["n_other", "s_jun"], "ほかの人の扶養親族は入らない。"],
    ["a_pw", 2, ["p_junT", "w_t3"], "1人ずつ区分を見る。"],
  ];
  const yen = (n) => n.toLocaleString("ja-JP") + "円";
  const man = (n) => (n !== 0 && n % MAN === 0 ? `${(n / MAN).toLocaleString("ja-JP")}万円` : yen(n));
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pickAmt = (R, lo, hi, step) => lo + ri(R, 0, Math.floor((hi - lo) / step)) * step;
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }

  const label = (t) => (t === 0 ? "0円（受けられない）" : yen(t));
  // かけらから2段目を決める：数える人が2人以上なら「足す」、1人ならその区分、いなければ「対象にならない」
  function grpOf(frags) {
    const c = frags.map((f) => F[f][3]).filter((x) => x !== "none");
    return c.length >= 2 ? "awase" : c.length === 1 ? c[0] : "none";
  }
  const deductOf = (cats) => cats.reduce((t, c) => t + AMT[c], 0);
  function maker(frags) {
    return (R) => {
      const people = frags.map((f) => {
        const [role, text, spec, cat] = F[f];
        const A = spec.A ? ri(R, spec.A[0], spec.A[1]) : 0, G = spec.G ? ri(R, spec.G[0], spec.G[1]) : 0;
        return { role, cat, A, G, text: text.replace("＄A", String(A)).replace("＄G", String(G)) };
      });
      const cats = people.map((p) => p.cat), ans = deductOf(cats);
      const sentence = people.map((p) => p.text).join("");
      // 選び肢：1人の区分を取り違える（同居を見落とす・本人を75万円にする・対象外を入れる など）・1人分だけ・0円 から3つ
      const cand = new Set([0]);
      people.forEach((p, i) => {
        for (const alt of ["ippan", "toku", "dokyo", "none"]) if (alt !== p.cat) cand.add(deductOf(cats.map((c, j) => (j === i ? alt : c))));
        cand.add(AMT[p.cat]);
      });
      const ok = (x) => Number.isInteger(x) && x >= 0 && x !== ans;
      const wrong0 = [...cand].filter(ok);
      for (const x of [ans + 270000, ans + 400000, 270000, 400000, 750000]) { if (wrong0.length >= 3) break; if (ok(x) && !wrong0.includes(x)) wrong0.push(x); }
      const wrong = pickN(R, [...new Set(wrong0)].sort((x, y) => x - y), 3);
      const opts = shuffle(R, [ans, ...wrong]).map(label);
      const parts = people.map((p) => `${p.role}${p.cat === "none" ? "は対象外" : "：" + CAT_NAME[p.cat] + man(AMT[p.cat])}`);
      const full = `${sentence} → ${parts.join("・")}：${label(ans)}`;
      return { type: "act", q: `${sentence}　控除はいくら？`, opts, ans: label(ans), rev: false, full, people, deduct: ans, v: people.map((p) => `${p.A}-${p.G}`).join("/") };
    };
  }
  // 年齢・等級の組が6通りより少ない種類は lo=hi にする（QA の「6通り以上」から外す）
  const cnt = (frags) => frags.reduce((n, f) => n * Object.values(F[f][2]).reduce((m, sp) => m * (sp[1] - sp[0] + 1), 1), 1);
  const KINDS = D.map(([id, lv, frags, look]) => { const grp = grpOf(frags); return { id, lv, grp, col: "a", frags, lo: 0, hi: cnt(frags) < 6 ? 0 : 1, look, src: ["a"], name: GROUPS[grp].name + "：" + F[frags[0]][1].replace(/＄A/g, "○").replace(/＄G/g, "○").slice(0, 22) + "…", key: KEY[grp], why: GRP_WHY[grp], make: maker(frags) }; });
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv) => KINDS.filter((k) => k.lv === lv).map((k) => k.id);
  const GRP_OF = Object.fromEntries(KINDS.map((k) => [k.id, k.grp]));
  const groupsOf = (g) => Object.keys(GROUPS).filter((x) => GROUPS[x].set === GROUPS[g].set);

  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function make(tag) {
    const [kind] = String(tag).split("|"), k = BY[kind];
    if (!k) return null;
    const p = k.make(rng(seedOf(tag)), k.lv);
    return { tag, kind, lv: k.lv, name: k.name, look: k.look, key: k.key, why: k.why, grp: k.grp, gwhy: GRP_WHY[k.grp], media: MEDIA[k.col], src: k.src.map((s) => SRC[s]), ...p };
  }
  const keyOf = (P) => `${P.kind}:${P.q}:${P.opts.slice().sort().join("/")}`;

  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), e = pickN(R, kindsOf(0), 2), n = pickN(R, kindsOf(1), 2), h = pickN(R, kindsOf(2), 1);
    return [...e, ...n, ...h].map((id, i) => `${id}|${date}:d${i}`);
  }
  function hardTags(date) {
    const dh = dailyTags(date)[4].split("|")[0], R = rng(seedOf("hard:" + date)), h = pickN(R, kindsOf(2).filter((x) => x !== dh), 3);
    return h.map((id, i) => `${id}|${date}:h${i}`);
  }

  const SGI = { KINDS, BY, GROUPS, GRP_OF, GRP_WHY, LV, SRC, MEDIA, AS_OF, AMT, F, deductOf, kindsOf, groupsOf, seedOf, rng, make, keyOf, dailyTags, hardTags, pickN };
  if (typeof module !== "undefined" && module.exports) module.exports = SGI; else root.SGI = SGI;
})(typeof self !== "undefined" ? self : this);
