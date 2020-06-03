// NODE CORE IMPORTS
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
  entry: './js/login.ts',
  target: 'web',
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.ts$/,
        use: 'eslint-loader',
        include: PUBLIC_DIR,
        exclude: nodeModulesPattern,
      },
      {
        test: /(?<!\.test)\.ts$/,
        use: 'ts-loader',
        include: PUBLIC_DIR,
        exclude: nodeModulesPattern,
      },
    ]
  },
  resolve: {
    symlinks: false,
    extensions: [ '.ts' ],
  },
  output: {
    filename: 'login.js',
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
        test: /\.ts$/,
        use: 'eslint-loader',
        include: SRC_DIR,
        exclude: nodeModulesPattern,
      },
      {
        test: /(?<!\.test)\.ts$/,
        use: 'ts-loader',
        include: SRC_DIR,
        exclude: nodeModulesPattern,
      },
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js', '.css', '.hbs' ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: path.join(SRC_DIR, 'views'), to: path.join(OUTPUT_DIR, 'server/views') },
        { from: path.join(PUBLIC_DIR, 'css'), to: path.join(OUTPUT_DIR, 'public/css') },
        { from: path.join(PUBLIC_DIR, 'svg'), to: path.join(OUTPUT_DIR, 'public/svg') },
      ],
    }),
  ],
  output: {
    filename: 'main.js',
    path: path.join(OUTPUT_DIR, 'server/'),
  },
};

module.exports = [ web, node ];
