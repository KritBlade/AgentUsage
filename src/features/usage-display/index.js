'use strict';
/** Usage display: the status bar dots, the hover, and the checklist that chooses the dots. */
const { placeDots, buildStatusText, buildHoverMarkdown } = require('./usage-display-core.js');
const { chooseStatusBarDots } = require('./dot-choice.js');

module.exports = { placeDots, buildStatusText, buildHoverMarkdown, chooseStatusBarDots };
