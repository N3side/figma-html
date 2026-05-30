async function exportStylesWithMapping() {
  const styles = await figma.getLocalPaintStylesAsync();
  const mapping = {};

  for (const style of styles) {
    const paint = style.paints[0];
    if (!paint || paint.type !== 'SOLID') continue;

    let value;

    // 1. Проверяем, привязан ли стиль к переменной
    if (paint.boundVariables && paint.boundVariables.color) {
      const variableId = paint.boundVariables.color.id;
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      value = variable ? variable.name : "Unknown Variable";
    }
    // 2. Если привязки нет, считаем HEX
    else {
      const { r, g, b } = paint.color;
      const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
      value = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    mapping[style.name] = value;
  }

  console.log(JSON.stringify(mapping, null, 2));
}

exportStylesWithMapping();