/*
  Plain JavaScript React implementation of the Knowledge Path Visualizer.

  This script uses React without JSX, so it can run directly in the browser
  without requiring Babel or any build tools.  It replicates the features of
  the original vanilla implementation: a force‑directed graph of topics,
  progress tracking with a drop‑down, unlock logic, and filters for active
  and completed topics and dependency lines.  The styling defined in
  style.css provides the Civilization VI inspired look.
*/

// Data definitions: topics and their prerequisites.  Progress is stored as a
// percentage (0, 25, 50, 75, 100).  You can modify these arrays to add
// additional topics and dependencies.
const initialNodes = [
  {
    id: 'basics',
    title: 'Programming Fundamentals',
    description:
      'Learn variables, control flow, functions and the building blocks of code.',
    dependencies: [],
    progress: 0,
  },
  {
    id: 'datastructures',
    title: 'Data Structures',
    description:
      'Study arrays, lists, stacks, queues, trees and more.  Knowing how data is organised is essential.',
    dependencies: ['basics'],
    progress: 0,
  },
  {
    id: 'algorithms',
    title: 'Algorithms',
    description:
      'Explore sorting, searching and other fundamental algorithms.  Learn to reason about complexity.',
    dependencies: ['basics'],
    progress: 0,
  },
  {
    id: 'graphs',
    title: 'Graph Theory',
    description:
      'Understand nodes and edges, traversal algorithms and shortest paths.',
    dependencies: ['datastructures', 'algorithms'],
    progress: 0,
  },
  {
    id: 'machinelearning',
    title: 'Machine Learning',
    description:
      'Dive into supervised and unsupervised learning, regression, classification and neural networks.',
    dependencies: ['algorithms'],
    progress: 0,
  },
];

// Derive edges from dependencies.  For each dependency, we create an edge
// connecting the prerequisite (source) to the dependent topic (target).
const initialEdges = [];
for (const node of initialNodes) {
  if (Array.isArray(node.dependencies)) {
    for (const dep of node.dependencies) {
      initialEdges.push({ source: dep, target: node.id });
    }
  }
}

// Interpolate a colour for a given progress value.  Colours are chosen to
// approximate the Civ VI palette: dark navy through to gold.  This helper
// returns a CSS `rgb(r,g,b)` string.  See style.css for stroke colours.
function progressColor(progress) {
  const stops = [
    { p: 0, color: [10, 26, 47] },
    { p: 25, color: [32, 55, 93] },
    { p: 50, color: [62, 88, 145] },
    { p: 75, color: [97, 122, 180] },
    { p: 100, color: [255, 215, 0] },
  ];
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (progress >= stops[i].p && progress <= stops[i + 1].p) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const ratio = lower.p === upper.p ? 0 : (progress - lower.p) / (upper.p - lower.p);
  const interp = lower.color.map((c, idx) => Math.round(c + (upper.color[idx] - c) * ratio));
  return 'rgb(' + interp[0] + ', ' + interp[1] + ', ' + interp[2] + ')';
}

// Given a list of nodes, compute a new list with `unlocked` flags based on
// whether all dependencies have reached at least 75% progress.  Nodes with no
// dependencies are unlocked by default.
function computeUnlocks(nodes) {
  return nodes.map((node) => {
    if (!node.dependencies || node.dependencies.length === 0) {
      return Object.assign({}, node, { unlocked: true });
    }
    const unlocked = node.dependencies.every((depId) => {
      const depNode = nodes.find((n) => n.id === depId);
      return depNode && depNode.progress >= 75;
    });
    return Object.assign({}, node, { unlocked: unlocked });
  });
}

// Helper alias for React.createElement to shorten element creation.
const e = React.createElement;

// Modal component: displays topic details and allows progress updates.  The
// component is built using plain React element calls (no JSX).  It closes
// when the overlay is clicked or when the close button is pressed.  After
// updating progress, it also closes automatically.
function Modal(props) {
  const node = props.node;
  const nodes = props.nodes;
  const onClose = props.onClose;
  const updateProgress = props.updateProgress;
  // Build prerequisites text list
  const deps = node.dependencies.map((depId) => {
    const depNode = nodes.find((n) => n.id === depId);
    return depNode ? depNode.title + ' – ' + depNode.progress + '%' : depId;
  });
  return e(
    'div',
    {
      id: 'modal-overlay',
      onClick: function (ev) {
        if (ev.target.id === 'modal-overlay') {
          onClose();
        }
      },
    },
    e(
      'div',
      { className: 'modal' },
      e(
        'div',
        { className: 'modal-header' },
        [
          e('h2', null, node.title),
          e(
            'button',
            {
              id: 'modal-close',
              'aria-label': 'close',
              onClick: function () {
                onClose();
              },
            },
            '\u2715',
          ),
        ],
      ),
      e(
        'div',
        { className: 'modal-body' },
        [
          e('p', null, node.description),
          e('h3', null, 'Prerequisites'),
          e(
            'ul',
            null,
            deps.length === 0
              ? [e('li', { key: 'none' }, 'None')]
              : deps.map(function (text, idx) {
                  return e('li', { key: 'dep-' + idx }, text);
                }),
          ),
          e('h3', null, 'Progress'),
          e(
            'select',
            {
              value: node.progress,
              onChange: function (ev) {
                var newVal = parseInt(ev.target.value, 10);
                updateProgress(node.id, newVal);
                onClose();
              },
            },
            [
              e('option', { value: 0 }, '0 %'),
              e('option', { value: 25 }, '25 %'),
              e('option', { value: 50 }, '50 %'),
              e('option', { value: 75 }, '75 %'),
              e('option', { value: 100 }, '100 %'),
            ],
          ),
        ],
      ),
    ),
  );
}

// Main application component.  Manages state for nodes, edges, filters and
// selected node.  Renders the navigation bar, graph container and modal when
// needed.  Uses D3 to draw a force-directed graph into the graph container
// whenever nodes or filter settings change.
function KnowledgeGraphApp() {
  // React state hooks
  const _useState = React.useState;
  const [nodes, setNodes] = _useState(function () {
    // Initialise by loading progress from localStorage.  Use a unique
    // prefix (kpv-react-progress-) so that stored values from older
    // implementations do not interfere with this React version.
    const loaded = initialNodes.map(function (node) {
      const stored = localStorage.getItem('kpv-react-progress-' + node.id);
      if (stored !== null) {
        return Object.assign({}, node, { progress: parseInt(stored, 10) });
      }
      return Object.assign({}, node);
    });
    return computeUnlocks(loaded);
  });
  const [edges] = _useState(initialEdges);
  const [showActive, setShowActive] = _useState(true);
  const [showCompleted, setShowCompleted] = _useState(true);
  const [showDependencies, setShowDependencies] = _useState(true);
  const [selectedNode, setSelectedNode] = _useState(null);
  const graphRef = React.useRef(null);

  // Export current progress to a downloadable JSON file.  This function
  // serialises the id and progress fields for each node into a JSON
  // string, wraps it in a Blob, creates an object URL and clicks a
  // temporary anchor element to trigger download.  A timestamp is
  // appended to the filename so repeated exports do not clobber one
  // another.
  function exportProgress() {
    const progressData = nodes.map(function (n) {
      return { id: n.id, progress: n.progress };
    });
    const jsonStr = JSON.stringify(progressData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = 'kpv-progress-' + timestamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Import progress from a user‑selected JSON file.  This function
  // triggers a hidden file input.  When a file is chosen, it reads
  // the JSON, validates that each entry has id and progress fields,
  // then updates the state accordingly.  Unknown ids are ignored.
  function importProgress() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = function (ev) {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const arr = JSON.parse(reader.result);
          if (!Array.isArray(arr)) return;
          setNodes(function (prev) {
            const updated = prev.map(function (n) {
              const match = arr.find(function (entry) {
                return entry.id === n.id;
              });
              if (match && typeof match.progress === 'number') {
                const newProg = Math.max(0, Math.min(100, match.progress));
                localStorage.setItem('kpv-react-progress-' + n.id, String(newProg));
                return Object.assign({}, n, { progress: newProg });
              }
              return n;
            });
            return computeUnlocks(updated);
          });
        } catch (err) {
          console.error('Error parsing JSON', err);
        }
      };
      reader.readAsText(file);
    };
    // click the hidden input to open file chooser
    input.click();
  }

  // Function to update progress on a node and persist it
  function updateProgress(id, newProgress) {
    setNodes(function (prev) {
      const updated = prev.map(function (n) {
        return n.id === id ? Object.assign({}, n, { progress: newProgress }) : n;
      });
      localStorage.setItem('kpv-react-progress-' + id, String(newProgress));
      return computeUnlocks(updated);
    });
  }

  // Draw the force-directed graph whenever nodes or filters change
  React.useEffect(
    function () {
      const container = graphRef.current;
      if (!container) {
        return;
      }
      // Clear previous SVG
      d3.select(container).selectAll('*').remove();
      const width = container.clientWidth;
      const height = container.clientHeight;
      const svg = d3
        .select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .classed('hidden-links', !showDependencies);

      // Create or select a tooltip div for hover information.  We attach
      // it to the document body so that it is not clipped by the
      // #graph-container overflow and can freely position anywhere in
      // the viewport.  The tooltip is hidden by default and becomes
      // visible on node hover.  It persists across renders because
      // D3 selects by class name on the body.
      let tooltip = d3.select('body').select('.tooltip');
      if (tooltip.empty()) {
        tooltip = d3
          .select('body')
          .append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('visibility', 'hidden');
      }
      const linkGroup = svg.append('g').attr('class', 'link');
      const nodeGroup = svg.append('g');
      // Use copies so we don't mutate state objects
      const simNodes = nodes.map(function (n) {
        return Object.assign({}, n);
      });
      const simEdges = edges.map(function (e) {
        return Object.assign({}, e);
      });
      const simulation = d3
        .forceSimulation(simNodes)
        .force(
          'link',
          d3
            .forceLink(simEdges)
            .id(function (d) {
              return d.id;
            })
            .distance(160)
            .strength(0.1),
        )
        .force('charge', d3.forceManyBody().strength(-500))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(60));
      // Render links
      const links = linkGroup
        .selectAll('line')
        .data(simEdges)
        .enter()
        .append('line');
      // Render nodes with drag and click handlers
      const nodeElements = nodeGroup
        .selectAll('g')
        .data(simNodes)
        .enter()
        .append('g')
        .attr('class', function (d) {
          return d.unlocked ? 'node' : 'node locked';
        })
        .on('click', function (event, d) {
          // Only respond if the node is unlocked
          const orig = nodes.find(function (n) {
            return n.id === d.id;
          });
          if (orig && orig.unlocked) {
            setSelectedNode(orig);
          }
        })
        .call(
          d3
            .drag()
            .on('start', function (event, d) {
              if (!event.active) {
                simulation.alphaTarget(0.3).restart();
              }
              d.fx = d.x;
              d.fy = d.y;
            })
            .on('drag', function (event, d) {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on('end', function (event, d) {
              if (!event.active) {
                simulation.alphaTarget(0);
              }
              d.fx = null;
              d.fy = null;
            }),
        );
      // Node rectangles
      nodeElements
        .append('rect')
        .attr('x', -50)
        .attr('y', -20)
        .attr('width', 100)
        .attr('height', 40)
        .attr('fill', function (d) {
          return progressColor(d.progress);
        });
      // Node labels
      nodeElements
        .append('text')
        .attr('dy', '0.35em')
        .text(function (d) {
          return d.title;
        })
        .style('pointer-events', 'none');

      // Add a title element for native browser tooltips.  This acts as a
      // fallback tooltip in case the custom tooltip fails or is
      // clipped.  It displays the topic title and current progress
      // percentage when the user hovers over the node.  The custom
      // tooltip is still created above, but this ensures some
      // information is always available.
      nodeElements
        .append('title')
        .text(function (d) {
          return d.title + ' – ' + d.progress + '%';
        });

      // Add tooltip handlers to node groups.  We attach listeners to
      // the group so that hovering anywhere on the node reveals a
      // tooltip with the title and current progress.  Position is
      // updated on mousemove so the tooltip follows the pointer.
      nodeElements
        .on('mouseover', function (event, d) {
          tooltip.style('visibility', 'visible');
          tooltip.text(d.title + ' – ' + d.progress + '%');
        })
        .on('mousemove', function (event) {
          // Use pageX/pageY for absolute coordinates.  Because the
          // tooltip is appended to the body, no subtraction of
          // container offsets is necessary.  Offset the tooltip
          // slightly so it doesn't overlap the cursor.
          const x = event.pageX;
          const y = event.pageY;
          tooltip
            .style('left', x + 15 + 'px')
            .style('top', y + 15 + 'px');
        })
        .on('mouseout', function () {
          tooltip.style('visibility', 'hidden');
        });
      // Tick update positions
      simulation.on('tick', function () {
        links
          .attr('x1', function (d) {
            return d.source.x;
          })
          .attr('y1', function (d) {
            return d.source.y;
          })
          .attr('x2', function (d) {
            return d.target.x;
          })
          .attr('y2', function (d) {
            return d.target.y;
          });
        nodeElements.attr('transform', function (d) {
          return 'translate(' + d.x + ',' + d.y + ')';
        });
      });
      // Apply visibility filters for nodes and links.  Hidden nodes are
      // determined by the showActive and showCompleted toggles.  Links
      // attached to hidden nodes become invisible to avoid floating lines.
      nodeElements.classed('hidden', function (d) {
        if (!showCompleted && d.progress >= 100) return true;
        if (!showActive && d.progress < 100) return true;
        return false;
      });
      links.style('opacity', function (d) {
        // Determine if either end of the link is hidden.  We compare
        // against the simulation nodes array (simNodes) because d.source
        // and d.target refer to those copies.
        const srcHidden = (!showCompleted && d.source.progress >= 100) ||
          (!showActive && d.source.progress < 100);
        const tgtHidden = (!showCompleted && d.target.progress >= 100) ||
          (!showActive && d.target.progress < 100);
        return srcHidden || tgtHidden ? 0 : 0.5;
      });
    },
    [nodes, edges, showActive, showCompleted, showDependencies],
  );

  // Render function: navigation bar, graph container, optional modal
  return e(
    React.Fragment,
    null,
    // Navigation bar
    e(
      'nav',
      { className: 'navbar' },
      [
        e(
          'div',
          { className: 'navbar-left' },
          [
            e(
              'button',
              {
                id: 'hamburger',
                className: 'hamburger',
                'aria-label': 'menu',
                onClick: function () {
                  // Placeholder for future sidebar toggle
                },
              },
              '\u2630',
            ),
            e('span', { className: 'title' }, 'Knowledge Path Visualizer'),
          ],
        ),
        e(
          'div',
          { className: 'navbar-right' },
          [
            e(
              'label',
              null,
              [
                e('input', {
                  type: 'checkbox',
                  checked: showActive,
                  onChange: function () {
                    setShowActive(function (v) {
                      return !v;
                    });
                  },
                }),
                ' Show active',
              ],
            ),
            e(
              'label',
              null,
              [
                e('input', {
                  type: 'checkbox',
                  checked: showCompleted,
                  onChange: function () {
                    setShowCompleted(function (v) {
                      return !v;
                    });
                  },
                }),
                ' Show completed',
              ],
            ),
            e(
              'label',
              null,
              [
                e('input', {
                  type: 'checkbox',
                  checked: showDependencies,
                  onChange: function () {
                    setShowDependencies(function (v) {
                      return !v;
                    });
                  },
                }),
                ' Show dependencies',
              ],
            ),
            // Export and import buttons.  These appear at the right end of
            // the navigation bar and call the helper functions defined
            // earlier.  They are styled via the .navbar .button class.
            e(
              'button',
              {
                className: 'nav-action',
                onClick: function () {
                  exportProgress();
                },
              },
              'Export',
            ),
            e(
              'button',
              {
                className: 'nav-action',
                onClick: function () {
                  importProgress();
                },
              },
              'Import',
            ),
          ],
        ),
      ],
    ),
    // Graph container
    e('div', {
      id: 'graph-container',
      ref: graphRef,
      style: { flexGrow: 1, position: 'relative', overflow: 'hidden' },
    }),
    // Conditional modal
    selectedNode
      ? e(Modal, {
          node: selectedNode,
          nodes: nodes,
          onClose: function () {
            setSelectedNode(null);
          },
          updateProgress: updateProgress,
        })
      : null,
  );
}

// Mount the application when the DOM is ready.  If the root element is
// present, we render the KnowledgeGraphApp into it.
document.addEventListener('DOMContentLoaded', function () {
  const root = document.getElementById('root');
  if (root) {
    ReactDOM.render(e(KnowledgeGraphApp, null), root);
  }
});