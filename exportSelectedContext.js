async function exportAllSelectedScreensContext() {
  // Получаем массив всех выделенных элементов
  const selectedNodes = figma.currentPage.selection;
  if (!selectedNodes || selectedNodes.length === 0) {
    console.error("Пожалуйста, выделите один или несколько фреймов перед запуском скрипта!");
    return;
  }

  console.log(`Анализируем выделенные элементы (${selectedNodes.length} шт.)...`);
  const usedVariables = new Set();
  const usedStyles = new Set();

  // Вспомогательная функция сбора токенов цвета
  async function checkPaintVars(paints, styleId) {
    if (paints && paints.length > 0) {
      // Проверяем первый слой заливки/обводки
      const paint = paints[0];
      if (paint && paint.type === 'SOLID') {
        if (paint.boundVariables && paint.boundVariables.color) {
          usedVariables.add(paint.boundVariables.color.id);
        } else if (styleId) {
          usedStyles.add(styleId);
        }
      }
    }
  }

  // Рекурсивный парсер дерева слоев
  async function scanAndParse(node, parentX = 0, parentY = 0) {
    if (!node || node.visible === false) return null;
    if (["VECTOR", "BOOLEAN_OPERATION", "SHAPE_WITH_TEXT"].includes(node.type)) return null;

    const localX = node.x !== undefined ? Math.round(node.x - parentX) : 0;
    const localY = node.y !== undefined ? Math.round(node.y - parentY) : 0;

    const result = { name: node.name, type: node.type, pos: `${localX},${localY}` };
    if (node.width && node.height) result.size = `${Math.round(node.width)}x${Math.round(node.height)}`;

    // Собираем цвета
    if (node.fills) await checkPaintVars(node.fills, node.fillStyleId);
    if (node.strokes) await checkPaintVars(node.strokes, node.strokeStyleId);

    if (node.type === "TEXT") {
      result.text = node.characters.substring(0, 40).replace(/\s+/g, ' ');
      if (node.textStyleId) usedStyles.add(node.textStyleId);
      if (node.boundVariables && node.boundVariables.characters) usedVariables.add(node.boundVariables.characters.id);
    }

    if (node.type === "INSTANCE") {
      result.isComp = true;
      const mainComp = await node.getMainComponentAsync();
      result.comp = mainComp ? mainComp.name : "Unknown";
      return result;
    }

    // Собираем Auto Layout данные
    if (node.layoutMode && node.layoutMode !== "NONE") {
      result.flex = {
        dir: node.layoutMode === "HORIZONTAL" ? "row" : "col",
        gap: node.itemSpacing || 0,
        pad: `${node.paddingTop || 0}px ${node.paddingRight || 0}px ${node.paddingBottom || 0}px ${node.paddingLeft || 0}px`,
        align: node.counterAxisAlignItems,
        dist: node.primaryAxisAlignItems
      };
    }

    if (node.children) {
      const currentX = node.x !== undefined ? node.x : parentX;
      const currentY = node.y !== undefined ? node.y : parentY;
      const childPromises = node.children.map(child => scanAndParse(child, currentX, currentY));
      const resolvedChildren = await Promise.all(childPromises);
      const filtered = resolvedChildren.filter(c => c !== null);
      if (filtered.length > 0) result.children = filtered;
    }

    return result;
  }

  // 1. Сканируем все выделенные элементы параллельно
  const screenPromises = selectedNodes.map(node => scanAndParse(node, node.x, node.y));
  const parsedScreens = await Promise.all(screenPromises);
  const filteredScreens = parsedScreens.filter(s => s !== null);

  // 2. Вытаскиваем значения только собранных переменных и стилей
  const flatTokens = { light: {}, dark: {}, textStyles: {} };

  for (const varId of usedVariables) {
    try {
      const v = await figma.variables.getVariableByIdAsync(varId);
      if (v) {
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const col = collections.find(c => c.id === v.variableCollectionId);
        if (col) {
          for (const mode of col.modes) {
            const mName = mode.name.toLowerCase().includes("dark") ? "dark" : "light";
            let val = v.valuesByMode[mode.modeId];
            if (val && typeof val === 'object' && 'r' in val) {
              const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
              val = `#${toHex(val.r)}${toHex(val.g)}${toHex(val.b)}`;
            }
            flatTokens[mName][v.name] = val;
          }
        }
      }
    } catch (e) { }
  }

  for (const styleId of usedStyles) {
    try {
      const s = await figma.getStyleByIdAsync(styleId);
      if (s && s.type === "TEXT") {
        flatTokens.textStyles[s.name] = {
          fontSize: `${s.fontSize}px`,
          fontFamily: s.fontName.family,
          fontWeight: s.fontName.style.toLowerCase()
        };
      } else if (s && s.type === "PAINT" && s.paints && s.paints[0]?.type === 'SOLID') {
        const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
        const color = s.paints[0].color;
        flatTokens.light[s.name] = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
      }
    } catch (e) { }
  }

  const finalContext = {
    screens: filteredScreens,
    dictionary: flatTokens
  };

  console.log("=== СКОПИРУЙТЕ ДАННЫЕ ВСЕХ ВЫДЕЛЕННЫХ ЭКРАНОВ ДЛЯ ИИ ===");
  console.log(JSON.stringify(finalContext));
}

// Запуск
exportAllSelectedScreensContext();