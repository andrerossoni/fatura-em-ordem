import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

(function(){
"use strict";

/* ============================ modelo ============================ */

var CAT_SEED = [
  ["Academia/Personal","#3B82F6"],
  ["Aluguel","#A855F7"],
  ["Amazon","#3B82F6"],
  ["Assinaturas/Streaming","#3B82F6"],
  ["Cartão ADC Rhaiane","#64748B"],
  ["Cartão de Crédito","#A855F7"],
  ["Combustível","#E5A00D"],
  ["Compras","#F97316"],
  ["Consertos e Manutenções","#38BDF8"],
  ["Energia","#84CC16"],
  ["Farmácia","#EF4444"],
  ["Financiamento Carro","#EC4899"],
  ["Fluke (celular)","#4ADE80"],
  ["iFood/Lanches","#EF4444"],
  ["Impostos (outros)","#F97316"],
  ["IPTU/Lixo","#3B82F6"],
  ["IPVA/impostos Carro","#2DD4BF"],
  ["LOGA internet","#64748B"],
  ["Médicos/Saúde","#38BDF8"],
  ["Mercado Livre","#EDC22E"],
  ["Mercado/Alimentação","#EF4444"],
  ["Padaria","#4ADE80"],
  ["PGMEI","#2DD4BF"],
  ["Poupança","#4ADE80"],
  ["Seguro Celular","#3B82F6"],
  ["Tag Sem Parar (crédito)","#F97316"],
  ["Uber","#64748B"],
  ["Youse Seguro Carro","#A855F7"]
];
var DEFAULT_CATS = CAT_SEED.map(function(p){ return p[0]; });
var CAT_COLORS = {};
CAT_SEED.forEach(function(p){ CAT_COLORS[p[0]] = p[1]; });
CAT_COLORS["Sem categoria"] = "#94A3B8";
var FALLBACK_COLORS = ["#3B82F6","#A855F7","#F97316","#EF4444","#2DD4BF","#84CC16","#EC4899","#64748B"];
function catColor(name){
  if(CAT_COLORS[name]) return CAT_COLORS[name];
  var h = 0;
  for(var i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}
function dot(name){ return '<span class="dot" style="background:'+catColor(name)+'"></span>'; }

/* Lista de categorias substituída em 01/09/2026; a versão força a troca em quem já tinha a lista antiga. */
var CATS_VERSION = 2;

/* Limite informado pelo banco em 01/09/2026. Os números do banco JÁ contemplam todos os
   lançamentos existentes, então valem na íntegra: nada é somado nem descontado deles.
   Só o que for lançado DEPOIS da sincronização entra por cima. */
var LIMIT_VERSION = 2;
var SEED_LIMIT_TOTAL = 2235200;
var SEED_BANK_USED = 1091400;

var DEFAULT_CFG = {
  cardName:"Meu cartão", closingDay:28, dueDay:5,
  categories:DEFAULT_CATS.slice(), catsVersion:CATS_VERSION,
  limitTotal:SEED_LIMIT_TOTAL, limitUsedAtSync:0, limitSyncAt:0, limitSyncedAt:"",
  limitRoundCents:true, limitVersion:0
};

var MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
var MONTHS_ABBR = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
var WEEKDAYS = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];

var brl = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
var brl0 = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
function money(c){ return brl.format((c||0)/100); }
function moneyAbs(c){ return brl.format(Math.abs(c||0)/100); }
/* O painel de limite acompanha o app do banco, que não informa centavos. */
function moneyLim(c){ return state.cfg.limitRoundCents ? brl0.format(Math.round((c||0)/100)) : money(c); }
function pad(n){ return String(n).padStart(2,"0"); }

function todayISO(){ var d=new Date(); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function nowHM(){ var d=new Date(); return pad(d.getHours())+":"+pad(d.getMinutes()); }
function parseISO(s){ var p=String(s||"").split("-"); return { y:+p[0], m:(+p[1])-1, d:+p[2] }; }
function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
function cycleOf(y,m){ return y*12+m; }
function cycleYM(c){ return { y:Math.floor(c/12), m:((c%12)+12)%12 }; }
function dayDiff(a,b){ return Math.round((Date.UTC(b.y,b.m,b.d)-Date.UTC(a.y,a.m,a.d))/86400000); }
function fmtDMY(o){ return pad(o.d)+"/"+pad(o.m+1)+"/"+o.y; }
function fmtDM(o){ return pad(o.d)+"/"+pad(o.m+1); }

/* O ciclo é identificado pelo mês em que a fatura fecha. */
function closingOf(c,cfg){ var ym=cycleYM(c); return { y:ym.y, m:ym.m, d:Math.min(cfg.closingDay, daysInMonth(ym.y,ym.m)) }; }
function dueOf(c,cfg){
  var cc = cfg.dueDay > cfg.closingDay ? c : c+1;
  var ym = cycleYM(cc);
  return { y:ym.y, m:ym.m, d:Math.min(cfg.dueDay, daysInMonth(ym.y,ym.m)) };
}
/* Compra até o dia do fechamento entra na fatura que fecha naquele dia. */
function cycleForDate(iso,cfg){
  var p = parseISO(iso);
  if(!p.y) return currentCycle(cfg);
  var close = Math.min(cfg.closingDay, daysInMonth(p.y,p.m));
  var c = cycleOf(p.y,p.m);
  return p.d > close ? c+1 : c;
}
function currentCycle(cfg){ return cycleForDate(todayISO(), cfg); }
function cycleName(c,cfg){ var d=dueOf(c,cfg); return MONTHS[d.m]+" de "+d.y; }
function cycleLabel(c,cfg){ return "Fatura de "+cycleName(c,cfg); }


/* ============================ estado ============================ */

var state = { cfg: JSON.parse(JSON.stringify(DEFAULT_CFG)), entries: [], view: null };
var session = null;

function normalize(id, o){
  var cycle = o.cycle === null || o.cycle === undefined || o.cycle === "" || !isFinite(+o.cycle)
    ? null : Math.round(+o.cycle);
  return {
    id: id,
    amount: Math.max(0, Math.round(Number(o.amount)||0)),
    date: typeof o.date === "string" ? o.date.slice(0,10) : todayISO(),
    time: typeof o.time === "string" ? o.time : "",
    category: typeof o.category === "string" ? o.category : "",
    isCredit: !!o.isCredit,
    installments: Math.min(72, Math.max(1, Math.round(Number(o.installments)||1))),
    note: typeof o.note === "string" ? o.note.slice(0,400) : "",
    cycle: cycle,
    createdAt: Number(o.createdAt) || 0
  };
}
function newId(){ return "e"+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

/* ---- conversão entre o formato do app e as colunas do Postgres ---- */
function entryToRow(e){
  return {
    id: e.id, user_id: session.user.id, amount: e.amount, date: e.date, time: e.time,
    category: e.category, is_credit: e.isCredit, installments: e.installments, note: e.note,
    cycle: e.cycle,
    created_at: new Date(e.createdAt || Date.now()).toISOString()
  };
}
function entryFromRow(r){
  return normalize(r.id, {
    amount: r.amount, date: r.date, time: r.time, category: r.category,
    isCredit: r.is_credit, installments: r.installments, note: r.note,
    cycle: r.cycle,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : 0
  });
}
function cfgToRow(){
  var c = state.cfg;
  return {
    user_id: session.user.id,
    card_name: c.cardName, closing_day: c.closingDay, due_day: c.dueDay,
    categories: c.categories, cats_version: c.catsVersion,
    limit_total: c.limitTotal, limit_used_at_sync: c.limitUsedAtSync,
    limit_sync_at: c.limitSyncAt, limit_synced_at: c.limitSyncedAt,
    limit_round_cents: c.limitRoundCents, limit_version: c.limitVersion,
    updated_at: new Date().toISOString()
  };
}
function cfgFromRow(r){
  return {
    cardName: r.card_name || DEFAULT_CFG.cardName,
    closingDay: Math.min(31, Math.max(1, Number(r.closing_day) || DEFAULT_CFG.closingDay)),
    dueDay: Math.min(31, Math.max(1, Number(r.due_day) || DEFAULT_CFG.dueDay)),
    categories: Array.isArray(r.categories) && r.categories.length ? r.categories.map(String) : DEFAULT_CATS.slice(),
    catsVersion: Number(r.cats_version) || 0,
    limitTotal: Math.max(0, Number(r.limit_total) || 0),
    limitUsedAtSync: Math.max(0, Number(r.limit_used_at_sync) || 0),
    limitSyncAt: Math.max(0, Number(r.limit_sync_at) || 0),
    limitSyncedAt: r.limit_synced_at || "",
    limitRoundCents: r.limit_round_cents !== false,
    limitVersion: Number(r.limit_version) || 0
  };
}

/* ---- escrita: atualiza a tela na hora e grava em seguida ---- */
function saveFail(err, what){
  console.error(err);
  toast("Não deu para salvar " + what + ". Confira a conexão — os dados seguem na tela.");
}
function putEntry(e){
  var i = state.entries.findIndex(function(x){ return x.id === e.id; });
  if(i >= 0) state.entries[i] = e; else state.entries.push(e);
  render();
  sb.from("entries").upsert(entryToRow(e)).then(function(r){
    if(r.error) saveFail(r.error, "o lançamento");
  });
}
function dropEntry(id){
  state.entries = state.entries.filter(function(x){ return x.id !== id; });
  render();
  sb.from("entries").delete().eq("id", id).then(function(r){
    if(r.error) saveFail(r.error, "a exclusão");
  });
}
function putConfig(){
  render();
  sb.from("settings").upsert(cfgToRow()).then(function(r){
    if(r.error) saveFail(r.error, "os ajustes");
  });
}

/* ============================ cálculo ============================ */

/* O ciclo fica preso na fatura em que o lançamento foi feito (guardado em e.cycle).
   Datas na virada do fechamento são inconsistentes no próprio banco, então a data
   nunca deve reclassificar um lançamento já salvo — só serve de referência para exibição.
   Lançamentos antigos, salvos antes de existir esse campo, ainda caem pela data. */
function baseCycleOf(e){
  return (e.cycle === null || e.cycle === undefined) ? cycleForDate(e.date, state.cfg) : e.cycle;
}

/* Cada compra ocupa `installments` faturas seguidas, a partir do ciclo em que foi lançada. */
function occurrencesIn(c){
  var out = [];
  state.entries.forEach(function(e){
    var b = baseCycleOf(e);
    if(c >= b && c < b + e.installments){
      out.push({ e:e, k:(c-b)+1, n:e.installments, base:b });
    }
  });
  out.sort(function(a,z){
    if(a.e.date !== z.e.date) return a.e.date < z.e.date ? 1 : -1;
    if((a.e.time||"") !== (z.e.time||"")) return (a.e.time||"") < (z.e.time||"") ? 1 : -1;
    return (z.e.createdAt||0) - (a.e.createdAt||0);
  });
  return out;
}
function summarize(c){
  var s = { spend:0, credit:0, carried:0, count:0, net:0, byCat:{}, byCatSub:{} };
  occurrencesIn(c).forEach(function(o){
    var v = o.e.amount;
    if(o.e.isCredit) s.credit += v; else s.spend += v;
    if(o.k > 1) s.carried += (o.e.isCredit ? -v : v);
    s.count++;
    var key = o.e.category || "Sem categoria";
    var signed = o.e.isCredit ? -v : v;
    s.byCat[key] = (s.byCat[key]||0) + signed;
    var sub = (o.e.note||"").trim() || "Outros";
    if(!s.byCatSub[key]) s.byCatSub[key] = {};
    if(!s.byCatSub[key][sub]) s.byCatSub[key][sub] = { v:0, occs:[] };
    s.byCatSub[key][sub].v += signed;
    s.byCatSub[key][sub].occs.push({ k:o.k, n:o.n });
  });
  s.net = s.spend - s.credit;
  return s;
}
/* Termos de nota já usados numa categoria, para sugerir como "subcategoria" ao digitar. */
function noteStats(category){
  var counts = {}, order = [];
  state.entries.forEach(function(e){
    var note = (e.note||"").trim();
    if(!note) return;
    if(category && e.category !== category) return;
    if(!counts[note]){ counts[note] = 0; order.push(note); }
    counts[note]++;
  });
  return order.map(function(n){ return { note:n, count:counts[n] }; })
    .sort(function(a,b){ return b.count - a.count || a.note.localeCompare(b.note); });
}
function noteSuggestions(prefix, category){
  var p = (prefix||"").trim().toLowerCase();
  var list = noteStats(category);
  if(p) list = list.filter(function(r){
    var low = r.note.toLowerCase();
    return low.indexOf(p) === 0 && low !== p;
  });
  return list.slice(0, 6);
}
/* Quanto de uma compra ainda reserva limite: as parcelas que caem na fatura aberta ou depois. */
function limitHeldBy(e){
  var cur = currentCycle(state.cfg);
  var b = baseCycleOf(e);
  var n = 0;
  for(var k=0;k<e.installments;k++) if(b+k >= cur) n++;
  return (e.isCredit ? -1 : 1) * e.amount * n;
}
/* Lançamentos registrados depois da sincronização — os únicos que o número do banco ainda não viu. */
function loggedAfterSync(){
  var t = state.cfg.limitSyncAt || 0;
  return state.entries.reduce(function(a, e){
    return a + ((e.createdAt || 0) > t ? limitHeldBy(e) : 0);
  }, 0);
}
function limitState(){
  var cfg = state.cfg;
  var total = Math.max(0, cfg.limitTotal || 0);
  var banco = Math.max(0, cfg.limitUsedAtSync || 0);
  var novos = loggedAfterSync();
  var usado = banco + novos;
  return { total:total, banco:banco, novos:novos, usado:usado, livre:total-usado };
}
function autoReconcile(){
  if(state.cfg.limitVersion === LIMIT_VERSION) return false;
  state.cfg.limitTotal = state.cfg.limitTotal || SEED_LIMIT_TOTAL;
  state.cfg.limitUsedAtSync = SEED_BANK_USED;
  state.cfg.limitSyncAt = Date.now();
  state.cfg.limitSyncedAt = todayISO();
  if(typeof state.cfg.limitRoundCents !== "boolean") state.cfg.limitRoundCents = true;
  delete state.cfg.limitBaseline;
  state.cfg.limitVersion = LIMIT_VERSION;
  return true;
}
function futureCommitted(){
  var cur = currentCycle(state.cfg), total = 0;
  state.entries.forEach(function(e){
    var b = baseCycleOf(e);
    for(var k=0;k<e.installments;k++){
      if(b+k > cur) total += (e.isCredit ? -e.amount : e.amount);
    }
  });
  return total;
}

/* ============================ render ============================ */

var $ = function(id){ return document.getElementById(id); };

function render(){
  var cfg = state.cfg;
  var cur = currentCycle(cfg);
  if(state.view === null) state.view = cur;

  $("cardName").textContent = cfg.cardName || "Meu cartão";
  document.title = "Fatura em Ordem";

  renderStrip(cur);
  renderLimit(cur);
  renderInvoice(state.view, cur);
  renderEntries(state.view);
  renderCats(state.view);
  renderProjection(cur);
}

function ticks(el, ratio, tone, n){
  n = n || 34;
  var on = Math.round(Math.max(0, Math.min(1, ratio || 0)) * n);
  var h = "";
  for(var i=0;i<n;i++) h += '<span class="tick' + (i < on ? " on" + (tone ? " " + tone : "") : "") + '"></span>';
  el.innerHTML = h;
}

function renderStrip(cur){
  var cfg = state.cfg;
  var close = closingOf(cur,cfg), prevClose = closingOf(cur-1,cfg);
  var t = parseISO(todayISO());
  var span = dayDiff(prevClose, close), done = dayDiff(prevClose, t);
  var pct = span > 0 ? Math.max(0, Math.min(100, (done/span)*100)) : 0;

  $("stripFill").style.width = pct.toFixed(1) + "%";
  $("stripStart").innerHTML = "abriu <b>" + fmtDM(prevClose) + "</b>";
  $("stripEnd").innerHTML = "fecha <b>" + fmtDM(close) + "</b>";

  var left = dayDiff(t, close);
  $("sideDays").textContent = left === 0 ? "hoje"
    : left > 0 ? (left === 1 ? "1 dia" : left + " dias")
    : "já fechou";

  var fut = futureCommitted();
  var total = state.cfg.limitTotal || 0;
  $("statFuture").textContent = money(fut);
  $("statFutureNote").textContent = fut ? "comprometido após a fatura atual" : "nada comprometido adiante";
  ticks($("tickFuture"), total ? fut/total : 0, "violet");
}

function renderLimit(cur){
  var L = limitState();
  var over = L.livre < 0;
  var low = !over && L.total > 0 && L.livre < L.total * 0.12;
  var freeTxt = over ? "− " + moneyLim(Math.abs(L.livre)) : moneyLim(L.livre);

  $("limFree").textContent = freeTxt;
  $("limFree").className = "stat-v" + (over ? " neg" : low ? " warn" : "");
  $("limOf").textContent = (over ? "acima do limite de " : "de ") + moneyLim(L.total);
  ticks($("tickLimit"), L.total ? L.livre / L.total : 0, over ? "warn" : "green");

  $("limBig").textContent = freeTxt;
  $("limBig").className = "hero sm" + (over ? " over" : low ? " low" : "");

  /* medidor tracejado: consumido do banco, lançado depois, e o que sobra */
  var N = 44, denom = Math.max(L.total, L.usado) || 1;
  var a = Math.round((L.banco / denom) * N);
  var b = Math.round((Math.max(0, L.novos) / denom) * N);
  var h = "";
  for(var i=0;i<N;i++) h += '<span class="tick' + (i < a ? " prev" : i < a + b ? " now" : "") + '"></span>';
  $("limMeter").innerHTML = h;
  $("limMeter").setAttribute("aria-label",
    "Limite de " + moneyLim(L.total) + ": " + moneyLim(L.usado) + " consumidos, " + moneyLim(L.livre) + " disponíveis.");

  $("limLegend").innerHTML =
      '<span class="lg"><i class="sw s-prev"></i>Consumido (banco) <b>' + moneyLim(L.banco) + "</b></span>"
    + '<span class="lg"><i class="sw s-now"></i>Lançado depois <b>' + moneyLim(Math.max(0, L.novos)) + "</b></span>"
    + '<span class="lg"><i class="sw free"></i>Disponível <b>' + moneyLim(Math.max(0, L.livre)) + "</b></span>";

  if(state.cfg.limitSyncedAt){
    var d = parseISO(state.cfg.limitSyncedAt);
    var age = dayDiff(d, parseISO(todayISO()));
    $("limSync").textContent = "banco em " + fmtDMY(d) + (age > 35 ? " · vale rever" : "");
  }else{
    $("limSync").textContent = "nunca sincronizado";
  }

  var atual = summarize(cur).net;
  var msgs = [];
  if(over) msgs.push("O limite estourou em " + moneyLim(Math.abs(L.livre)) + ".");
  else if(low) msgs.push("Resta menos de 12% do limite.");
  if(atual > 0) msgs.push("Ao pagar a fatura de " + cycleName(cur, state.cfg) + " (" + moneyLim(atual) + "), esse valor volta ao limite.");
  msgs.push(L.novos !== 0
    ? "O consumido do banco vale de " + fmtDM(parseISO(state.cfg.limitSyncedAt || todayISO())) + "; por cima dele entra só o que você lançou aqui depois disso."
    : "Sincronize de novo depois de pagar a fatura, para o consumido acompanhar o banco.");
  $("limNote").className = "note" + (over || low ? " warn" : "");
  $("limNote").textContent = msgs.join(" ");
}

function renderInvoice(c, cur){
  var cfg = state.cfg;
  var close = closingOf(c,cfg), due = dueOf(c,cfg);
  var s = summarize(c);

  $("invLabel").textContent = MONTHS_ABBR[due.m] + "/" + String(due.y).slice(2);
  $("invMonth").textContent = cycleName(c, cfg);
  $("invDates").textContent = "fecha " + fmtDMY(close) + " · vence " + fmtDMY(due);

  var neg = s.net < 0;
  var txt = neg ? "− " + moneyAbs(s.net) : money(s.net);
  $("invHero").textContent = txt;
  $("invHero").className = "hero" + (neg ? " is-credit" : "");
  $("invTotal").textContent = txt;
  $("invTotal").className = "stat-v" + (neg ? " credit" : "");
  $("topbarTotal").textContent = txt;
  $("topbarTotal").className = "topbar-total" + (neg ? " credit" : "");
  ticks($("tickInvoice"), cfg.limitTotal ? Math.abs(s.net)/cfg.limitTotal : 0, "");

  var left = dayDiff(parseISO(todayISO()), close);
  var estado = c === cur ? (left === 0 ? "fecha hoje" : "fecha em " + left + " dias")
    : c < cur ? "fatura fechada" : "fatura prevista";
  $("invPill").className = "pill " + (c === cur ? "open" : c < cur ? "closed" : "future");
  $("invPill").textContent = c === cur ? "aberta" : c < cur ? "fechada" : "prevista";
  $("invStatus").textContent = estado;
  $("goToday").hidden = (c === cur);

  $("tileSpend").textContent = money(s.spend);
  $("tileSpendSub").textContent = s.count === 0 ? "nenhum lançamento"
    : s.count === 1 ? "1 lançamento" : s.count + " lançamentos";
  $("tileCredit").textContent = s.credit ? "− " + money(s.credit) : money(0);
  $("tileCreditSub").textContent = s.credit ? "abatidos do total" : "nenhum crédito";
  $("tileCarried").textContent = money(s.carried);
  var carriedCount = occurrencesIn(c).filter(function(o){ return o.k > 1; }).length;
  $("tileCarriedSub").textContent = carriedCount
    ? carriedCount + " parcela" + (carriedCount > 1 ? "s" : "") + " em andamento"
    : "nada parcelado";

  $("navCount").textContent = s.count || "";
}

function esc(s){
  return String(s).replace(/[&<>"']/g, function(ch){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
  });
}

function renderEntries(c){
  var list = $("entriesList");
  var occ = occurrencesIn(c);
  $("entriesCount").textContent = occ.length ? occ.length + (occ.length > 1 ? " lançamentos" : " lançamento") : "";

  if(!occ.length){
    list.innerHTML = '<div class="empty"><p>Nenhum lançamento nesta fatura ainda.</p>'
      + '<button class="btn primary" data-act="new">Lançar o primeiro</button></div>';
    return;
  }

  var html = "";
  var lastDate = null;
  occ.forEach(function(o){
    var e = o.e, p = parseISO(e.date);

    if(e.date !== lastDate){                 /* novo dia: fecha o grupo anterior e abre um novo */
      if(lastDate !== null) html += "</div>";
      var wd = WEEKDAYS[new Date(p.y, p.m, p.d).getDay()];
      html += '<div class="day-group"><div class="day-head">'
        + '<span class="day-num">' + pad(p.d) + "</span>"
        + '<span class="day-rest">' + MONTHS_ABBR[p.m] + " · " + wd + "</span>"
        + "</div>";
      lastDate = e.date;
    }

    var cat = e.category || "Sem categoria";
    var chips = "";
    if(e.installments > 1) chips += '<span class="chip inst">' + o.k + "/" + o.n + "</span>";
    if(e.isCredit) chips += '<span class="chip credit">estorno</span>';

    var sub = [];
    if(e.time) sub.push(e.time);
    if(o.k > 1) sub.push("compra em " + fmtDM(p));
    if(e.installments > 1) sub.push("total " + money(e.amount * e.installments));
    if(e.note) sub.push(esc(e.note));

    html += '<div class="led-row">'
      + '<span class="led-main"><span class="led-title">' + dot(cat) + "<strong>" + esc(cat) + "</strong>" + chips + "</span>"
      + (sub.length ? '<span class="led-sub">' + sub.join(" · ") + "</span>" : "")
      + "</span>"
      + '<span class="led-amt' + (e.isCredit ? " credit" : "") + '">' + (e.isCredit ? "− " : "") + money(e.amount) + "</span>"
      + '<span class="led-acts">'
      + '<button class="link-btn" data-act="edit" data-id="' + e.id + '">editar</button>'
      + '<button class="link-btn" data-act="del" data-id="' + e.id + '">excluir</button>'
      + "</span></div>";
  });
  list.innerHTML = html + "</div>";
}

function renderCats(c){
  var s = summarize(c);
  var rows = Object.keys(s.byCat).map(function(k){ return { name:k, v:s.byCat[k] }; })
    .filter(function(r){ return r.v !== 0; })
    .sort(function(a,b){ return Math.abs(b.v) - Math.abs(a.v); });

  var box = $("catList");
  if(!rows.length){
    box.innerHTML = '<div class="empty" style="padding:22px 0 26px"><p>Sem gastos para resumir.</p></div>';
    $("catMeta").textContent = "";
    return;
  }
  var max = rows.reduce(function(a,r){ return Math.max(a, Math.abs(r.v)); }, 0) || 1;
  var totalAbs = rows.reduce(function(a,r){ return a + Math.abs(r.v); }, 0) || 1;
  $("catMeta").textContent = rows.length + (rows.length>1 ? " categorias" : " categoria");

  box.innerHTML = rows.map(function(r){
    var w = Math.max(2, (Math.abs(r.v)/max)*100);
    var pct = Math.round((Math.abs(r.v)/totalAbs)*100);
    var neg = r.v < 0;
    var fill = 'width:'+w.toFixed(1)+'%';

    var subs = Object.keys(s.byCatSub[r.name]||{}).map(function(k){
      var bucket = s.byCatSub[r.name][k];
      return { name:k, v:bucket.v, occs:bucket.occs };
    }).filter(function(x){ return x.v !== 0; })
      .sort(function(a,b){ return Math.abs(b.v) - Math.abs(a.v); });
    var subHtml = "";
    if(subs.length > 1){
      var subTotalAbs = subs.reduce(function(a,x){ return a + Math.abs(x.v); }, 0) || 1;
      subHtml = '<div class="cat-subs">' + subs.map(function(x){
        var sneg = x.v < 0;
        var spct = Math.round((Math.abs(x.v)/subTotalAbs)*100);
        /* só dá pra mostrar a parcela quando a subcategoria representa um único lançamento parcelado */
        var chip = (x.occs.length === 1 && x.occs[0].n > 1)
          ? '<span class="chip inst">'+x.occs[0].k+"/"+x.occs[0].n+"</span>" : "";
        return '<div class="cat-sub-row"><span class="cat-sub-name"><span class="cat-sub-label">'+esc(x.name)+"</span>"+chip+"</span>"
          + '<span class="cat-sub-amt'+(sneg?" credit":"")+'">'+(sneg?"− "+moneyAbs(x.v):money(x.v))
          + '<span class="cat-sub-pct">'+spct+"%</span></span></div>";
      }).join("") + "</div>";
    }

    return '<div class="cat-row"><div class="cat-top"><span class="cat-name">'+dot(r.name)+esc(r.name)+"</span>"
      + '<span class="amt'+(neg?" credit":"")+'">'+(neg?"− "+moneyAbs(r.v):money(r.v))
      + '<span class="cat-pct">'+pct+"%</span></span></div>"
      + '<div class="cat-track"><div class="cat-fill'+(neg?" credit":"")+'" style="'+fill+'"></div></div>'
      + subHtml + "</div>";
  }).join("");
}

function renderProjection(cur){
  var cfg = state.cfg, N = 12, data = [];
  for(var i=0;i<N;i++){
    var c = cur+i;
    data.push({ c:c, net:summarize(c).net, due:dueOf(c,cfg) });
  }
  var max = data.reduce(function(a,d){ return Math.max(a, Math.abs(d.net)); }, 0) || 1;
  var maxIdx = 0;
  data.forEach(function(d,i){ if(Math.abs(d.net) > Math.abs(data[maxIdx].net)) maxIdx = i; });

  $("projChart").innerHTML = data.map(function(d,i){
    var h = Math.max(2, (Math.abs(d.net)/max)*128);
    var cls = "col" + (d.c === state.view ? " is-current" : "") + (d.net < 0 ? " is-credit" : "");
    var showVal = (i === 0 || i === maxIdx || d.c === state.view) ? " show" : "";
    var label = d.net === 0 ? "—" : (d.net < 0 ? "−" : "") + brl.format(Math.abs(d.net)/100).replace("R$", "").trim();
    return '<button class="'+cls+'" data-cycle="'+d.c+'" title="'+esc(cycleLabel(d.c,cfg)+" · "+money(d.net))+'">'
      + '<span class="col-plot"><span class="col-val'+showVal+'">'+label+"</span>"
      + '<span class="col-bar" style="height:'+h.toFixed(1)+'px"></span></span>'
      + '<span class="col-x">'+MONTHS_ABBR[d.due.m]+(d.due.m===0||i===0?"/"+String(d.due.y).slice(2):"")+"</span></button>";
  }).join("");

  var fut = futureCommitted();
  $("committedMeta").textContent = fut ? money(fut)+" já comprometidos após a fatura atual" : "nada comprometido adiante";
}

/* ============================ diálogos ============================ */

var lastFocus = null;
function openSheet(id){
  lastFocus = document.activeElement;
  $(id).hidden = false;
  var f = $(id).querySelector("input,select,textarea,button");
  if(f) setTimeout(function(){ f.focus(); }, 20);
}
function closeSheet(id){
  $(id).hidden = true;
  if(lastFocus && lastFocus.focus) lastFocus.focus();
}
document.addEventListener("keydown", function(ev){
  if(ev.key !== "Escape") return;
  ["entryScrim","cfgScrim","delScrim","limScrim"].forEach(function(id){ if(!$(id).hidden) closeSheet(id); });
});
["entryScrim","cfgScrim","delScrim"].forEach(function(id){
  $(id).addEventListener("mousedown", function(ev){ if(ev.target === $(id)) closeSheet(id); });
});

var toastTimer = null;
function toast(msg){
  var t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 2600);
}

/* ---------- máscara de dinheiro ---------- */
function centsOf(input){ return parseInt(String(input.value).replace(/\D/g,"") || "0", 10); }
function setCents(input, c){
  var s = String(Math.max(0, Math.round(c||0)));
  while(s.length < 3) s = "0"+s;
  var int = s.slice(0,-2), dec = s.slice(-2);
  input.value = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + dec;
}
function attachMoney(el){
  el.addEventListener("input", function(){
    setCents(this, parseInt(String(this.value).replace(/\D/g,"").slice(0,11) || "0", 10));
  });
  el.addEventListener("focus", function(){
    var t = this;
    setTimeout(function(){ t.setSelectionRange(t.value.length, t.value.length); }, 0);
  });
}
attachMoney($("fAmount"));
$("fAmount").addEventListener("input", syncInstHint);

/* ---------- switches ---------- */
function isOn(el){ return el.getAttribute("aria-checked") === "true"; }
function setOn(el, on){ el.setAttribute("aria-checked", on ? "true" : "false"); }
$("fCredit").addEventListener("click", function(){ setOn(this, !isOn(this)); syncInstHint(); });
$("fInst").addEventListener("click", function(){
  var on = !isOn(this);
  setOn(this, on);
  $("fInstWrap").hidden = !on;
  if(on && (+$("fInstN").value) < 2) $("fInstN").value = 2;
  syncInstHint();
});
$("fInstN").addEventListener("input", syncInstHint);
$("fDate").addEventListener("change", syncInstHint);

function syncInstHint(){
  var c = centsOf($("fAmount"));
  var n = $("fInstWrap").hidden ? 1 : Math.min(72, Math.max(2, Math.round(+$("fInstN").value || 2)));
  var credit = isOn($("fCredit"));
  $("fInstHint").textContent = "Total lançado: "+n+" x "+money(c)+" = "+money(c*n);

  var cfg = state.cfg;
  var existing = editingId ? state.entries.find(function(x){ return x.id===editingId; }) : null;
  var b = existing ? baseCycleOf(existing) : state.view;
  var where = (credit ? "Crédito entra na fatura de " : "Entra na fatura de ") + cycleName(b,cfg);
  if(n > 1) where += ", indo até a de " + cycleName(b+n-1,cfg);
  $("fWhere").textContent = where + ".";
}

/* ---------- categorias no formulário ---------- */
function fillCats(sel){
  var cur = sel || $("fCat").value;
  $("fCat").innerHTML = '<option value="">Selecione</option>' + state.cfg.categories.map(function(c){
    return '<option value="'+esc(c)+'">'+esc(c)+"</option>";
  }).join("");
  if(cur) $("fCat").value = cur;
}
$("fCatAdd").addEventListener("click", function(){
  var w = $("fCatNewWrap");
  w.hidden = !w.hidden;
  if(!w.hidden) $("fCatNew").focus();
});
function commitNewCat(){
  var v = $("fCatNew").value.trim();
  if(!v) return;
  if(state.cfg.categories.indexOf(v) === -1){
    state.cfg.categories.push(v);
    putConfig();
  }
  fillCats(v);
  $("fCatNew").value = "";
  $("fCatNewWrap").hidden = true;
}
$("fCatSave").addEventListener("click", commitNewCat);
$("fCatNew").addEventListener("keydown", function(ev){ if(ev.key === "Enter"){ ev.preventDefault(); commitNewCat(); }});

/* ---------- sugestões de nota (subcategoria por categoria) ---------- */
var noteSuggestIdx = -1;
function hideNoteSuggest(){
  $("fNoteSuggest").hidden = true;
  $("fNoteSuggest").innerHTML = "";
  noteSuggestIdx = -1;
}
function highlightNoteSuggest(items){
  items.forEach(function(el,i){ el.classList.toggle("is-active", i === noteSuggestIdx); });
}
function updateNoteSuggest(){
  var v = $("fNote").value;
  if(!v.trim()){ hideNoteSuggest(); return; }
  var items = noteSuggestions(v, $("fCat").value || null);
  if(!items.length){ hideNoteSuggest(); return; }
  $("fNoteSuggest").innerHTML = items.map(function(r){
    return '<div class="note-suggest-item" data-note="'+esc(r.note)+'">'+esc(r.note)+"</div>";
  }).join("");
  $("fNoteSuggest").hidden = false;
  noteSuggestIdx = -1;
}
$("fNote").addEventListener("input", updateNoteSuggest);
$("fNote").addEventListener("focus", updateNoteSuggest);
$("fCat").addEventListener("change", updateNoteSuggest);
$("fNote").addEventListener("blur", function(){ setTimeout(hideNoteSuggest, 150); });
$("fNoteSuggest").addEventListener("mousedown", function(ev){
  var item = ev.target.closest(".note-suggest-item");
  if(!item) return;
  ev.preventDefault();
  $("fNote").value = item.getAttribute("data-note");
  hideNoteSuggest();
  $("fNote").focus();
});
$("fNote").addEventListener("keydown", function(ev){
  var box = $("fNoteSuggest");
  if(box.hidden) return;
  var items = box.querySelectorAll(".note-suggest-item");
  if(!items.length) return;
  if(ev.key === "ArrowDown"){
    ev.preventDefault();
    noteSuggestIdx = Math.min(items.length-1, noteSuggestIdx+1);
    highlightNoteSuggest(items);
  }else if(ev.key === "ArrowUp"){
    ev.preventDefault();
    noteSuggestIdx = Math.max(0, noteSuggestIdx-1);
    highlightNoteSuggest(items);
  }else if(ev.key === "Tab"){
    var pick = items[noteSuggestIdx >= 0 ? noteSuggestIdx : 0];
    $("fNote").value = pick.getAttribute("data-note");
    hideNoteSuggest();
  }else if(ev.key === "Enter" && noteSuggestIdx >= 0){
    ev.preventDefault();
    $("fNote").value = items[noteSuggestIdx].getAttribute("data-note");
    hideNoteSuggest();
  }else if(ev.key === "Escape"){
    hideNoteSuggest();
  }
});

/* ---------- abrir / salvar lançamento ---------- */
var editingId = null;

function openEntry(entry){
  editingId = entry ? entry.id : null;
  $("entryTitle").textContent = entry ? "Editar lançamento" : "Nova compra no cartão";
  $("entrySave").textContent = entry ? "Salvar" : "Lançar";
  $("entrySaveMore").hidden = !!entry;

  fillCats(entry ? entry.category : "");
  $("fCatNewWrap").hidden = true;
  $("fCatNew").value = "";

  if(entry){
    setCents($("fAmount"), entry.amount);
    $("fDate").value = entry.date;
    $("fTime").value = entry.time || "";
    $("fCat").value = entry.category || "";
    setOn($("fCredit"), entry.isCredit);
    setOn($("fInst"), entry.installments > 1);
    $("fInstWrap").hidden = entry.installments <= 1;
    $("fInstN").value = Math.max(2, entry.installments);
    $("fNote").value = entry.note || "";
  }else{
    setCents($("fAmount"), 0);
    $("fDate").value = todayISO();
    $("fTime").value = nowHM();
    $("fCat").value = "";
    setOn($("fCredit"), false);
    setOn($("fInst"), false);
    $("fInstWrap").hidden = true;
    $("fInstN").value = 2;
    $("fNote").value = "";
  }
  syncInstHint();
  hideNoteSuggest();
  openSheet("entryScrim");
  setTimeout(function(){ $("fAmount").focus(); }, 30);
}

function collect(){
  var amount = centsOf($("fAmount"));
  if(amount <= 0){ toast("Informe o valor da parcela."); $("fAmount").focus(); return null; }
  var date = $("fDate").value;
  if(!date){ toast("Informe a data da compra."); $("fDate").focus(); return null; }
  var n = $("fInstWrap").hidden ? 1 : Math.min(72, Math.max(2, Math.round(+$("fInstN").value || 2)));
  var existing = editingId ? state.entries.find(function(x){ return x.id===editingId; }) : null;
  return normalize(editingId || newId(), {
    amount: amount,
    date: date,
    time: $("fTime").value || "",
    category: $("fCat").value || "",
    isCredit: isOn($("fCredit")),
    installments: n,
    note: $("fNote").value.trim(),
    /* fica preso na fatura em que foi lançado — editar a data não deve pular o lançamento de fatura. */
    cycle: existing ? baseCycleOf(existing) : state.view,
    createdAt: existing ? existing.createdAt || Date.now() : Date.now()
  });
}

function saveEntry(keepOpen){
  var e = collect();
  if(!e) return;
  putEntry(e);
  var cyc = e.cycle;
  toast(editingId ? "Lançamento atualizado." :
    (e.installments > 1 ? e.installments+" parcelas lançadas a partir da fatura de "+cycleName(cyc,state.cfg)+"."
                        : "Lançado na fatura de "+cycleName(cyc,state.cfg)+"."));
  if(keepOpen){
    editingId = null;
    setCents($("fAmount"), 0);
    $("fNote").value = "";
    $("fTime").value = nowHM();
    setOn($("fCredit"), false);
    setOn($("fInst"), false);
    $("fInstWrap").hidden = true;
    $("fInstN").value = 2;
    syncInstHint();
    hideNoteSuggest();
    $("fAmount").focus();
  }else{
    closeSheet("entryScrim");
  }
}
$("entrySave").addEventListener("click", function(){ saveEntry(false); });
$("entrySaveMore").addEventListener("click", function(){ saveEntry(true); });
$("entryCancel").addEventListener("click", function(){ closeSheet("entryScrim"); });
$("entryClose").addEventListener("click", function(){ closeSheet("entryScrim"); });

/* ---------- excluir ---------- */
var deletingId = null;
function askDelete(id){
  var e = state.entries.find(function(x){ return x.id===id; });
  if(!e) return;
  deletingId = id;
  $("delBody").textContent = e.installments > 1
    ? "Esta compra ocupa "+e.installments+" faturas ("+money(e.amount)+" cada, "+money(e.amount*e.installments)+" no total). Excluir remove todas as parcelas."
    : "Excluir "+money(e.amount)+" em "+(e.category || "sem categoria")+"?";
  openSheet("delScrim");
}
$("delConfirm").addEventListener("click", function(){
  if(deletingId){ dropEntry(deletingId); toast("Lançamento excluído."); }
  deletingId = null;
  closeSheet("delScrim");
});
$("delCancel").addEventListener("click", function(){ closeSheet("delScrim"); });
$("delClose").addEventListener("click", function(){ closeSheet("delScrim"); });

/* ---------- limite ---------- */
attachMoney($("lTotal"));
attachMoney($("lUsed"));
$("lTotal").addEventListener("input", syncLimCalc);
$("lUsed").addEventListener("input", syncLimCalc);
$("lRound").addEventListener("click", function(){ setOn(this, !isOn(this)); syncLimCalc(); });

function syncLimCalc(){
  var total = centsOf($("lTotal"));
  var used = centsOf($("lUsed"));
  var free = total - used;
  var html = '<span class="l">Limite total<b>'+money(total)+"</b></span>"
    + '<span class="l">Consumido, segundo o banco<b>'+money(used)+"</b></span>"
    + '<span class="l sum">Disponível para gastar<b>'+money(free)+"</b></span>";

  var notes = [];
  if(free < 0) notes.push(["warn", "O consumido informado passa do limite total. Confira os dois números."]);
  notes.push(["", "Compare o disponível acima com o do app do banco: se bater, os números estão certos."]);
  notes.push(["", "Esses valores entram inteiros, sem somar nem descontar nada — eles já contemplam os lançamentos registrados aqui. Daqui em diante, só o que você lançar depois desta sincronização entra por cima."]);
  if(isOn($("lRound"))) notes.push(["", "Sem os centavos do banco, o consumido tem margem de menos de R$ 1,00 — some na próxima sincronização."]);
  html += notes.map(function(n){ return '<span class="note'+(n[0]?" "+n[0]:"")+'">'+n[1]+"</span>"; }).join("");
  $("lCalc").innerHTML = html;
}

function openLimit(){
  setCents($("lTotal"), state.cfg.limitTotal || 0);
  setCents($("lUsed"), limitState().usado);
  setOn($("lRound"), state.cfg.limitRoundCents !== false);
  syncLimCalc();
  openSheet("limScrim");
}
$("btnLimit").addEventListener("click", openLimit);
$("limCancel").addEventListener("click", function(){ closeSheet("limScrim"); });
$("limClose").addEventListener("click", function(){ closeSheet("limScrim"); });
$("limSave").addEventListener("click", function(){
  var total = centsOf($("lTotal"));
  if(total <= 0){ toast("Informe o limite total do cartão."); $("lTotal").focus(); return; }
  state.cfg.limitTotal = total;
  state.cfg.limitUsedAtSync = Math.max(0, centsOf($("lUsed")));
  state.cfg.limitSyncAt = Date.now();
  state.cfg.limitRoundCents = isOn($("lRound"));
  state.cfg.limitSyncedAt = todayISO();
  state.cfg.limitVersion = LIMIT_VERSION;
  putConfig();
  closeSheet("limScrim");
  toast("Limite sincronizado.");
});

/* ---------- ajustes ---------- */
function renderCfgCats(){
  var used = {};
  state.entries.forEach(function(e){ if(e.category) used[e.category] = true; });
  $("cfgCats").innerHTML = cfgDraft.categories.map(function(c,i){
    return '<span class="cat-tag">'+dot(c)+esc(c)
      + (used[c] ? "" : '<button type="button" data-rm="'+i+'" aria-label="Remover '+esc(c)+'">×</button>')
      + "</span>";
  }).join("");
}
var cfgDraft = null;
function openCfg(){
  cfgDraft = JSON.parse(JSON.stringify(state.cfg));
  $("cName").value = cfgDraft.cardName;
  $("cClose").value = cfgDraft.closingDay;
  $("cDue").value = cfgDraft.dueDay;
  $("cCatNew").value = "";
  renderCfgCats();
  syncCfgHint();
  openSheet("cfgScrim");
}
function syncCfgHint(){
  var cd = Math.min(31, Math.max(1, Math.round(+$("cClose").value || 1)));
  var dd = Math.min(31, Math.max(1, Math.round(+$("cDue").value || 1)));
  var same = dd > cd;
  $("cfgHint").textContent = "Compras até o dia "+cd+" entram na fatura que fecha naquele mês; a partir do dia "+(cd+1)
    + " vão para a seguinte. O vencimento cai no dia "+dd+(same ? " do mesmo mês do fechamento." : " do mês seguinte ao fechamento.");
}
$("cClose").addEventListener("input", syncCfgHint);
$("cDue").addEventListener("input", syncCfgHint);
$("cfgCats").addEventListener("click", function(ev){
  var b = ev.target.closest("button[data-rm]");
  if(!b) return;
  cfgDraft.categories.splice(+b.getAttribute("data-rm"), 1);
  renderCfgCats();
});
function addCfgCat(){
  var v = $("cCatNew").value.trim();
  if(!v) return;
  if(cfgDraft.categories.indexOf(v) === -1) cfgDraft.categories.push(v);
  $("cCatNew").value = "";
  renderCfgCats();
}
$("cCatAdd").addEventListener("click", addCfgCat);
$("cCatNew").addEventListener("keydown", function(ev){ if(ev.key === "Enter"){ ev.preventDefault(); addCfgCat(); }});
$("cfgSave").addEventListener("click", function(){
  state.cfg = Object.assign({}, state.cfg, {
    cardName: ($("cName").value.trim() || "Meu cartão").slice(0,48),
    closingDay: Math.min(31, Math.max(1, Math.round(+$("cClose").value || 28))),
    dueDay: Math.min(31, Math.max(1, Math.round(+$("cDue").value || 5))),
    categories: cfgDraft.categories.slice(0,60),
    catsVersion: CATS_VERSION
  });
  putConfig();
  fillCats($("fCat").value);
  closeSheet("cfgScrim");
  toast("Ajustes salvos.");
});
$("cfgCancel").addEventListener("click", function(){ closeSheet("cfgScrim"); });
$("cfgClose").addEventListener("click", function(){ closeSheet("cfgScrim"); });

/* ---------- navegação ---------- */
var VIEW_NAMES = { painel:"Painel", lancamentos:"Lançamentos", categorias:"Categorias" };
function setView(v){
  Array.prototype.forEach.call(document.querySelectorAll(".view"), function(el){
    el.hidden = el.getAttribute("data-view") !== v;
  });
  Array.prototype.forEach.call(document.querySelectorAll(".nav-item[data-view]"), function(b){
    b.classList.toggle("is-on", b.getAttribute("data-view") === v);
  });
  $("viewTitle").textContent = VIEW_NAMES[v] || "Painel";
  window.scrollTo(0, 0);
}
Array.prototype.forEach.call(document.querySelectorAll(".nav-item[data-view]"), function(b){
  b.addEventListener("click", function(){ setView(this.getAttribute("data-view")); });
});

$("btnNew").addEventListener("click", function(){ openEntry(null); });
$("btnConfig").addEventListener("click", openCfg);
$("prevCycle").addEventListener("click", function(){ state.view--; render(); });
$("nextCycle").addEventListener("click", function(){ state.view++; render(); });
$("goToday").addEventListener("click", function(){ state.view = currentCycle(state.cfg); render(); });

$("entriesList").addEventListener("click", function(ev){
  var b = ev.target.closest("button[data-act]");
  if(!b) return;
  var act = b.getAttribute("data-act");
  if(act === "new") return openEntry(null);
  var e = state.entries.find(function(x){ return x.id === b.getAttribute("data-id"); });
  if(!e) return;
  if(act === "edit") openEntry(e);
  if(act === "del") askDelete(e.id);
});
$("projChart").addEventListener("click", function(ev){
  var b = ev.target.closest("button[data-cycle]");
  if(!b) return;
  state.view = +b.getAttribute("data-cycle");
  render();
});


/* ============================ acesso ============================ */

var EMAIL_KEY = "fatura-em-ordem/email";

function rememberedEmail(){
  try{ return localStorage.getItem(EMAIL_KEY) || ""; }catch(e){ return ""; }
}
function rememberEmail(v){
  try{ v ? localStorage.setItem(EMAIL_KEY, v) : localStorage.removeItem(EMAIL_KEY); }catch(e){}
}

var authMode = "in";

function paintAuth(){
  var known = rememberedEmail();
  var signup = authMode === "up";
  $("authTitle").textContent = signup ? "Criar acesso" : "Fatura em Ordem";
  $("authSub").textContent = signup
    ? "Escolha o e-mail e a senha que vão abrir o app. Depois disso, só a senha é pedida."
    : (known ? "Digite a senha para abrir." : "Entre com o e-mail e a senha do seu acesso.");
  $("authEmailField").hidden = !signup && !!known;
  $("authEmail").value = signup ? $("authEmail").value : known;
  $("authConfirmField").hidden = !signup;
  $("authGo").textContent = signup ? "Criar acesso" : "Entrar";
  $("authSwap").textContent = signup ? "Já tenho acesso" : "Criar acesso";
  $("authForget").hidden = signup || !known;
  $("authMsg").textContent = "";
  $("authMsg").className = "auth-msg";
}
function authError(msg){
  $("authMsg").textContent = msg;
  $("authMsg").className = "auth-msg bad";
}
function authInfo(msg){
  $("authMsg").textContent = msg;
  $("authMsg").className = "auth-msg good";
}
function showAuth(){
  $("authScrim").hidden = false;
  $("app").hidden = true;
  paintAuth();
  setTimeout(function(){ ($("authEmailField").hidden ? $("authPass") : $("authEmail")).focus(); }, 40);
}

async function doAuth(){
  var email = ($("authEmailField").hidden ? rememberedEmail() : $("authEmail").value.trim()).toLowerCase();
  var pass = $("authPass").value;
  if(!email){ authError("Informe o e-mail."); return; }
  if(pass.length < 8){ authError("A senha precisa de pelo menos 8 caracteres."); return; }

  $("authGo").disabled = true;
  try{
    if(authMode === "up"){
      if(pass !== $("authConfirm").value){ authError("As duas senhas não são iguais."); return; }
      var up = await sb.auth.signUp({ email: email, password: pass });
      if(up.error) throw up.error;
      rememberEmail(email);
      if(!up.data.session){
        authInfo("Conta criada. Confirme pelo link enviado para " + email + " e volte aqui para entrar.");
        authMode = "in";
        setTimeout(paintAuth, 60);
        return;
      }
      session = up.data.session;
    }else{
      var inn = await sb.auth.signInWithPassword({ email: email, password: pass });
      if(inn.error) throw inn.error;
      rememberEmail(email);
      session = inn.data.session;
    }
    $("authPass").value = "";
    $("authConfirm").value = "";
    await enterApp();
  }catch(err){
    var m = String(err && err.message || err);
    if(/Invalid login/i.test(m)) authError("E-mail ou senha não conferem.");
    else if(/already registered/i.test(m)) authError("Esse e-mail já tem acesso — use a opção 'Já tenho acesso'.");
    else if(/Email not confirmed/i.test(m)) authError("Falta confirmar o e-mail. Procure a mensagem do Supabase na caixa de entrada.");
    else authError(m);
  }finally{
    $("authGo").disabled = false;
  }
}

$("authGo").addEventListener("click", doAuth);
$("authForm").addEventListener("submit", function(ev){ ev.preventDefault(); doAuth(); });
$("authSwap").addEventListener("click", function(){
  authMode = authMode === "up" ? "in" : "up";
  paintAuth();
});
$("authForget").addEventListener("click", function(){
  rememberEmail("");
  paintAuth();
  $("authEmail").focus();
});
$("btnOut").addEventListener("click", async function(){
  await sb.auth.signOut();
  session = null;
  state.entries = [];
  state.cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));
  showAuth();
});

/* ============================ carga ============================ */

async function enterApp(){
  var res = await Promise.all([
    sb.from("settings").select("*").maybeSingle(),
    sb.from("entries").select("*")
  ]);
  if(res[0].error) throw res[0].error;
  if(res[1].error) throw res[1].error;

  state.cfg = res[0].data ? cfgFromRow(res[0].data) : JSON.parse(JSON.stringify(DEFAULT_CFG));
  state.entries = (res[1].data || []).map(entryFromRow);
  state.view = null;

  var dirty = !res[0].data;
  if(state.cfg.catsVersion !== CATS_VERSION){
    state.cfg.categories = DEFAULT_CATS.slice();
    state.cfg.catsVersion = CATS_VERSION;
    dirty = true;
  }
  /* A reconciliação do limite depende dos lançamentos, então roda só agora. */
  if(autoReconcile()) dirty = true;
  if(dirty){
    var w = await sb.from("settings").upsert(cfgToRow());
    if(w.error) saveFail(w.error, "os ajustes");
  }

  fillCats($("fCat").value);
  $("authScrim").hidden = true;
  $("app").hidden = false;
  render();
}

/* ============================ importar ============================ */

$("btnImport").addEventListener("click", function(){
  $("impText").value = "";
  $("impInfo").textContent = "Cole aqui o arquivo que você exportou do artefato.";
  $("impInfo").className = "hint";
  openSheet("impScrim");
});
$("impClose").addEventListener("click", function(){ closeSheet("impScrim"); });
$("impCancel").addEventListener("click", function(){ closeSheet("impScrim"); });
$("impFile").addEventListener("change", function(){
  var f = this.files && this.files[0];
  if(!f) return;
  var r = new FileReader();
  r.onload = function(){ $("impText").value = String(r.result); };
  r.readAsText(f);
});
$("impGo").addEventListener("click", async function(){
  var raw = $("impText").value.trim();
  if(!raw){ $("impInfo").textContent = "Cole o conteúdo do arquivo primeiro."; $("impInfo").className = "hint warn"; return; }
  var data;
  try{ data = JSON.parse(raw); }
  catch(e){ $("impInfo").textContent = "Isso não é um arquivo válido de exportação."; $("impInfo").className = "hint warn"; return; }
  var list = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : null);
  if(!list){ $("impInfo").textContent = "Não achei a lista de lançamentos nesse arquivo."; $("impInfo").className = "hint warn"; return; }

  this.disabled = true;
  try{
    var rows = list.map(function(o){
      var e = normalize(o.id || newId(), o);
      if(!e.createdAt) e.createdAt = Date.now();
      return entryToRow(e);
    });
    /* upsert por id: reimportar o mesmo arquivo não duplica nada. */
    for(var i=0;i<rows.length;i+=200){
      var chunk = await sb.from("entries").upsert(rows.slice(i, i+200));
      if(chunk.error) throw chunk.error;
    }
    if(data.cfg && typeof data.cfg === "object"){
      if(typeof data.cfg.cardName === "string") state.cfg.cardName = data.cfg.cardName;
      if(data.cfg.closingDay) state.cfg.closingDay = Math.min(31, Math.max(1, Number(data.cfg.closingDay)));
      if(data.cfg.dueDay) state.cfg.dueDay = Math.min(31, Math.max(1, Number(data.cfg.dueDay)));
      if(Array.isArray(data.cfg.categories) && data.cfg.categories.length) state.cfg.categories = data.cfg.categories.map(String);
      if(data.cfg.limitTotal) state.cfg.limitTotal = Math.max(0, Number(data.cfg.limitTotal));
      if(data.cfg.limitUsedAtSync) state.cfg.limitUsedAtSync = Math.max(0, Number(data.cfg.limitUsedAtSync));
      if(data.cfg.limitSyncAt) state.cfg.limitSyncAt = Math.max(0, Number(data.cfg.limitSyncAt));
      if(data.cfg.limitSyncedAt) state.cfg.limitSyncedAt = String(data.cfg.limitSyncedAt);
      await sb.from("settings").upsert(cfgToRow());
    }
    closeSheet("impScrim");
    await enterApp();
    toast(rows.length + " lançamento" + (rows.length > 1 ? "s importados." : " importado."));
  }catch(err){
    $("impInfo").textContent = "Falhou ao importar: " + (err && err.message || err);
    $("impInfo").className = "hint warn";
  }finally{
    this.disabled = false;
  }
});

/* ============================ exportar ============================ */

$("btnExport").addEventListener("click", function(){
  var payload = { app:"fatura-em-ordem", version:1, exportedAt:new Date().toISOString(),
                  cfg:state.cfg, entries:state.entries };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fatura-em-ordem-" + todayISO() + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  toast("Backup baixado.");
});

/* ============================ partida ============================ */

sb.auth.getSession().then(async function(r){
  if(r.data && r.data.session){
    session = r.data.session;
    try{ await enterApp(); }
    catch(e){ console.error(e); showAuth(); authError("Não deu para carregar seus dados. Entre de novo."); }
  }else{
    showAuth();
  }
});

})();
