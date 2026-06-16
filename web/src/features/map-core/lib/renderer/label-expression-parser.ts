/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 标注表达式解析器
 * 将用户输入的 "{name} - {type}" 格式转换为 MapLibre GL expression
 */

/**
 * 将用户表达式转换为 MapLibre expression
 * 输入: "{name} - {type}"
 * 输出: ['concat', ['get', 'name'], ' - ', ['get', 'type']]
 *
 * @param expression 用户输入的标注表达式
 * @returns MapLibre GL expression 或纯文本
 */
export function parseLabelExpression(expression: string): unknown[] | string {
  if (!expression || !expression.includes('{')) {
    return expression; // 纯文本直接返回
  }

  const parts = expression.split(/(\{[^}]+\})/);
  const result: unknown[] = ['concat'];

  for (const part of parts) {
    if (part.startsWith('{') && part.endsWith('}')) {
      const fieldName = part.slice(1, -1);
      result.push(['get', fieldName]);
    } else if (part) {
      result.push(part);
    }
  }

  return result.length > 1 ? result : expression;
}

/**
 * 从表达式提取所有字段名
 * 输入: "{name} - {type}"
 * 输出: ['name', 'type']
 *
 * @param expression 用户输入的标注表达式
 * @returns 字段名数组
 */
export function extractFieldsFromExpression(expression: string): string[] {
  if (!expression) return [];

  const fieldRegex = /\{([^}]+)\}/g;
  const fields: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(expression)) !== null) {
    fields.push(match[1]);
  }

  return fields;
}

/**
 * 验证表达式格式是否正确
 *
 * @param expression 用户输入的标注表达式
 * @returns 是否有效
 */
export function validateExpression(expression: string): boolean {
  if (!expression) return true; // 空表达式是有效的

  // 检查是否有未闭合的花括号
  const openBraces = expression.split('{').length - 1;
  const closeBraces = expression.split('}').length - 1;

  return openBraces === closeBraces;
}

/**
 * 将字段名插入到表达式中的指定位置
 *
 * @param expression 当前表达式
 * @param fieldName 要插入的字段名
 * @param cursorPosition 光标位置（可选）
 * @returns 新的表达式
 */
export function insertFieldToExpression(
  expression: string,
  fieldName: string,
  cursorPosition?: number
): string {
  const fieldPlaceholder = `{${fieldName}}`;

  if (cursorPosition !== undefined) {
    // 在指定位置插入
    return expression.slice(0, cursorPosition) + fieldPlaceholder + expression.slice(cursorPosition);
  }

  // 默认在末尾插入
  return expression + fieldPlaceholder;
}

/**
 * 获取表达式的示例显示文本
 * 用于预览标注效果
 *
 * @param expression 用户输入的标注表达式
 * @param sampleProperties 示例属性数据
 * @returns 示例显示文本
 */
export function getExpressionPreview(
  expression: string,
  sampleProperties: Record<string, unknown>
): string {
  if (!expression) return '';

  return expression.replace(/\{([^}]+)\}/g, (match, fieldName) => {
    const value = sampleProperties[fieldName];
    if (value === undefined || value === null) {
      return `[${fieldName}]`;
    }
    return String(value);
  });
}