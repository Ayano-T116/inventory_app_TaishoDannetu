// import { updateItem } from "../db.js";
import { helpers } from "../utils/helpers.js";
import { state, useState } from "../utils/state.js";
import { createQuantityChangeData, updateMaterialsQuantity } from "../services/materialService.js";

export function initQuantityDialog({
    dialogQuantityChange,
    quantityChangeListBody,
    quantityChangeSummary,
    btnQuantityChangeOk,
    btnQuantityChangeCancel,
    btnAddRow,
    btnDelete,
    btnRefresh,
    setStatus,
    fetchMaterials,
}) {

    /** 数量変更ダイアログ関連 */

    // ダイアログを開く関数
    function openQuantityChangeDialog() {
        if (!dialogQuantityChange || !quantityChangeListBody) return;
        if (!state.quantityChanges.length) return;

        const items = createQuantityChangeData(state.allRows, state.quantityChanges);

        quantityChangeListBody.innerHTML = "";
        if (quantityChangeSummary) {
            quantityChangeSummary.textContent = `${items.length}件の数量を変更します。よろしいですか？`;
        }

        for (const item of items) {
            const tr = document.createElement("tr");
            const tdMat = document.createElement("td");
            tdMat.textContent = `${helpers.formatMaterialText(item.row)}`;
            const tdQty = document.createElement("td");
            tdQty.className = "num";
            tdQty.textContent = `${item.before} → ${item.after}`;
            tr.appendChild(tdMat);
            tr.appendChild(tdQty);
            quantityChangeListBody.appendChild(tr);
        }
        dialogQuantityChange.showModal();
    }


    // ダイアログを閉じる関数
    function closeQuantityChangeDialog() {
        if (!dialogQuantityChange) return;
        dialogQuantityChange.close();
    }


    // 数量変更を更新する関数
    async function updateQuantities() {
        setStatus("数量を更新中...");

        if (btnQuantityChangeOk) btnQuantityChangeOk.disabled = true;
        if (btnQuantityChangeCancel) btnQuantityChangeCancel.disabled = true;
        if (btnDelete) btnDelete.disabled = true;
        if (btnAddRow) btnAddRow.disabled = true;
        if (btnRefresh) btnRefresh.disabled = true;

        try {
            await updateMaterialsQuantity(state.allRows, state.quantityChanges);
            btnRefresh.disabled = useState.clearQuantityChanges();
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
            if (btnRefresh) btnRefresh.disabled = useState.updateRefreshButtonState();
            if (btnDelete) btnDelete.disabled = useState.updateDeleteButtonState();
        }
    }

    
    /**イベントリスナーの設定*/

    // フォームの送信イベント
    if (formQuantityChange) {
        formQuantityChange.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            if (!state.quantityChanges.length) return;
            await updateQuantities();
        });
    }

    // キャンセルボタンのクリックイベント
    if (btnQuantityChangeCancel) {
        btnQuantityChangeCancel.addEventListener("click", () => {
            // キャンセル時はデータ更新・再描画しない
            closeQuantityChangeDialog();
        });
    }

    return {
        openQuantityChangeDialog,
    };

}