// NATIVE IMPORTS
const path = require('path');

// DEPENDENCIES
const CopyPlugin = require('copy-webpack-plugin');
const nodeExternals  = require('webpack-node-externals');

// GLOBAL VARIABLES
const OUTPUT_DIR = path.resolve(__dirname, 'build');
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const SRC_DIR = path.resolve(__dirname, 'src');
const nodeModulesPattern = /node_modules/;

const web = {
  context: PUBLIC_DIR,
  entry: './js/main.ts',
  target: 'web',
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.tsx?$/,
        use: 'eslint-loader',
        exclude: nodeModulesPattern,
      },
      {
        test: /(?<!\.test)\.tsx?$/,
        use: 'ts-loader',
        exclude: nodeModulesPattern,
      },
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
  },
  output: {
    filename: 'main.js',
    path: path.join(OUTPUT_DIR, 'public/js'),
  },
};

const node = {
  context: SRC_DIR,
  entry: './main.ts',
  target: 'node',
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: [ nodeExternals() ],
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.tsx?$/,
        use: 'eslint-loader',
        exclude: nodeModulesPattern,
      },
      {
        test: /(?<!\.test)\.tsx?$/,
        use: 'ts-loader',
        exclude: nodeModulesPattern,
      },
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js', '.css', '.hbs' ],
  },
  plugins: [
    new CopyPlugin([
      { from: path.join(SRC_DIR, 'views'), to: path.join(OUTPUT_DIR, 'server/views') },
      { from: path.join(PUBLIC_DIR, 'css'), to: path.join(OUTPUT_DIR, 'public/css') },
    ]),
  ],
  output: {
    filename: 'main.js',
    path: path.join(OUTPUT_DIR, 'server/'),
  },
};

module.exports = [ web, node ];