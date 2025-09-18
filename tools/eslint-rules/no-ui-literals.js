'use strict';

const UI_PROPERTY_NAMES = new Set([
  'innerHTML',
  'innerText',
  'textContent',
  'placeholder',
  'title',
  'alt',
  'value',
  'ariaLabel',
  'ariaLabelledby',
  'ariaDescribedby',
  'ariaDescription',
  'ariaPlaceholder',
  'ariaValueText',
]);

const UI_ATTRIBUTE_NAMES = new Set([
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-description',
  'aria-placeholder',
  'aria-valuetext',
  'placeholder',
  'title',
  'alt',
  'value',
  'label',
]);

const TRANSLATION_FUNCTION_NAMES = new Set(['t', 'translate', 'formatMessage']);

function getLiteralText(node) {
  if (!node) {
    return null;
  }

  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }

  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.length > 0 ? node.quasis[0].value.cooked : '';
  }

  return null;
}

function hasMeaningfulText(text) {
  if (!text) {
    return false;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  return /[\p{L}\p{N}]/u.test(trimmed);
}

function isTranslationCall(node) {
  if (!node || node.type !== 'CallExpression') {
    return false;
  }

  let callee = node.callee;
  if (callee.type === 'ChainExpression') {
    callee = callee.expression;
  }

  if (callee.type === 'Identifier') {
    return TRANSLATION_FUNCTION_NAMES.has(callee.name);
  }

  if (callee.type === 'MemberExpression') {
    const propertyName = getPropertyName(callee);
    return Boolean(propertyName && TRANSLATION_FUNCTION_NAMES.has(propertyName));
  }

  return false;
}

function getPropertyName(member) {
  if (!member) {
    return null;
  }

  if (member.type === 'ChainExpression') {
    return getPropertyName(member.expression);
  }

  if (member.type !== 'MemberExpression') {
    return null;
  }

  const property = member.property;
  if (!property) {
    return null;
  }

  if (member.computed) {
    if (property.type === 'Literal' && typeof property.value === 'string') {
      return property.value;
    }
    return null;
  }

  if (property.type === 'Identifier') {
    return property.name;
  }

  return null;
}

function reportIfLiteral(context, node, literalNode) {
  const text = getLiteralText(literalNode);
  if (!hasMeaningfulText(text)) {
    return;
  }

  context.report({
    node: literalNode,
    messageId: 'noRawString',
  });
}

function handleJsxAttribute(context, node) {
  const nameNode = node.name;
  if (!nameNode) {
    return;
  }

  const attributeName = nameNode.type === 'JSXIdentifier' ? nameNode.name : null;
  if (!attributeName) {
    return;
  }

  if (!UI_ATTRIBUTE_NAMES.has(attributeName)) {
    return;
  }

  if (!node.value) {
    return;
  }

  if (node.value.type === 'Literal') {
    reportIfLiteral(context, node, node.value);
    return;
  }

  if (
    node.value.type === 'JSXExpressionContainer' &&
    node.value.expression &&
    !isTranslationCall(node.value.expression)
  ) {
    reportIfLiteral(context, node, node.value.expression);
  }
}

function handleAssignment(context, node) {
  if (node.operator !== '=') {
    return;
  }

  const propertyName = getPropertyName(node.left);
  if (!propertyName || !UI_PROPERTY_NAMES.has(propertyName)) {
    return;
  }

  if (isTranslationCall(node.right)) {
    return;
  }

  reportIfLiteral(context, node, node.right);
}

function handleSetAttribute(context, node) {
  let callee = node.callee;
  if (callee.type === 'ChainExpression') {
    callee = callee.expression;
  }

  if (callee.type !== 'MemberExpression') {
    return;
  }

  const methodName = getPropertyName(callee);
  if (!methodName || (methodName !== 'setAttribute' && methodName !== 'setAttributeNS')) {
    return;
  }

  if (node.arguments.length < 2) {
    return;
  }

  const [attributeNode, valueNode] = node.arguments;
  const attributeName = getLiteralText(attributeNode);

  if (!attributeName || !UI_ATTRIBUTE_NAMES.has(attributeName) || isTranslationCall(valueNode)) {
    return;
  }

  reportIfLiteral(context, node, valueNode);
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow raw string literals in UI contexts without i18n',
      category: 'Best Practices',
    },
    schema: [],
    messages: {
      noRawString: 'UI text must use translation helpers instead of raw string literals.',
    },
  },
  create(context) {
    return {
      JSXText(node) {
        if (hasMeaningfulText(node.value)) {
          context.report({ node, messageId: 'noRawString' });
        }
      },
      JSXAttribute(node) {
        handleJsxAttribute(context, node);
      },
      JSXExpressionContainer(node) {
        if (node.parent && node.parent.type === 'JSXAttribute') {
          return;
        }

        if (node.expression && !isTranslationCall(node.expression)) {
          reportIfLiteral(context, node, node.expression);
        }
      },
      AssignmentExpression(node) {
        handleAssignment(context, node);
      },
      CallExpression(node) {
        handleSetAttribute(context, node);
      },
    };
  },
};
