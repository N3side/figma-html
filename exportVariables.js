async function exportStructuredVariables() {
  console.log("Собираем структурированный список переменных для ИИ...");

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();
  const finalStructure = {};

  // Функция для безопасного перевода цвета Figma RGB(A) в HEX
  function rgbToHex(rawValue) {
    if (!rawValue || typeof rawValue !== 'object' || !('r' in rawValue)) return null;
    const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
    const a = rawValue.a !== undefined ? Math.round(rawValue.a * 255).toString(16).padStart(2, '0') : '';
    return `#${toHex(rawValue.r)}${toHex(rawValue.g)}${toHex(rawValue.b)}${a === 'ff' ? '' : a}`;
  }

  // Рекурсивный поиск финального значения (разрешение Alias)
  async function resolveValue(value, modeId) {
    if (value && value.type === 'VARIABLE_ALIAS') {
      try {
        const aliasVar = await figma.variables.getVariableByIdAsync(value.id);
        if (aliasVar) {
          const parentValue = aliasVar.valuesByMode[modeId];
          return await resolveValue(parentValue, modeId);
        }
      } catch (e) {
        return "Linked Variable Error";
      }
    }

    const hex = rgbToHex(value);
    if (hex) return hex;
    return value;
  }

  // Проходим по каждой коллекции (это ваш VARIANT_NAME верхнего уровня)
  for (const collection of collections) {
    const collectionName = collection.name; // Например: "Colors", "Sizes"
    finalStructure[collectionName] = {};

    // Инициализируем режимы внутри коллекции (переводим в нижний регистр для единообразия)
    for (const mode of collection.modes) {
      const modeKey = mode.name.toLowerCase(); // "light", "dark"
      finalStructure[collectionName][modeKey] = {};
    }

    // Находим все переменные, принадлежащие этой коллекции
    const collectionVariables = variables.filter(v => v.variableCollectionId === collection.id);

    for (const variable of collectionVariables) {
      for (const mode of collection.modes) {
        const modeKey = mode.name.toLowerCase();
        const rawValue = variable.valuesByMode[mode.modeId];
        const finalValue = await resolveValue(rawValue, mode.modeId);

        // Записываем: "КОЛЛЕКЦИЯ": { "режим": { "имя_переменной": значение } }
        finalStructure[collectionName][modeKey][variable.name] = finalValue;
      }
    }
  }

  console.log("=== СКОПИРУЙТЕ СТРУКТУРИРОВАННЫЙ JSON ДЛЯ ИИ ===");
  console.log(JSON.stringify(finalStructure, null, 2));
}

// Запуск
exportStructuredVariables();