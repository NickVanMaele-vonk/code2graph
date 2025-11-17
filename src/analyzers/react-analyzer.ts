/**
 * React Analyzer
 * Handles React-specific analysis separate from general AST parsing
 * Following Single Responsibility Principle for better maintainability
 *
 * Architectural Separation:
 * - AST Parser: General parsing (imports, exports, AST traversal)
 * - React Analyzer: React-specific logic (components, JSX, hooks, state)
 *
 * This separation enables:
 * - Independent testing of React analysis
 * - Future framework support (Vue, Angular, Svelte)
 * - Clearer code organization and maintainability
 */

import traverse from '@babel/traverse';
import type { Visitor } from '@babel/traverse';
import * as t from '@babel/types';
import {
  ASTNode,
  JSXElementInfo,
  InformativeElementInfo,
  ComponentDefinitionInfo,
  EventHandler,
  ReactAnalyzer
} from '../types/index.js';
import { AnalysisLogger } from './analysis-logger.js';

// Handle ES module/CommonJS interop for @babel/traverse
const traverseFunction = (traverse as unknown as { default?: typeof traverse }).default || traverse;

/**
 * React Analyzer Implementation
 * Analyzes React components, JSX elements, hooks, and state management
 */
export class ReactAnalyzerImpl implements ReactAnalyzer {
  private logger?: AnalysisLogger;

  constructor(logger?: AnalysisLogger) {
    this.logger = logger;
  }

  /**
   * Extracts JSX elements from AST
   * Identifies all JSX elements and their properties
   */
  extractJSXElements(ast: ASTNode): JSXElementInfo[] {
    const jsxElements: JSXElementInfo[] = [];

    const visitor: Visitor = {
      JSXElement: (path) => {
        const elementInfo = this.processJSXElement(path.node);
        jsxElements.push(elementInfo);
      },

      JSXFragment: (path) => {
        const fragmentInfo: JSXElementInfo = {
          name: 'Fragment',
          type: 'fragment',
          props: {},
          children: [],
          line: path.node.loc?.start.line,
          column: path.node.loc?.start.column,
          hasEventHandlers: false,
          hasDataBinding: false
        };
        jsxElements.push(fragmentInfo);
      }
    };

    traverseFunction(ast as t.Node, visitor);

    return jsxElements;
  }

  /**
   * Extracts informative elements from AST
   * Identifies elements that exchange internal data with users
   * Tracks parent component context during traversal
   */
  extractInformativeElements(ast: ASTNode, filePath: string): InformativeElementInfo[] {
    const informativeElements: InformativeElementInfo[] = [];
    let currentComponentName: string | undefined;
    const componentStack: string[] = [];

    const visitor: Visitor = {
      // Track function declaration components
      FunctionDeclaration: {
        enter: (path) => {
          const funcName = path.node.id?.name;
          if (funcName && this.isComponentName(funcName) && this.functionReturnsJSX(path.node)) {
            currentComponentName = funcName;
            componentStack.push(funcName);
          }
        },
        exit: (path) => {
          const funcName = path.node.id?.name;
          if (funcName && componentStack[componentStack.length - 1] === funcName) {
            componentStack.pop();
            currentComponentName = componentStack[componentStack.length - 1];
          }
        }
      },

      // Track arrow function components
      VariableDeclarator: {
        enter: (path) => {
          const varName = t.isIdentifier(path.node.id) ? path.node.id.name : undefined;
          if (varName && this.isComponentName(varName)) {
            const init = path.node.init;
            if ((t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) &&
                this.functionReturnsJSX(init)) {
              currentComponentName = varName;
              componentStack.push(varName);
            }
          }
        },
        exit: (path) => {
          const varName = t.isIdentifier(path.node.id) ? path.node.id.name : undefined;
          if (varName && componentStack[componentStack.length - 1] === varName) {
            componentStack.pop();
            currentComponentName = componentStack[componentStack.length - 1];
          }
        }
      },

      // Track class components
      ClassDeclaration: {
        enter: (path) => {
          const className = path.node.id?.name;
          if (!className || !this.isComponentName(className)) {
            return;
          }

          const superClass = path.node.superClass;
          let extendsComponent: string | undefined;

          if (t.isMemberExpression(superClass)) {
            if (t.isIdentifier(superClass.object) && t.isIdentifier(superClass.property)) {
              extendsComponent = `${superClass.object.name}.${superClass.property.name}`;
            }
          } else if (t.isIdentifier(superClass)) {
            extendsComponent = superClass.name;
          }

          if (extendsComponent && this.isReactComponent(extendsComponent)) {
            currentComponentName = className;
            componentStack.push(className);
          }
        },
        exit: (path) => {
          const className = path.node.id?.name;
          if (className && componentStack.length > 0 && componentStack[componentStack.length - 1] === className) {
            componentStack.pop();
            currentComponentName = componentStack.length > 0 ? componentStack[componentStack.length - 1] : undefined;
          }
        }
      },

      // Process JSX elements with component context
      JSXElement: {
        enter: (path) => {
          const hasBinding = this.hasDataBinding(path.node);
          const hasHandlers = this.hasEventHandlers(path.node);

          if (hasBinding || hasHandlers) {
            const semanticIdentifier = this.extractSemanticIdentifier(path.node);

            const elementInfo: InformativeElementInfo = {
              type: hasHandlers ? 'input' : 'display',
              name: this.getJSXElementName(path.node),
              elementType: 'JSXElement',
              props: this.extractJSXProps(path.node),
              eventHandlers: hasHandlers ? this.extractEventHandlers(path.node as unknown as ASTNode) : [],
              dataBindings: hasBinding ? this.extractDataBindings(path.node) : [],
              line: path.node.loc?.start.line,
              column: path.node.loc?.start.column,
              file: filePath,
              parentComponent: currentComponentName,
              semanticIdentifier: semanticIdentifier,
              hasSemanticIdentifier: semanticIdentifier !== undefined
            };
            informativeElements.push(elementInfo);
          }
        }
      }
    };

    traverseFunction(ast as t.Node, visitor);

    // Detect data sources and state management
    informativeElements.push(...this.detectDataSources(ast));
    informativeElements.push(...this.detectStateManagement(ast));

    // Add file path to all elements
    informativeElements.forEach(element => {
      element.file = filePath;
    });

    return informativeElements;
  }

  /**
   * Extracts component definitions from AST
   * Identifies individual React components within files (component-level granularity)
   */
  extractComponentDefinitions(ast: ASTNode, filePath: string): ComponentDefinitionInfo[] {
    const components: ComponentDefinitionInfo[] = [];
    const exports: Set<string> = new Set();

    // First pass: collect all exports
    traverseFunction(ast as t.Node, {
      ExportNamedDeclaration: (path) => {
        if (path.node.declaration) {
          if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
            exports.add(path.node.declaration.id.name);
          } else if (t.isVariableDeclaration(path.node.declaration)) {
            path.node.declaration.declarations.forEach((decl) => {
              if (t.isIdentifier(decl.id)) {
                exports.add(decl.id.name);
              }
            });
          } else if (t.isClassDeclaration(path.node.declaration) && path.node.declaration.id) {
            exports.add(path.node.declaration.id.name);
          }
        }
      },
      ExportDefaultDeclaration: (path) => {
        if (t.isIdentifier(path.node.declaration)) {
          exports.add(path.node.declaration.name);
        } else if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
          exports.add(path.node.declaration.id.name);
        } else if (t.isClassDeclaration(path.node.declaration) && path.node.declaration.id) {
          exports.add(path.node.declaration.id.name);
        }
      }
    });

    // Second pass: find React components
    const visitor: Visitor = {
      FunctionDeclaration: (path) => {
        const funcName = path.node.id?.name;
        if (!funcName || !this.isComponentName(funcName)) {
          return;
        }

        if (this.functionReturnsJSX(path.node)) {
          components.push({
            name: funcName,
            type: 'functional',
            file: filePath,
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column,
            isExported: exports.has(funcName)
          });
        }
      },

      VariableDeclarator: (path) => {
        const varName = t.isIdentifier(path.node.id) ? path.node.id.name : undefined;
        if (!varName || !this.isComponentName(varName)) {
          return;
        }

        const init = path.node.init;
        if ((t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) &&
            this.functionReturnsJSX(init)) {
          components.push({
            name: varName,
            type: 'functional',
            file: filePath,
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column,
            isExported: exports.has(varName)
          });
        }
      },

      ClassDeclaration: (path) => {
        const className = path.node.id?.name;
        if (!className || !this.isComponentName(className)) {
          return;
        }

        const superClass = path.node.superClass;
        let extendsComponent: string | undefined;

        if (t.isMemberExpression(superClass)) {
          if (t.isIdentifier(superClass.object) && t.isIdentifier(superClass.property)) {
            extendsComponent = `${superClass.object.name}.${superClass.property.name}`;
          }
        } else if (t.isIdentifier(superClass)) {
          extendsComponent = superClass.name;
        }

        if (extendsComponent && this.isReactComponent(extendsComponent)) {
          components.push({
            name: className,
            type: 'class',
            file: filePath,
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column,
            isExported: exports.has(className),
            extendsComponent: extendsComponent
          });
        }
      }
    };

    traverseFunction(ast as t.Node, visitor);

    return components;
  }

  /**
   * Checks if a node is an informative element
   */
  isInformativeElement(node: ASTNode): boolean {
    const babelNode = node as unknown as t.Node;
    if (!t.isJSXElement(babelNode)) {
      return false;
    }

    return this.hasEventHandlers(babelNode) || this.hasDataBinding(babelNode);
  }

  /**
   * Detects display elements from AST
   */
  detectDisplayElements(ast: ASTNode): InformativeElementInfo[] {
    const displayElements: InformativeElementInfo[] = [];

    traverseFunction(ast as t.Node, {
      JSXElement: (path) => {
        if (this.hasDataBinding(path.node) && !this.hasEventHandlers(path.node)) {
          displayElements.push({
            type: 'display',
            name: this.getJSXElementName(path.node),
            elementType: 'JSXElement',
            props: this.extractJSXProps(path.node),
            eventHandlers: [],
            dataBindings: this.extractDataBindings(path.node),
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column,
            file: ''
          });
        }
      }
    });

    return displayElements;
  }

  /**
   * Detects input elements from AST
   */
  detectInputElements(ast: ASTNode): InformativeElementInfo[] {
    const inputElements: InformativeElementInfo[] = [];

    traverseFunction(ast as t.Node, {
      JSXElement: (path) => {
        if (this.hasEventHandlers(path.node)) {
          inputElements.push({
            type: 'input',
            name: this.getJSXElementName(path.node),
            elementType: 'JSXElement',
            props: this.extractJSXProps(path.node),
            eventHandlers: this.extractEventHandlers(path.node as unknown as ASTNode),
            dataBindings: this.extractDataBindings(path.node),
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column,
            file: ''
          });
        }
      }
    });

    return inputElements;
  }

  /**
   * Detects data sources from AST (API calls, fetch operations)
   */
  detectDataSources(ast: ASTNode): InformativeElementInfo[] {
    const dataSources: InformativeElementInfo[] = [];

    traverseFunction(ast as t.Node, {
      CallExpression: (path) => {
        if (this.isAPICall(path.node)) {
          const callName = this.getCallExpressionName(path.node);
          dataSources.push({
            type: 'data-source',
            name: callName,
            elementType: 'CallExpression',
            props: {},
            eventHandlers: [],
            dataBindings: [],
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column,
            file: ''
          });
        }
      }
    });

    return dataSources;
  }

  /**
   * Detects state management from AST (useState, useReducer, etc.)
   */
  detectStateManagement(ast: ASTNode): InformativeElementInfo[] {
    const stateElements: InformativeElementInfo[] = [];

    traverseFunction(ast as t.Node, {
      VariableDeclarator: (path) => {
        if (this.isStateManagement(path.node)) {
          const varName = this.getVariableName(path.node);
          stateElements.push({
            type: 'state-management',
            name: varName,
            elementType: 'VariableDeclarator',
            props: {},
            eventHandlers: [],
            dataBindings: [],
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column,
            file: ''
          });
        }
      }
    });

    return stateElements;
  }

  /**
   * Extracts event handlers from a JSX element
   */
  extractEventHandlers(jsxElement: ASTNode): EventHandler[] {
    const babelNode = jsxElement as unknown as t.Node;
    if (!t.isJSXElement(babelNode)) {
      return [];
    }

    const handlers: EventHandler[] = [];

    for (const attr of babelNode.openingElement.attributes) {
      if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) {
        continue;
      }

      const attrName = attr.name.name;
      if (!attrName.startsWith('on')) {
        continue;
      }

      const handlerType = this.getHandlerType(attr.value);
      const functionNames = this.extractFunctionNamesFromHandler(attr.value);
      const handlerString = functionNames.join(', ');

      handlers.push({
        name: attrName,
        type: handlerType,
        handler: handlerString
      });
    }

    return handlers;
  }

  /**
   * Extracts function calls from an event handler
   */
  extractFunctionCallsFromHandler(handler: ASTNode): string[] {
    const functionNames: string[] = [];
    const babelNode = handler as unknown as t.Node;

    if (t.isJSXExpressionContainer(babelNode) && babelNode.expression) {
      if (t.isIdentifier(babelNode.expression)) {
        functionNames.push(babelNode.expression.name);
      } else if (t.isArrowFunctionExpression(babelNode.expression) ||
                 t.isFunctionExpression(babelNode.expression)) {
        this.findCallExpressionsInNode(babelNode.expression.body as t.Node, functionNames);
      }
    }

    return functionNames;
  }

  // ========== Private Helper Methods ==========

  private processJSXElement(node: t.JSXElement): JSXElementInfo {
    // Type assertion for ASTNode compatibility
    return {
      name: this.getJSXElementName(node),
      type: 'element',
      props: this.extractJSXProps(node),
      children: [],
      line: node.loc?.start.line,
      column: node.loc?.start.column,
      hasEventHandlers: this.hasEventHandlers(node),
      hasDataBinding: this.hasDataBinding(node)
    };
  }

  private getJSXElementName(node: t.JSXElement): string {
    const openingElement = node.openingElement.name;

    if (t.isJSXIdentifier(openingElement)) {
      return openingElement.name;
    } else if (t.isJSXMemberExpression(openingElement)) {
      return this.getMemberExpressionName(openingElement);
    }

    return 'Unknown';
  }

  private getMemberExpressionName(node: t.JSXMemberExpression): string {
    const parts: string[] = [];
    let current: t.JSXMemberExpression | t.JSXIdentifier = node;

    while (t.isJSXMemberExpression(current)) {
      if (t.isJSXIdentifier(current.property)) {
        parts.unshift(current.property.name);
      }
      current = current.object;
    }

    if (t.isJSXIdentifier(current)) {
      parts.unshift(current.name);
    }

    return parts.join('.');
  }

  private extractJSXProps(node: t.JSXElement): Record<string, unknown> {
    const props: Record<string, unknown> = {};

    for (const attr of node.openingElement.attributes) {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
        const key = attr.name.name;
        if (attr.value) {
          if (t.isStringLiteral(attr.value)) {
            props[key] = attr.value.value;
          } else if (t.isJSXExpressionContainer(attr.value)) {
            props[key] = '<expression>';
          }
        } else {
          props[key] = true;
        }
      }
    }

    return props;
  }

  private hasEventHandlers(node: t.JSXElement): boolean {
    return node.openingElement.attributes.some(attr => {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
        return attr.name.name.startsWith('on');
      }
      return false;
    });
  }

  private hasDataBinding(node: t.JSXElement): boolean {
    for (const child of node.children) {
      if (t.isJSXExpressionContainer(child) && child.expression) {
        if (!t.isJSXEmptyExpression(child.expression)) {
          return true;
        }
      }
    }

    for (const attr of node.openingElement.attributes) {
      if (t.isJSXAttribute(attr) && t.isJSXExpressionContainer(attr.value)) {
        return true;
      }
    }

    return false;
  }

  private extractSemanticIdentifier(node: t.JSXElement): string | undefined {
    // Check aria-label
    for (const attr of node.openingElement.attributes) {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
        const attrName = attr.name.name;
        if (attrName === 'aria-label' && t.isStringLiteral(attr.value)) {
          return attr.value.value;
        }
        if (attrName === 'data-testid' && t.isStringLiteral(attr.value)) {
          return attr.value.value;
        }
        if (attrName === 'id' && t.isStringLiteral(attr.value)) {
          return attr.value.value;
        }
      }
    }

    // Check text content
    return this.extractTextContent(node);
  }

  private extractTextContent(node: t.JSXElement): string | undefined {
    for (const child of node.children) {
      if (t.isJSXText(child)) {
        const text = child.value.trim();
        if (text.length > 0 && text.length < 50) {
          return text;
        }
      }
    }
    return undefined;
  }

  private extractDataBindings(node: t.JSXElement): string[] {
    const bindings: string[] = [];

    for (const child of node.children) {
      if (t.isJSXExpressionContainer(child) && t.isIdentifier(child.expression)) {
        bindings.push(child.expression.name);
      }
    }

    return bindings;
  }

  private getHandlerType(value: t.JSXAttribute['value']): string {
    if (!value || !t.isJSXExpressionContainer(value)) {
      return 'unknown';
    }

    if (t.isIdentifier(value.expression)) {
      return 'function-reference';
    } else if (t.isArrowFunctionExpression(value.expression)) {
      return 'arrow-function';
    } else if (t.isFunctionExpression(value.expression)) {
      return 'function-expression';
    }

    return 'unknown';
  }

  private extractFunctionNamesFromHandler(value: t.JSXAttribute['value']): string[] {
    const functionNames: string[] = [];

    if (!value || !t.isJSXExpressionContainer(value)) {
      return functionNames;
    }

    if (t.isIdentifier(value.expression)) {
      functionNames.push(value.expression.name);
    } else if (t.isArrowFunctionExpression(value.expression) ||
               t.isFunctionExpression(value.expression)) {
      this.findCallExpressionsInNode(value.expression.body, functionNames);
    }

    return functionNames;
  }

  private findCallExpressionsInNode(node: t.Node | t.Statement | null | undefined, functionNames: string[]): void {
    if (!node) return;

    if (t.isCallExpression(node)) {
      if (t.isIdentifier(node.callee)) {
        functionNames.push(node.callee.name);
      } else if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
        functionNames.push(node.callee.property.name);
      }
    }

    if (t.isBlockStatement(node)) {
      node.body.forEach(stmt => this.findCallExpressionsInNode(stmt, functionNames));
    } else if (t.isExpressionStatement(node)) {
      this.findCallExpressionsInNode(node.expression, functionNames);
    } else if (t.isSequenceExpression(node)) {
      node.expressions.forEach(expr => this.findCallExpressionsInNode(expr, functionNames));
    }
  }

  private isAPICall(node: t.CallExpression): boolean {
    if (t.isIdentifier(node.callee)) {
      const name = node.callee.name.toLowerCase();
      return name === 'fetch' || name.includes('api') || name.includes('request');
    }
    return false;
  }

  private getCallExpressionName(node: t.CallExpression): string {
    if (t.isIdentifier(node.callee)) {
      return node.callee.name;
    } else if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
      return node.callee.property.name;
    }
    return 'UnknownCall';
  }

  private isStateManagement(node: t.VariableDeclarator): boolean {
    if (!node.init || !t.isCallExpression(node.init)) {
      return false;
    }

    if (t.isIdentifier(node.init.callee)) {
      const name = node.init.callee.name;
      return name === 'useState' || name === 'useReducer' || name === 'useContext';
    }

    return false;
  }

  private getVariableName(node: t.VariableDeclarator): string {
    if (t.isIdentifier(node.id)) {
      return node.id.name;
    } else if (t.isArrayPattern(node.id) && node.id.elements.length > 0) {
      const firstElement = node.id.elements[0];
      if (firstElement && t.isIdentifier(firstElement)) {
        return firstElement.name;
      }
    }
    return 'UnknownState';
  }

  private isComponentName(name: string): boolean {
    return /^[A-Z]/.test(name);
  }

  private isReactComponent(superClassName: string): boolean {
    const reactComponentNames = [
      'Component',
      'PureComponent',
      'React.Component',
      'React.PureComponent'
    ];
    return reactComponentNames.includes(superClassName);
  }

  private functionReturnsJSX(node: t.Function): boolean {
    return this.containsJSX(node.body);
  }

  private containsJSX(node: t.Node | null | undefined): boolean {
    if (!node) return false;

    if (t.isJSXElement(node) || t.isJSXFragment(node)) {
      return true;
    }

    if (t.isBlockStatement(node)) {
      return node.body.some(stmt => {
        if (t.isReturnStatement(stmt)) {
          return this.containsJSX(stmt.argument);
        }
        return false;
      });
    }

    if (t.isReturnStatement(node)) {
      return this.containsJSX(node.argument);
    }

    if (t.isArrowFunctionExpression(node)) {
      return this.containsJSX(node.body);
    }

    return false;
  }
}
