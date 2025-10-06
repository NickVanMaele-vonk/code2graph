# Change Request 001: Custom Code Focus & Graph Architecture Refinement

## Document Information
- **Date**: 2025-10-03
- **Author**: Nick Van Maele
- **Status**: Approved - Ready for Implementation
- **Related Documents**: 
  - `code2graph-architecture.md` (Section 11: Graph Architecture Philosophy)
  - `code2graph-prd.md` (Section 15: Custom Code Focus Philosophy)

---

## 1. Context & Decision Rationale

### 1.1 Problem Discovery
After implementing Phase 1 (component-level detection) and Phase 2 (JSX usage edges), analysis of the `react-typescript-helloworld` repository revealed several architectural issues in the generated graph output:

**Initial Output Issues:**
- 13 nodes, 2 edges (expected more edges for comprehensive dependency tracking)
- Non-React files (webpack.config.js) incorrectly identified as components
- Multiple external import nodes for same package (3 React import nodes instead of 1)
- Duplicate component nodes (MainComponent appeared twice: definition + JSX usage)
- Missing structural relationships (Component → JSX Element)
- Same-file component usage not detected

### 1.2 Core Principle: Custom Code Focus

**User Goal**: Analyze custom code at granular level while treating external libraries as black-box infrastructure.

**Analogy - Keyboard Press Analysis:**
```
✅ What matters:
   User presses 'b' → Letter 'b' appears on screen

❌ What to abstract away:
   Electronic contact → ASCII code → Windows interpretation → 
   Graphics card → Pixel activation
```

**Applied to React Applications:**
```
✅ What matters (custom code flow):
   MainComponent defined → Rendered at location → 
   User clicks button → API called → Database updated

❌ What to abstract away (standard library internals):
   React.Component internals → React rendering engine → 
   Event system implementation
```

**Rationale**: Standard libraries like React are well-tested and rarely contain bugs. Code2Graph is designed to help developers understand **structural dependencies in new code they write**, not debug standard library implementations.

### 1.3 UI → Database Flow Principle

**Decision**: All edges follow UI → Database direction for intuitive dependency tracing.

**Rationale**: 
- Enables questions like "What does MainComponent depend on?" (follow outgoing edges)
- Supports impact analysis: "What breaks if Hello is removed?" (trace incoming edges)
- Facilitates signal tracing: "How does user action reach database?" (traverse UI → Database)

**Edge Pattern:**
```
User Interface Layer:
  Component --[contains]--> JSX Element
  Component --[renders]--> Component

Dependency Layer:
  Component --[imports]--> External Package

API Layer:
  Component --[calls]--> API Endpoint

Data Layer:
  API --[reads/writes to]--> Database
```

### 1.4 Node Granularity Strategy

#### Custom Code (Internal)
- **Granularity**: Component-level (not file-level) ✅ Already implemented in Phase 1
- **Detail**: Full properties (props, state, hooks, line/column numbers)
- **Node Count**: One node per actual component definition
- **Example**: File with 3 components → 3 nodes

#### External Dependencies (Infrastructure)
- **Granularity**: Package-level (not import-level) ⚠️ Needs implementation
- **Detail**: Minimal (package name, version only)
- **Node Count**: One node per external package
- **Example**: 5 React imports in 3 files → 1 "react" node

**Benefits:**
1. Reduced noise: Focus on custom code
2. Scalability: Fewer nodes for large applications
3. Clarity: Clear distinction between custom and external
4. Flexibility: Easy filtering (show/hide external dependencies)
5. Performance: Faster analysis and rendering

### 1.5 JSX Instance Handling

**Decision**: JSX component usage instances are **metadata on component definitions**, not separate nodes. Only HTML elements become JSX nodes.

**Rationale**:
- **Component JSX usage** (`<MainComponent />`, `<Hello />`) is syntax for invoking a component, not a logical step in data flow
- Creating separate nodes for component usage creates duplication and confusion
- **HTML elements** (`<button>`, `<input>`, `<div>`) represent actual UI interaction/display points in data flow
- Users care about data flow and logical steps, not JSX syntax details

**Node Creation Policy**:
- ✅ **HTML elements** → Create JSX element nodes (they are UI interaction points)
- ❌ **Component usage** (local or imported) → No JSX node, create direct "renders" edge instead
- ✅ **Component definitions** → Always create component nodes
- ✅ **Render locations** → Store as metadata on component definitions

**Implementation**: Store as `renderLocations` array on ComponentInfo:
```typescript
interface ComponentInfo {
  name: string;
  renderLocations: RenderLocation[]; // Metadata, not nodes
}

interface RenderLocation {
  file: string;
  line: number;
  context: string; // e.g., "ReactDOM.render", "JSX usage"
}
```

---

## 2. Issues Identified & Solutions

### Issue #1: Non-React Files Detected as Components

**Problem**: `webpack.config.js` (node_13) incorrectly identified as functional component.

**Root Cause**: 
- `extractComponentDefinitions()` in `ast-parser.ts` runs on ALL `.ts`/`.js` files
- Doesn't verify file is a React component file
- Config files with exported functions pass the "returns JSX" check if they have any JSX-like syntax

**Solution**: Add React file filtering
- Only run component detection on `.tsx`/`.jsx` files, OR
- Check if file imports React before considering functions as components
- Exclude common patterns (webpack.config.js, *.config.js, utility files without React imports)

**Files to Modify**: `src/analyzers/ast-parser.ts` (extractComponentDefinitions method)

---

### Issue #2: Multiple Import Nodes for Same Package

**Problem**: 
- 3 separate "react" import nodes (node_3, node_10) instead of 1 consolidated node
- 1 "react-dom" import node (node_11)
- 1 "./components/Hello" import node (node_12)
- Creates noise and reduces focus on custom code

**Root Cause**: 
- Current implementation creates one node per import statement
- No consolidation of external packages

**Solution**: Implement external dependency consolidation
1. Create one node per external package (not per import statement)
2. Add node properties:
   - `codeOwnership: "external"` for packages, `"internal"` for custom code
   - `isInfrastructure: true` for external dependencies
   - `nodeType: "external-dependency"` for packages
   - `nodeCategory: "library"` for external dependencies
3. Create edges: `Component --[imports]--> Package` (one edge per component that uses the package)
4. For internal imports (e.g., "./components/Hello"), create edge to the actual component node (no separate import node)

**Example Output:**
```json
{
  "id": "node_ext_1",
  "label": "react",
  "nodeType": "external-dependency",
  "nodeCategory": "library",
  "codeOwnership": "external",
  "isInfrastructure": true,
  "properties": {
    "packageName": "react",
    "version": "^18.0.0"
  }
}
```

**Files to Modify**: 
- `src/types/index.ts` (add CodeOwnership type, update NodeInfo interface)
- `src/analyzers/dependency-analyser.ts` (consolidate external imports, modify edge creation)

---

### Issue #3: Same-File Component Usage Not Detected

**Problem**: Components rendering other components in the same file don't get "renders" edges.

**Root Cause**: 
In `createJSXUsageEdges()` at line 948 of `dependency-analyser.ts`:
```typescript
compNode.file !== jsxNode.file // Explicitly excludes same-file usage
```

**Solution**: 
1. Remove the `compNode.file !== jsxNode.file` restriction
2. Add self-reference check to prevent infinite recursion:
   ```typescript
   if (parentComponent.id === targetComponentNode.id) {
     continue; // Skip self-rendering
   }
   ```

**Enables:**
- ✅ Multiple components per file where one renders another
- ✅ Component usage in same file
- ❌ Prevents Component A → Component A (infinite loop)

**Files to Modify**: `src/analyzers/dependency-analyser.ts` (createJSXUsageEdges method)

---

### Issue #4: Missing Component → JSX Element Edges

**Problem**: No edges from components to their child JSX elements
- Hello component (node_1) contains h1 element (node_2) - no edge
- MainComponent (node_4) contains p, button (nodes 6, 7, 9) - no edges

**Root Cause**: `createEdges()` doesn't have logic to create structural parent-child edges.

**Solution**: Add "contains" relationship edges
1. Create new edge type: `"contains"` for structural parent-child relationships
2. Add logic to create edges from component nodes to their JSX element children
3. Match JSX elements to their parent component based on file location

**Implementation Logic:**
```typescript
// For each component node
for (const componentNode of componentNodes) {
  // Find all JSX elements in the same file
  const jsxElementsInFile = jsxElementNodes.filter(jsx => 
    jsx.file === componentNode.file &&
    !isJSXComponentUsage(jsx) // Only HTML elements, not component usage
  );
  
  // Create "contains" edges
  for (const jsxElement of jsxElementsInFile) {
    edges.push({
      source: componentNode.id,
      target: jsxElement.id,
      relationship: 'contains'
    });
  }
}
```

**Files to Modify**: 
- `src/types/index.ts` (add "contains" to RelationshipType)
- `src/analyzers/dependency-analyser.ts` (add createContainsEdges method, call from createEdges)

---

### Issue #5: Duplicate Component Nodes (Definition + JSX Instance)

**Problem**: 
- `node_4`: MainComponent definition (line 9, type "class")
- `node_8`: MainComponent JSX instance (elementType "display")
- Creates confusion about whether this is a usage or definition

**Root Cause**: 
System creates separate nodes for:
1. Component definitions (from ComponentInfo)
2. JSX element usages (from JSX parsing)

**Solution**: Store JSX instances as metadata, not separate nodes
1. When creating JSX element nodes, check if element name matches a component definition (local or imported)
2. If yes, don't create a separate JSX element node
3. Instead, add renderLocation metadata to the component definition
4. Only create JSX element nodes for:
   - HTML elements (div, button, input, h1, p, etc.) - these represent UI interaction/display points in the data flow
   - NOT for component usages (whether local or imported) - these create direct "renders" edges instead

**Rationale**: Component JSX usage (`<Hello />`) is syntax for invoking a component, not a logical step in data flow. HTML elements represent actual UI interaction points where users provide input or see output. Creating nodes for component JSX usage adds syntactic noise without logical value.

**Implementation:**
```typescript
// In createNodesFromComponents or similar
for (const jsxElement of jsxElements) {
  const isComponentUsage = componentDefinitions.find(comp => 
    comp.name === jsxElement.name
    // Check both local and imported components
  );
  
  if (isComponentUsage) {
    // Don't create node for component usage, add to renderLocations metadata
    if (!isComponentUsage.renderLocations) {
      isComponentUsage.renderLocations = [];
    }
    isComponentUsage.renderLocations.push({
      file: jsxElement.file,
      line: jsxElement.line,
      context: "JSX usage"
    });
  } else {
    // Create JSX element node for HTML elements only (button, div, input, etc.)
    nodes.push(createJSXElementNode(jsxElement));
  }
}
```

**Files to Modify**: 
- `src/types/index.ts` (add renderLocations to ComponentInfo)
- `src/analyzers/dependency-analyser.ts` (modify node creation logic)

---

## 3. Detailed Action List

### Phase A: Type System Updates

**A1. Update Type Definitions** (`src/types/index.ts`)

- [ ] Add `CodeOwnership` type:
  ```typescript
  type CodeOwnership = "internal" | "external";
  ```

- [ ] Update `NodeInfo` interface:
  ```typescript
  interface NodeInfo {
    // ... existing properties
    codeOwnership: CodeOwnership;
    isInfrastructure?: boolean;
  }
  ```

- [ ] Add `EventHandler` interface for structured event handler information:
  ```typescript
  export interface EventHandler {
    name: string;        // Event name: "onClick", "onChange", "onSubmit"
    type: string;        // Handler type: "function-reference", "arrow-function", "function-expression"
    handler: string;     // Function(s) called: "handleClick" or "validateInput, callAPI"
  }
  ```

- [ ] Update `InformativeElementInfo` to include parent component and use EventHandler[]:
  ```typescript
  export interface InformativeElementInfo {
    type: 'display' | 'input' | 'data-source' | 'state-management';
    name: string;
    elementType: string;
    props: Record<string, unknown>;
    eventHandlers: EventHandler[];  // UPDATED: Full EventHandler objects, not just strings
    dataBindings: string[];
    line?: number;
    column?: number;
    file: string;
    parentComponent?: string; // NEW: Name of the component that contains this element
  }
  ```

- [ ] Update `RelationshipType`:
  ```typescript
  type RelationshipType = "imports" | "calls" | "uses" | "reads" | 
                          "writes to" | "renders" | "contains";
  ```

- [ ] Update `NodeType`:
  ```typescript
  type NodeType = "function" | "API" | "table" | "view" | "route" | 
                  "external-dependency" | string;
  ```

- [ ] Update `NodeCategory`:
  ```typescript
  type NodeCategory = "front end" | "middleware" | "database" | "library";
  ```

- [ ] Add `RenderLocation` interface:
  ```typescript
  interface RenderLocation {
    file: string;
    line: number;
    context: string;
  }
  ```

- [ ] Update `ComponentInfo` interface:
  ```typescript
  interface ComponentInfo {
    // ... existing properties
    renderLocations?: RenderLocation[];
  }
  ```

---

### Phase B: AST Parser Enhancements

**B1. Filter Component Detection to React Files** (`src/analyzers/ast-parser.ts`)

- [ ] Update `extractComponentDefinitions()` to check file extension:
  ```typescript
  extractComponentDefinitions(ast: ASTNode, filePath: string): ComponentDefinitionInfo[] {
    // Only process React files
    if (!this.isReactFile(filePath, ast)) {
      return [];
    }
    // ... existing logic
  }
  ```

- [ ] Add `isReactFile()` helper method:
  ```typescript
  private isReactFile(filePath: string, ast: ASTNode): boolean {
    // Check file extension
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      return true;
    }
    
    // Check if file imports React
    const imports = this.extractImports(ast);
    const hasReactImport = imports.some(imp => 
      imp.source === 'react' || 
      imp.source === 'react-dom'
    );
    
    return hasReactImport;
  }
  ```

- [ ] Add exclusion patterns for common non-component files:
  ```typescript
  private isReactFile(filePath: string, ast: ASTNode): boolean {
    // Exclude config files
    const excludePatterns = [
      /\.config\.(js|ts)$/,
      /webpack\./,
      /vite\./,
      /rollup\./
    ];
    
    if (excludePatterns.some(pattern => pattern.test(filePath))) {
      return false;
    }
    
    // ... rest of logic
  }
  ```

**B2. Add Parent Component Tracking** (`src/analyzers/ast-parser.ts`)

- [ ] Update `extractInformativeElements()` to track component context:
  ```typescript
  extractInformativeElements(ast: ASTNode, filePath: string): InformativeElementInfo[] {
    const informativeElements: InformativeElementInfo[] = [];
    let currentComponentName: string | undefined;
    
    // Use AST traversal with scope tracking to determine parent component
    const visitor: Visitor = {
      // Track when we enter a component definition
      FunctionDeclaration: (path) => {
        const funcName = path.node.id?.name;
        if (funcName && this.isComponentName(funcName) && this.functionReturnsJSX(path.node)) {
          currentComponentName = funcName;
        }
      },
      
      // Track arrow function components
      VariableDeclarator: (path) => {
        const varName = t.isIdentifier(path.node.id) ? path.node.id.name : undefined;
        if (varName && this.isComponentName(varName)) {
          const init = path.node.init;
          if ((t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) && 
              this.functionReturnsJSX(init)) {
            currentComponentName = varName;
          }
        }
      },
      
      // Track class components
      ClassDeclaration: (path) => {
        const className = path.node.id?.name;
        if (className && this.isComponentName(className)) {
          const superClass = path.node.superClass;
          if (superClass && this.isReactComponent(this.getSuperClassName(superClass))) {
            currentComponentName = className;
          }
        }
      },
      
      // Detect JSX elements and assign parent component
      JSXElement: (path) => {
        // Check if this is a display element
        if (this.hasDataBinding(path.node)) {
          const elementInfo: InformativeElementInfo = {
            type: 'display',
            name: this.getJSXElementName(path.node),
            elementType: 'JSXElement',
            props: this.extractJSXProps(path.node),
            eventHandlers: this.extractEventHandlers(path.node),
            dataBindings: this.extractDataBindings(path.node),
            line: path.node.loc?.start.line,
            column: path.node.loc?.start.column,
            file: filePath,
            parentComponent: currentComponentName // Assign parent from traversal context
          };
          informativeElements.push(elementInfo);
        }
        
        // Check if this is an input element
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
            file: filePath,
            parentComponent: currentComponentName // Assign parent from traversal context
          };
          informativeElements.push(elementInfo);
        }
      }
    };
    
    traverseFunction(ast as t.Node, visitor);
    
    return informativeElements;
  }
  ```

- [ ] Add helper method to get superclass name:
  ```typescript
  private getSuperClassName(superClass: t.Expression): string {
    if (t.isMemberExpression(superClass)) {
      if (t.isIdentifier(superClass.object) && t.isIdentifier(superClass.property)) {
        return `${superClass.object.name}.${superClass.property.name}`;
      }
    } else if (t.isIdentifier(superClass)) {
      return superClass.name;
    }
    return '';
  }
  ```

- [ ] Update `detectDisplayElements()` and other detection methods to preserve parent component context during nested traversals

**B3. Update Tests** (`test/ast-parser.test.js`)

- [ ] Add test for parent component tracking:
  ```javascript
  it('should track parent component for JSX elements', async () => {
    const testFile = path.join(tempDir, 'multicomponent.tsx');
    const content = `
      function ParentComponent() {
        return <button onClick={handleClick}>Click</button>;
      }
      
      function SiblingComponent() {
        return <input type="text" onChange={handleChange} />;
      }
    `;
    await fs.writeFile(testFile, content);
    
    const ast = await parser.parseFile(testFile);
    const elements = parser.extractInformativeElements(ast, testFile);
    
    const buttonElement = elements.find(e => e.name === 'button');
    const inputElement = elements.find(e => e.name === 'input');
    
    assert.strictEqual(buttonElement?.parentComponent, 'ParentComponent');
    assert.strictEqual(inputElement?.parentComponent, 'SiblingComponent');
  });
  ```

- [ ] Add test for webpack.config.js exclusion:
  ```javascript
  it('should not extract components from webpack.config.js', async () => {
    const testFile = path.join(tempDir, 'webpack.config.js');
    const content = `
      module.exports = {
        entry: './src/index.js'
      };
    `;
    await fs.writeFile(testFile, content);
    
    const ast = await parser.parseFile(testFile);
    const components = parser.extractComponentDefinitions(ast, testFile);
    
    assert.strictEqual(components.length, 0);
  });
  ```

- [ ] Add test for .js files without React imports:
  ```javascript
  it('should not extract components from .js files without React imports', async () => {
    const testFile = path.join(tempDir, 'utility.js');
    const content = `
      export const formatDate = (date) => {
        return date.toISOString();
      };
    `;
    await fs.writeFile(testFile, content);
    
    const ast = await parser.parseFile(testFile);
    const components = parser.extractComponentDefinitions(ast, testFile);
    
    assert.strictEqual(components.length, 0);
  });
  ```

---

### Phase C: External Dependency Consolidation

**C1. Create External Package Node Consolidation** (`src/analyzers/dependency-analyser.ts`)

- [ ] Add `consolidateExternalImports()` method:
  ```typescript
  private consolidateExternalImports(components: ComponentInfo[]): Map<string, NodeInfo> {
    const externalPackages = new Map<string, NodeInfo>();
    
    for (const component of components) {
      for (const importInfo of component.imports) {
        if (this.isExternalPackage(importInfo.source)) {
          const packageName = this.getPackageName(importInfo.source);
          
          if (!externalPackages.has(packageName)) {
            externalPackages.set(packageName, {
              id: this.generateNodeId(),
              label: packageName,
              nodeType: 'external-dependency',
              nodeCategory: 'library',
              datatype: 'array',
              liveCodeScore: 100,
              file: '', // No specific file
              codeOwnership: 'external',
              isInfrastructure: true,
              properties: {
                packageName: packageName,
                importType: 'external'
              }
            });
          }
        }
      }
    }
    
    return externalPackages;
  }
  ```

- [ ] Add helper methods:
  ```typescript
  private isExternalPackage(importSource: string): boolean {
    // External if doesn't start with './' or '../'
    return !importSource.startsWith('./') && !importSource.startsWith('../');
  }
  
  private getPackageName(importSource: string): string {
    // Extract package name (e.g., "react-dom/client" → "react-dom")
    const parts = importSource.split('/');
    return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
  }
  ```

**C2. Update Node Creation Logic**

- [ ] Modify `createNodesFromComponents()` to use consolidated external imports:
  ```typescript
  private createNodesFromComponents(
    components: ComponentInfo[],
    liveCodeScores: Map<string, number>
  ): NodeInfo[] {
    const nodes: NodeInfo[] = [];
    
    // Create component nodes (internal code)
    for (const component of components) {
      const componentNode = this.createComponentNode(component, liveCodeScores);
      componentNode.codeOwnership = 'internal'; // Mark as custom code
      nodes.push(componentNode);
    }
    
    // Create consolidated external dependency nodes
    const externalPackages = this.consolidateExternalImports(components);
    nodes.push(...externalPackages.values());
    
    // ... rest of node creation (JSX elements, etc.)
    
    return nodes;
  }
  ```

**C3. Update Import Edge Creation**

- [ ] Modify import edge creation to connect to consolidated package nodes:
  ```typescript
  private createImportEdges(allNodes: NodeInfo[], components: ComponentInfo[]): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    
    for (const component of components) {
      const componentNode = allNodes.find(n => 
        n.label === component.name && 
        n.file === component.file &&
        n.codeOwnership === 'internal'
      );
      
      if (!componentNode) continue;
      
      for (const importInfo of component.imports) {
        if (this.isExternalPackage(importInfo.source)) {
          // Find consolidated external package node
          const packageName = this.getPackageName(importInfo.source);
          const packageNode = allNodes.find(n => 
            n.label === packageName && 
            n.nodeType === 'external-dependency'
          );
          
          if (packageNode) {
            edges.push({
              id: this.generateEdgeId(),
              source: componentNode.id,
              target: packageNode.id,
              relationship: 'imports',
              properties: {
                importType: 'external',
                packageName: packageName
              }
            });
          }
        } else {
          // Internal import - find the actual component node
          const targetComponent = allNodes.find(n => 
            this.matchesImportPath(n, importInfo.source, componentNode.file)
          );
          
          if (targetComponent) {
            edges.push({
              id: this.generateEdgeId(),
              source: componentNode.id,
              target: targetComponent.id,
              relationship: 'imports',
              properties: {
                importType: 'internal'
              }
            });
          }
        }
      }
    }
    
    return edges;
  }
  ```

---

### Phase D: Same-File Component Usage Support

**D1. Update JSX Usage Edge Creation** (`src/analyzers/dependency-analyser.ts`)

- [ ] Modify `createJSXUsageEdges()` to remove file restriction:
  ```typescript
  private createJSXUsageEdges(allNodes: NodeInfo[]): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    
    const componentNodes = allNodes.filter(node => 
      node.properties.type !== undefined && 
      node.nodeType === 'function' &&
      node.nodeCategory === 'front end' &&
      !node.properties.elementType
    );
    
    const jsxElementNodes = allNodes.filter(node => 
      this.isJSXComponentUsage(node)
    );
    
    for (const jsxNode of jsxElementNodes) {
      const targetComponentNode = componentNodes.find(compNode => 
        compNode.label === jsxNode.label
        // REMOVED: compNode.file !== jsxNode.file
      );
      
      if (!targetComponentNode) continue;
      
      const parentComponents = componentNodes.filter(compNode => 
        compNode.file === jsxNode.file
      );
      
      for (const parentComponent of parentComponents) {
        // Prevent self-referencing (recursion)
        if (parentComponent.id === targetComponentNode.id) {
          continue;
        }
        
        edges.push({
          id: this.generateEdgeId(),
          source: parentComponent.id,
          target: targetComponentNode.id,
          relationship: 'renders',
          properties: {
            jsxElement: jsxNode.label,
            usageFile: jsxNode.file,
            definitionFile: targetComponentNode.file,
            usageComponent: parentComponent.label
          }
        });
      }
    }
    
    return edges;
  }
  ```

**D2. Update Tests** (`test/dependency-analyser.test.js`)

- [ ] Add test for same-file component rendering:
  ```javascript
  it('should create JSX usage edges for components in the same file', () => {
    const nodes = [
      {
        id: 'comp1',
        label: 'ParentComponent',
        nodeType: 'function',
        nodeCategory: 'front end',
        file: '/app/components.tsx',
        properties: { type: 'functional' }
      },
      {
        id: 'comp2',
        label: 'ChildComponent',
        nodeType: 'function',
        nodeCategory: 'front end',
        file: '/app/components.tsx',
        properties: { type: 'functional' }
      },
      {
        id: 'jsx1',
        label: 'ChildComponent',
        nodeType: 'function',
        file: '/app/components.tsx',
        properties: { elementType: 'display' }
      }
    ];
    
    const edges = analyzer.createEdges(nodes);
    const renderEdges = edges.filter(e => e.relationship === 'renders');
    
    assert.strictEqual(renderEdges.length, 1);
    assert.strictEqual(renderEdges[0].source, 'comp1');
    assert.strictEqual(renderEdges[0].target, 'comp2');
  });
  ```

- [ ] Add test for self-reference prevention:
  ```javascript
  it('should not create self-referencing render edges', () => {
    const nodes = [
      {
        id: 'comp1',
        label: 'RecursiveComponent',
        nodeType: 'function',
        nodeCategory: 'front end',
        file: '/app/component.tsx',
        properties: { type: 'functional' }
      },
      {
        id: 'jsx1',
        label: 'RecursiveComponent',
        nodeType: 'function',
        file: '/app/component.tsx',
        properties: { elementType: 'display' }
      }
    ];
    
    const edges = analyzer.createEdges(nodes);
    const renderEdges = edges.filter(e => e.relationship === 'renders');
    
    assert.strictEqual(renderEdges.length, 0); // No self-reference
  });
  ```

---

### Phase E: Component → JSX Element "Contains" Edges

**E1. Create Contains Edges Method** (`src/analyzers/dependency-analyser.ts`)

- [ ] Add `createContainsEdges()` method using parentComponent tracking:
  ```typescript
  private createContainsEdges(allNodes: NodeInfo[]): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    
    // Get component nodes
    const componentNodes = allNodes.filter(node => 
      node.properties.type !== undefined && 
      node.nodeType === 'function' &&
      node.nodeCategory === 'front end' &&
      !node.properties.elementType &&
      node.codeOwnership === 'internal'
    );
    
    // Get JSX element nodes (HTML elements only, not component usage)
    const jsxElementNodes = allNodes.filter(node => 
      node.properties.elementType !== undefined &&
      !this.isJSXComponentUsage(node)
    );
    
    // Create edges from components to their JSX children using parentComponent field
    for (const componentNode of componentNodes) {
      // Find JSX elements that belong to this specific component
      const jsxChildren = jsxElementNodes.filter(jsx => 
        jsx.properties.parentComponent === componentNode.label &&
        jsx.file === componentNode.file
      );
      
      for (const jsxChild of jsxChildren) {
        edges.push({
          id: this.generateEdgeId(),
          source: componentNode.id,
          target: jsxChild.id,
          relationship: 'contains',
          properties: {
            elementType: jsxChild.properties.elementType,
            parentComponent: componentNode.label
          }
        });
      }
    }
    
    if (this.logger) {
      this.logger.logInfo('Contains edges created using parentComponent tracking', {
        totalComponentNodes: componentNodes.length,
        totalJSXElements: jsxElementNodes.length,
        containsEdges: edges.length
      });
    }
    
    return edges;
  }
  ```

- [ ] Update `createEdges()` to call new method:
  ```typescript
  createEdges(nodes: NodeInfo[]): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    
    try {
      // ... existing edge creation (import, API, DB edges)
      
      // Create "renders" edges (component → component)
      const jsxUsageEdges = this.createJSXUsageEdges(nodes);
      edges.push(...jsxUsageEdges);
      
      // Create "contains" edges (component → JSX element)
      const containsEdges = this.createContainsEdges(nodes);
      edges.push(...containsEdges);
      
      // Remove duplicate edges
      const uniqueEdges = this.removeDuplicateEdges(edges);
      
      if (this.logger) {
        this.logger.logInfo('Edge creation completed', {
          totalEdges: uniqueEdges.length,
          importEdges: uniqueEdges.filter(e => e.relationship === 'imports').length,
          callEdges: uniqueEdges.filter(e => e.relationship === 'calls').length,
          rendersEdges: uniqueEdges.filter(e => e.relationship === 'renders').length,
          containsEdges: uniqueEdges.filter(e => e.relationship === 'contains').length,
          dataEdges: uniqueEdges.filter(e => e.relationship === 'reads' || e.relationship === 'writes to').length
        });
      }
      
      return uniqueEdges;
    } catch (error) {
      // ... error handling
    }
  }
  ```

**E2. Update Tests** (`test/dependency-analyser.test.js`)

- [ ] Add test for contains edges with parentComponent tracking:
  ```javascript
  it('should create contains edges only for JSX elements with matching parentComponent', () => {
    const nodes = [
      {
        id: 'comp1',
        label: 'MyComponent',
        nodeType: 'function',
        nodeCategory: 'front end',
        file: '/app/component.tsx',
        codeOwnership: 'internal',
        properties: { type: 'functional' }
      },
      {
        id: 'comp2',
        label: 'OtherComponent',
        nodeType: 'function',
        nodeCategory: 'front end',
        file: '/app/component.tsx',
        codeOwnership: 'internal',
        properties: { type: 'functional' }
      },
      {
        id: 'jsx1',
        label: 'button',
        nodeType: 'function',
        file: '/app/component.tsx',
        properties: { 
          elementType: 'input',
          parentComponent: 'MyComponent' // Belongs to MyComponent
        }
      },
      {
        id: 'jsx2',
        label: 'div',
        nodeType: 'function',
        file: '/app/component.tsx',
        properties: { 
          elementType: 'display',
          parentComponent: 'OtherComponent' // Belongs to OtherComponent
        }
      }
    ];
    
    const edges = analyzer.createEdges(nodes);
    const containsEdges = edges.filter(e => e.relationship === 'contains');
    
    // Should have 2 edges: MyComponent→button and OtherComponent→div
    assert.strictEqual(containsEdges.length, 2);
    
    // Verify correct parent-child relationships
    const myComponentEdge = containsEdges.find(e => e.source === 'comp1');
    const otherComponentEdge = containsEdges.find(e => e.source === 'comp2');
    
    assert.ok(myComponentEdge);
    assert.strictEqual(myComponentEdge.target, 'jsx1'); // MyComponent contains button
    
    assert.ok(otherComponentEdge);
    assert.strictEqual(otherComponentEdge.target, 'jsx2'); // OtherComponent contains div
  });
  ```

- [ ] Add test for file with multiple components (no cross-contamination):
  ```javascript
  it('should not create contains edges between unrelated components in same file', () => {
    const nodes = [
      {
        id: 'comp1',
        label: 'ParentComponent',
        nodeType: 'function',
        nodeCategory: 'front end',
        file: '/app/multi.tsx',
        codeOwnership: 'internal',
        properties: { type: 'functional' }
      },
      {
        id: 'comp2',
        label: 'SiblingComponent',
        nodeType: 'function',
        nodeCategory: 'front end',
        file: '/app/multi.tsx',
        codeOwnership: 'internal',
        properties: { type: 'functional' }
      },
      {
        id: 'jsx1',
        label: 'button',
        nodeType: 'function',
        file: '/app/multi.tsx',
        properties: { 
          elementType: 'input',
          parentComponent: 'ParentComponent'
        }
      },
      {
        id: 'jsx2',
        label: 'input',
        nodeType: 'function',
        file: '/app/multi.tsx',
        properties: { 
          elementType: 'input',
          parentComponent: 'SiblingComponent'
        }
      }
    ];
    
    const edges = analyzer.createEdges(nodes);
    const containsEdges = edges.filter(e => e.relationship === 'contains');
    
    // Should NOT have ParentComponent→input or SiblingComponent→button
    const wrongEdges = containsEdges.filter(e => 
      (e.source === 'comp1' && e.target === 'jsx2') || // ParentComponent→input (WRONG)
      (e.source === 'comp2' && e.target === 'jsx1')    // SiblingComponent→button (WRONG)
    );
    
    assert.strictEqual(wrongEdges.length, 0, 'Should not create cross-component edges');
  });
  ```

---

### Phase F: JSX Instance Metadata (No Duplicate Nodes)

**F1. Update Node Creation Logic** (`src/analyzers/dependency-analyser.ts`)

- [ ] Modify JSX element node creation to check for local component matches:
  ```typescript
  private createNodesFromComponents(
    components: ComponentInfo[],
    liveCodeScores: Map<string, number>
  ): NodeInfo[] {
    const nodes: NodeInfo[] = [];
    
    // Create component nodes
    for (const component of components) {
      const componentNode = this.createComponentNode(component, liveCodeScores);
      componentNode.codeOwnership = 'internal';
      nodes.push(componentNode);
    }
    
    // Create consolidated external dependency nodes
    const externalPackages = this.consolidateExternalImports(components);
    nodes.push(...externalPackages.values());
    
    // Create JSX element nodes and track render locations
    for (const component of components) {
      for (const element of component.informativeElements) {
        const elementName = element.name;
        
        // Check if this JSX element matches any component definition (local or imported)
        const isComponentUsage = components.some(comp => 
          comp.name === elementName
          // Checks all components, not just same-file
        );
        
        if (isComponentUsage) {
          // Don't create node for component usage - add to renderLocations metadata
          const targetComponent = components.find(comp => 
            comp.name === elementName
          );
          
          if (targetComponent) {
            if (!targetComponent.renderLocations) {
              targetComponent.renderLocations = [];
            }
            targetComponent.renderLocations.push({
              file: component.file,
              line: 0, // Would need actual line from JSX parsing
              context: `Used in ${component.name}`
            });
          }
        } else {
          // Create JSX element node for HTML elements only (button, div, input, etc.)
          nodes.push(this.createInformativeElementNode(element, component.file, liveCodeScores));
        }
      }
    }
    
    return nodes;
  }
  ```

**F2. Update ComponentInfo with Render Locations**

- [ ] Ensure renderLocations are populated during analysis (already added type in Phase A)

**F3. Update Tests**

- [ ] Add test to verify no duplicate component nodes:
  ```javascript
  it('should not create duplicate nodes for component JSX usage (local or imported)', () => {
    const components = [
      {
        name: 'MainComponent',
        type: 'class',
        file: '/app/index.tsx',
        informativeElements: [
          { name: 'ChildComponent', type: 'display' } // Component usage
        ],
        imports: [],
        exports: [],
        props: [],
        state: [],
        hooks: [],
        children: []
      },
      {
        name: 'ChildComponent',
        type: 'functional',
        file: '/app/child.tsx',
        informativeElements: [],
        imports: [],
        exports: [],
        props: [],
        state: [],
        hooks: [],
        children: []
      }
    ];
    
    const graph = analyzer.buildDependencyGraph(components);
    const childComponentNodes = graph.nodes.filter(n => n.label === 'ChildComponent');
    
    assert.strictEqual(childComponentNodes.length, 1); // Only definition, not JSX instance
    
    // Should have renderLocations metadata instead
    const childComponent = components.find(c => c.name === 'ChildComponent');
    assert.ok(childComponent.renderLocations);
    assert.strictEqual(childComponent.renderLocations.length, 1);
  });
  ```

---

### Phase G: Event Handler Analysis & Edge Creation

**G1. Implement Event Handler Function Extraction** (`src/analyzers/ast-parser.ts`)

- [ ] Update `extractEventHandlers()` to extract full event handler information:
  ```typescript
  private extractEventHandlers(node: t.JSXElement): EventHandler[] {
    const handlers: EventHandler[] = [];
    
    node.openingElement.attributes?.forEach((attr) => {
      if (t.isJSXAttribute(attr) && 
          t.isJSXIdentifier(attr.name) && 
          attr.name.name.match(/^on[A-Z]/)) {
        
        const eventName = attr.name.name;
        let handlerInfo: EventHandler;
        
        // Case 1: Direct function reference - onClick={handleClick}
        if (t.isJSXExpressionContainer(attr.value) && 
            t.isIdentifier(attr.value.expression)) {
          handlerInfo = {
            name: eventName,
            type: 'function-reference',
            handler: attr.value.expression.name
          };
        }
        // Case 2: Arrow function - onClick={() => doSomething()}
        else if (t.isJSXExpressionContainer(attr.value) && 
                 t.isArrowFunctionExpression(attr.value.expression)) {
          const functionCalls = this.extractFunctionCallsFromArrowFunction(
            attr.value.expression
          );
          handlerInfo = {
            name: eventName,
            type: 'arrow-function',
            handler: functionCalls.join(', ')
          };
        }
        // Case 3: Inline function expression - onClick={function() {...}}
        else if (t.isJSXExpressionContainer(attr.value) && 
                 t.isFunctionExpression(attr.value.expression)) {
          const functionCalls = this.extractFunctionCallsFromFunction(
            attr.value.expression
          );
          handlerInfo = {
            name: eventName,
            type: 'function-expression',
            handler: functionCalls.join(', ')
          };
        }
        else {
          handlerInfo = {
            name: eventName,
            type: 'unknown',
            handler: 'unknown'
          };
        }
        
        handlers.push(handlerInfo);
      }
    });

    return handlers;
  }
  ```

- [ ] Add helper method to extract function calls from arrow functions:
  ```typescript
  private extractFunctionCallsFromArrowFunction(
    arrowFunc: t.ArrowFunctionExpression
  ): string[] {
    const calls: string[] = [];
    
    // Traverse arrow function body to find CallExpressions
    const visitor: Visitor = {
      CallExpression: (path) => {
        const callName = this.getCallExpressionName(path.node);
        if (callName && callName !== 'unknown') {
          calls.push(callName);
        }
      }
    };
    
    traverseFunction(arrowFunc.body as t.Node, visitor);
    
    return calls;
  }
  ```

- [ ] Add helper method to extract function calls from function expressions:
  ```typescript
  private extractFunctionCallsFromFunction(
    func: t.FunctionExpression
  ): string[] {
    const calls: string[] = [];
    
    const visitor: Visitor = {
      CallExpression: (path) => {
        const callName = this.getCallExpressionName(path.node);
        if (callName && callName !== 'unknown') {
          calls.push(callName);
        }
      }
    };
    
    traverseFunction(func.body as t.Node, visitor);
    
    return calls;
  }
  ```

- [ ] Update `InformativeElementInfo` extraction to use full `EventHandler` objects:
  ```typescript
  // In detectInputElements()
  const elementInfo: InformativeElementInfo = {
    type: 'input',
    name: this.getJSXElementName(path.node),
    elementType: 'JSXElement',
    props: this.extractJSXProps(path.node),
    eventHandlers: this.extractEventHandlers(path.node), // Now returns EventHandler[]
    dataBindings: [],
    line: path.node.loc?.start.line,
    column: path.node.loc?.start.column,
    file: ''
  };
  ```

**G2. Create Event Handler Edges** (`src/analyzers/dependency-analyser.ts`)

- [ ] Add `createEventHandlerEdges()` method:
  ```typescript
  private createEventHandlerEdges(allNodes: NodeInfo[]): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    
    // Get JSX element nodes (buttons, inputs with event handlers)
    const jsxElementNodes = allNodes.filter(node => 
      node.properties.elementType !== undefined &&
      node.properties.eventHandlers &&
      Array.isArray(node.properties.eventHandlers) &&
      node.properties.eventHandlers.length > 0
    );
    
    // Get all function nodes (component methods, standalone functions)
    const functionNodes = allNodes.filter(node => 
      node.nodeType === 'function' &&
      !node.properties.elementType // Not a JSX element
    );
    
    // Get all API nodes
    const apiNodes = allNodes.filter(node => 
      node.nodeType === 'API'
    );
    
    for (const jsxNode of jsxElementNodes) {
      const eventHandlers = jsxNode.properties.eventHandlers as Array<{
        name: string;
        type: string;
        handler: string;
      }>;
      
      for (const eventHandler of eventHandlers) {
        // Parse handler string - may contain multiple function calls
        const handlerFunctions = eventHandler.handler.split(',').map(h => h.trim());
        
        for (const handlerFunction of handlerFunctions) {
          // Try to find matching function node
          const targetNode = functionNodes.find(fn => 
            fn.label === handlerFunction
          ) || apiNodes.find(api => 
            api.label.includes(handlerFunction)
          );
          
          if (targetNode) {
            edges.push({
              id: this.generateEdgeId(),
              source: jsxNode.id,
              target: targetNode.id,
              relationship: 'calls',
              properties: {
                eventType: eventHandler.name,
                handlerType: eventHandler.type,
                triggerMechanism: 'user-interaction'
              }
            });
          }
        }
      }
    }
    
    return edges;
  }
  ```

- [ ] Update `createEdges()` to call new method:
  ```typescript
  createEdges(nodes: NodeInfo[]): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    
    try {
      // ... existing edge creation ...
      
      // Create "contains" edges (component → JSX element)
      const containsEdges = this.createContainsEdges(nodes);
      edges.push(...containsEdges);
      
      // NEW: Create event handler edges (JSX element → function/API)
      const eventHandlerEdges = this.createEventHandlerEdges(nodes);
      edges.push(...eventHandlerEdges);
      
      // Remove duplicate edges
      const uniqueEdges = this.removeDuplicateEdges(edges);
      
      if (this.logger) {
        this.logger.logInfo('Edge creation completed', {
          totalEdges: uniqueEdges.length,
          importEdges: uniqueEdges.filter(e => e.relationship === 'imports').length,
          callEdges: uniqueEdges.filter(e => e.relationship === 'calls').length,
          rendersEdges: uniqueEdges.filter(e => e.relationship === 'renders').length,
          containsEdges: uniqueEdges.filter(e => e.relationship === 'contains').length,
          eventHandlerEdges: eventHandlerEdges.length,
          dataEdges: uniqueEdges.filter(e => e.relationship === 'reads' || e.relationship === 'writes to').length
        });
      }
      
      return uniqueEdges;
    } catch (error) {
      // ... error handling ...
    }
  }
  ```

**G3. Verify Type Definitions** (`src/types/index.ts`)

- [ ] Verify `EventHandler` interface was added correctly in Phase A
- [ ] Verify `InformativeElementInfo` uses `EventHandler[]` (updated in Phase A)
- [ ] Confirm no TypeScript compilation errors after type changes

**G4. Update Tests** (`test/ast-parser.test.js`, `test/dependency-analyser.test.js`)

- [ ] Add test for event handler extraction with function reference:
  ```javascript
  it('should extract event handler with function reference', async () => {
    const testFile = path.join(tempDir, 'button.tsx');
    const content = `
      function MyComponent() {
        const handleClick = () => console.log('clicked');
        return <button onClick={handleClick}>Click</button>;
      }
    `;
    await fs.writeFile(testFile, content);
    
    const ast = await parser.parseFile(testFile);
    const elements = parser.extractInformativeElements(ast, testFile);
    
    assert.strictEqual(elements.length, 1);
    assert.strictEqual(elements[0].type, 'input');
    assert.strictEqual(elements[0].eventHandlers.length, 1);
    assert.strictEqual(elements[0].eventHandlers[0].name, 'onClick');
    assert.strictEqual(elements[0].eventHandlers[0].handler, 'handleClick');
  });
  ```

- [ ] Add test for event handler extraction with arrow function:
  ```javascript
  it('should extract event handler with arrow function and multiple calls', async () => {
    const testFile = path.join(tempDir, 'button.tsx');
    const content = `
      function MyComponent() {
        return (
          <button onClick={() => {
            validateInput();
            callAPI('/endpoint');
            updateState();
          }}>
            Submit
          </button>
        );
      }
    `;
    await fs.writeFile(testFile, content);
    
    const ast = await parser.parseFile(testFile);
    const elements = parser.extractInformativeElements(ast, testFile);
    
    assert.strictEqual(elements[0].eventHandlers[0].type, 'arrow-function');
    assert.ok(elements[0].eventHandlers[0].handler.includes('validateInput'));
    assert.ok(elements[0].eventHandlers[0].handler.includes('callAPI'));
    assert.ok(elements[0].eventHandlers[0].handler.includes('updateState'));
  });
  ```

- [ ] Add test for event handler edge creation:
  ```javascript
  it('should create edges from JSX elements to event handler functions', () => {
    const nodes = [
      {
        id: 'jsx1',
        label: 'button',
        nodeType: 'function',
        file: '/app/component.tsx',
        properties: {
          elementType: 'input',
          eventHandlers: [
            { name: 'onClick', type: 'function-reference', handler: 'handleClick' }
          ]
        }
      },
      {
        id: 'func1',
        label: 'handleClick',
        nodeType: 'function',
        nodeCategory: 'front end',
        file: '/app/component.tsx',
        properties: { type: 'functional' }
      }
    ];
    
    const edges = analyzer.createEdges(nodes);
    const eventEdges = edges.filter(e => 
      e.source === 'jsx1' && 
      e.target === 'func1' &&
      e.relationship === 'calls'
    );
    
    assert.strictEqual(eventEdges.length, 1);
    assert.strictEqual(eventEdges[0].properties.eventType, 'onClick');
  });
  ```

**G5. Update Documentation**

- [ ] Add examples to README showing event handler tracking
- [ ] Document edge flow: User → Button → Event Handler → Function → API → Database

---

### Phase H: Integration & Testing

**H1. Run Full Test Suite**

- [ ] Run `npm test` to ensure all unit tests pass
- [ ] Verify no test regressions

**H2. Run Analysis on Test Repository**

- [ ] Re-analyze react-typescript-helloworld:
  ```bash
  node dist/index.js analyze https://github.com/tomm/react-typescript-helloworld -o ./graph-data-files/react-typescript-helloworld.json
  ```

- [ ] Verify expected output:
  - [ ] No webpack.config.js component node
  - [ ] Only 1 "react" external dependency node (not 2-3)
  - [ ] Only 1 "react-dom" external dependency node
  - [ ] No separate "./components/Hello" import node (edge goes directly to Hello component)
  - [ ] No duplicate MainComponent nodes
  - [ ] "contains" edges from Hello → h1
  - [ ] "contains" edges from MainComponent → button, p
  - [ ] "renders" edge from MainComponent → Hello
  - [ ] "imports" edges from components to external packages
  - [ ] All nodes have `codeOwnership` property
  - [ ] External nodes have `isInfrastructure: true`

**H3. Validate Node Counts**

Expected output for react-typescript-helloworld:
- **Nodes**: ~9-10 (down from 13)
  - 2 component nodes (Hello, MainComponent)
  - 2 external dependency nodes (react, react-dom)
  - 4-5 JSX element nodes for HTML elements only (h1, button, p, etc.)
  - 0 import nodes (replaced by external dependencies)
  - 0 JSX nodes for component usage (replaced by direct "renders" edges and renderLocations metadata)
  
- **Edges**: ~10-12 (up from 2)
  - 2 imports edges (Hello→react, MainComponent→react/react-dom)
  - 1 renders edge (MainComponent→Hello)
  - 5-7 contains edges (components→JSX elements)
  - 0 self-referencing edges

**H4. Document Results**

- [ ] Update analysis log with new output format
- [ ] Create comparison document showing before/after node/edge counts
- [ ] Document filtering examples (show only internal code, etc.)

---

## 4. Testing Strategy

### Unit Tests
- [ ] All existing tests must pass
- [ ] New tests for React file filtering (ast-parser)
- [ ] New tests for external dependency consolidation (dependency-analyser)
- [ ] New tests for same-file component usage (dependency-analyser)
- [ ] New tests for "contains" edges (dependency-analyser)
- [ ] New tests for no duplicate component nodes (dependency-analyser)

### Integration Tests
- [ ] Re-analyze react-typescript-helloworld
- [ ] Validate output structure and counts
- [ ] Test filtering capabilities (internal only, external only)

### Regression Tests
- [ ] Ensure Phase 1 (component-level detection) still works
- [ ] Ensure Phase 2 (JSX usage edges) still works
- [ ] Verify no performance degradation

---

## 5. Success Criteria

### Functional Requirements
✅ webpack.config.js not detected as component  
✅ One node per external package (not per import)  
✅ Same-file component usage creates "renders" edges  
✅ "contains" edges from components to JSX elements using parentComponent tracking  
✅ Parent component correctly tracked for JSX elements (no file-level fallback)  
✅ Multiple components in same file have accurate JSX element ownership  
✅ No duplicate component nodes (definition only, no JSX instance nodes)  
✅ All nodes have `codeOwnership` property  
✅ External dependencies flagged with `isInfrastructure: true`  
✅ No self-referencing edges  
✅ Event handler function extraction working (function references, arrow functions, inline functions)  
✅ Event handler edges created from JSX elements to handler functions  
✅ Support for multiple function calls per event handler  

### Output Quality
✅ Reduced node count (fewer redundant nodes)  
✅ Increased edge count (more relationships captured)  
✅ Clear distinction between internal and external code  
✅ Filtering works correctly  

### Performance
✅ No significant performance degradation  
✅ All tests pass  
✅ Build and lint successful  

---

## 6. Implementation Notes

### Order of Implementation
The phases should be implemented in order (A → G) because:
1. Phase A (types) is foundation for all other changes
2. Phase B (AST filtering) is independent and can be done early
3. Phase C (external consolidation) depends on Phase A types
4. Phase D (same-file usage) is independent but benefits from Phase C cleanup
5. Phase E (contains edges) is independent
6. Phase F (JSX metadata) depends on understanding from Phases C-E
7. Phase G (integration) validates all changes together

### Code Review Checklist
- [ ] All type definitions properly exported
- [ ] No breaking changes to existing APIs
- [ ] Comprehensive docstrings added
- [ ] Error handling for edge cases
- [ ] Logging for debugging
- [ ] Performance considerations (no N² algorithms)

### Documentation Updates
- [ ] Architecture document (already updated)
- [ ] PRD (already updated)
- [ ] README.md (update examples with new output format)
- [ ] API documentation (if applicable)

---

## 7. Risks & Mitigation

### Risk 1: Breaking Changes
**Risk**: Changes to node structure might break existing consumers  
**Mitigation**: This is MVP phase, no external consumers yet. Changes are acceptable.

### Risk 2: Performance Impact
**Risk**: Additional edge creation might slow down large codebases  
**Mitigation**: Monitor performance benchmarks, optimize if needed

### Risk 3: Test Complexity
**Risk**: New test cases increase maintenance burden  
**Mitigation**: Keep tests focused and well-documented

---

## 8. Approval & Sign-off

**Approved by**: Nick Van Maele  
**Date**: 2025-10-03  
**Status**: Ready for Implementation

---

*This change request captures architectural decisions and implementation details for improving Code2Graph's focus on custom code analysis while reducing noise from external dependencies.*

