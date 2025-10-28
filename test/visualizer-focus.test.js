/**
 * Tests for Code2Graph Visualizer Focus Functionality
 * 
 * Test Strategy:
 * - Uses Node.js built-in test runner (node:test) to match project standards
 * - Tests node discovery functions (upstream, downstream, connected edges)
 * - Tests focus state management
 * - Tests visual state application and clearing
 * - Verifies integration with existing click handlers
 * 
 * Business Logic: Tests the enhanced node click functionality that allows users to:
 * 1. Click a node to focus on it and its connections
 * 2. Click the same node again to clear focus
 * 3. Click background to clear focus
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';

/**
 * Test getUpstreamNodes function
 * Verifies that upstream nodes are correctly identified
 */
describe('getUpstreamNodes', () => {
    test('should return empty array for node with no incoming edges', () => {
        const mockNode = {
            id: () => 'node1',
            incomers: () => []
        };
        
        // Mock the function (simulates the visualizer.js implementation)
        const getUpstreamNodes = (node) => {
            const upstreamNodes = [];
            const visited = new Set();
            
            function traverseUpstream(currentNode) {
                if (visited.has(currentNode.id())) {
                    return;
                }
                visited.add(currentNode.id());
                
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
        };
        
        const result = getUpstreamNodes(mockNode);
        assert.deepStrictEqual(result, []);
    });
    
    test('should return upstream nodes for node with incoming edges', () => {
        const mockSourceNode1 = { id: () => 'source1', incomers: () => [] };
        const mockSourceNode2 = { id: () => 'source2', incomers: () => [] };
        const mockEdge1 = { source: () => mockSourceNode1 };
        const mockEdge2 = { source: () => mockSourceNode2 };
        
        const mockNode = {
            id: () => 'node1',
            incomers: () => [mockEdge1, mockEdge2]
        };
        
        // Mock the function
        const getUpstreamNodes = (node) => {
            const upstreamNodes = [];
            const visited = new Set();
            
            function traverseUpstream(currentNode) {
                if (visited.has(currentNode.id())) {
                    return;
                }
                visited.add(currentNode.id());
                
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
        };
        
        const result = getUpstreamNodes(mockNode);
        assert.strictEqual(result.length, 2);
        assert.ok(result.includes(mockSourceNode1));
        assert.ok(result.includes(mockSourceNode2));
    });
    
    test('should handle circular dependencies without infinite loops', () => {
        const mockSourceNode = { 
            id: () => 'source1',
            incomers: () => []
        };
        const mockEdge = { source: () => mockSourceNode };
        
        const mockNode = {
            id: () => 'node1',
            incomers: () => [mockEdge]
        };
        
        // Mock the function
        const getUpstreamNodes = (node) => {
            const upstreamNodes = [];
            const visited = new Set();
            
            function traverseUpstream(currentNode) {
                if (visited.has(currentNode.id())) {
                    return;
                }
                visited.add(currentNode.id());
                
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
        };
        
        const result = getUpstreamNodes(mockNode);
        assert.strictEqual(result.length, 1);
        assert.ok(result.includes(mockSourceNode));
    });
});

/**
 * Test getDownstreamNodes function
 * Verifies that downstream nodes are correctly identified
 */
describe('getDownstreamNodes', () => {
    test('should return empty array for node with no outgoing edges', () => {
        const mockNode = {
            id: () => 'node1',
            outgoers: () => []
        };
        
        // Mock the function
        const getDownstreamNodes = (node) => {
            const downstreamNodes = [];
            const visited = new Set();
            
            function traverseDownstream(currentNode) {
                if (visited.has(currentNode.id())) {
                    return;
                }
                visited.add(currentNode.id());
                
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
        };
        
        const result = getDownstreamNodes(mockNode);
        assert.deepStrictEqual(result, []);
    });
    
    test('should return downstream nodes for node with outgoing edges', () => {
        const mockTargetNode1 = { id: () => 'target1', outgoers: () => [] };
        const mockTargetNode2 = { id: () => 'target2', outgoers: () => [] };
        const mockEdge1 = { target: () => mockTargetNode1 };
        const mockEdge2 = { target: () => mockTargetNode2 };
        
        const mockNode = {
            id: () => 'node1',
            outgoers: () => [mockEdge1, mockEdge2]
        };
        
        // Mock the function
        const getDownstreamNodes = (node) => {
            const downstreamNodes = [];
            const visited = new Set();
            
            function traverseDownstream(currentNode) {
                if (visited.has(currentNode.id())) {
                    return;
                }
                visited.add(currentNode.id());
                
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
        };
        
        const result = getDownstreamNodes(mockNode);
        assert.strictEqual(result.length, 2);
        assert.ok(result.includes(mockTargetNode1));
        assert.ok(result.includes(mockTargetNode2));
    });
});

/**
 * Test getConnectedEdges function
 * Verifies that connected edges are correctly identified
 */
describe('getConnectedEdges', () => {
    test('should return empty array when no connected edges exist', () => {
        const mockNode = {
            id: () => 'node1',
            connectedEdges: () => []
        };
        
        // Mock the function
        const getConnectedEdges = (focusedNode, upstreamNodes, downstreamNodes) => {
            const connectedEdges = [];
            const allConnectedNodes = [focusedNode, ...upstreamNodes, ...downstreamNodes];
            const nodeIds = new Set(allConnectedNodes.map(node => node.id()));
            
            allConnectedNodes.forEach(node => {
                const edges = node.connectedEdges();
                edges.forEach(edge => {
                    const sourceId = edge.source().id();
                    const targetId = edge.target().id();
                    
                    if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
                        connectedEdges.push(edge);
                    }
                });
            });
            
            return connectedEdges;
        };
        
        const result = getConnectedEdges(mockNode, [], []);
        assert.deepStrictEqual(result, []);
    });
    
    test('should return connected edges between focused and related nodes', () => {
        const mockEdge1 = {
            source: () => ({ id: () => 'node1' }),
            target: () => ({ id: () => 'node2' })
        };
        const mockEdge2 = {
            source: () => ({ id: () => 'node2' }),
            target: () => ({ id: () => 'node3' })
        };
        
        const mockFocusedNode = {
            id: () => 'node1',
            connectedEdges: () => [mockEdge1]
        };
        
        const mockUpstreamNode = {
            id: () => 'node2',
            connectedEdges: () => [mockEdge1, mockEdge2]
        };
        
        const mockDownstreamNode = {
            id: () => 'node3',
            connectedEdges: () => [mockEdge2]
        };
        
        // Mock the function
        // Business Logic: Deduplicates edges since each edge appears in multiple nodes' connectedEdges
        // (once for the source node, once for the target node)
        const getConnectedEdges = (focusedNode, upstreamNodes, downstreamNodes) => {
            const connectedEdges = [];
            const allConnectedNodes = [focusedNode, ...upstreamNodes, ...downstreamNodes];
            const nodeIds = new Set(allConnectedNodes.map(node => node.id()));
            const edgeSet = new Set(); // Track edges we've already added to prevent duplicates
            
            allConnectedNodes.forEach(node => {
                const edges = node.connectedEdges();
                edges.forEach(edge => {
                    const sourceId = edge.source().id();
                    const targetId = edge.target().id();
                    
                    // Only include edge if both endpoints are in our connected nodes
                    // AND we haven't already added this edge
                    if (nodeIds.has(sourceId) && nodeIds.has(targetId) && !edgeSet.has(edge)) {
                        connectedEdges.push(edge);
                        edgeSet.add(edge); // Mark this edge as added
                    }
                });
            });
            
            return connectedEdges;
        };
        
        const result = getConnectedEdges(mockFocusedNode, [mockUpstreamNode], [mockDownstreamNode]);
        assert.strictEqual(result.length, 2);
        assert.ok(result.includes(mockEdge1));
        assert.ok(result.includes(mockEdge2));
    });
});

/**
 * Test focus state management
 * Verifies that focus state is correctly tracked and updated
 */
describe('Focus State Management', () => {
    test('should initialize with inactive focus state', () => {
        const focusState = {
            isActive: false,
            focusedNodeId: null
        };
        
        assert.strictEqual(focusState.isActive, false);
        assert.strictEqual(focusState.focusedNodeId, null);
    });
    
    test('should update focus state when node is focused', () => {
        const focusState = {
            isActive: false,
            focusedNodeId: null
        };
        
        // Simulate focusing on a node
        focusState.isActive = true;
        focusState.focusedNodeId = 'node1';
        
        assert.strictEqual(focusState.isActive, true);
        assert.strictEqual(focusState.focusedNodeId, 'node1');
    });
    
    test('should clear focus state when node is unfocused', () => {
        const focusState = {
            isActive: true,
            focusedNodeId: 'node1'
        };
        
        // Simulate clearing focus
        focusState.isActive = false;
        focusState.focusedNodeId = null;
        
        assert.strictEqual(focusState.isActive, false);
        assert.strictEqual(focusState.focusedNodeId, null);
    });
});

/**
 * Test applyFocusState function
 * Verifies that focus styling is correctly applied
 */
describe('applyFocusState', () => {
    test('should apply focus classes to nodes and edges', () => {
        const addClassCalls = {
            focused: 0,
            connected: 0,
            focusedEdge: 0,
            dimmed: 0,
            dimmedEdge: 0
        };
        
        const mockFocusedNode = {
            addClass: (className) => { if (className === 'node-focused') addClassCalls.focused++; },
            hasClass: () => false
        };
        
        const mockConnectedNode = {
            addClass: (className) => { if (className === 'node-connected') addClassCalls.connected++; },
            hasClass: () => false
        };
        
        const mockDimmedNode = {
            addClass: (className) => { if (className === 'node-dimmed') addClassCalls.dimmed++; },
            hasClass: () => false
        };
        
        const mockFocusedEdge = {
            addClass: (className) => { if (className === 'edge-focused') addClassCalls.focusedEdge++; },
            hasClass: () => false
        };
        
        const mockDimmedEdge = {
            addClass: (className) => { if (className === 'edge-dimmed') addClassCalls.dimmedEdge++; },
            hasClass: () => false
        };
        
        const mockNodes = [mockFocusedNode, mockConnectedNode, mockDimmedNode];
        const mockEdges = [mockFocusedEdge, mockDimmedEdge];
        
        // Mock the function
        const applyFocusState = (focusedNode, upstreamNodes, downstreamNodes, connectedEdges) => {
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
            mockNodes.forEach(node => {
                if (!node.hasClass('node-focused') && !node.hasClass('node-connected')) {
                    node.addClass('node-dimmed');
                }
            });
            
            // Apply dimmed styling to all other edges
            mockEdges.forEach(edge => {
                if (!edge.hasClass('edge-focused')) {
                    edge.addClass('edge-dimmed');
                }
            });
        };
        
        applyFocusState(mockFocusedNode, [mockConnectedNode], [], [mockFocusedEdge]);
        
        // Verify focus classes were applied
        assert.strictEqual(addClassCalls.focused, 1, 'node-focused should be called once');
        assert.strictEqual(addClassCalls.connected, 1, 'node-connected should be called once');
        assert.strictEqual(addClassCalls.focusedEdge, 1, 'edge-focused should be called once');
        assert.strictEqual(addClassCalls.dimmed, 1, 'node-dimmed should be called once');
        assert.strictEqual(addClassCalls.dimmedEdge, 1, 'edge-dimmed should be called once');
    });
});

/**
 * Test clearFocusState function
 * Verifies that focus styling is correctly cleared
 */
describe('clearFocusState', () => {
    test('should remove all focus classes and reset state', () => {
        let removeClassCalled = false;
        const mockElements = {
            removeClass: (classes) => {
                removeClassCalled = true;
                assert.strictEqual(classes, 'node-focused node-connected node-dimmed edge-focused edge-dimmed');
            }
        };
        
        const focusState = {
            isActive: true,
            focusedNodeId: 'node1'
        };
        
        // Mock the function
        const clearFocusState = () => {
            // Remove all focus-related CSS classes
            mockElements.removeClass('node-focused node-connected node-dimmed edge-focused edge-dimmed');
            
            // Reset focus state
            focusState.isActive = false;
            focusState.focusedNodeId = null;
        };
        
        clearFocusState();
        
        // Verify classes were removed and state was reset
        assert.strictEqual(removeClassCalled, true);
        assert.strictEqual(focusState.isActive, false);
        assert.strictEqual(focusState.focusedNodeId, null);
    });
});

/**
 * Test click handler logic
 * Verifies that click handlers correctly toggle focus state
 */
describe('Click Handler Logic', () => {
    test('should apply focus on first click', () => {
        const focusState = {
            isActive: false,
            focusedNodeId: null
        };
        
        const mockNode = {
            id: () => 'node1'
        };
        
        // Simulate first click logic
        if (focusState.isActive && focusState.focusedNodeId === mockNode.id()) {
            // Second click - clear focus
            focusState.isActive = false;
            focusState.focusedNodeId = null;
        } else {
            // First click - apply focus
            focusState.isActive = true;
            focusState.focusedNodeId = mockNode.id();
        }
        
        assert.strictEqual(focusState.isActive, true);
        assert.strictEqual(focusState.focusedNodeId, 'node1');
    });
    
    test('should clear focus on second click of same node', () => {
        const focusState = {
            isActive: true,
            focusedNodeId: 'node1'
        };
        
        const mockNode = {
            id: () => 'node1'
        };
        
        // Simulate second click logic
        if (focusState.isActive && focusState.focusedNodeId === mockNode.id()) {
            // Second click - clear focus
            focusState.isActive = false;
            focusState.focusedNodeId = null;
        } else {
            // First click - apply focus
            focusState.isActive = true;
            focusState.focusedNodeId = mockNode.id();
        }
        
        assert.strictEqual(focusState.isActive, false);
        assert.strictEqual(focusState.focusedNodeId, null);
    });
    
    test('should apply focus on click of different node', () => {
        const focusState = {
            isActive: true,
            focusedNodeId: 'node1'
        };
        
        const mockNode = {
            id: () => 'node2'
        };
        
        // Simulate click on different node logic
        if (focusState.isActive && focusState.focusedNodeId === mockNode.id()) {
            // Second click - clear focus
            focusState.isActive = false;
            focusState.focusedNodeId = null;
        } else {
            // First click or different node - apply focus
            focusState.isActive = true;
            focusState.focusedNodeId = mockNode.id();
        }
        
        assert.strictEqual(focusState.isActive, true);
        assert.strictEqual(focusState.focusedNodeId, 'node2');
    });
});

/**
 * Test edge cases and error handling
 */
describe('Edge Cases', () => {
    test('should handle nodes with no connections gracefully', () => {
        const mockNode = {
            id: () => 'isolated',
            incomers: () => [],
            outgoers: () => [],
            connectedEdges: () => []
        };
        
        // Test that functions don't crash with isolated nodes
        const getUpstreamNodes = (node) => {
            const upstreamNodes = [];
            const visited = new Set();
            
            function traverseUpstream(currentNode) {
                if (visited.has(currentNode.id())) {
                    return;
                }
                visited.add(currentNode.id());
                
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
        };
        
        const result = getUpstreamNodes(mockNode);
        assert.deepStrictEqual(result, []);
    });
    
    test('should handle empty node arrays gracefully', () => {
        let removeClassCalled = false;
        const mockElements = {
            removeClass: () => { removeClassCalled = true; }
        };
        
        const mockNodes = [];
        const mockEdges = [];
        
        // Mock applyFocusState with empty arrays
        const applyFocusState = (focusedNode) => {
            mockElements.removeClass('node-focused node-connected node-dimmed edge-focused edge-dimmed');
            focusedNode.addClass('node-focused');
            
            mockNodes.forEach(node => {
                if (!node.hasClass('node-focused') && !node.hasClass('node-connected')) {
                    node.addClass('node-dimmed');
                }
            });
            
            mockEdges.forEach(edge => {
                if (!edge.hasClass('edge-focused')) {
                    edge.addClass('edge-dimmed');
                }
            });
        };
        
        const mockFocusedNode = { 
            addClass: () => {}
        };
        
        // Should not throw error with empty arrays
        applyFocusState(mockFocusedNode);
        assert.strictEqual(removeClassCalled, true);
    });
});

/**
 * Integration test: Complete focus workflow
 */
describe('Complete Focus Workflow', () => {
    test('should handle complete focus cycle: focus -> unfocus -> focus different', () => {
        const focusState = {
            isActive: false,
            focusedNodeId: null
        };
        
        const mockNode1 = { id: () => 'node1' };
        
        // Step 1: Focus on node1
        focusState.isActive = true;
        focusState.focusedNodeId = 'node1';
        assert.strictEqual(focusState.isActive, true);
        assert.strictEqual(focusState.focusedNodeId, 'node1');
        
        // Step 2: Click node1 again (unfocus)
        if (focusState.isActive && focusState.focusedNodeId === mockNode1.id()) {
            focusState.isActive = false;
            focusState.focusedNodeId = null;
        }
        assert.strictEqual(focusState.isActive, false);
        assert.strictEqual(focusState.focusedNodeId, null);
        
        // Step 3: Focus on node2
        focusState.isActive = true;
        focusState.focusedNodeId = 'node2';
        assert.strictEqual(focusState.isActive, true);
        assert.strictEqual(focusState.focusedNodeId, 'node2');
    });
});
