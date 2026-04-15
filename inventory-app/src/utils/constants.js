
export const TABLE = "materials";

export const ENV = import.meta.env.VITE_ENV || "";

export const prodMessage = "大正断熱専用です。部外者は触るんじゃねぇ。";
export const devMessage = "デモバージョンです。ご自由に操作ください。"; 

export const COLUMNS = [
  { label: "口径", key: "diameter" },
  { label: "厚み", key: "thickness" },
  { label: "表被仕様", key: "coating_type" },
  { label: "数量", key: "quantity", align: "num" },
  { label: "更新日", key: "updated_at" },
];

export const selectSymbols = [
  {value: "", label: "選択してください", diameterLabel: "口径", diameterSuffix: "A"},
  {value: "GW", label: "GW", diameterLabel: "口径", diameterSuffix: "A"},
  {value: "RW", label: "RW", diameterLabel: "口径", diameterSuffix: "A"},
  {value: "スチロール", label: "スチロール", diameterLabel: "口径", diameterSuffix: "A"},
  {value: "GWロール", label: "GWロール", diameterLabel: "密度", diameterSuffix: "k"},
  {value: "RWロール", label: "RWロール", diameterLabel: "密度", diameterSuffix: "k"},
];