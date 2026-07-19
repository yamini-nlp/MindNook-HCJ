const path = require('path');

function loadFrontendModules() {
  const frontendDir = path.join(__dirname, '..', '..', 'Frontend');
  delete require.cache[require.resolve(path.join(frontendDir, 'hyperbole_lexicon.js'))];
  delete require.cache[require.resolve(path.join(frontendDir, 'utility_decomposition.js'))];
  delete require.cache[require.resolve(path.join(frontendDir, 'personal_baseline.js'))];
  delete require.cache[require.resolve(path.join(frontendDir, 'goal_clarification.js'))];
  const hyperbole = require(path.join(frontendDir, 'hyperbole_lexicon.js'));
  const utility = require(path.join(frontendDir, 'utility_decomposition.js'));
  const baseline = require(path.join(frontendDir, 'personal_baseline.js'));
  const goalClarification = require(path.join(frontendDir, 'goal_clarification.js'));
  return { hyperbole, utility, baseline, goalClarification };
}

module.exports = { loadFrontendModules };