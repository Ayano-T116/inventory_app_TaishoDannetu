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
const btnDelete = document.getElementById("btnDelete");
const btnAddRow = document.getElementById("btnAddRow");
const dialogAdd = document.getElementById("dialogAdd");
const formAdd = document.getElementById("formAdd");
const btnSubmitAdd = document.getElementById("btnSubmitAdd");
const btnDialogCancel = document.getElementById("btnDialogCancel");
const dialogDelete = document.getElementById("dialogDelete");
const formDelete = document.getElementById("formDelete");
const deleteSummary = document.getElementById("deleteSummary");
const deleteListBody = document.getElementById("deleteListBody");
const btnDeleteCancel = document.getElementById("btnDeleteCancel");
const btnDeleteOk = document.getElementById("btnDeleteOk");
const dialogQuantityChange = document.getElementById("dialogQuantityChange");
const formQuantityChange = document.getElementById("formQuantityChange");
const quantityChangeSummary = document.getElementById("quantityChangeSummary");
const quantityChangeListBody = document.getElementById("quantityChangeListBody");
const btnQuantityChangeCancel = document.getElementById("btnQuantityChangeCancel");
const btnQuantityChangeOk = document.getElementById("btnQuantityChangeOk");
const numericInputs = Array.from(
  formAdd.querySelectorAll("input[name='diameter'], input[name='thickness'], input[name='quantity']")
);
const selectSymbol = document.getElementById("selectSymbol");

let allRows = [];
let sortStateBySymbol = {};
let checkedIds = [];
// 数量編集の未保存変更（行id + 変更後quantity）
let quantityChanges = [];

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

function toId(value) {
  return value === null || value === undefined ? "" : String(value);
}

function isChecked(id) {
  const sid = toId(id);
  return !!sid && checkedIds.includes(sid);
}

function setChecked(id, nextChecked) {
  const sid = toId(id);
  if (!sid) return;
  if (nextChecked) {
    if (!checkedIds.includes(sid)) checkedIds = [...checkedIds, sid];
  } else {
    checkedIds = checkedIds.filter((x) => x !== sid);
  }
}

function updateDeleteButtonState() {
  if (!btnDelete) return;
  btnDelete.disabled = checkedIds.length === 0;
}

function updateRefreshButtonState() {
  if (!btnRefresh) return;
  btnRefresh.disabled = quantityChanges.length === 0;
}

function getQuantityChange(id) {
  const sid = toId(id);
  if (!sid) return null;
  return quantityChanges.find((x) => x.id === sid) || null;
}

function setQuantityChange(id, quantity) {
  const sid = toId(id);
  if (!sid) return;
  quantityChanges = quantityChanges.filter((x) => x.id !== sid);
  if (quantity == null) {
    updateRefreshButtonState();
    return;
  }
  quantityChanges = [...quantityChanges, { id: sid, quantity: Number(quantity) }];
  updateRefreshButtonState();
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
function createHeaderRow(sym) {
  const tr = document.createElement("tr");

  const thCheck = document.createElement("th");
  thCheck.className = "checkCell";
  thCheck.setAttribute("aria-label", "選択");
  thCheck.textContent = "選択";
  tr.appendChild(thCheck);

  for (const col of COLUMNS) {
    const th = document.createElement("th");
    th.dataset.key = col.key;
    if (col.align === "num") th.classList.add("num");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = col.align === "num" ? "thBtn thBtnNum" : "thBtn";

    const labelSpan = document.createElement("span");
    if (col.key === "diameter" ) {
      labelSpan.textContent = selectSymbols.find((item) => item.value === sym)?.diameterLabel;
    }else{
      labelSpan.textContent = col.label;
    }
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

  const tdCheck = document.createElement("td");
  tdCheck.className = "checkCell";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "rowCheck";
  cb.checked = isChecked(row["id"]);
  cb.setAttribute("aria-label", "この行を選択");
  cb.dataset.id = toId(row["id"]);
  tdCheck.appendChild(cb);
  tr.appendChild(tdCheck);

  for (const col of COLUMNS) {
    const td = document.createElement("td");
    td.classList.add("cell");
    td.tabIndex = 0;
    if (col.align === "num") td.classList.add("num");
    if (col.key === "quantity") td.dataset.editable = "quantity";

    //更新日時を整形する
    const v = formatValue(col.key, row[col.key]);

    if (col.key === "diameter" || col.key === "thickness") {
      const wrap = document.createElement("div");
      wrap.className = "unitCell";
      const valueSpan = document.createElement("span");
      valueSpan.textContent = v;
      const unitSpan = document.createElement("span");
      unitSpan.className = "unit";
      if (col.key === "diameter") {
        unitSpan.textContent = selectSymbols.find((item) => item.value === row.symbol)?.diameterSuffix || "A";
      }else{
        unitSpan.textContent = "t";
      }
      wrap.appendChild(valueSpan);
      wrap.appendChild(unitSpan);
      td.appendChild(wrap);
    } else if (col.key === "quantity") {
      const pending = getQuantityChange(row.id);
      if (pending) td.classList.add("cellQuantityChanged");
      td.textContent = pending ? String(pending.quantity) : v;
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
    thead.appendChild(createHeaderRow(sym));

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
  if (btnDelete) btnDelete.disabled = true;

  try {
    //DBからデータ取得
    const { data, error } = await supabase
      .from(TABLE)
      .select("id,symbol,diameter,thickness,coating_type,quantity,updated_at")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    //画面表示
    allRows = data || [];
    // 既に存在しないIDは除外（削除後など）
    const existing = new Set(allRows.map((r) => toId(r.id)));
    checkedIds = checkedIds.filter((id) => existing.has(id));
    quantityChanges = quantityChanges.filter((c) =>
      existing.has(toId(c.id))
    );
    updateDeleteButtonState();
    updateRefreshButtonState();
    rerenderWithSort();
    setStatus("");
  } catch (e) {
    console.error(e);
    setStatus(`エラー: ${e.message || e}`, "error");
    allRows = [];
    renderGroups();
  } finally {
    updateRefreshButtonState();
    updateDeleteButtonState();
  }
}

/** 新規登録ダイアログ関連の処理 */

const selectSymbols = [
  {value: "", label: "選択してください", diameterLabel: "口径", diameterSuffix: "A"},
  {value: "GW", label: "GW", diameterLabel: "口径", diameterSuffix: "A"},
  {value: "RW", label: "RW", diameterLabel: "口径", diameterSuffix: "A"},
  {value: "スチロール", label: "スチロール", diameterLabel: "口径", diameterSuffix: "A"},
  {value: "GWロール", label: "GWロール", diameterLabel: "密度", diameterSuffix: "k"},
  {value: "RWロール", label: "RWロール", diameterLabel: "密度", diameterSuffix: "k"},
];

function openAddDialog() {
  if (!dialogAdd) return;
  formAdd.reset();
  dialogAdd.showModal();
  createSymbolOptions();
  const first = formAdd.querySelector("select[name='symbol']");
  if (first) first.focus();
}

function closeAddDialog() {
  formAdd.reset();
  dialogAdd.close();
}

function createSymbolOptions() {
  const select = document.querySelector("select[name='symbol']");
  if (!select) return;
  selectSymbols.forEach(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
}

function createDiameterTexts(symbol) {
  const diameterLabel = document.getElementById("diameterLabel");
  const diameterSuffix = document.getElementById("diameterSuffix");
  const texts = selectSymbols.find(({ value }) => value === symbol);
  diameterLabel.textContent = texts.diameterLabel;
  diameterSuffix.textContent = texts.diameterSuffix;
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
  if (btnDelete) btnDelete.disabled = true;

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
    updateDeleteButtonState();
    updateRefreshButtonState();
  }
}

function formatMaterialText(row) {
  const sym = String(row.symbol || "").trim();
  const d = row.diameter == null ? "" : `${row.diameter}A`;
  const t = row.thickness == null ? "" : `${row.thickness}t`;
  const c = String(row.coating_type || "").trim();
  const dt = `${d}${t}`.trim();
  const left = [sym, dt].filter(Boolean).join(" ").trim();
  return [left, c].filter(Boolean).join(" ").trim();
}

/** 削除ダイアログ関連の処理 */

function openDeleteDialog() {
  if (!dialogDelete || !deleteListBody) return;
  if (!checkedIds.length) return;

  const selected = allRows.filter((r) => checkedIds.includes(toId(r.id)));
  deleteListBody.innerHTML = "";

  if (deleteSummary) deleteSummary.textContent = `${selected.length}件を削除します。よろしいですか？`;

  for (const row of selected) {
    const tr = document.createElement("tr");
    const tdMat = document.createElement("td");
    tdMat.textContent = formatMaterialText(row);
    const tdQty = document.createElement("td");
    tdQty.className = "num";
    const pending = getQuantityChange(row.id);
    tdQty.textContent = pending
      ? String(pending.quantity)
      : row.quantity == null
        ? ""
        : String(row.quantity);
    tr.appendChild(tdMat);
    tr.appendChild(tdQty);
    deleteListBody.appendChild(tr);
  }

  dialogDelete.showModal();
}

function closeDeleteDialog() {
  if (!dialogDelete) return;
  dialogDelete.close();
}

async function deleteMaterialsByIds(ids) {
  if (!ids.length) return;
  setStatus("削除中...");
  if (btnDeleteOk) btnDeleteOk.disabled = true;
  if (btnDeleteCancel) btnDeleteCancel.disabled = true;
  if (btnDelete) btnDelete.disabled = true;
  if (btnAddRow) btnAddRow.disabled = true;
  if (btnRefresh) btnRefresh.disabled = true;

  try {
    const { error } = await supabase.from(TABLE).delete().in("id", ids);
    if (error) throw error;

    checkedIds = [];
    closeDeleteDialog();
    await fetchMaterials();
  } catch (e) {
    console.error(e);
    setStatus(`削除エラー: ${e.message || e}`, "error");
  } finally {
    if (btnDeleteOk) btnDeleteOk.disabled = false;
    if (btnDeleteCancel) btnDeleteCancel.disabled = false;
    updateDeleteButtonState();
    if (btnAddRow) btnAddRow.disabled = false;
    updateRefreshButtonState();
  }
}

/** 数量変更ダイアログ関連の処理 */

function closeQuantityChangeDialog() {
  if (!dialogQuantityChange) return;
  dialogQuantityChange.close();
}

function openQuantityChangeDialog() {
  if (!dialogQuantityChange || !quantityChangeListBody) return;
  if (!quantityChanges.length) return;

  const items = quantityChanges
    .map((ch) => {
      const row = allRows.find((r) => toId(r.id) === ch.id);
      if (!row) return null;
      return {
        row,
        before: row.quantity == null ? "" : String(row.quantity),
        after: String(ch.quantity),
      };
    })
    .filter(Boolean);

  quantityChangeListBody.innerHTML = "";
  if (quantityChangeSummary) {
    quantityChangeSummary.textContent = `${items.length}件の数量を変更します。よろしいですか？`;
  }

  for (const item of items) {
    const tr = document.createElement("tr");
    const tdMat = document.createElement("td");
    tdMat.textContent = `${formatMaterialText(item.row)}`;
    const tdQty = document.createElement("td");
    tdQty.className = "num";
    tdQty.textContent = `${item.before} → ${item.after}`;
    tr.appendChild(tdMat);
    tr.appendChild(tdQty);
    quantityChangeListBody.appendChild(tr);
  }

  dialogQuantityChange.showModal();
}

async function updateQuantities() {
  if (!quantityChanges.length) return;
  setStatus("数量を更新中...");

  if (btnQuantityChangeOk) btnQuantityChangeOk.disabled = true;
  if (btnQuantityChangeCancel) btnQuantityChangeCancel.disabled = true;
  if (btnDelete) btnDelete.disabled = true;
  if (btnAddRow) btnAddRow.disabled = true;
  if (btnRefresh) btnRefresh.disabled = true;

  try {
    const existing = new Set(allRows.map((r) => toId(r.id)));
    const payload = quantityChanges
      .filter((c) => existing.has(toId(c.id)))
      .map(({ id, quantity }) => ({
        id,
        quantity,
      }));

    if (!payload.length) {
      setStatus("更新対象が見つかりません。", "error");
      return;
    }

    quantityChanges = quantityChanges.filter((c) =>
      existing.has(toId(c.id))
    );


    for(const pl of payload){
      
      const { error } = await supabase
      .from(TABLE)
      .update(pl)
      .eq('id', pl.id);

    if (error) throw error;
    }

    quantityChanges = [];
    closeQuantityChangeDialog();
    await fetchMaterials();
    setStatus("");
  } catch (e) {
    console.error(e);
    setStatus(`更新エラー: ${e.message || e}`, "error");
  } finally {
    if (btnQuantityChangeOk) btnQuantityChangeOk.disabled = false;
    if (btnQuantityChangeCancel) btnQuantityChangeCancel.disabled = false;
    if (btnAddRow) btnAddRow.disabled = false;
    if (btnRefresh) updateRefreshButtonState();
    if (btnDelete) updateDeleteButtonState();
  }
}

function openQuantityCellEditor(td, row) {
  if (!td || !row) return;

  const id = toId(row.id);
  const original =
    row.quantity == null ? null : Number.parseInt(String(row.quantity), 10);
  const pending = getQuantityChange(row.id);
  const start = pending ? pending.quantity : original;
  const fixedWidth = `${Math.ceil(td.getBoundingClientRect().width)}px`;
  td.style.width = fixedWidth;
  td.style.minWidth = fixedWidth;
  td.style.maxWidth = fixedWidth;

  const restoreCellWidth = () => {
    td.style.width = "";
    td.style.minWidth = "";
    td.style.maxWidth = "";
  };

  td.innerHTML = "";

  const input = document.createElement("input");
  input.className = "quantityEditor";
  input.type = "text";
  input.setAttribute("inputmode", "numeric");
  input.autocomplete = "off";
  input.value = start == null ? "" : String(start);

  td.appendChild(input);
  input.focus();
  input.select();

  const setCellChangedClass = (isChanged) => {
    td.classList.toggle("cellQuantityChanged", isChanged);
  };

  const syncStateFromValue = () => {
    const normalized = normalizeIntegerText(input.value);
    if (input.value !== normalized) input.value = normalized;

    if (normalized === "") {
      setQuantityChange(id, null);
      setCellChangedClass(false);
      return;
    }

    const next = Number.parseInt(normalized, 10);
    if (Number.isNaN(next)) {
      setQuantityChange(id, null);
      setCellChangedClass(false);
      return;
    }

    if (original != null && next === original) {
      setQuantityChange(id, null);
      setCellChangedClass(false);
      return;
    }

    setQuantityChange(id, next);
    setCellChangedClass(true);
  };

  input.addEventListener("input", () => {
    syncStateFromValue();
  });

  let committed = false;
  const commitAndExit = () => {
    if (committed) return;
    committed = true;

    const normalized = normalizeIntegerText(input.value);

    if (normalized === "") {
      setQuantityChange(id, null);
      setCellChangedClass(false);
      td.innerHTML = "";
      td.textContent = original == null ? "" : String(original);
      restoreCellWidth();
      return;
    }

    const next = Number.parseInt(normalized, 10);
    const isOriginal = original != null && next === original;

    if (isOriginal) {
      setQuantityChange(id, null);
      setCellChangedClass(false);
    } else {
      setQuantityChange(id, next);
      setCellChangedClass(true);
    }

    td.innerHTML = "";
    td.textContent = isOriginal
      ? original == null
        ? ""
        : String(original)
      : String(next);
    restoreCellWidth();
  };

  input.addEventListener("blur", commitAndExit);

  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      input.blur();
      return;
    }

    if (ev.key === "Escape") {
      ev.preventDefault();
      committed = true;

      const revert = start;
      const revertIsOriginal = original != null && revert === original;

      if (revertIsOriginal || revert == null) {
        setQuantityChange(id, null);
        setCellChangedClass(false);
        td.innerHTML = "";
        td.textContent = original == null ? "" : String(original);
        restoreCellWidth();
      } else {
        setQuantityChange(id, revert);
        setCellChangedClass(true);
        td.innerHTML = "";
        td.textContent = String(revert);
        restoreCellWidth();
      }
    }
  });
}

/** イベント系 */

btnRefresh.addEventListener("click", async () => {
  const activeEditor = elGroupContainer.querySelector("input.quantityEditor");
  if (activeEditor) activeEditor.blur();

  if (quantityChanges.length) {
    openQuantityChangeDialog();
    return;
  }
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

// 行チェックON/OFF
elGroupContainer.addEventListener("change", (e) => {
  const cb = e.target.closest("input.rowCheck");
  if (!cb || !elGroupContainer.contains(cb)) return;
  const id = cb.dataset.id;
  setChecked(id, cb.checked);
  updateDeleteButtonState();
});

// 数量セルのクリックで編集inputへ置換
elGroupContainer.addEventListener("click", (e) => {
  const td = e.target.closest("td[data-editable='quantity']");
  if (!td || !elGroupContainer.contains(td)) return;
  if (td.querySelector("input.quantityEditor")) return;

  const tr = td.closest("tr[data-id]");
  if (!tr) return;

  const id = toId(tr.dataset.id);
  const row = allRows.find((r) => toId(r.id) === id);
  if (!row) return;

  openQuantityCellEditor(td, row);
  updateRefreshButtonState();
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

if (btnDelete) {
  btnDelete.addEventListener("click", () => {
    if (!checkedIds.length) return;
    openDeleteDialog();
  });
}

if (btnDeleteCancel) {
  btnDeleteCancel.addEventListener("click", () => {
    // キャンセル時はチェック状態を維持し、再描画もしない
    closeDeleteDialog();
  });
}

if (formDelete) {
  formDelete.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!checkedIds.length) return;
    await deleteMaterialsByIds([...checkedIds]);
  });
}

if (btnQuantityChangeCancel) {
  btnQuantityChangeCancel.addEventListener("click", () => {
    // キャンセル時はデータ更新・再描画しない
    closeQuantityChangeDialog();
  });
}

if (formQuantityChange) {
  formQuantityChange.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!quantityChanges.length) return;
    await updateQuantities();
  });
}

selectSymbol.addEventListener("change", (ev) => {
  createDiameterTexts(ev.target.value);
});

/** 初期化 ここからスタート */
updateDeleteButtonState();
updateRefreshButtonState();
fetchMaterials();
