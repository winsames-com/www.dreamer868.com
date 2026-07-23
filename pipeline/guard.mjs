// pipeline/guard.mjs
import { THRESHOLDS } from './config.mjs';

// 確定性化名掃描：偵測殘留的可辨識資訊。
// 注意：判決全文常將姓名遮成「甲○○」等，改編稿不應出現身分證、統編、完整電話、地址號樓。
const PATTERNS = [
  { kind: 'national_id', re: /[A-Z][12]\d{8}/g },                 // 身分證字號
  { kind: 'tax_id', re: /統一?編號\s*[:：]?\s*\d{8}/g },          // 統一編號（需標籤，避免誤抓金額/日期）
  { kind: 'phone', re: /09\d{2}[-\s]?\d{3}[-\s]?\d{3}/g },        // 手機
  { kind: 'redacted_name', re: /[甲乙丙丁戊][○Ｏ]{1,3}/g },        // 判決遮蔽殘留（甲○○）
  { kind: 'address', re: /\d+號\d+樓(?:之\d+)?/g },               // 門牌+樓（真實地址）
  { kind: 'address', re: /[路街段巷弄][^，。、\s]{0,8}?\d+號/g },   // 街路+號（避免「第3號」序數誤判）
];

// ── 姓＋雙名 啟發式（LLM 提示詞之外的確定性後盾）──────────────────────
// 改編稿只准「姓＋通用稱謂」（陳先生）或「身分角色」（駕駛人/長子），不得出現「姓＋名」全名。
// 難點在假陽性：正當化名「陳先生」、地名「高雄」、詞彙「高鐵/董事長」都是「姓+2字」。
// 因此採「精準優先」策略：只有在**當事人/關係線索之後**或**兩名並列**時，才把「姓+雙名」判為疑似全名，
// 命中即讓 gate 失敗（進 quarantine 待人工）。對 221 篇既有乾淨語料實測 0 假陽性。
// 注意：這是後盾，故意不追求全 recall（無情境的裸名交給提示詞主防線）。
const SURNAMES = '陳林黃張李王吳劉蔡楊許鄭謝郭洪邱曾廖賴徐周葉蘇莊呂江蕭羅高潘朱鍾游詹胡施沈余盧梁杜阮顏柯翁魏孫戴范宋鄧曹薛丁卓侯姚秦孔陶姜戚鄒彭郎龔';
// 姓氏後接這 2 字稱謂/關係/機構 → 合法化名或非人名，非全名
const TITLE_SUFFIX = new Set([
  '先生', '小姐', '太太', '女士', '媽媽', '爸爸', '小弟', '小妹', '大哥', '大姐', '大嫂',
  '老闆', '老師', '律師', '醫師', '會計', '經理', '董事', '總監', '主任', '課長', '廠長',
  '奶奶', '爺爺', '伯伯', '叔叔', '阿姨', '姑姑', '舅舅', '嬸嬸', '伯母', '姨丈', '姑丈',
  '家人', '家族', '同學', '同事', '母親', '父親', '父母', '兄弟', '姊妹', '姐妹', '夫妻', '夫婦',
  '公司', '集團', '企業', '商行', '工廠', '銀行', '建設', '投資', '法官', '檢察', '書記',
]);
// 給名首字若為這些 → 屬稱謂/角色前綴或匿名詞（老先生/阿姨/姓男/家兄/某人…）
const TITLE_PREFIX1 = new Set(['老', '阿', '姓', '家', '某']);
// 特定姓氏後接這些「給名首字」時屬常用詞/動詞，非人名（高等法院/陳述/張貼…）
const GIVEN_DENY = {
  高: new Set('等級雄鐵額齡速峰收風達利度壓樓山興'.split('')),
  陳: new Set('述報明稱列情年舊設'.split('')),
  張: new Set('貼力望羅揚本'.split('')),
  李: new Set('子'.split('')),
};
// 3 字後緊接這些字 → 地名/地址/機構（高雄市/…路），非人名
const PLACE_AFTER = new Set('市區縣鄉鎮里路街村鄰段巷弄號樓島港站'.split(''));
// 已知非人名的 3 字（作者等正當保留）
const WORD_DENY = new Set(['吳芳圳']);

const NAME = `[${SURNAMES}][\\u4e00-\\u9fff]{2}`;
// 當事人/關係線索（緊接在名字前，代表其後極可能是人名）
const CUE =
  '(?:被告|原告|聲請人|相對人|上訴人|被上訴人|抗告人|再抗告人|債務人|債權人|繼承人|被繼承人|遺贈人|受益人|委任人|委託人|受託人|保證人|連帶保證人|承租人|出租人|買受人|出賣人|其子|其女|長子|次子|三子|么子|長女|次女|兒子|女兒|妻子|丈夫|配偶|死者|已故|亡故|父親|母親|哥哥|弟弟|姊姊|妹妹|名叫|叫做)';

function looksLikeName(full) {
  const surname = full[0];
  const given = full.slice(1);
  if (TITLE_SUFFIX.has(given)) return false;
  if (TITLE_PREFIX1.has(given[0])) return false;
  if (GIVEN_DENY[surname] && GIVEN_DENY[surname].has(given[0])) return false;
  if (WORD_DENY.has(full)) return false;
  return true;
}

// 回傳疑似「姓＋雙名」全名清單（去重）。純函式、不依賴外部狀態。
export function scanSuspectFullNames(text) {
  const str = (text || '').toString();
  const hits = new Set();
  const reCue = new RegExp(CUE + `(${NAME})`, 'g');
  const rePair = new RegExp(`(${NAME})(?:與|、|及|和|跟)(${NAME})`, 'g');
  let m;
  while ((m = reCue.exec(str)) !== null) {
    const after = str[m.index + m[0].length] || '';
    if (PLACE_AFTER.has(after)) continue;
    if (looksLikeName(m[1])) hits.add(m[1]);
  }
  while ((m = rePair.exec(str)) !== null) {
    // 兩名並列：兩者都須像名字才算（避免「金融與投資」類誤報）
    if (looksLikeName(m[1]) && looksLikeName(m[2])) {
      hits.add(m[1]);
      hits.add(m[2]);
    }
    rePair.lastIndex = m.index + 1; // 允許重疊，避免相鄰名字漏抓
  }
  return [...hits];
}

export function scanAnonymization(markdown) {
  const text = (markdown || '').toString();
  const hits = [];
  for (const { kind, re } of PATTERNS) {
    const matches = text.match(re);
    if (matches) {
      for (const m of matches) hits.push({ kind, value: m });
    }
  }
  for (const name of scanSuspectFullNames(text)) {
    hits.push({ kind: 'suspect_fullname', value: name });
  }
  return { ok: hits.length === 0, hits };
}

export function passesGates(assessment, scanResult) {
  if (!assessment) return false;
  if (!scanResult || !scanResult.ok) return false;
  if (assessment.anonymization_ok !== true) return false;
  if (Number(assessment.relevance_score) < THRESHOLDS.relevanceMin) return false;
  if (Number(assessment.quality_score) < THRESHOLDS.qualityMin) return false;
  return true;
}
