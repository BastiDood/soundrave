// TODO: delete stale builds before production
// NODE CORE IMPORTS
const path = require('path').posix;
const zlib = require('zlib');

// DEPENDENCIES
const lazypipe = require('lazypipe');
const typescript = require('typescript');
const vBuffer = require('vinyl-buffer');
const vSource = require('vinyl-source-stream');

// BROWSERIFY PLUGINS
const browserify = require('browserify');
const tsify = require('tsify');

// GULP PLUGINS
const brotli = require('gulp-brotli');
// const eslint = require('gulp-eslint');
const gulp = require('gulp');
const changed = require('gulp-changed');
const gulpIf = require('gulp-if');
const gZip = require('gulp-gzip');
const htmlMin = require('gulp-htmlmin');
const plumber = require('gulp-plumber');
const postcss = require('gulp-postcss');
const sourcemaps = require('gulp-sourcemaps');
const svgo = require('gulp-svgo');
const terser = require('gulp-terser');
const ts = require('gulp-typescript');

// POST-CSS PLUGINS
const cssImport = require('postcss-import');
const cssNano = require('cssnano');

// MAIN INPUT DIRECTORIES
const PUBLIC_DIR = './public';
const SRC_DIR = './src';
const TYPINGS_DIR = './typings';

// MAIN OUTPUT DIRECTORIES
const OUTPUT_DIR = './build';
const PUBLIC_OUT = path.join(OUTPUT_DIR, 'public');
const SERVER_OUT = path.join(OUTPUT_DIR, 'server');

// RESOURCE OUTPUT DIRECTORIES
const CLIENT_OUT = path.join(PUBLIC_OUT, 'js');
const CSS_OUT = path.join(PUBLIC_OUT, 'css');
const HBS_OUT = path.join(SERVER_OUT, 'views');
const SVG_OUT = path.join(PUBLIC_OUT, 'svg');
const IMG_OUT = path.join(PUBLIC_OUT, 'img');

// TYPESCRIPT PROJECT
const tsProject = ts.createProject('tsconfig.json', { typescript });

// COMPRESSION OPTIONS
const gZipOptions = {
  threshold: '2kb',
  skipGrowingFiles : true,
  gzipOptions: { level: zlib.constants.BEST_COMPRESSION },
};
const brotliOptions = {
  skipLarger: true,
  params: { [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY },
}

// CONVENIENCE CHANNELS
const optimizeSVG = lazypipe()
  .pipe(changed, SVG_OUT)
  .pipe(plumber)
  .pipe(svgo)
  .pipe(plumber.stop);
// const lintJS = lazypipe()
//   .pipe(eslint)
//   .pipe(eslint.failOnError);
const minifyJS = lazypipe()
  .pipe(vBuffer)
  .pipe(plumber)
  // .pipe(lintJS)
  .pipe(terser)
  .pipe(plumber.stop);

// Compile client-side TypeScript as `main.js`
function initClient(isProd) {
  const entry = path.join(PUBLIC_DIR, 'js/main.ts');
  const client = () => browserify({
      debug: false,
      cache: Object.create(null),
      packageCache: Object.create(null),
      entries: entry,
    })
    .plugin(tsify, { target: 'ES6' })
    .bundle()
    .pipe(vSource('main.js'))
    .pipe(gulpIf(isProd, minifyJS()))
    .pipe(gulp.dest(CLIENT_OUT));
  return client;
}

// Compile server-side TypeScript
function initServer(isProd) {
  const server = () => tsProject.src()
    .pipe(plumber())
    // .pipe(gulpIf(isProd, lintJS()))
    .pipe(sourcemaps.init())
    .pipe(tsProject()).js
    .pipe(sourcemaps.write('.'))
    .pipe(plumber.stop())
    .pipe(gulp.dest(SERVER_OUT));
  return server;
}

// Minify Handlebars templates
function initHBS(isProd) {
  const viewsPath = path.join(SRC_DIR, 'views');
  const glob = path.join(viewsPath, '**/*.hbs');
  const hbs = () => gulp.src(glob)
    .pipe(gulpIf(isProd, htmlMin({
      html5: true,
      collapseBooleanAttributes: true,
      collapseWhitespace: true,
      ignoreCustomFragments: [ /{{[{]?(.*?)[}]?}}/ ],
      quoteCharacter: '\"',
      removeAttributeQuotes: true,
      removeComments: true,
      removeEmptyAttributes: true,
      removeRedundantAttributes: true,
      removeStyleLinkTypeAttributes: true,
      useShortDoctype: true,
      trimCustomFragments: true,
    })))
    .pipe(gulp.dest(HBS_OUT));
  return hbs;
}

// Bundle CSS together
function initCSS(isProd) {
  const INPUT_DIR = path.join(PUBLIC_DIR, 'css');
  const entries = [
    path.join(INPUT_DIR, '*.css'),
    path.join(INPUT_DIR, 'pages/*.css'),
  ];
  const postcssPlugins = [ cssImport ];

  if (isProd)
    postcssPlugins.push(cssNano);

  const css = () => gulp.src(entries, { base: INPUT_DIR })
    .pipe(plumber())
    .pipe(postcss(postcssPlugins))
    .pipe(plumber.stop())
    .pipe(gulp.dest(CSS_OUT));

  return css;
}

// Optimize SVG files
function initSVG(isProd) {
  const INPUT_DIR = path.join(PUBLIC_DIR, 'svg');
  const glob = path.join(INPUT_DIR, '**/*.svg');
  const svg = () => gulp.src(glob, {
      buffer: isProd,
      base: INPUT_DIR,
    })
    .pipe(gulpIf(isProd, optimizeSVG()))
    .pipe(gulp.dest(SVG_OUT));
  return svg;
}

// Copy PNG image files
function images() {
  const INPUT_DIR = path.join(PUBLIC_DIR, 'img');
  const glob = path.join(INPUT_DIR, '**/*.png');
  return gulp.src(glob, {
    buffer: false,
    base: INPUT_DIR,
  })
    .pipe(gulp.dest(IMG_OUT));
}

// Copy `robots.txt`
function robots() {
  const textPath = path.join(PUBLIC_DIR, 'robots.txt');
  const out = path.join(OUTPUT_DIR, 'public');
  return gulp.src(textPath, { buffer: false })
    .pipe(gulp.dest(out));
}

// Compress assets via Gzip
function initGzip(srcs, out) {
  const compressGzip = () => gulp.src(srcs)
    .pipe(gZip(gZipOptions))
    .pipe(gulp.dest(out));
  return compressGzip;
}

// Compress assets via Brotli
function initBrotli(srcs, out) {
  const compressBrotli = () => gulp.src(srcs)
    .pipe(brotli(brotliOptions))
    .pipe(gulp.dest(out));
  return compressBrotli;
}

// Convenience function for task execution
function execBuild(isProd) {
  const clientSteps = [ initClient(isProd) ];
  const cssSteps = [ initCSS(isProd) ];
  const svgSteps = [ initSVG(isProd) ];
  const imgSteps = [ images ];

  // Production-specific optimizations
  if (isProd) {
    // JavaScript Compression
    const jsArgs = [ path.join(PUBLIC_OUT, 'js/main.js'), CLIENT_OUT ];
    clientSteps.push(gulp.parallel(initGzip(...jsArgs), initBrotli(...jsArgs)));

    // CSS Compression
    const cssArgs = [ path.join(CSS_OUT, '**/*.css'), CSS_OUT ];
    cssSteps.push(gulp.parallel(initGzip(...cssArgs), initBrotli(...cssArgs)));

    // SVG Compression
    const svgArgs = [ path.join(SVG_OUT, '**/*.svg'), SVG_OUT ];
    cssSteps.push(gulp.parallel(initGzip(...svgArgs), initBrotli(...svgArgs)));

    // Image Compression
    const imgArgs = [ path.join(IMG_OUT, '**/*.png'), IMG_OUT ];
    imgSteps.push(gulp.parallel(initGzip(...imgArgs), initBrotli(...imgArgs)));
  }

  return gulp.parallel(
    robots,
    initServer(isProd),
    initHBS(isProd),
    gulp.series(cssSteps),
    gulp.series(svgSteps),
    gulp.series(imgSteps),
    gulp.series(clientSteps),
  );
}

function watch() {
  // Watch Options
  const options = { ignoreInitial: false };

  // Server-side JS watch
  gulp.watch([
    path.join(SRC_DIR, '**/*.ts'),
    path.join(TYPINGS_DIR, '**/*.d.ts'),
  ], options, initServer(false));

  // Client-side JS watch
  // TODO: use Watchify for this
  gulp.watch(path.join(PUBLIC_DIR, 'js/**/*.ts'), options, initClient(false));

  // Client-side CSS watch
  gulp.watch(path.join(PUBLIC_DIR, 'css/**/*.css'), options, initCSS(false));

  // Client-side SVG watch
  gulp.watch(path.join(PUBLIC_DIR, 'svg/**/*.svg'), options, initSVG(false));

  // Handlebars watch
  gulp.watch(path.join(SRC_DIR, 'views/**/*.hbs'), options, initHBS(false));
}

const dev = execBuild(false);
const prod = execBuild(true);
module.exports = { watch, dev, prod, default: prod };
