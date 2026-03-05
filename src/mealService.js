const { ALLERGY_NAMES, MEAL_TYPE_BY_CODE, MEAL_TYPE_LABEL } = require("./constants");

function toDateKey(dateInput) {
  const today = new Date();
  const target = dateInput ? new Date(dateInput) : today;
  if (Number.isNaN(target.getTime())) {
    const fallback = new Date();
    return fallback.toISOString().slice(0, 10);
  }

  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey, offsetDays) {
  const base = new Date(dateKey);
  base.setDate(base.getDate() + offsetDays);
  return toDateKey(base);
}

function toYmd(dateKey) {
  return dateKey.replace(/-/g, "");
}

function cleanDishText(raw) {
  return String(raw || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .trim();
}

function parseNumber(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const match = String(rawValue).match(/([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) {
    return null;
  }

  const normalized = match[1].replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNutrientValue(rawNtrInfo, nutrientName) {
  const cleaned = String(rawNtrInfo || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/\r/g, "");

  const pattern = new RegExp(`${nutrientName}\\s*\\(g\\)\\s*:\\s*([0-9]+(?:[.,][0-9]+)?)`);
  const match = cleaned.match(pattern);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMealNutrition({ calInfo, ntrInfo, mealLabel }) {
  const kcal = parseNumber(calInfo);
  const carbs = parseNutrientValue(ntrInfo, "탄수화물");
  const protein = parseNutrientValue(ntrInfo, "단백질");
  const fat = parseNutrientValue(ntrInfo, "지방");

  if (![kcal, carbs, protein, fat].every((value) => Number.isFinite(value))) {
    return null;
  }

  return {
    kcal,
    carbs,
    protein,
    fat,
    scope: `${mealLabel} 전체 기준`,
  };
}

function parseAllergyNumbers(text) {
  const allergySet = new Set();
  const matches = text.matchAll(/\(([^)]+)\)/g);

  for (const match of matches) {
    const token = match[1].trim();
    if (!/^\d+(\.\d+)*\.?$/.test(token)) {
      continue;
    }

    token
      .split(".")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 1)
      .forEach((value) => allergySet.add(value));
  }

  return [...allergySet].sort((a, b) => a - b);
}

function parseDishLine(line, mealNutrition) {
  const allergies = parseAllergyNumbers(line);
  const name = line
    .replace(/\(([^)]+)\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) {
    return null;
  }

  return {
    name,
    allergies,
    allergyNames: allergies.map((no) => ALLERGY_NAMES[no] || `알레르기${no}`),
    nutrition: mealNutrition,
  };
}

function createEmptyMeals() {
  return {
    breakfast: { mealType: "breakfast", label: MEAL_TYPE_LABEL.breakfast, kcal: null, nutrition: null, items: [] },
    lunch: { mealType: "lunch", label: MEAL_TYPE_LABEL.lunch, kcal: null, nutrition: null, items: [] },
    dinner: { mealType: "dinner", label: MEAL_TYPE_LABEL.dinner, kcal: null, nutrition: null, items: [] },
  };
}

function parseMealRows(rows, dateKey, meta = {}) {
  const meals = createEmptyMeals();

  rows.forEach((row) => {
    const mealType = MEAL_TYPE_BY_CODE[row.MMEAL_SC_CODE];
    if (!mealType) {
      return;
    }

    const mealLabel = meals[mealType].label;
    const mealNutrition = parseMealNutrition({
      calInfo: row.CAL_INFO,
      ntrInfo: row.NTR_INFO,
      mealLabel,
    });

    const dishText = cleanDishText(row.DDISH_NM || "");
    const lines = dishText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    meals[mealType].items = lines.map((line) => parseDishLine(line, mealNutrition)).filter(Boolean);
    meals[mealType].kcal = row.CAL_INFO || null;
    meals[mealType].nutrition = mealNutrition;
  });

  return {
    date: dateKey,
    source: meta.source || "neis",
    resolvedDate: meta.resolvedDate || dateKey,
    meals,
  };
}

function buildNoDataMeals(dateKey, source) {
  return {
    date: dateKey,
    source,
    resolvedDate: null,
    meals: createEmptyMeals(),
  };
}

async function fetchMealRowsByDate({ apiKey, atptCode, schoolCode, dateKey }) {
  const params = new URLSearchParams({
    KEY: apiKey,
    Type: "json",
    pIndex: "1",
    pSize: "100",
    ATPT_OFCDC_SC_CODE: atptCode,
    SD_SCHUL_CODE: schoolCode,
    MLSV_YMD: toYmd(dateKey),
  });

  const endpoint = `https://open.neis.go.kr/hub/mealServiceDietInfo?${params.toString()}`;
  const response = await fetch(endpoint, {
    headers: {
      "User-Agent": "GBSW-Cafeteria-Dashboard/1.0",
    },
  });

  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  const root = json.mealServiceDietInfo;

  if (!Array.isArray(root) || root.length < 2 || !root[1].row) {
    return null;
  }

  return root[1].row;
}

async function fetchMeals({ apiKey, atptCode, schoolCode, date }) {
  const dateKey = toDateKey(date);

  if (!apiKey || !atptCode || !schoolCode) {
    return buildNoDataMeals(dateKey, "config-missing");
  }

  try {
    const directRows = await fetchMealRowsByDate({ apiKey, atptCode, schoolCode, dateKey });
    if (directRows && directRows.length > 0) {
      return parseMealRows(directRows, dateKey, {
        source: "neis",
        resolvedDate: dateKey,
      });
    }

    // 주말/공휴일/학교 일정으로 당일 데이터가 없을 수 있으므로
    // 가까운 제공일 데이터를 공식 API에서 찾아 대체합니다.
    for (let offset = 1; offset <= 45; offset += 1) {
      const candidates = [addDays(dateKey, offset), addDays(dateKey, -offset)];

      for (const candidateDate of candidates) {
        const rows = await fetchMealRowsByDate({ apiKey, atptCode, schoolCode, dateKey: candidateDate });
        if (rows && rows.length > 0) {
          return parseMealRows(rows, dateKey, {
            source: "neis-nearest",
            resolvedDate: candidateDate,
          });
        }
      }
    }

    return buildNoDataMeals(dateKey, "neis-no-data");
  } catch {
    return buildNoDataMeals(dateKey, "neis-error");
  }
}

module.exports = {
  fetchMeals,
  toDateKey,
};
