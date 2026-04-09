import { supabase } from "./supabase.js";

const TABLE = "materials";

// テーブル内に表示する列（symbol はタイトルに出すので列には含めない）
const COLUMNS = [
  { label: "口径", key: "diameter" },
  { label: "厚み", key: "thickness" },
  { label: "表被仕様", key: "coating_type" },
  { label: "数量", key: "quantity", align: "num" },
  { label: "更新日", key: "updated_at" },
];

const elGroupContainer = document.getElementById("groupContainer");
const elStatus = document.getElementById("status");
const btnRefresh = document.getElementById("btnRefresh");
const btnAddRow = document.getElementById("btnAddRow");
const dialogAdd = document.getElementById("dialogAdd");
const formAdd = document.getElementById("formAdd");
const btnSubmitAdd = document.getElementById("btnSubmitAdd");
const btnDialogCancel = document.getElementById("btnDialogCancel");
const numericInputs = Array.from(
  formAdd.querySelectorAll("input[name='diameter'], input[name='thickness'], input[name='quantity']")
);

let allRows = [];
let sortStateBySymbol = {};

function setStatus(message, kind = "info") {
  if (!elStatus) return;
  elStatus.textContent = message || "";
  elStatus.dataset.kind = kind;
}

/** 更新日時を整形する */
function formatValue(key, value) {
  if (value === null || value === undefined) return "";

  if (key === "updated_at") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);

    const formattedDate =
      `${d.getFullYear()}/` +
      `${String(d.getMonth() + 1).padStart(2, '0')}/` +
      `${String(d.getDate()).padStart(2, '0')}`;

    return formattedDate;
  }

  return String(value);
}

function compareValues(a, b, key) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;

  if (key === "diameter" || key === "thickness" || key === "quantity") {
    return Number(a) - Number(b);
  }
  if (key === "updated_at") {
    return new Date(a).getTime() - new Date(b).getTime();
  }
  return String(a).localeCompare(String(b), "ja");
}

/** ソート状態を見てテーブル内の表示順を調整 */
function getSortedRows(symbol, rows) {

  const state = sortStateBySymbol[symbol];
  if (!state || state.direction === "none") return [...rows];

  const dir = state.direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    return compareValues(left[state.key], right[state.key], state.key) * dir;
  });
}

/** symbol ごとにまとめる (記号:[]),(記号:[]),...の形にしてる*/
function groupBySymbol(rows) {
  const map = new Map();
  for (const row of rows) {
    const sym = row.symbol == null ? "" : String(row.symbol);
    if (!map.has(sym)) map.set(sym, []);
    map.get(sym).push(row);
  }
  return map;
}

/** header行のソートマークを制御する */
function updateHeaderSortMark(sym, thead) {
  const headers = thead.querySelectorAll("th[data-key]");
  for (const th of headers) {
    const key = th.dataset.key;
    const mark = th.querySelector(".sortMark");
    th.classList.remove("sorted");
    if (!mark) continue;

    const state = sortStateBySymbol[sym];
    if (!state || key !== state.key || state.direction === "none") {
      mark.textContent = "-";
      continue;
    }

    th.classList.add("sorted");
    mark.textContent = state.direction === "asc" ? "▲" : "▼";
  }
}

/** ヘッダ行を作成する */
function createHeaderRow() {
  const tr = document.createElement("tr");
  for (const col of COLUMNS) {
    const th = document.createElement("th");
    th.dataset.key = col.key;
    if (col.align === "num") th.classList.add("num");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = col.align === "num" ? "thBtn thBtnNum" : "thBtn";

    const labelSpan = document.createElement("span");
    labelSpan.textContent = col.label;
    const markSpan = document.createElement("span");
    markSpan.className = "sortMark";
    markSpan.setAttribute("aria-hidden", "true");
    markSpan.textContent = "-";

    btn.appendChild(labelSpan);
    btn.appendChild(markSpan);
    th.appendChild(btn);
    tr.appendChild(th);
  }
  return tr;
}

/** セルを作成する */
function appendCells(tr, row) {
  for (const col of COLUMNS) {
    const td = document.createElement("td");
    td.classList.add("cell");
    td.tabIndex = 0;
    if (col.align === "num") td.classList.add("num");

    //更新日時を整形する
    const v = formatValue(col.key, row[col.key]);

    if (col.key === "diameter" || col.key === "thickness") {
      const wrap = document.createElement("div");
      wrap.className = "unitCell";
      const valueSpan = document.createElement("span");
      valueSpan.textContent = v;
      const unitSpan = document.createElement("span");
      unitSpan.className = "unit";
      unitSpan.textContent = col.key === "diameter" ? "A" : "t";
      wrap.appendChild(valueSpan);
      wrap.appendChild(unitSpan);
      td.appendChild(wrap);
    } else {
      td.textContent = v;
    }

    tr.appendChild(td);
  }
}

/** symbolごとにテーブルを作成する */
function renderGroups() {
  elGroupContainer.innerHTML = "";

  if (!allRows.length) {
    const p = document.createElement("p");
    p.className = "muted emptyHint";
    p.textContent = "データがありません。右上の「新規行を追加」から登録できます。";
    elGroupContainer.appendChild(p);
    return;
  }

  // symbol ごとにまとめる (記号:[]),(記号:[]),...という形のmapにしてる
  const bySymbol = groupBySymbol(allRows);
  //記号はあいうえお順にしてる
  const symbols = [...bySymbol.keys()].sort((a, b) => a.localeCompare(b, "ja"));

  // 記号ごとにテーブル作成処理
  for (const sym of symbols) {
    //mapの内容に入ってた[]を取り出す
    const rowsInGroup = getSortedRows(sym, bySymbol.get(sym));

    const section = document.createElement("section");
    section.className = "groupBlock";
    section.setAttribute("data-symbol", sym);

    const titleRow = document.createElement("div");
    titleRow.className = "groupTitleRow";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "groupToggle";
    toggleBtn.textContent = "ー";
    toggleBtn.setAttribute("aria-expanded", "true");
    toggleBtn.setAttribute("aria-label", "テーブルの表示を切り替え");

    const title = document.createElement("h2");
    title.className = "groupTitle";
    title.textContent = sym || "（記号なし）";

    const count = document.createElement("span");
    count.className = "groupCount";
    count.textContent = `${rowsInGroup.length}件`;

    const innerWrap = document.createElement("div");
    innerWrap.className = "tableWrap groupTableWrap";

    const table = document.createElement("table");
    table.className = "grid";

    toggleBtn.addEventListener("click", () => {
      const collapsed = table.classList.toggle("isCollapsed");
      toggleBtn.textContent = collapsed ? "＋" : "ー";
      toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });

    const thead = document.createElement("thead");
    thead.appendChild(createHeaderRow());

    //1行ずつ作成
    const tbody = document.createElement("tbody");
    for (const row of rowsInGroup) {
      const tr = document.createElement("tr");
      tr.dataset.id = row["id"];
      appendCells(tr, row);
      tbody.appendChild(tr);
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    innerWrap.appendChild(table);
    titleRow.appendChild(toggleBtn);
    titleRow.appendChild(title);
    titleRow.appendChild(count);
    section.appendChild(titleRow);
    section.appendChild(innerWrap);
    elGroupContainer.appendChild(section);

    //カラム名行のソートマークの表示
    updateHeaderSortMark(sym, thead);

  }
}

//DBデータ取得以外の描画処理※ソートから使用
function rerenderWithSort() {
  renderGroups();
}

/** 毎回呼ばれる最初の処理 */
async function fetchMaterials() {
  setStatus("読み込み中...");
  btnRefresh.disabled = true;

  try {
    //DBからデータ取得
    const { data, error } = await supabase
      .from(TABLE)
      .select("id,symbol,diameter,thickness,coating_type,quantity,updated_at")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    //画面表示
    allRows = data || [];
    rerenderWithSort();
    setStatus("");
  } catch (e) {
    console.error(e);
    setStatus(`エラー: ${e.message || e}`, "error");
    allRows = [];
    renderGroups();
  } finally {
    btnRefresh.disabled = false;
  }
}

/** 新規登録ダイアログ関連の処理 */

function openAddDialog() {
  if (!dialogAdd) return;
  formAdd.reset();
  dialogAdd.showModal();
  const first = formAdd.querySelector("select[name='symbol']");
  if (first) first.focus();
}

function closeAddDialog() {
  formAdd.reset();
  dialogAdd.close();
}

function normalizeIntegerText(text) {
  // 全角数字を半角へ
  const half = String(text || "").replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  // 数字以外を削除（小数点も削除）
  return half.replace(/[^0-9]/g, "");
}

function readNumber(formData, name) {
  const raw = formData.get(name);
  const n = Number.parseInt(String(raw), 10);
  if (Number.isNaN(n)) return null;
  return n;
}

async function insertMaterial(payload) {
  setStatus("登録中...");
  btnSubmitAdd.disabled = true;
  btnAddRow.disabled = true;

  try {
    const { error } = await supabase.from(TABLE).insert(payload);
    if (error) throw error;

    setStatus("登録しました。再読み込みします...");
    dialogAdd.close();
    await fetchMaterials();
  } catch (e) {
    console.error(e);
    setStatus(`登録エラー: ${e.message || e}`, "error");
  } finally {
    btnSubmitAdd.disabled = false;
    btnAddRow.disabled = false;
  }
}

btnRefresh.addEventListener("click", () => {
  fetchMaterials();
});

/** カラム名が押下された場合の処理 */
elGroupContainer.addEventListener("click", (e) => {
  const btn = e.target.closest(".thBtn");
  if (!btn || !elGroupContainer.contains(btn)) return;

  const th = btn.closest("th[data-key]");
  if (!th) return;

  // どの記号(section)のthが押されたかを取得
  const section = th.closest("section[data-symbol]");
  const symbol = section ? section.dataset.symbol : undefined;
  if (symbol === undefined) return;

  const key = th.dataset.key;
  if (!key) return;

  //symbolごと、カラムごとにソート状態を設定
  const current = sortStateBySymbol[symbol] || { key: null, direction: "none" };
  let newSortState;
  if (current.key !== key) {
    newSortState = { key, direction: "asc" };
  } else if (current.direction === "asc") {
    newSortState = { key, direction: "desc" };
  } else if (current.direction === "desc") {
    newSortState = { key, direction: "none" };
  } else {
    newSortState = { key, direction: "asc" };
  }

  sortStateBySymbol[symbol] = newSortState;


  rerenderWithSort();
});

btnAddRow.addEventListener("click", () => {
  openAddDialog();
});

btnDialogCancel.addEventListener("click", () => {
  closeAddDialog();
});

dialogAdd.addEventListener("close", () => {
  formAdd.reset();
});

for (const input of numericInputs) {
  input.addEventListener("input", (ev) => {
    const next = normalizeIntegerText(ev.target.value);
    ev.target.value = next;
  });
}

formAdd.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const fd = new FormData(formAdd);
  const payload = {
    symbol: String(fd.get("symbol") || "").trim(),
    diameter: readNumber(fd, "diameter"),
    thickness: readNumber(fd, "thickness"),
    coating_type: String(fd.get("coating_type") || "").trim() || null,
    quantity: readNumber(fd, "quantity"),
  };

  if (!payload.symbol) {
    setStatus("symbol は必須です。", "error");
    return;
  }
  if (payload.diameter === null || payload.thickness === null || payload.quantity === null) {
    setStatus("diameter / thickness / quantity は数値で入力してください。", "error");
    return;
  }

  await insertMaterial(payload);
});

/** 初期化 ここからスタート */
fetchMaterials();
