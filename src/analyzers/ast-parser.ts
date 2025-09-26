/**
 * AST Parser
 * Handles parsing of TypeScript/JavaScript files using @babel/parser
 * Following Phase 3.3 requirements from the architecture document
 */

import { parse, ParserOptions } from '@babel/parser';
import traverse from '@babel/traverse';
import type { Visitor } from '@babel/traverse';
import * as t from '@babel/types';

/**
 * Using Babel's official Visitor pattern for type-safe AST traversal
 * This eliminates duplicate type definitions and ensures compatibility with Babel's traverse API
 */

// Handle ES module/CommonJS interop for @babel/traverse
const traverseFunction = (traverse as unknown as { default?: typeof traverse }).default || traverse;
import fs from 'fs-extra';
import * as path from 'path';
import {
  ASTNode,
  ImportInfo,
  ExportInfo,
  JSXElementInfo,
  InformativeElementInfo,
  AnalysisError
} from '../types/index.js';
import { AnalysisLogger } from './analysis-logger.js';

/**
 * AST Parser class
 * Implements TypeScript/JavaScript file parsing and AST analysis
 * Extracts imports, exports, JSX elements, and informative elements
 */
export class ASTParserImpl {
  private logger?: AnalysisLogger;

  /**
   * Constructor initializes the AST parser
   * @param logger - Optional analysis logger for error reporting
   */
  constructor(logger?: AnalysisLogger) {
    this.logger = logger;
  }

  /**
   * Parses a file and returns its AST
   * Handles TypeScript, JavaScript, JSX, and TSX files
   * 
   * @param filePath - Path to the file to parse
   * @returns Promise<ASTNode> - The parsed AST
   * @throws AnalysisError if parsing fails
   */
  async parseFile(filePath: string): Promise<ASTNode> {
    try {
      // Read file content using fs-extra for better error handling and additional utilities
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Check for empty files
      if (content.trim() === '') {
        throw new Error('File is empty or contains only whitespace');
      }
      
      // Determine file extension for parser options
      const ext = path.extname(filePath).toLowerCase();
      const isTypeScript = ext === '.ts' || ext === '.tsx';
      const isJSX = ext === '.jsx' || ext === '.tsx';

      // Configure parser options based on file type
      const parserOptions: ParserOptions = {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining'
        ],
        tokens: true,
        ranges: true
      };

      // Parse the file
      const ast = parse(content, parserOptions);
      
      if (this.logger) {
        this.logger.logInfo(`Successfully parsed file: ${filePath}`, {
          fileType: ext,
          isTypeScript,
          isJSX,
          nodeCount: this.countNodes(ast as unknown as ASTNode)
        });
      }

      return ast as unknown as ASTNode;

    } catch (error) {
      const errorMessage = `Failed to parse file ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
      
      if (this.logger) {
        this.logger.logError(errorMessage, { filePath, error: error instanceof Error ? error.stack : String(error) });
      }

      const analysisError: AnalysisError = {
        type: 'syntax',
        message: errorMessage,
        file: filePath,
        stack: error instanceof Error ? error.stack : undefined
      };
      throw analysisError;
    }
  }

  /**
   * Extracts import information from AST
   * Identifies all import statements and their specifiers
   * 
   * @param ast - The AST to analyze
   * @returns ImportInfo[] - Array of import information
   */
  extractImports(ast: ASTNode): ImportInfo[] {
    const imports: ImportInfo[] = [];

    const visitor: Visitor = {
      ImportDeclaration(path) {
        const importInfo: ImportInfo = {
          source: path.node.source.value,
          specifiers: [],
          line: path.node.loc?.start.line,
          column: path.node.loc?.start.column
        };

        // Process import specifiers
        path.node.specifiers.forEach((spec: t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier) => {
          if (t.isImportDefaultSpecifier(spec)) {
            importInfo.defaultImport = spec.local.name;
            importInfo.specifiers.push({
              name: spec.local.name,
              type: 'default'
            });
          } else if (t.isImportNamespaceSpecifier(spec)) {
            importInfo.namespaceImport = spec.local.name;
            importInfo.specifiers.push({
              name: spec.local.name,
              type: 'namespace'
            });
          } else if (t.isImportSpecifier(spec)) {
            const importedName = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
            importInfo.specifiers.push({
              name: spec.local.name,
              imported: importedName,
              type: 'named'
            });
          }
        });

        imports.push(importInfo);
      }
    };

    traverseFunction(ast as t.Node, visitor);

    return imports;
  }

  /**
   * Extracts export information from AST
   * Identifies all export statements and their details
   * 
   * @param ast - The AST to analyze
   * @returns ExportInfo[] - Array of export information
   */
  extractExports(ast: ASTNode): ExportInfo[] {
    const exports: ExportInfo[] = [];

    const visitor: Visitor = {
      ExportDefaultDeclaration: (path) => {
        const exportInfo: ExportInfo = {
          name: this.getExportName(path.node.declaration),
          type: 'default',
          line: path.node.loc?.start.line,
          column: path.node.loc?.start.column
        };
        exports.push(exportInfo);
      },

      ExportNamedDeclaration: (path) => {
        if (path.node.source) {
          // Re-export from another module
          const exportInfo: ExportInfo = {
            name: 're-export',
            type: 'all',
            source: path.node.source.value,
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column
          };
          exports.push(exportInfo);
        } else if (path.node.declaration) {
          // Named export with declaration
          const exportInfo: ExportInfo = {
            name: this.getExportName(path.node.declaration),
            type: 'named',
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column
          };
          exports.push(exportInfo);
        } else if (path.node.specifiers) {
          // Named export with specifiers
          path.node.specifiers.forEach((spec: t.ExportSpecifier | t.ExportDefaultSpecifier | t.ExportNamespaceSpecifier) => {
            if (t.isExportSpecifier(spec)) {
              const exportInfo: ExportInfo = {
                name: t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value,
                type: 'named',
                line: path.node.loc?.start.line,
                column: path.node.loc?.start.column
              };
              exports.push(exportInfo);
            }
          });
        }
      },

      ExportAllDeclaration: (path) => {
        const exportInfo: ExportInfo = {
          name: '*',
          type: 'all',
          source: path.node.source.value,
          line: path.node.loc?.start.line,
          column: path.node.loc?.start.column
        };
        exports.push(exportInfo);
      }
    };

    traverseFunction(ast as t.Node, visitor);

    return exports;
  }

  /**
   * Extracts JSX elements from AST
   * Identifies all JSX elements and their properties
   * 
   * @param ast - The AST to analyze
   * @returns JSXElementInfo[] - Array of JSX element information
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
   * 
   * @param ast - The AST to analyze
   * @param filePath - Path to the file being analyzed
   * @returns InformativeElementInfo[] - Array of informative element information
   */
  extractInformativeElements(ast: ASTNode, filePath: string): InformativeElementInfo[] {
    const informativeElements: InformativeElementInfo[] = [];

    // Detect different types of informative elements
    informativeElements.push(...this.detectDisplayElements(ast));
    informativeElements.push(...this.detectInputElements(ast));
    informativeElements.push(...this.detectDataSources(ast));
    informativeElements.push(...this.detectStateManagement(ast));

    // Add file path to all elements
    informativeElements.forEach(element => {
      element.file = filePath;
    });

    return informativeElements;
  }

  /**
   * Finds AST nodes of specific types
   * Searches for nodes matching the provided types
   * 
   * @param ast - The AST to search
   * @param targetTypes - Array of node types to find
   * @returns ASTNode[] - Array of matching nodes
   */
  findASTNodeTypes(ast: ASTNode, targetTypes: string[]): ASTNode[] {
    const foundNodes: ASTNode[] = [];

    const visitor: Visitor = {
      enter: (path) => {
        if (targetTypes.includes(path.node.type)) {
          foundNodes.push(path.node as ASTNode);
        }
      }
    };

    traverseFunction(ast as t.Node, visitor);

    return foundNodes;
  }

  /**
   * Checks if a node represents an informative element
   * Determines if the node exchanges data with users
   * 
   * @param node - The AST node to check
   * @returns boolean - True if the node is informative
   */
  isInformativeElement(node: ASTNode): boolean {
    const babelNode = node as unknown as t.Node;
    
    // Check for JSX elements with event handlers or data binding
    if (t.isJSXElement(babelNode)) {
      return this.hasEventHandlers(babelNode as t.JSXElement) || this.hasDataBinding(babelNode as t.JSXElement);
    }

    // Check for API call expressions
    if (t.isCallExpression(babelNode)) {
      return this.isAPICall(babelNode as t.CallExpression);
    }

    // Check for state management (useState, etc.)
    if (t.isVariableDeclarator(babelNode)) {
      return this.isStateManagement(babelNode as t.VariableDeclarator);
    }

    return false;
  }

  /**
   * Detects display elements
   * JSX elements with JSXExpressionContainer containing props/state data
   * 
   * @param ast - The AST to analyze
   * @returns InformativeElementInfo[] - Array of display elements
   */
  detectDisplayElements(ast: ASTNode): InformativeElementInfo[] {
    const displayElements: InformativeElementInfo[] = [];

    const visitor: Visitor = {
      JSXElement: (path) => {
        if (this.hasDataBinding(path.node)) {
          const elementInfo: InformativeElementInfo = {
            type: 'display',
            name: this.getJSXElementName(path.node),
            elementType: 'JSXElement',
            props: this.extractJSXProps(path.node),
            eventHandlers: [],
            dataBindings: this.extractDataBindings(path.node),
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column,
            file: ''
          };
          displayElements.push(elementInfo);
        }
      }
    };

    traverseFunction(ast as t.Node, visitor);

    return displayElements;
  }

  /**
   * Detects input elements
   * JSX elements with event handlers (onClick, onChange, onSubmit)
   * 
   * @param ast - The AST to analyze
   * @returns InformativeElementInfo[] - Array of input elements
   */
  detectInputElements(ast: ASTNode): InformativeElementInfo[] {
    const inputElements: InformativeElementInfo[] = [];

    const visitor: Visitor = {
      JSXElement: (path) => {
        if (this.hasEventHandlers(path.node)) {
          const elementInfo: InformativeElementInfo = {
            type: 'input',
            name: this.getJSXElementName(path.node),
            elementType: 'JSXElement',
            props: this.extractJSXProps(path.node),
            eventHandlers: this.extractEventHandlers(path.node),
            dataBindings: [],
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column,
            file: ''
          };
          inputElements.push(elementInfo);
        }
      }
    };

    traverseFunction(ast as t.Node, visitor);

    return inputElements;
  }

  /**
   * Detects data sources
   * CallExpression patterns for API calls
   * 
   * @param ast - The AST to analyze
   * @returns InformativeElementInfo[] - Array of data source elements
   */
  detectDataSources(ast: ASTNode): InformativeElementInfo[] {
    const dataSources: InformativeElementInfo[] = [];

    const visitor: Visitor = {
      CallExpression: (path) => {
        if (this.isAPICall(path.node)) {
          const elementInfo: InformativeElementInfo = {
            type: 'data-source',
            name: this.getCallExpressionName(path.node),
            elementType: 'CallExpression',
            props: {},
            eventHandlers: [],
            dataBindings: [],
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column,
            file: ''
          };
          dataSources.push(elementInfo);
        }
      }
    };

    traverseFunction(ast as t.Node, visitor);

    return dataSources;
  }

  /**
   * Detects state management
   * VariableDeclarator with useState patterns
   * 
   * @param ast - The AST to analyze
   * @returns InformativeElementInfo[] - Array of state management elements
   */
  detectStateManagement(ast: ASTNode): InformativeElementInfo[] {
    const stateElements: InformativeElementInfo[] = [];

    const visitor: Visitor = {
      VariableDeclarator: (path) => {
        if (this.isStateManagement(path.node)) {
          const elementInfo: InformativeElementInfo = {
            type: 'state-management',
            name: this.getVariableName(path.node),
            elementType: 'VariableDeclarator',
            props: {},
            eventHandlers: [],
            dataBindings: [],
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column,
            file: ''
          };
          stateElements.push(elementInfo);
        }
      }
    };

    traverseFunction(ast as t.Node, visitor);

    return stateElements;
  }

  // Private helper methods

  /**
   * Counts the total number of nodes in an AST
   * @param ast - The AST to count
   * @returns number - Total node count
   */
  private countNodes(ast: ASTNode): number {
    let count = 0;
    const visitor: Visitor = {
      enter() {
        count++;
      }
    };
    traverseFunction(ast as t.Node, visitor);
    return count;
  }

  /**
   * Gets the name of an export declaration
   * @param declaration - The export declaration
   * @returns string - The export name
   */
  private getExportName(declaration: t.Declaration | t.Expression | null): string {
    if (t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) {
      return declaration.id?.name || 'anonymous';
    } else if (t.isVariableDeclaration(declaration)) {
      const firstDecl = declaration.declarations[0];
      if (firstDecl && t.isIdentifier(firstDecl.id)) {
        return firstDecl.id.name || 'anonymous';
      }
      return 'anonymous';
    }
    return 'anonymous';
  }

  /**
   * Processes a JSX element and extracts its information
   * @param node - The JSX element node
   * @returns JSXElementInfo - Processed JSX element information
   */
  private processJSXElement(node: t.JSXElement): JSXElementInfo {
    return {
      name: this.getJSXElementName(node),
      type: 'element',
      props: this.extractJSXProps(node),
      children: node.children?.map((child: t.JSXElement | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXText | t.JSXFragment) => 
        t.isJSXElement(child) ? this.processJSXElement(child) : null
      ).filter((item): item is JSXElementInfo => item !== null) || [],
      line: node.loc?.start.line,
      column: node.loc?.start.column,
      hasEventHandlers: this.hasEventHandlers(node),
      hasDataBinding: this.hasDataBinding(node)
    };
  }

  /**
   * Gets the name of a JSX element
   * @param node - The JSX element node
   * @returns string - The element name
   */
  private getJSXElementName(node: t.JSXElement): string {
    if (t.isJSXIdentifier(node.openingElement.name)) {
      return node.openingElement.name.name;
    } else if (t.isJSXMemberExpression(node.openingElement.name)) {
      return this.getMemberExpressionName(node.openingElement.name);
    }
    return 'Unknown';
  }

  /**
   * Gets the name of a member expression
   * @param node - The member expression node
   * @returns string - The member expression name
   */
  private getMemberExpressionName(node: t.JSXMemberExpression): string {
    if (t.isJSXIdentifier(node.object) && t.isJSXIdentifier(node.property)) {
      return `${node.object.name}.${node.property.name}`;
    }
    return 'Unknown';
  }

  /**
   * Gets the name of a regular member expression
   * @param node - The member expression node
   * @returns string - The member expression name
   */
  private getRegularMemberExpressionName(node: t.MemberExpression): string {
    if (t.isIdentifier(node.object) && t.isIdentifier(node.property)) {
      return `${node.object.name}.${node.property.name}`;
    }
    return 'Unknown';
  }

  /**
   * Extracts props from a JSX element
   * @param node - The JSX element node
   * @returns Record<string, any> - The extracted props
   */
  private extractJSXProps(node: t.JSXElement): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    
    node.openingElement.attributes?.forEach((attr: t.JSXAttribute | t.JSXSpreadAttribute) => {
      if (t.isJSXAttribute(attr)) {
        const key = t.isJSXIdentifier(attr.name) ? attr.name.name : String(attr.name);
        if (t.isStringLiteral(attr.value)) {
          props[key] = attr.value.value;
        } else if (t.isJSXExpressionContainer(attr.value)) {
          props[key] = 'expression';
        } else {
          props[key] = true;
        }
      }
    });

    return props;
  }

  /**
   * Checks if a JSX element has event handlers
   * @param node - The JSX element node
   * @returns boolean - True if the element has event handlers
   */
  private hasEventHandlers(node: t.JSXElement): boolean {
    return node.openingElement.attributes?.some((attr: t.JSXAttribute | t.JSXSpreadAttribute) => 
      t.isJSXAttribute(attr) && 
      t.isJSXIdentifier(attr.name) &&
      attr.name.name.match(/^on[A-Z]/)
    ) || false;
  }

  /**
   * Checks if a JSX element has data binding
   * @param node - The JSX element node
   * @returns boolean - True if the element has data binding
   */
  private hasDataBinding(node: t.JSXElement): boolean {
    // Check for JSXExpressionContainer in children
    const hasExpressionInChildren = node.children?.some((child: t.JSXElement | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXText | t.JSXFragment) => 
      t.isJSXExpressionContainer(child)
    ) || false;

    // Check for any attributes with values (JSXExpressionContainer or string literals)
    const hasExpressionInProps = node.openingElement.attributes?.some((attr: t.JSXAttribute | t.JSXSpreadAttribute) => 
      t.isJSXAttribute(attr) && (
        t.isJSXExpressionContainer(attr.value) || // Dynamic values like {variable}
        (attr.value && t.isStringLiteral(attr.value)) // String literals like "container"
      )
    ) || false;

    return hasExpressionInChildren || hasExpressionInProps;
  }

  /**
   * Extracts event handlers from a JSX element
   * @param node - The JSX element node
   * @returns string[] - Array of event handler names
   */
  private extractEventHandlers(node: t.JSXElement): string[] {
    const handlers: string[] = [];
    
    node.openingElement.attributes?.forEach((attr: t.JSXAttribute | t.JSXSpreadAttribute) => {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name.match(/^on[A-Z]/)) {
        handlers.push(attr.name.name);
      }
    });

    return handlers;
  }

  /**
   * Extracts data bindings from a JSX element
   * @param node - The JSX element node
   * @returns string[] - Array of data binding expressions
   */
  private extractDataBindings(node: t.JSXElement): string[] {
    const bindings: string[] = [];

    // Check children for JSXExpressionContainer
    node.children?.forEach((child: t.JSXElement | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXText | t.JSXFragment) => {
      if (t.isJSXExpressionContainer(child)) {
        bindings.push('expression');
      }
    });

    // Check attributes for JSXExpressionContainer
    node.openingElement.attributes?.forEach((attr: t.JSXAttribute | t.JSXSpreadAttribute) => {
      if (t.isJSXAttribute(attr) && t.isJSXExpressionContainer(attr.value)) {
        const attrName = t.isJSXIdentifier(attr.name) ? attr.name.name : String(attr.name);
        bindings.push(attrName);
      }
    });

    return bindings;
  }

  /**
   * Checks if a call expression is an API call
   * @param node - The call expression node
   * @returns boolean - True if it's an API call
   */
  private isAPICall(node: t.CallExpression): boolean {
    if (!t.isCallExpression(node)) return false;

    // Check for fetch, axios, or similar API calls
    if (t.isIdentifier(node.callee)) {
      const apiMethods = ['fetch', 'axios', 'request', 'get', 'post', 'put', 'delete', 'patch'];
      return apiMethods.includes(node.callee.name);
    }

    // Check for member expressions like axios.get, fetch(url)
    if (t.isMemberExpression(node.callee)) {
      const apiObjects = ['axios', 'fetch', 'http', 'api'];
      if (t.isIdentifier(node.callee.object)) {
        return apiObjects.includes(node.callee.object.name);
      }
    }

    return false;
  }

  /**
   * Gets the name of a call expression
   * @param node - The call expression node
   * @returns string - The call expression name
   */
  private getCallExpressionName(node: t.CallExpression): string {
    if (t.isIdentifier(node.callee)) {
      return node.callee.name;
    } else if (t.isMemberExpression(node.callee)) {
      return this.getRegularMemberExpressionName(node.callee);
    }
    return 'anonymous';
  }

  /**
   * Checks if a variable declarator is state management
   * @param node - The variable declarator node
   * @returns boolean - True if it's state management
   */
  private isStateManagement(node: t.VariableDeclarator): boolean {
    if (!t.isVariableDeclarator(node)) return false;

    // Check for useState, useReducer, etc.
    if (t.isCallExpression(node.init)) {
      if (t.isIdentifier(node.init.callee)) {
        const stateHooks = ['useState', 'useReducer', 'useContext', 'useRef'];
        return stateHooks.includes(node.init.callee.name);
      }
    }

    return false;
  }

  /**
   * Gets the name of a variable
   * @param node - The variable declarator node
   * @returns string - The variable name
   */
  private getVariableName(node: t.VariableDeclarator): string {
    if (t.isIdentifier(node.id)) {
      return node.id.name;
    }
    return 'anonymous';
  }
}

// Export the interface and implementation
export { ASTParserImpl as ASTParser };
