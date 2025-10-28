# Change Request 002: Hierarchical Layout with UI Section Grouping

**Date**: October 28, 2025  
**Status**: Planning Phase  
**Estimated Effort**: 92-140 hours  
**Priority**: High  

---

## 1. Problem Statement

### Observation
In the Code2Graph Visualizer, the codebase is presented as a force-directed graph without clear indication of where the logic begins and ends. Users cannot easily understand the application's logical flow from UI through middleware to database.

### User Impact
- Difficult to trace data flow through the application
- Cannot distinguish UI elements from backend logic
- No visual indication of application structure (tabs, pages, sections)
- Hard to understand which components belong to which UI sections

---

## 2. Desired Effects

### 2.1 Hierarchical Left-to-Right Layout
Show all UI elements on the left-hand side, all database tables on the right-hand side, and all intermediate nodes (middleware, services, APIs) in between. The logical flow should go from left to right on the screen with edges predominantly flowing left-to-right.

**Visual Goal**: 
```
[UI Layer]  →  [Middleware Layer]  →  [Database Layer]
  (Left)           (Center)              (Right)
```

### 2.2 UI Section Grouping
For major UI sections (visible tabs like Home, Manage, Admin, etc.; and menu items like Messages, Help, User Avatar), create first-level graph nodes. For the components and UI elements in each such section, create nodes also, and create a "displays" relationships from the first-level graph nodes to the nodes representing their components. 

---

## 3. Technical Approach

### 3.1 Architecture Decisions

| Decision Point | Chosen Approach | Rationale |
|---------------|-----------------|-----------|
| **Grouping Method** | UI sections as nodes (not compound nodes or background shapes) | More graph-native, works better with dagre layout, easier to query |
| **Section Discovery** | Generic detection (not hardcoded routes) | Works with any codebase, not specific or custom-developed for any single app |
| **Shared Components** | Multiple "displays" edges from different sections to their visible UI components | Accurately represents reality where dialogs/components appear in multiple places |
| **Layout Algorithm** | Pure dagre (directed acyclic graph) | Designed for hierarchical left-to-right layouts |
| **Data Pipeline** | Modify existing analyzers | Maintains consistency with current architecture |

### 3.2 Solution Architecture

#### New Node Type: UI Section
```typescript
{
  id: "node_19", //use "node" + auto-increment integers
  label: "Manage", //visible name of tab on the app UI screen
  nodeType: "ui-section", 
  nodeCategory: "front-end", 
  datatype: "section", 
  liveCodeScore: 100, 
  file: "client/src/App.tsx",
  line: 58, //line where definition starts
  codeOwnership: "internal", 
  properties: {
    routePath: "/manage",
    routeComponent: "Manage",
    sectionType: "tab" | "menu" | "modal"
  }
}
```

#### Example of a Regular Component Node (Not a UI Section)
```typescript
{
  id: "node_201", //use "node" + auto-increment integers
  label: "ClubMembersButton", //component or element name
  nodeType: "function", 
  nodeCategory: "front-end", 
  datatype: "array", 
  liveCodeScore: 100, 
  file: "client/src/pages/Manage.tsx",
  line: 145, //line where definition starts
  codeOwnership: "internal", 
  properties: {
    type: "functional",
    props: [],
    state: [],
    hooks: []
  }
}
```

#### New Relationship Type: "displays"
```typescript
{
  id: "edge_107", //use "edge" + auto-increment integers
  source: "node_19", //ID of the "Manage" node 
  target: "node_201", //example of a button node ID
  relationship: "displays", 
  properties: {
    displayContext: "primary-action" | "form-field" | "navigation"
  }
}
```

#### Visual Representation
```
[Manage Section Node]
    ├── displays → [Mark Attendance Button]
    ├── displays → [Grading/Exam Button]
    ├── displays → [Club Calendar Button]
    ├── displays → [Reports Button]
    ├── displays → [Club Members Button]
    └── displays → [Club Settings Button]
```

---

## 4. Implementation Plan

### Phase 1: Foundation (Critical Path)
**Estimated Effort**: 14-24 hours

#### 1.1 Update Type Definitions
- Add `nodeType: "ui-section"` to NodeType union
- Add `relationship: "displays"` to RelationshipType union
- Add `sectionType` to node properties interface

**Files**: `src/types/index.ts`

#### 1.2 Fix Node Categorization
**Problem**: Current analyzer marks all nodes as `nodeCategory: "front-end"`

**Solution**: Properly categorize nodes:
- UI components/elements → `"front-end"`
- API endpoints → `"api"`
- services, middleware → `"middleware"`
- Database tables, views, queries → `"database"`
- External libraries → `"library"`

**Files**: 
- `src/analyzers/ast-parser.ts`
- `src/analyzers/connection-mapper.ts`
- `src/analyzers/database-analyzer.ts`

### Phase 2: Router Detection (Most Complex)
**Estimated Effort**: 28-40 hours

#### 2.1 Generic Router File Detection
**Goal**: Identify routing configuration files without hardcoding

**Detection Patterns**:
```typescript
interface RouterDetectionPattern {
  framework: 'react' | 'vue' | 'angular' | 'generic';
  routerLibraries: string[];  // Import sources to look for
  routePatterns: {
    componentProp: string;    // 'component', 'element', 'render'
    pathProp: string;         // 'path', 'to', 'route'
    nodeType: string;         // 'JSXElement', 'ObjectExpression'
  };
}
```

**Supported Frameworks (Initial)**:
- React Router (`react-router-dom`)
- Wouter (`wouter`)
- Next.js (pages directory + app directory)
- Generic JSX route patterns

**Implementation Strategy**:
1. Scan files for routing library imports
2. Detect routing patterns in AST
3. Mark files as router configuration files

**Files**: `src/analyzers/ast-parser.ts` (new methods)

#### 2.2 Route Extraction Logic
**Goal**: Extract route definitions from router configuration

**Extract from JSX**:
```jsx
<Route path="/manage" component={Manage} />
<Route path="/library" element={<Library />} />
```

**Extract from Configuration Objects**:
```javascript
const routes = [
  { path: '/manage', component: Manage },
  { path: '/library', component: Library }
];
```

**Extracted Information**:
```typescript
interface RouteInfo {
  path: string;              // "/manage"
  component: string;         // "Manage"
  label?: string;            // "Manage" (derived from component or explicit)
  file: string;              // File where route is defined
  line?: number;
  sectionType: 'tab' | 'menu' | 'modal';
}
```

**Files**: `src/analyzers/ast-parser.ts` (new `extractRoutes()` method)

#### 2.3 Navigation UI Detection
**Goal**: Detect non-route UI sections (menu items, icons)

**Patterns to Detect**:
- Navigation bars with multiple buttons
- Top menu icons with click handlers
- Tab bars
- Sidebar navigation

**Heuristics**:
1. Look for arrays of navigation items
2. Detect click handlers that navigate (`onClick={() => navigate('/path')}`)
3. Find persistent layout components (header, navbar)
4. Identify icon buttons in header sections

**Example from MartialApps**:
```jsx
// Top menu icons 
<button onClick={() => navigate('/messages')}>
  <i className="fas fa-envelope"></i>
</button>
```

**Files**: `src/analyzers/ast-parser.ts` (new `extractNavigationElements()` method)

### Phase 3: Component Mapping (High Value)
**Estimated Effort**: 24-36 hours

#### 3.1 Component Tree Traversal
**Goal**: Build complete component hierarchy for each route

**Algorithm**:
```
1. Start from route component (e.g., "Manage.tsx")
2. Parse file and extract:
   - All JSX element usages
   - All imported components
3. Recursively traverse each child component
4. Build tree of all descendants
5. Mark all descendants with parent section ID
```

**Data Structure**:
```typescript
interface ComponentTreeNode {
  componentId: string;
  componentName: string;
  file: string;
  children: ComponentTreeNode[];
  parentSections: string[];  // Can belong to multiple sections
}
```

**Implementation**:
```typescript
function buildComponentTree(
  rootComponent: string,
  allComponents: ComponentInfo[],
  visited: Set<string> = new Set()
): ComponentTreeNode {
  if (visited.has(rootComponent)) return null;
  visited.add(rootComponent);
  
  const component = allComponents.find(c => c.name === rootComponent);
  if (!component) return null;
  
  const children = component.imports
    .filter(imp => isComponentImport(imp))
    .map(imp => buildComponentTree(imp.name, allComponents, visited))
    .filter(Boolean);
  
  return {
    componentId: component.id,
    componentName: rootComponent,
    file: component.file,
    children,
    parentSections: []
  };
}
```

**Files**: `src/analyzers/dependency-analyser.ts` (new method)

#### 3.2 Map Components to Sections
**Goal**: Associate each component with its parent UI section(s)

**Algorithm**:
```
1. For each route/section:
   - Build complete component tree
   - Flatten tree to list of component IDs
   - Store mapping: componentId → [sectionId1, sectionId2, ...]

2. Handle shared components:
   - Dialog used in multiple sections → multiple parent sections
   - Utility component → inherits sections from usage locations
```

**Data Structure**:
```typescript
interface ComponentToSectionMapping {
  componentId: string;
  sectionIds: string[];     // Array because components can be shared
  usageLocations: {
    sectionId: string;
    context: 'primary-content' | 'modal' | 'shared-utility';
  }[];
}
```

**Files**: `src/analyzers/dependency-analyser.ts` (new method)

#### 3.3 Handle Shared Components
**Scenario**: `AddMemberDialog` used in both "Manage" and "Admin" sections

**Solution**: Create multiple "displays" edges
```
[Manage Section] --displays--> [AddMemberDialog]
[Admin Section]  --displays--> [AddMemberDialog]
```

**Benefits**:
- Accurate representation
- Shows component reuse
- Maintains graph integrity

**Files**: `src/analyzers/connection-mapper.ts`

### Phase 4: Graph Generation (Integration)
**Estimated Effort**: 12-20 hours

#### 4.1 Create Section Nodes
**Goal**: Generate UI section nodes in the graph JSON

**Implementation**:
```typescript
function createSectionNodes(routes: RouteInfo[]): NodeInfo[] {
  return routes.map((route, index) => ({
    id: `section_${sanitizeId(route.path)}`,
    label: route.label || route.component,
    nodeType: "ui-section",
    nodeCategory: "front-end",
    datatype: "section",
    liveCodeScore: 100,
    file: route.file,
    line: route.line,
    codeOwnership: "internal",
    properties: {
      routePath: route.path,
      routeComponent: route.component,
      sectionType: route.sectionType
    }
  }));
}
```

**Files**: `src/generators/json-generator.ts`

#### 4.2 Create "displays" Edges
**Goal**: Connect section nodes to their components/UI elements

**Implementation**:
```typescript
function createDisplaysEdges(
  sections: NodeInfo[],
  componentMappings: ComponentToSectionMapping[]
): EdgeInfo[] {
  const edges: EdgeInfo[] = [];
  
  for (const mapping of componentMappings) {
    for (const sectionId of mapping.sectionIds) {
      edges.push({
        id: `edge_${sectionId}_displays_${mapping.componentId}`,
        source: sectionId,
        target: mapping.componentId,
        relationship: "displays",
        properties: {
          displayContext: determineContext(mapping.usageLocations, sectionId)
        }
      });
    }
  }
  
  return edges;
}
```

**Files**: `src/analyzers/connection-mapper.ts`

#### 4.3 Update Connection Mapper
**New Relationship Type**: Add "displays" to relationship handling

**Files**: `src/analyzers/connection-mapper.ts`

### Phase 5: Visualization (User-Facing)
**Estimated Effort**: 14-20 hours

#### 5.1 Add Dagre Layout
**Goal**: Implement hierarchical left-to-right layout

**Implementation**:
```javascript
// Add to visualizer.js
// Include cytoscape-dagre library in index.html
<script src="https://unpkg.com/dagre@0.8.5/dist/dagre.min.js"></script>
<script src="https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js"></script>

// Register extension
cytoscape.use(cytoscapeDagre);

// Add dagre layout option
document.getElementById('layoutSelect').innerHTML += `
  <option value="dagre">Hierarchical (Left-to-Right)</option>
`;

// Handle dagre layout
if (layoutName === 'dagre') {
  cy.layout({
    name: 'dagre',
    rankDir: 'LR',           // Left-to-right
    ranker: 'network-simplex',
    rankSep: 200,            // Horizontal spacing between ranks
    nodeSep: 100,            // Vertical spacing between nodes
    fit: true,
    padding: 30
  }).run();
}
```

**Files**: 
- `visualizer/index.html` (add scripts)
- `visualizer/visualizer.js` (add layout option)

#### 5.2 Style Section Nodes
**Goal**: Make UI section nodes visually distinct

**Implementation**:
```javascript
// Add to Cytoscape styles
{
  selector: 'node[nodeType = "ui-section"]',
  style: {
    'background-color': '#3B82F6',  // Blue for sections
    'shape': 'roundrectangle',
    'width': 120,
    'height': 60,
    'font-size': '14px',
    'font-weight': 'bold',
    'border-width': 3,
    'border-color': '#1E40AF'
  }
}
```

**Files**: `visualizer/visualizer.js`

#### 5.3 Style "displays" Edges
**Goal**: Distinguish "displays" relationships from other edge types

**Implementation**:
```javascript
{
  selector: 'edge[relationship = "displays"]',
  style: {
    'width': 2,
    'line-color': '#3B82F6',
    'target-arrow-color': '#3B82F6',
    'line-style': 'solid',
    'opacity': 0.7
  }
}
```

**Files**: `visualizer/visualizer.js`

---

## 5. Complexity Assessment

| Task | Complexity | Estimated Effort | Files to Modify |
|------|-----------|------------------|-----------------|
| **1. Add dagre layout** | Low | 2-4 hours | `visualizer/visualizer.js`, `visualizer/index.html` |
| **2. Fix node categorization** | Medium | 8-12 hours | `ast-parser.ts`, `connection-mapper.ts` |
| **3. Generic router detection** | High | 16-24 hours | `ast-parser.ts` (new methods) |
| **4. Route extraction logic** | High | 12-16 hours | `ast-parser.ts` |
| **5. Component tree traversal** | High | 16-24 hours | `dependency-analyser.ts` |
| **6. Create section nodes** | Medium | 4-8 hours | `json-generator.ts` |
| **7. Create "displays" edges** | Medium | 8-12 hours | `connection-mapper.ts` |
| **8. Handle shared components** | Medium | 8-12 hours | `connection-mapper.ts` |
| **9. Update type definitions** | Low | 2-4 hours | `types/index.ts` |
| **10. Testing & refinement** | High | 16-24 hours | Multiple files |

**Total Estimated Effort**: 92-140 hours

---

## 6. Challenges and Risks

### 6.1 High-Risk Challenges

#### Generic Router Detection (Risk: High)
**Problem**: Every framework has different routing patterns
- React: react-router, wouter, Next.js, Remix
- Vue: vue-router
- Angular: @angular/router
- Svelte: SvelteKit routing

**Impact**: May not work for all apps initially

**Mitigation**:
- Start with React frameworks (most common)
- Build extensible pattern system
- Document supported frameworks
- Provide configuration override option

#### Component Tree Completeness (Risk: Medium)
**Problem**: Dynamic scenarios hard to detect statically
- Dynamic imports: `const Component = lazy(() => import('./Component'))`
- Conditional rendering: `{condition && <Component />}`
- Render props: `<Provider>{children}</Provider>`

**Impact**: May miss some components in section mapping

**Mitigation**:
- Best-effort static analysis
- Focus on common patterns
- Log unresolved components for debugging

### 6.2 Medium-Risk Challenges

#### Non-Route UI Sections (Risk: Medium)
**Problem**: Top menu icons (Messages, Help, Profile) aren't routes in traditional sense

**Examples**:
- Modal triggers
- Dropdown menus
- Icon buttons that open panels

**Solution**:
- Detect navigation click handlers
- Treat them as section entry points
- Mark as `sectionType: "menu"` vs `"tab"`

#### Framework Variability (Risk: Medium)
**Problem**: Each framework structures apps differently

**Mitigation**:
- Plugin architecture for framework-specific analyzers
- Start with one framework, expand iteratively
- Community contributions for additional frameworks

### 6.3 Low-Risk Challenges

#### Performance Impact (Risk: Low)
**Problem**: Additional analysis increases processing time

**Mitigation**:
- Efficient tree traversal algorithms
- Caching of component trees
- Optional feature flag

#### Graph Complexity (Risk: Low)
**Problem**: Adding section nodes increases graph size

**Impact**: ~8 additional nodes for typical app

**Mitigation**: Minimal impact, dagre handles it well

---

## 7. Success Criteria

### 7.1 Functional Requirements
- ✅ UI elements positioned on left side of graph
- ✅ Database tables positioned on right side
- ✅ Middleware nodes positioned in center
- ✅ Edges flow predominantly left-to-right
- ✅ UI sections represented as nodes
- ✅ "displays" relationships connect sections to components
- ✅ Works with MartialApps codebase
- ✅ Works with at least one other React app (test repository)

### 7.2 Quality Requirements
- ✅ No hardcoded application-specific logic
- ✅ Generic router detection works for common frameworks
- ✅ Shared components correctly show multiple parent sections
- ✅ Section nodes visually distinct from component nodes
- ✅ Performance degradation < 20% for analysis phase
- ✅ All existing tests pass
- ✅ New tests added for router detection and component mapping

### 7.3 User Experience Requirements
- ✅ Logical flow is immediately apparent
- ✅ Can trace from UI section → component → API → database
- ✅ Sections labeled clearly
- ✅ Layout remains readable with 500+ nodes
- ✅ Can toggle dagre layout on/off
- ✅ Section nodes show in node details panel

---

## 8. Testing Strategy

### 8.1 Unit Tests
**Router Detection**:
- Test with React Router syntax
- Test with Wouter syntax
- Test with Next.js pages directory
- Test with configuration objects
- Test with no router (should gracefully handle)

**Component Tree Traversal**:
- Test linear hierarchy (A → B → C)
- Test branching hierarchy (A → [B, C, D])
- Test circular imports (should detect and stop)
- Test missing components (should log and continue)

**Section Mapping**:
- Test single section per component
- Test shared component (multiple sections)
- Test deeply nested components

### 8.2 Integration Tests
**Full Pipeline**:
- Analyze MartialApps codebase
- Verify section nodes created
- Verify "displays" edges created
- Verify correct categorization (frontend/middleware/database)

**Layout Verification**:
- Load graph in visualizer
- Apply dagre layout
- Verify UI nodes on left
- Verify database nodes on right
- Verify edges flow left-to-right

### 8.3 Manual Testing
**Visual Verification**:
- Load MartialApps graph
- Check "Manage" section contains expected components
- Verify shared dialogs have multiple parent sections
- Test with second repository (react-typescript-helloworld)

---

## 9. Rollout Plan

### Phase 1: Core Infrastructure (Week 1-2)
- Update type definitions
- Fix node categorization
- Add dagre layout to visualizer
- **Milestone**: Can visualize existing graphs in hierarchical layout

### Phase 2: Router Detection (Week 3-4)
- Implement router file detection
- Implement route extraction for React
- Create section nodes
- **Milestone**: Section nodes appear in graph

### Phase 3: Component Mapping (Week 5-6)
- Build component tree traversal
- Map components to sections
- Create "displays" edges
- **Milestone**: Complete graph with sections and relationships

### Phase 4: Testing & Refinement (Week 7-8)
- Unit tests for all new functionality
- Integration tests with test repositories
- Performance optimization
- Documentation updates
- **Milestone**: Production ready

---

## 10. Future Enhancements (Out of Scope)

### Additional Framework Support
- Vue Router detection
- Angular routing detection
- Svelte routing detection

### Advanced Component Mapping
- Dynamic import resolution
- Render prop tracing
- Higher-order component unwrapping

### Enhanced Visualization
- Collapsible section nodes
- Minimap showing high-level structure
- Path highlighting (section → component → API → database)
- Filter by section

### Configuration Options
- Custom section definitions
- Manual section override file
- Exclude certain sections from analysis

---

## 11. References

### Cytoscape.js Documentation
- Dagre Layout: https://github.com/cytoscape/cytoscape.js-dagre
- Compound Nodes: https://js.cytoscape.org/#notation/compound-nodes
- Styling: https://js.cytoscape.org/#style

### Framework Routing Documentation
- React Router: https://reactrouter.com/
- Wouter: https://github.com/molefrog/wouter
- Next.js Routing: https://nextjs.org/docs/routing/introduction

### Related Documents
- `ARCHITECTURE.md` - Overall system architecture
- `code2graph-architecture.md` - Detailed architecture specifications
- `code2graph-prd.md` - Product requirements

---

## 12. Approval and Sign-off

**Prepared by**: AI Assistant (Claude Sonnet 4.5)  
**Date**: October 28, 2025  

**Review Status**: Pending  
**Implementation Status**: Not Started  

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Oct 28, 2025 | AI Assistant | Initial draft |

