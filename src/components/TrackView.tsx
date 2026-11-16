import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { C, T, S, R, E, catOf, respOf, STATUSES, statOf } from "../constants";
import { Btn, Card, TextInput, Pill } from "./ui";
import { lookupFeedback, loadSavedCodes, forgetCode, loadMyCode, forgetMyCode, type SavedCode } from "../utils/api";
import { canonCode, shortDate } from "../utils/helpers";
import { useIsMobile } from "../hooks/useIsMobile";
import type { PublicFeedback } from "../types";

export function TrackView({ initialCode }: { initialCode?: string }) {
  const isMobile = useIsMobile();
  const [myCode, setMyCode] = useState(loadMyCode);
  // 從送出成功畫面點進來時帶入那組碼；否則先帶入這台裝置記住的個人查詢碼
  const [code, setCode] = useState(initialCode || myCode);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<PublicFeedback[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedCode[]>(loadSavedCodes);

  const search = useCallback(async (c: string) => {
    setCode(c);
    if (canonCode(c).length < 8) { setError("查詢碼至少要 8 個字"); return; }
    setLoading(true); setError(""); setResults(null);
    const r = await lookupFeedback(c);
    setLoading(false);
    if (r.ok) { setResults(r.value); setOpenId(r.value[0]?.id ?? null); } else setError(r.message);
  }, []);

  useEffect(() => { if (initialCode) search(initialCode); }, [initialCode, search]);

  const isMine = !!myCode && canonCode(code) === canonCode(myCode);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: `0 ${S[4]}px ${S[8]}px` }}>
      <Card className="fu" style={{ padding: isMobile ? S[4] : S[5] }}>
        <h2 className="display" style={{ fontSize: T.lg, fontWeight: 400 }}>🔍 查看處理進度</h2>
        <p style={{ fontSize: T.sm, color: C.muted, marginTop: S[1], marginBottom: S[4] }}>
          輸入你的個人查詢碼，或送出時系統給你的查詢碼
        </p>
        <form onSubmit={e => { e.preventDefault(); search(code); }} style={{ display: "flex", gap: S[2], flexDirection: isMobile ? "column" : "row" }}>
          <label htmlFor="track-code" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>查詢碼</label>
          <TextInput id="track-code" type={show ? "text" : "password"} value={code} onChange={v => { setCode(v); setError(""); }}
            placeholder="查詢碼" autoComplete="off" maxLength={60} invalid={!!error}
            style={{ fontSize: T.md, flex: 1 }} />
          <Btn type="submit" disabled={loading} style={{ minHeight: 48 }}>{loading ? "查詢中…" : "查詢"}</Btn>
        </form>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: S[3], flexWrap: "wrap", marginTop: S[2], fontSize: T.xs, color: C.muted }}>
          <span>{isMine ? "🔐 已帶入這台裝置記住的個人查詢碼" : ""}</span>
          <span style={{ display: "flex", gap: S[3] }}>
            <button type="button" onClick={() => setShow(v => !v)} style={linkBtn}>{show ? "隱藏" : "顯示"}查詢碼</button>
            {isMine && <button type="button" onClick={() => { forgetMyCode(); setMyCode(""); setCode(""); setResults(null); }} style={linkBtn}>不要記住</button>}
          </span>
        </div>
        {error && <div role="alert" style={{ color: C.redDark, fontSize: T.sm, marginTop: S[3], fontWeight: 600 }}>⚠ {error}</div>}

        {saved.length > 0 && (
          <div style={{ marginTop: S[5], paddingTop: S[4], borderTop: `1px dashed ${C.border}` }}>
            <div style={{ fontSize: T.xs, color: C.muted, fontWeight: 700, marginBottom: S[2] }}>這台裝置記住的單次查詢碼</div>
            <div style={{ display: "flex", flexDirection: "column", gap: S[2] }}>
              {saved.map(s => {
                const cat = catOf(s.category);
                return (
                  <div key={s.code} style={{ display: "flex", alignItems: "center", gap: S[2], background: C.surface, borderRadius: R.md, padding: `${S[2]}px ${S[3]}px` }}>
                    <button type="button" onClick={() => search(s.code)} style={{ flex: 1, display: "flex", alignItems: "center", gap: S[2], background: "none", border: "none", cursor: "pointer", textAlign: "left", minHeight: 36, color: C.ink }}>
                      <span aria-hidden="true">{cat?.emoji || "📝"}</span>
                      <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700, fontSize: T.sm }}>{s.code}</span>
                      <span style={{ fontSize: T.xs, color: C.muted }}>{s.at}</span>
                    </button>
                    <button type="button" aria-label={`忘記查詢碼 ${s.code}`} onClick={() => { forgetCode(s.code); setSaved(loadSavedCodes()); }}
                      style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", width: 32, height: 32, borderRadius: R.full }}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {results && results.length === 1 && <ResultCard fb={results[0]} />}
      {results && results.length > 1 && (
        <div className="fu" style={{ marginTop: S[5] }}>
          <div style={{ fontSize: T.sm, color: C.sub, fontWeight: 700, marginBottom: S[3], paddingLeft: S[1] }}>
            這組查詢碼共有 {results.length} 則回饋，點一下看詳細狀態
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: S[2] }}>
            {results.map(fb => {
              const cat = catOf(fb.category);
              const st = statOf(fb.status);
              const open = openId === fb.id;
              return (
                <div key={fb.id}>
                  <button type="button" onClick={() => setOpenId(open ? null : fb.id)} aria-expanded={open} className="lift" style={{
                    width: "100%", display: "flex", alignItems: "center", gap: S[3], textAlign: "left", cursor: "pointer",
                    padding: `${S[3]}px ${S[4]}px`, borderRadius: R.lg, color: C.ink,
                    background: open ? cat.tint : C.paper, border: `2px solid ${open ? cat.color : "transparent"}`, boxShadow: open ? "none" : E[1],
                  }}>
                    <span aria-hidden="true" style={{ fontSize: "1.25rem" }}>{cat.emoji}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: T.sm }}>{fb.content}</span>
                    {fb.reply && <span aria-label="有回覆" title="有回覆">💌</span>}
                    <Pill color={st.color} tint={st.tint}>{st.emoji} {st.short}</Pill>
                    <span style={{ fontSize: T.xs, color: C.muted, whiteSpace: "nowrap" }}>{shortDate(fb.createdAt)}</span>
                  </button>
                  {open && <ResultCard fb={fb} compact />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const linkBtn: CSSProperties = { background: "none", border: "none", color: C.primary, fontWeight: 700, cursor: "pointer", fontSize: T.xs, textDecoration: "underline", padding: 0 };

function ResultCard({ fb, compact }: { fb: PublicFeedback; compact?: boolean }) {
  const isMobile = useIsMobile();
  const cat = catOf(fb.category);
  const st = statOf(fb.status);
  return (
    <div className="fu" style={{ marginTop: compact ? S[3] : S[5] }}>
      {/* 目前狀態：大卡片 */}
      <div style={{
        borderRadius: R.xl, padding: isMobile ? S[5] : S[6], textAlign: "center",
        background: `linear-gradient(160deg, ${st.tint}, ${C.paper})`, boxShadow: E[2], border: `1px solid ${C.hairline}`,
      }}>
        <div className="pop" aria-hidden="true" style={{ fontSize: "3rem", lineHeight: 1 }}>{st.emoji}</div>
        <div className="display" style={{ fontSize: isMobile ? T.lg : T.xl, color: st.color, marginTop: S[3], lineHeight: 1.45 }}>{st.label}</div>
        <div style={{ fontSize: T.xs, color: C.muted, marginTop: S[2] }}>最後更新：{fb.updatedAt || fb.createdAt}</div>

        <p style={{ fontSize: T.base, color: C.sub, lineHeight: 1.8, marginTop: S[3] }}>{st.desc}</p>
        {fb.respond === "ack" && fb.status === "received" && (
          <p style={{ fontSize: T.sm, color: C.muted, lineHeight: 1.7, marginTop: S[2] }}>你希望我們知道就好，我們收到了 🙂</p>
        )}

        {/* 四種狀態是不同的回應方式，不是先後順序，所以平排、不畫連接線 */}
        <div style={{ marginTop: S[5], paddingTop: S[4], borderTop: `1px dashed ${C.border}` }}>
          <div style={{ fontSize: T.xs, color: C.muted, marginBottom: S[2] }}>我們可能用這幾種方式回應，不一定依序進行</div>
          <ul aria-label="回應狀態說明" style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: S[2] }}>
            {STATUSES.map(s => {
              const current = s.key === fb.status;
              return (
                <li key={s.key} aria-current={current ? "true" : undefined} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: R.full,
                  fontSize: T.xs, fontWeight: current ? 700 : 500,
                  background: current ? s.tint : "transparent", color: current ? s.color : C.muted,
                  border: `1.5px solid ${current ? s.color : C.border}`,
                }}>
                  <span aria-hidden="true" style={{ filter: current ? "none" : "grayscale(1)", opacity: current ? 1 : .55 }}>{s.emoji}</span>
                  {s.short}{current && <span style={{ fontWeight: 500 }}>（目前）</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {fb.reply && (
        <Card style={{ marginTop: S[4], borderLeft: `5px solid ${C.coral}` }}>
          <div style={{ fontSize: T.xs, fontWeight: 700, color: C.coralDark, letterSpacing: ".06em", marginBottom: S[2] }}>💌 我們的回覆</div>
          <div style={{ fontSize: T.base, lineHeight: 1.85, whiteSpace: "pre-wrap", color: C.ink }}>{fb.reply}</div>
        </Card>
      )}

      <Card style={{ marginTop: S[4] }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: S[2], marginBottom: S[3] }}>
          <Pill color={cat.color} tint={cat.tint}>{cat.emoji} {cat.title}</Pill>
          <Pill color={C.sub} tint={C.surface}>{respOf(fb.respond).emoji} {respOf(fb.respond).label}{fb.meetWith ? `（${fb.meetWith}）` : ""}</Pill>
        </div>
        <div style={{ fontSize: T.xs, color: C.muted, marginBottom: S[2] }}>你在 {fb.createdAt} 說：</div>
        <div style={{ fontSize: T.base, lineHeight: 1.85, whiteSpace: "pre-wrap", background: C.surface, borderRadius: R.md, padding: S[4] }}>{fb.content}</div>

        {fb.history?.length > 1 && (
          <div style={{ marginTop: S[4] }}>
            <div style={{ fontSize: T.xs, color: C.muted, fontWeight: 700, marginBottom: S[2] }}>狀態更新紀錄</div>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {[...fb.history].reverse().map((h, i) => (
                <li key={i} style={{ display: "flex", gap: S[2], fontSize: T.sm, color: C.sub }}>
                  <span aria-hidden="true">{statOf(h.status).emoji}</span>
                  <span style={{ flex: 1 }}>{statOf(h.status).label}</span>
                  <span style={{ fontSize: T.xs, color: C.muted, whiteSpace: "nowrap" }}>{h.at}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
