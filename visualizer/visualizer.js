/**
 * Code2Graph Visualizer
 * Transforms code2graph JSON output into interactive graph visualization
 */

// Change Request 002 - Phase 5: Register Dagre Extension
// Context: Enables hierarchical left-to-right layout for UI sections
// Business Logic: Dagre algorithm positions nodes by category (front-end, middleware, api, database)
if (typeof cytoscape !== 'undefined' && typeof cytoscapeDagre !== 'undefined') {
    cytoscape.use(cytoscapeDagre);
}

let cy;

/**
 * Global state management for node focus functionality
 * Tracks whether focus mode is active and which node is currently focused
 * Business Logic: Enables toggling between normal view and focused view of node connections
 */
let focusState = {
    isActive: false,
    focusedNodeId: null
};

/**
 * Initialize Cytoscape.js with empty graph
 */
function initializeCytoscape() {
    cy = cytoscape({
        container: document.getElementById('cy'),
        elements: [],
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': '#666',
                    'label': 'data(label)',
                    // Node sizes are now calculated programmatically based on degree
                    // and adjusted on zoom to maintain constant screen size
                    // Default size is set here and will be overridden after nodes are added
                    'width': 40,
                    'height': 40,
                    
                    // Label positioning: Place labels to the right of nodes, not inside
                    // This prevents text overflow when labels are too long for node size
                    'font-size': '10px',
                    'color': '#333', // Dark text for white background (changed from #fff)
                    'text-valign': 'center',
                    'text-halign': 'right', // Position label to the right of node
                    'text-margin-x': '3px', // 8px horizontal spacing between node and label
                    
                    // Zoom-independent font sizing 
                    // Prevents labels from becoming unreadable when zoomed out
                    'min-zoomed-font-size': '8px',
                    
                    // Text background for better readability over edges and complex backgrounds
                    // Semi-transparent white background behind labels
                    'text-background-color': '#ffffff',
                    'text-background-opacity': 0.85,
                    'text-background-padding': '3px',
                    'text-background-shape': 'roundrectangle'
                }
            },
            {
                selector: 'node[type = "function"]',
                style: {
                    'background-color': '#4CAF50',
                    'shape': 'ellipse'
                }
            },
            {
                selector: 'node[type = "external-dependency"]',
                style: {
                    'background-color': '#FF9800',
                    'shape': 'diamond'
                }
            },
            // Change Request 002 - Phase 5: UI Section Node Styling
            // Context: UI sections are first-level nodes representing screens/tabs/pages
            // Business Logic: Leftmost nodes in hierarchical layout, larger size to emphasize hierarchy
            {
                selector: 'node[type = "ui-section"]',
                style: {
                    'background-color': '#2196F3',
                    'shape': 'roundrectangle',
                    'width': 60,
                    'height': 40,
                    'font-size': '12px',
                    'font-weight': 'bold',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'color': '#ffffff',
                    'text-background-opacity': 0
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 1,
                    'line-color': '#B8B8B8',
                    'target-arrow-color': '#B8B8B8',
                    'target-arrow-shape': 'vee',
                    'arrow-scale': 0.5,
                    'curve-style': 'bezier'
                }
            },
            // Change Request 002 - Phase 5: Displays Edge Styling
            // Context: "displays" relationships connect UI sections to their components
            // Business Logic: Distinct visual from other edges to show section-component membership
            {
                selector: 'edge[relationship = "displays"]',
                style: {
                    'width': 2,
                    'line-color': '#2196F3',
                    'target-arrow-color': '#2196F3',
                    'target-arrow-shape': 'triangle',
                    'arrow-scale': 1.2,
                    'curve-style': 'bezier',
                    'line-style': 'solid'
                }
            },
            // Focus Mode Styles - Enhanced Node Click Functionality
            // These styles are applied when users click nodes to focus on their connections
            {
                selector: '.node-focused',
                style: {
                    'border-width': 4,
                    'border-color': '#ff6b35',
                    'background-color': '#fff3e0',
                    'box-shadow': '0 0 15px rgba(255, 107, 53, 0.4)'
                }
            },
            {
                selector: '.node-connected',
                style: {
                    'border-width': 3,
                    'border-color': '#4caf50',
                    'background-color': '#e8f5e8',
                    'box-shadow': '0 0 10px rgba(76, 175, 80, 0.3)'
                }
            },
            {
                selector: '.node-dimmed',
                style: {
                    'opacity': 0.3,
                    'background-color': '#f5f5f5',
                    'border-color': '#e0e0e0'
                }
            },
            {
                selector: '.edge-focused',
                style: {
                    'width': 3,
                    'line-color': '#ff6b35',
                    'target-arrow-color': '#ff6b35',
                    'opacity': 1
                }
            },
            {
                selector: '.edge-dimmed',
                style: {
                    'opacity': 0.2,
                    'line-color': '#d0d0d0',
                    'target-arrow-color': '#d0d0d0'
                }
            },
            // Search Highlight Style
            // Applied when user searches for nodes by label
            {
                selector: '.search-highlight',
                style: {
                    'background-color': '#FFEB3B',
                    'border-width': 3,
                    'border-color': '#FBC02D',
                    'border-style': 'solid',
                    'z-index': 9999
                }
            }
        ],
        layout: {
            name: 'cose',
            fit: true,
            padding: 30
        }
    });
    
    // Setup zoom-independent font sizing (Hybrid approach - Option C)
    // This ensures labels don't become too large when zooming in
    // Combined with min-zoomed-font-size, this creates reasonable bounds on label size
    setupZoomIndependentLabels();
    
    // Setup zoom-independent node sizing
    // This keeps node icons at constant screen size when zooming, reducing visual clutter
    // while still allowing distances between nodes to change naturally
    setupZoomIndependentNodeSizes();
}

/**
 * Setup zoom event handler for controlling maximum label font size
 * Business Logic: Prevents labels from growing too large when users zoom in
 * 
 * Hybrid Approach (Option C):
 * - Uses Cytoscape's built-in min-zoomed-font-size (8px) to prevent shrinking when zoomed out
 * - Uses custom zoom event handler to cap maximum size (12px) when zoomed in
 * - Result: Labels stay readable at all zoom levels without becoming oversized
 */
function setupZoomIndependentLabels() {
    const BASE_FONT_SIZE = 10; // Base font size at zoom level 1.0
    const MAX_FONT_SIZE = 12; // Maximum font size regardless of zoom level
    
    cy.on('zoom', function() {
        const zoomLevel = cy.zoom();
        
        // Calculate what the font size would be at current zoom
        // Cytoscape naturally scales font size with zoom level
        const naturalFontSize = BASE_FONT_SIZE * zoomLevel;
        
        // Cap the font size at MAX_FONT_SIZE when zooming in
        // When zoomed in beyond a certain level, override the natural scaling
        if (naturalFontSize > MAX_FONT_SIZE) {
            const adjustedFontSize = MAX_FONT_SIZE / zoomLevel;
            cy.style()
                .selector('node')
                .style('font-size', adjustedFontSize + 'px')
                .update();
        } else {
            // Reset to base font size when within normal zoom range
            // Let Cytoscape's natural scaling handle it
            cy.style()
                .selector('node')
                .style('font-size', BASE_FONT_SIZE + 'px')
                .update();
        }
    });
}

/**
 * Setup zoom event handler for keeping node sizes constant on screen
 * Business Logic: Prevents node icons from growing/shrinking when users zoom
 * 
 * Context: By default, Cytoscape scales node sizes with zoom level, which clutters the screen
 * when zooming in without adding value. This function keeps node icon sizes constant while
 * still allowing distances between nodes to change naturally with zoom.
 * 
 * Implementation Strategy:
 * - Store each node's base size as a data attribute when nodes are created
 * - On zoom events, calculate adjusted size: adjustedSize = baseSize / zoomLevel
 * - This inverse relationship keeps rendered size constant on screen
 * - Distances between nodes still increase/decrease naturally with zoom
 * 
 * Result: Node icons stay at constant screen size regardless of zoom level, reducing visual
 * clutter while maintaining spatial relationship clarity.
 */
function setupZoomIndependentNodeSizes() {
    cy.on('zoom', function() {
        const zoomLevel = cy.zoom();
        
        // Iterate through all nodes and adjust their size inversely to zoom level
        // This keeps the rendered size constant on screen
        cy.nodes().forEach(function(node) {
            // Get the base size stored when the node was created
            // Base size is calculated from node degree (number of connections)
            const baseWidth = node.data('baseWidth');
            const baseHeight = node.data('baseHeight');
            
            // Calculate adjusted size: inverse of zoom level
            // When zoom increases (zoom in), we decrease the size proportionally
            // When zoom decreases (zoom out), we increase the size proportionally
            // Result: constant screen size regardless of zoom level
            const adjustedWidth = baseWidth / zoomLevel;
            const adjustedHeight = baseHeight / zoomLevel;
            
            // Apply the adjusted sizes to the node
            // This overrides Cytoscape's default zoom scaling behavior for node sizes
            node.style({
                'width': adjustedWidth,
                'height': adjustedHeight
            });
        });
    });
}

/**
 * Calculate and store base node sizes based on node degree
 * Business Logic: Node size reflects importance (number of connections)
 * 
 * Context: Nodes are sized based on their degree (number of connections) to visually
 * indicate their importance in the dependency graph. This function calculates and stores
 * these base sizes so they can be used for zoom-independent sizing.
 * 
 * @param {Object} node - Cytoscape node object
 */
function calculateAndStoreBaseSize(node) {
    // Get node degree (number of connections)
    const degree = node.degree();
    
    // Map degree to size range: 0-20 connections → 20-100 pixels
    // This matches the original Cytoscape mapData configuration
    const minDegree = 0;
    const maxDegree = 20;
    const minSize = 20;
    const maxSize = 100;
    
    // Linear interpolation formula: size = minSize + (degree - minDegree) * (maxSize - minSize) / (maxDegree - minDegree)
    // Clamp degree to [minDegree, maxDegree] range to prevent oversized nodes
    const clampedDegree = Math.min(Math.max(degree, minDegree), maxDegree);
    const baseSize = minSize + (clampedDegree - minDegree) * (maxSize - minSize) / (maxDegree - minDegree);
    
    // Store base sizes as node data attributes for use in zoom handler
    node.data('baseWidth', baseSize);
    node.data('baseHeight', baseSize);
}

/**
 * Get dagre rank (column position) based on node category
 * Change Request 002 - Phase 5 Bug Fix: Assign explicit ranks to nodes
 * Context: Dagre reads rank from node data, not from layout options
 * Business Logic: Maps node categories to column positions (0=leftmost, 3=rightmost)
 * 
 * @param {string} category - Node category (front-end, middleware, api, database)
 * @returns {number} - Rank number (0-3) for hierarchical positioning
 */
function getCategoryRank(category) {
    const categoryRank = {
        'front-end': 0,    // Column 0 (leftmost) - UI elements start here
        'middleware': 1,   // Column 1 - Business logic and handlers
        'api': 2,          // Column 2 - API endpoints
        'database': 3,     // Column 3 (rightmost) - Data persistence layer
        'library': 1       // External libraries positioned with middleware
    };
    return categoryRank[category] !== undefined ? categoryRank[category] : 1;
}

/**
 * Transform code2graph JSON to Cytoscape.js format
 * @param {Object} data - code2graph JSON data
 * @returns {Object} - Cytoscape.js elements
 */
function transformData(data) {
    const elements = {
        nodes: [],
        edges: []
    };

    // Transform nodes
    if (data.graph && data.graph.nodes) {
        data.graph.nodes.forEach(node => {
            elements.nodes.push({
                data: {
                    id: node.id,
                    label: node.label || node.id,
                    type: node.nodeType,
                    category: node.nodeCategory,
                    nodeCategory: node.nodeCategory,  // Change Request 002 - Phase 5: Keep original for dagre layout
                    rank: getCategoryRank(node.nodeCategory), // Change Request 002 - Phase 5: Explicit rank for dagre
                    liveCodeScore: node.liveCodeScore,
                    // Include all original properties for tooltip
                    ...node
                }
            });
        });
    }

    // Transform edges
    if (data.graph && data.graph.edges) {
        data.graph.edges.forEach(edge => {
            elements.edges.push({
                data: {
                    id: edge.id,
                    source: edge.source,
                    target: edge.target,
                    relationship: edge.relationship,
                    // Include all original properties
                    ...edge
                }
            });
        });
    }

    return elements;
}

/**
 * Load and visualize graph data
 * @param {Object} data - code2graph JSON data
 */
function loadGraph(data) {
    const elements = transformData(data);
    
    // Clear existing elements
    cy.elements().remove();
    
    // Add new elements
    cy.add(elements);
    
    // Calculate and store base sizes for all nodes
    // This must be done after nodes are added and before layout runs
    // Base sizes are needed for zoom-independent node sizing
    cy.nodes().forEach(function(node) {
        calculateAndStoreBaseSize(node);
    });
    
    // Change Request 002 - Phase 5: Use currently selected layout on load
    // Context: Respect user's layout preference when loading new graph data
    // Business Logic: Trigger layout change event to apply correct layout algorithm
    const changeEvent = new Event('change');
    document.getElementById('layoutSelect').dispatchEvent(changeEvent);
    
    // Update stats
    updateStats(data);
    
    // Setup event handlers for tooltip and node details (Phase 1 & 2)
    setupNodeInteractions();
    
    // Show success message
    console.log('Graph loaded successfully');
}

/**
 * Update statistics panel
 */
function updateStats(data) {
    const statsDiv = document.getElementById('stats');
    if (!data || !data.statistics) {
        statsDiv.innerHTML = '<p>No statistics available</p>';
        return;
    }
    
    const stats = data.statistics;
    statsDiv.innerHTML = `
        <p><strong>Total Nodes:</strong> ${stats.totalNodes}</p>
        <p><strong>Total Edges:</strong> ${stats.totalEdges}</p>
        <p><strong>Live Code Nodes:</strong> ${stats.liveCodeNodes}</p>
        <p><strong>Dead Code Nodes:</strong> ${stats.deadCodeNodes}</p>
        <p><strong>Dead Code %:</strong> ${stats.deadCodePercentage}%</p>
    `;
}

/**
 * Setup node interaction handlers for tooltip (Phase 1) and details panel (Phase 2)
 * This function initializes hover and click event listeners on graph nodes
 */
function setupNodeInteractions() {
    const tooltip = document.getElementById('nodeTooltip');
    const detailsPanel = document.getElementById('nodeDetails');
    
    if (!tooltip || !detailsPanel) {
        console.error('Tooltip or details panel not found in DOM');
        return;
    }
    
    // Phase 1: Tooltip on hover
    cy.on('mouseover', 'node', function(evt) {
        const node = evt.target;
        const nodeData = node.data();
        
        // Create tooltip content with essential node information
        let tooltipHTML = `<h4>${escapeHtml(nodeData.label || nodeData.id)}</h4>`;
        tooltipHTML += `<p><span class="tooltip-label">Type:</span> <span class="tooltip-value">${escapeHtml(nodeData.type || 'N/A')}</span></p>`;
        tooltipHTML += `<p><span class="tooltip-label">Category:</span> <span class="tooltip-value">${escapeHtml(nodeData.category || 'N/A')}</span></p>`;
        
        if (nodeData.liveCodeScore !== undefined) {
            tooltipHTML += `<p><span class="tooltip-label">Live Score:</span> <span class="tooltip-value">${nodeData.liveCodeScore}%</span></p>`;
        }
        
        if (nodeData.file) {
            const fileName = nodeData.file.split(/[\\/]/).pop(); // Get just the filename
            tooltipHTML += `<p><span class="tooltip-label">File:</span> <span class="tooltip-value">${escapeHtml(fileName)}</span></p>`;
        }
        
        tooltip.innerHTML = tooltipHTML;
        tooltip.style.display = 'block';
        
        // Position tooltip near the mouse cursor
        const renderedPosition = node.renderedPosition();
        const containerRect = cy.container().getBoundingClientRect();
        
        tooltip.style.left = (containerRect.left + renderedPosition.x + 20) + 'px';
        tooltip.style.top = (containerRect.top + renderedPosition.y - 20) + 'px';
    });
    
    // Hide tooltip when mouse leaves node
    cy.on('mouseout', 'node', function() {
        tooltip.style.display = 'none';
    });
    
    // Phase 2: Show detailed information in side panel on click
    // Enhanced with focus mode toggle functionality
    cy.on('tap', 'node', function(evt) {
        const node = evt.target;
        const nodeData = node.data();
        
        // Clear previous details
        detailsPanel.innerHTML = '';
        
        // Create detailed information display
        const detailsHTML = createDetailedNodeInfo(nodeData);
        detailsPanel.innerHTML = detailsHTML;
        
        // Handle focus mode toggle
        if (focusState.isActive && focusState.focusedNodeId === node.id()) {
            // Second click on same node: clear focus state
            clearFocusState();
        } else {
            // First click or click on different node: apply focus state
            const upstreamNodes = getUpstreamNodes(node);
            const downstreamNodes = getDownstreamNodes(node);
            const connectedEdges = getConnectedEdges(node, upstreamNodes, downstreamNodes);
            
            // Apply focus state styling
            applyFocusState(node, upstreamNodes, downstreamNodes, connectedEdges);
            
            // Update focus state
            focusState.isActive = true;
            focusState.focusedNodeId = node.id();
        }
        
        // Highlight the selected node (maintain existing functionality)
        cy.nodes().removeClass('node-selected');
        node.addClass('node-selected');
    });
    
    // Clear selection when clicking on background
    cy.on('tap', function(evt) {
        if (evt.target === cy) {
            cy.nodes().removeClass('node-selected');
            detailsPanel.innerHTML = '<p class="placeholder">Click a node to see details</p>';
            // Also clear focus state when clicking on background
            clearFocusState();
        }
    });
}

/**
 * Create detailed HTML for node information panel
 * @param {Object} nodeData - The data object from a Cytoscape node
 * @returns {string} HTML string for the details panel
 */
function createDetailedNodeInfo(nodeData) {
    let html = '<div class="detail-item">';
    html += '<div class="detail-label">ID</div>';
    html += `<div class="detail-value">${escapeHtml(nodeData.id)}</div>`;
    html += '</div>';
    
    if (nodeData.label) {
        html += '<div class="detail-item">';
        html += '<div class="detail-label">Label</div>';
        html += `<div class="detail-value">${escapeHtml(nodeData.label)}</div>`;
        html += '</div>';
    }
    
    html += '<div class="detail-item">';
    html += '<div class="detail-label">Type</div>';
    html += `<div class="detail-value">${escapeHtml(nodeData.type || 'N/A')}</div>`;
    html += '</div>';
    
    if (nodeData.category) {
        html += '<div class="detail-item">';
        html += '<div class="detail-label">Category</div>';
        html += `<div class="detail-value">${escapeHtml(nodeData.category)}</div>`;
        html += '</div>';
    }
    
    if (nodeData.liveCodeScore !== undefined) {
        html += '<div class="detail-item">';
        html += '<div class="detail-label">Live Code Score</div>';
        html += `<div class="detail-value">${nodeData.liveCodeScore}%</div>`;
        html += '</div>';
    }
    
    if (nodeData.file) {
        html += '<div class="detail-item">';
        html += '<div class="detail-label">File</div>';
        html += `<div class="detail-value">${escapeHtml(nodeData.file)}</div>`;
        html += '</div>';
    }
    
    if (nodeData.line) {
        html += '<div class="detail-item">';
        html += '<div class="detail-label">Line Number</div>';
        html += `<div class="detail-value">${nodeData.line}</div>`;
        html += '</div>';
    }
    
    // Display properties if they exist
    if (nodeData.properties && typeof nodeData.properties === 'object') {
        html += '<div class="detail-item">';
        html += '<div class="detail-label">Properties</div>';
        html += '<div class="detail-code">' + escapeHtml(JSON.stringify(nodeData.properties, null, 2)) + '</div>';
        html += '</div>';
    }
    
    return html;
}

/**
 * Escape HTML special characters to prevent XSS attacks
 * This is a security best practice when inserting user data into HTML
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for HTML insertion
 */
function escapeHtml(text) {
    if (text === null || text === undefined) {
        return '';
    }
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Get all upstream nodes (nodes that have outgoing edges to the target node)
 * Business Logic: Identifies all nodes that directly or indirectly influence the target node
 * @param {Object} node - Cytoscape node object
 * @returns {Array} Array of upstream node objects
 */
function getUpstreamNodes(node) {
    const upstreamNodes = [];
    const visited = new Set();
    
    function traverseUpstream(currentNode) {
        if (visited.has(currentNode.id())) {
            return;
        }
        visited.add(currentNode.id());
        
        // Get all incoming edges (edges pointing TO this node)
        const incomingEdges = currentNode.incomers('edge');
        incomingEdges.forEach(edge => {
            const sourceNode = edge.source();
            if (!visited.has(sourceNode.id())) {
                upstreamNodes.push(sourceNode);
                traverseUpstream(sourceNode);
            }
        });
    }
    
    traverseUpstream(node);
    return upstreamNodes;
}

/**
 * Get all downstream nodes (nodes that have incoming edges from the target node)
 * Business Logic: Identifies all nodes that are directly or indirectly influenced by the target node
 * @param {Object} node - Cytoscape node object
 * @returns {Array} Array of downstream node objects
 */
function getDownstreamNodes(node) {
    const downstreamNodes = [];
    const visited = new Set();
    
    function traverseDownstream(currentNode) {
        if (visited.has(currentNode.id())) {
            return;
        }
        visited.add(currentNode.id());
        
        // Get all outgoing edges (edges pointing FROM this node)
        const outgoingEdges = currentNode.outgoers('edge');
        outgoingEdges.forEach(edge => {
            const targetNode = edge.target();
            if (!visited.has(targetNode.id())) {
                downstreamNodes.push(targetNode);
                traverseDownstream(targetNode);
            }
        });
    }
    
    traverseDownstream(node);
    return downstreamNodes;
}

/**
 * Get all edges connected to the focused node and its upstream/downstream nodes
 * Business Logic: Identifies all edges that should be highlighted in focus mode
 * @param {Object} focusedNode - The main focused node
 * @param {Array} upstreamNodes - Array of upstream nodes
 * @param {Array} downstreamNodes - Array of downstream nodes
 * @returns {Array} Array of connected edge objects
 */
function getConnectedEdges(focusedNode, upstreamNodes, downstreamNodes) {
    const connectedEdges = [];
    const allConnectedNodes = [focusedNode, ...upstreamNodes, ...downstreamNodes];
    const nodeIds = new Set(allConnectedNodes.map(node => node.id()));
    const edgeSet = new Set(); // Track edges already added to prevent duplicates
    
    // Find all edges between connected nodes
    // Context: Each edge appears in multiple nodes' connectedEdges() (once for source, once for target)
    // Business Logic: Deduplicate edges to avoid showing the same edge multiple times
    allConnectedNodes.forEach(node => {
        const edges = node.connectedEdges();
        edges.forEach(edge => {
            const sourceId = edge.source().id();
            const targetId = edge.target().id();
            
            // Include edge if both source and target are in connected nodes
            // AND we haven't already added this edge
            if (nodeIds.has(sourceId) && nodeIds.has(targetId) && !edgeSet.has(edge)) {
                connectedEdges.push(edge);
                edgeSet.add(edge); // Mark edge as added to prevent duplicates
            }
        });
    });
    
    return connectedEdges;
}

/**
 * Apply focus state styling to nodes and edges
 * Business Logic: Highlights the focused node, its connections, and dims all other elements
 * @param {Object} focusedNode - The main focused node
 * @param {Array} upstreamNodes - Array of upstream nodes
 * @param {Array} downstreamNodes - Array of downstream nodes
 * @param {Array} connectedEdges - Array of connected edges
 */
function applyFocusState(focusedNode, upstreamNodes, downstreamNodes, connectedEdges) {
    // Clear any existing focus classes
    cy.elements().removeClass('node-focused node-connected node-dimmed edge-focused edge-dimmed');
    
    // Apply focused styling to the main node
    focusedNode.addClass('node-focused');
    
    // Apply connected styling to upstream and downstream nodes
    [...upstreamNodes, ...downstreamNodes].forEach(node => {
        node.addClass('node-connected');
    });
    
    // Apply focused styling to connected edges
    connectedEdges.forEach(edge => {
        edge.addClass('edge-focused');
    });
    
    // Apply dimmed styling to all other nodes
    cy.nodes().forEach(node => {
        if (!node.hasClass('node-focused') && !node.hasClass('node-connected')) {
            node.addClass('node-dimmed');
        }
    });
    
    // Apply dimmed styling to all other edges
    cy.edges().forEach(edge => {
        if (!edge.hasClass('edge-focused')) {
            edge.addClass('edge-dimmed');
        }
    });
}

/**
 * Clear focus state and return to normal view
 * Business Logic: Removes all focus-related styling and resets to normal view
 */
function clearFocusState() {
    // Remove all focus-related CSS classes
    cy.elements().removeClass('node-focused node-connected node-dimmed edge-focused edge-dimmed');
    
    // Reset focus state
    focusState.isActive = false;
    focusState.focusedNodeId = null;
}

/**
 * Handle file input change
 */
document.getElementById('fileInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            loadGraph(data);
        } catch (error) {
            console.error('Error parsing JSON:', error);
            alert('Error loading JSON file. Please check the format.');
        }
    };
    reader.readAsText(file);
});

/**
 * Handle search input
 */
document.getElementById('searchInput').addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase();
    if (!query) {
        cy.elements().removeClass('search-highlight');
        return;
    }
    
    cy.elements().forEach(ele => {
        if (ele.isNode()) {
            const label = ele.data('label') || '';
            if (label.toLowerCase().includes(query)) {
                ele.addClass('search-highlight');
            } else {
                ele.removeClass('search-highlight');
            }
        }
    });
});

/**
 * Handle filter changes
 */
document.querySelectorAll('.node-filter').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        const type = checkbox.dataset.type;
        const checked = checkbox.checked;
        
        cy.nodes().forEach(node => {
            if (node.data('type') === type) {
                node.style('display', checked ? 'element' : 'none');
            }
        });
    });
});

/**
 * Handle layout selection
 * Business Logic: Allow users to choose different graph layouts for better visualization
 * Context: Recalculate base sizes after layout changes to ensure proper node sizing
 * 
 * Change Request 002 - Phase 5: Hierarchical Dagre Layout
 * Context: Dagre layout positions nodes left-to-right by category hierarchy
 * Business Logic: UI sections (leftmost) → middleware → API → database (rightmost)
 */
document.getElementById('layoutSelect').addEventListener('change', (event) => {
    const layoutName = event.target.value;
    
    // Configure layout options
    let layoutOptions = {
        name: layoutName,
        fit: true,
        padding: 30
    };
    
    // Change Request 002 - Phase 5: Dagre-specific configuration
    // Context: Hierarchical layout requires rank direction and spacing parameters
    // Business Logic: Positions nodes based on nodeCategory to show event flow sequence
    if (layoutName === 'dagre') {
        // Apply dagre layout only to connected nodes (nodes with edges)
        // Isolated nodes will be positioned separately in layoutstop callback
        const connectedNodes = cy.nodes().filter(node => node.degree(false) > 0);
        
        if (connectedNodes.length > 0) {
            // Apply dagre layout only to connected nodes
            layoutOptions = {
                ...layoutOptions,
                eles: connectedNodes,    // Only layout connected nodes
                rankDir: 'LR',           // Left-to-Right direction
                nodeSep: 50,             // Horizontal spacing between nodes
                edgeSep: 10,             // Spacing between edges
                rankSep: 100,            // Vertical spacing between ranks (categories)
                ranker: 'network-simplex', // Algorithm for rank assignment
                
                // Change Request 002 - Phase 5 Bug Fix: Edge length tuning
                // Context: Dagre reads rank from node.data('rank'), set in transformData()
                // Business Logic: Fine-tune edge lengths between ranks for optimal spacing
                minLen: function(edge) {
                    const sourceCategory = edge.source().data('nodeCategory');
                    const targetCategory = edge.target().data('nodeCategory');
                    
                    // Define category order for hierarchical positioning
                    const categoryRank = {
                        'front-end': 0,
                        'middleware': 1,
                        'api': 2,
                        'database': 3,
                        'library': 1  // Libraries positioned with middleware
                    };
                    
                    const sourceRank = categoryRank[sourceCategory] || 1;
                    const targetRank = categoryRank[targetCategory] || 1;
                    
                    // Return minimum edge length to enforce rank separation
                    return Math.max(1, targetRank - sourceRank);
                }
            };
        }
    }
    
    // Apply the layout
    const layout = cy.layout(layoutOptions);
    
    // Recalculate base sizes after layout completes
    // This ensures nodes maintain zoom-independent sizing after layout changes
    layout.on('layoutstop', function() {
        // Change Request 002 - Phase 5 Bug Fix: Position isolated nodes at bottom
        // Context: Isolated nodes disrupt hierarchical layout when positioned in middle
        // Business Logic: Place disconnected nodes in compact grid below main graph
        if (layoutName === 'dagre') {
            const isolatedNodes = cy.nodes().filter(node => node.degree(false) === 0);
            
            if (isolatedNodes.length > 0) {
                // Get bounding box of connected nodes to position isolated nodes below
                const connectedNodes = cy.nodes().filter(node => node.degree(false) > 0);
                let maxY = 0;
                
                if (connectedNodes.length > 0) {
                    connectedNodes.forEach(node => {
                        const pos = node.position();
                        if (pos.y > maxY) maxY = pos.y;
                    });
                }
                
                // Position isolated nodes in a compact grid at the bottom
                const isolatedStartY = maxY + 150; // 150px gap below main graph
                const gridColumns = Math.ceil(Math.sqrt(isolatedNodes.length));
                const nodeSpacing = 80;
                
                isolatedNodes.forEach((node, index) => {
                    const col = index % gridColumns;
                    const row = Math.floor(index / gridColumns);
                    
                    node.position({
                        x: col * nodeSpacing,
                        y: isolatedStartY + (row * nodeSpacing)
                    });
                });
            }
        }
        
        cy.nodes().forEach(function(node) {
            calculateAndStoreBaseSize(node);
        });
        
        // Fit the view to show all nodes
        cy.fit(undefined, 30);
    });
    
    layout.run();
});

/**
 * Initialize on page load
 */
window.addEventListener('DOMContentLoaded', () => {
    initializeCytoscape();
    
    // Try to load graph-output.json if it exists
    fetch('./graph-output.json')
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('File not found');
        })
        .then(data => loadGraph(data))
        .catch(() => {
            // Error details not needed - showing generic message for better UX
            console.log('No default graph file found. Load a JSON file to get started.');
        });
});
