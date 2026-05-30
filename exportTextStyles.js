async function exportTextStylesWithMapping() {
  const styles = await figma.getLocalTextStylesAsync();
  const mapping = {};

  for (const style of styles) {
    // Получаем базовые параметры шрифта
    const fontFamily = style.fontName ? style.fontName.family : "Unknown Font";
    const fontWeight = style.fontName ? style.fontName.style : "Regular";

    // Вспомогательная функция для проверки привязки к переменным
    const getValueOrVariable = async (styleObject, propertyName, fallbackValue) => {
      if (styleObject.boundVariables && styleObject.boundVariables[propertyName]) {
        const variableId = styleObject.boundVariables[propertyName].id;
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        return variable ? `var(--${variable.name.replace(/\//g, '-')})` : fallbackValue;
      }
      return fallbackValue;
    };

    // 1. Считаем Размер шрифта (Font Size)
    const fontSize = await getValueOrVariable(style, 'fontSize', `${style.fontSize}px`);

    // 2. Считаем Межстрочный интервал (Line Height)
    let lineHeight = "normal";
    if (style.lineHeight) {
      if (style.lineHeight.unit === "PIXELS") {
        lineHeight = await getValueOrVariable(style, 'lineHeight', `${style.lineHeight.value}px`);
      } else if (style.lineHeight.unit === "PERCENT") {
        lineHeight = `${Math.round(style.lineHeight.value)}%`;
      }
    }

    // 3. Считаем Межбуквенный интервал (Letter Spacing)
    let letterSpacing = "normal";
    if (style.letterSpacing) {
      if (style.letterSpacing.unit === "PIXELS") {
        letterSpacing = await getValueOrVariable(style, 'letterSpacing', `${style.letterSpacing.value}px`);
      } else if (style.letterSpacing.unit === "PERCENT") {
        letterSpacing = `${style.letterSpacing.value}%`;
      }
    }

    // Собираем объект для ИИ в понятном CSS-подобном формате
    mapping[style.name] = {
      "font-family": fontFamily,
      "font-weight": fontWeight,
      "font-size": fontSize,
      "line-height": lineHeight,
      "letter-spacing": letterSpacing,
      "text-transform": style.textCase === "UPPER" ? "uppercase" : style.textCase === "LOWER" ? "lowercase" : "none"
    };
  }

  console.log(JSON.stringify(mapping, null, 2));
}

exportTextStylesWithMapping();