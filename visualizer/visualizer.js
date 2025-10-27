/**
 * Code2Graph Visualizer
 * Transforms code2graph JSON output into interactive graph visualization
 */

let cy;

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
                    
                    // Zoom-independent font sizing (Hybrid approach - Option C)
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
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#ccc',
                    'target-arrow-color': '#ccc',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier'
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
    
    // Apply layout
    cy.layout({
        name: 'cose',
        fit: true,
        padding: 30
    }).run();
    
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
    cy.on('tap', 'node', function(evt) {
        const node = evt.target;
        const nodeData = node.data();
        
        // Clear previous details
        detailsPanel.innerHTML = '';
        
        // Create detailed information display
        const detailsHTML = createDetailedNodeInfo(nodeData);
        detailsPanel.innerHTML = detailsHTML;
        
        // Highlight the selected node
        cy.nodes().removeClass('node-selected');
        node.addClass('node-selected');
    });
    
    // Clear selection when clicking on background
    cy.on('tap', function(evt) {
        if (evt.target === cy) {
            cy.nodes().removeClass('node-selected');
            detailsPanel.innerHTML = '<p class="placeholder">Click a node to see details</p>';
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
 */
document.getElementById('layoutSelect').addEventListener('change', (event) => {
    const layoutName = event.target.value;
    
    // Apply the new layout
    const layout = cy.layout({
        name: layoutName,
        fit: true,
        padding: 30
    });
    
    // Recalculate base sizes after layout completes
    // This ensures nodes maintain zoom-independent sizing after layout changes
    layout.on('layoutstop', function() {
        cy.nodes().forEach(function(node) {
            calculateAndStoreBaseSize(node);
        });
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
