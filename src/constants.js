const ALLERGY_NAMES = {
  1: "난류",
  2: "우유",
  3: "메밀",
  4: "땅콩",
  5: "대두",
  6: "밀",
  7: "고등어",
  8: "게",
  9: "새우",
  10: "돼지고기",
  11: "복숭아",
  12: "토마토",
  13: "아황산류",
  14: "호두",
  15: "닭고기",
  16: "쇠고기",
  17: "오징어",
  18: "조개류",
  19: "잣",
};

const MEAL_TYPE_BY_CODE = {
  "1": "breakfast",
  "2": "lunch",
  "3": "dinner",
};

const MEAL_TYPE_LABEL = {
  breakfast: "조식",
  lunch: "중식",
  dinner: "석식",
};

const DEFAULT_SPECIAL_OPTIONS = [
  { id: "malatang", label: "마라탕 & 꿔바로우" },
  { id: "rose_chicken", label: "로제찜닭 & 주먹밥" },
  { id: "katsu", label: "수제 돈까스 정식" },
];

module.exports = {
  ALLERGY_NAMES,
  MEAL_TYPE_BY_CODE,
  MEAL_TYPE_LABEL,
  DEFAULT_SPECIAL_OPTIONS,
};
