// NODE CORE IMPORTS
const path = require('path');

// DEPENDENCIES
const browserify = require('browserify');
const gulp = require('gulp');
const ts = require('gulp-typescript');
const tsify = require('tsify');
const typescript = require('typescript');
const vBuffer = require('vinyl-buffer');
const vSource = require('vinyl-source-stream');

// GULP PLUGINS
const plumber = require('gulp-plumber');
const postcss = require('gulp-postcss');
const sourcemaps = require('gulp-sourcemaps');
// const svgo = require('gulp-svgo');

// POST-CSS PLUGINS
const cssImport = require('postcss-import');
// const cssNano = require('cssnano');

// MAIN DIRECTORIES
const OUTPUT_DIR = path.resolve(__dirname, 'build');
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const SRC_DIR = path.resolve(__dirname, 'src');

// OUTPUT DIRECTORIES
const SERVER_OUT = path.join(OUTPUT_DIR, 'server');
const HBS_OUT = path.join(SERVER_OUT, 'views');
const CLIENT_OUT = path.join(OUTPUT_DIR, 'public/js');
const CSS_OUT = path.join(OUTPUT_DIR, 'public/css');
const CSS_PAGES_OUT = path.join(CSS_OUT, 'pages');
const SVG_OUT = path.join(OUTPUT_DIR, 'public/svg');

// TYPESCRIPT PROJECT
const tsProject = ts.createProject('tsconfig.json', { typescript });

// Compile client-side TypeScript
function client() {
  const entry = path.join(PUBLIC_DIR, 'js/main.ts');
  const config = {
    basedir: '.',
    cache: {},
    packageCache: {},
    entries: [ entry ],
    debug: true,
  };
  return browserify(config)
    .plugin(tsify)
    .bundle()
    .pipe(vSource('main.js'))
    .pipe(vBuffer())
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(sourcemaps.write('.'))
    .pipe(plumber.stop())
    .pipe(gulp.dest(CLIENT_OUT));
}

// Compile server-side TypeScript
function server() {
  return tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(tsProject()).js
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(SERVER_OUT));
}

// Minify Handlebars templates
function hbs() {
  const viewsPath = path.join(SRC_DIR, 'views');
  const glob = path.join(viewsPath, '**/*.hbs');
  return gulp.src(glob)
    .pipe(gulp.dest(HBS_OUT));
}

// Bundle CSS together
function css() {
  const entries = [
    path.join(PUBLIC_DIR, 'css/main.css'),
    path.join(PUBLIC_DIR, 'css/pages/*.css'),
  ];
  return gulp.src(entries)
    .pipe(plumber())
    .pipe(postcss([ cssImport ]))
    .pipe(plumber.stop())
    .pipe(gulp.dest(file => file.stem === 'main' ? CSS_OUT : CSS_PAGES_OUT));
}

// Compile other client-side assets
function svg() {
  const glob = path.join(PUBLIC_DIR, 'svg/*.svg');
  return gulp.src(glob)
    .pipe(gulp.dest(SVG_OUT));
}

module.exports.default = gulp.parallel(css, svg, hbs, client, server);
