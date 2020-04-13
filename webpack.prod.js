// DEPENDENCIES
const common = require('./webpack.common');
const merge = require('webpack-merge');

module.exports = common.map(config => merge(config, {
  mode: 'production',
  devtool: 'none',
}));
