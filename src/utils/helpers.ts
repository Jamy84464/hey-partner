import type { Feedback, CategoryKey, StatusKey, RespondKey } from "../types";

/** 查詢碼標準形式（與 gas/Code.gs canonCode 一致）：全形轉半形、去掉空白與 - _、英文不分大小寫 */
export function canonCode(raw: string): string {
  return (raw || "").normalize("NFKC").replace(/[\s\-_]/g, "").toUpperCase();
}

const WEAK_CODES = ["PASSWORD", "PASSWORD1", "12345678", "123456789", "1234567890", "87654321", "11111111",
  "00000000", "QWERTYUI", "QWERTYUIOP", "ASDFGHJK", "ABCDEFGH", "ILOVEYOU", "HEYPARTNER", "HEY夥伴請聽我說"];

function isSequential(c: string): boolean {
  if (c.length < 4) return false;
  let up = true, down = true;
  for (let i = 1; i < c.length; i++) {
    const d = c.charCodeAt(i) - c.charCodeAt(i - 1);
    if (d !== 1) up = false;
    if (d !== -1) down = false;
  }
  return up || down;
}

/**
 * 檢查個人查詢碼（與 gas/Code.gs checkMyCode 一致），回傳錯誤代碼；沒問題回傳 ""。
 * 同一組碼會看到所有用它送出的回饋，跟別人取到一樣就會互相看到，所以不能太好猜。
 */
export function checkMyCode(raw: string, teamCode = ""): string {
  const c = canonCode(raw);
  if (c.length < 8) return "code_too_short";
  if (c.length > 40) return "code_too_long";
  if (/^(.)\1+$/.test(c) || isSequential(c) || WEAK_CODES.includes(c)) return "code_weak";
  if (/^\d+$/.test(c) && c.length < 10) return "code_digits";
  if (teamCode && canonCode(teamCode) === c) return "code_is_team";
  return "";
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

/** 每次送出一個識別碼：伺服器用它辨識重送，前端收不到回應時用它取回查詢碼 */
export function makeSid(): string {
  const buf = new Uint8Array(12);
  const cr: Crypto | undefined = (globalThis as any).crypto;
  if (cr?.getRandomValues) cr.getRandomValues(buf);
  else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  return Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
}

/** "2026/11/12 下午3:04:05" → "2026-11"，用來做月份統計 */
export function monthOf(createdAt: string): string {
  const m = /^(\d{4})\/(\d{1,2})\//.exec(createdAt || "");
  return m ? `${m[1]}-${m[2].padStart(2, "0")}` : "";
}

/** "2026/11/12 下午3:04:05" → "11/12" */
export function shortDate(createdAt: string | null): string {
  const m = /^\d{4}\/(\d{1,2})\/(\d{1,2})/.exec(createdAt || "");
  return m ? `${m[1]}/${m[2]}` : "";
}

export interface CountItem { key: string; count: number }

function countBy<T>(list: T[], keys: (x: T) => string[]): CountItem[] {
  const map = new Map<string, number>();
  list.forEach(x => keys(x).forEach(k => { if (k) map.set(k, (map.get(k) || 0) + 1); }));
  return Array.from(map, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export interface TagInsight extends CountItem {
  /** 出現在幾個不同月份：跨月重複出現代表不是單一事件 */
  months: number;
  categories: CategoryKey[];
}

export interface Insights {
  total: number;
  open: number;
  byCategory: Record<CategoryKey, number>;
  byStatus: Record<StatusKey, number>;
  byRespond: Record<RespondKey, number>;
  tags: TagInsight[];
  subjects: TagInsight[];
  months: CountItem[];
  /** 希望面談、或被標記需要介入，且還沒結案 */
  needsCare: Feedback[];
  untagged: number;
}

function insightOf(list: Feedback[], pick: (f: Feedback) => string[]): TagInsight[] {
  return countBy(list, pick).map(c => {
    const hits = list.filter(f => pick(f).includes(c.key));
    return {
      ...c,
      months: new Set(hits.map(f => monthOf(f.createdAt))).size,
      categories: Array.from(new Set(hits.map(f => f.category))),
    };
  });
}

export function buildInsights(list: Feedback[]): Insights {
  const zero = <K extends string>(keys: K[]) => Object.fromEntries(keys.map(k => [k, 0])) as Record<K, number>;
  const byCategory = zero<CategoryKey>(["env", "flow", "team", "up", "vent"]);
  const byStatus = zero<StatusKey>(["received", "seeded", "thinking", "action"]);
  const byRespond = zero<RespondKey>(["ack", "attention", "reply", "meet"]);
  // 用 hasOwnProperty 而不是 in：資料裡若有 "constructor" 之類的值，in 會誤判成存在
  const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
  list.forEach(f => {
    if (own(byCategory, f.category)) byCategory[f.category]++;
    if (own(byStatus, f.status)) byStatus[f.status]++;
    if (own(byRespond, f.respond)) byRespond[f.respond]++;
  });
  const months = countBy(list, f => [monthOf(f.createdAt)]).sort((a, b) => a.key.localeCompare(b.key));
  return {
    total: list.length,
    open: list.filter(f => !f.archived).length,
    byCategory, byStatus, byRespond,
    tags: insightOf(list, f => f.tags || []),
    subjects: insightOf(list, f => f.subjects || []),
    months: months.slice(-6),
    needsCare: list.filter(f => !f.archived && (f.respond === "meet" || (f.tags || []).includes("需要介入"))),
    untagged: list.filter(f => !(f.tags || []).length).length,
  };
}
