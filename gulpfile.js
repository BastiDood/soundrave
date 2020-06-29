// NODE CORE IMPORTS
const path = require('path');
const zlib = require('zlib');

// DEPENDENCIES
const lazypipe = require('lazypipe');
const typescript = require('typescript');
const vBuffer = require('vinyl-buffer');
const vSource = require('vinyl-source-stream');

// BROWSERIFY PLUGINS
const babelify = require('babelify');
const browserify = require('browserify');
const tsify = require('tsify');

// GULP PLUGINS
const brotli = require('gulp-brotli');
const gulp = require('gulp');
const changed = require('gulp-changed');
const gulpIf = require('gulp-if');
const gZip = require('gulp-gzip');
// const htmlMin = require('gulp-htmlmin');
const plumber = require('gulp-plumber');
const postcss = require('gulp-postcss');
const sourcemaps = require('gulp-sourcemaps');
const svgo = require('gulp-svgo');
const ts = require('gulp-typescript');
const uglify = require('gulp-uglify');

// POST-CSS PLUGINS
const cssImport = require('postcss-import');
const cssNano = require('cssnano');

// MAIN INPUT DIRECTORIES
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const SRC_DIR = path.resolve(__dirname, 'src');

// MAIN OUTPUT DIRECTORIES
const OUTPUT_DIR = path.resolve(__dirname, 'build');
const PUBLIC_OUT = path.join(OUTPUT_DIR, 'public');
const SERVER_OUT = path.join(OUTPUT_DIR, 'server');

// RESOURCE OUTPUT DIRECTORIES
const CLIENT_OUT = path.join(PUBLIC_OUT, 'js');
const CSS_OUT = path.join(PUBLIC_OUT, 'css');
const CSS_PAGES_OUT = path.join(CSS_OUT, 'pages');
const HBS_OUT = path.join(SERVER_OUT, 'views');
const SVG_OUT = path.join(PUBLIC_OUT, 'svg');

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
const minifyJS = lazypipe()
  .pipe(vBuffer)
  .pipe(plumber)
  .pipe(uglify)
  .pipe(plumber.stop);

// Compile client-side TypeScript as `main.js`
function initClient(isProd) {
  const entry = path.join(PUBLIC_DIR, 'js/main.ts');
  const client = () => browserify({ debug: false })
    .add(entry)
    .plugin(tsify)
    .transform(babelify, {
      presets: [ '@babel/preset-env' ],
      extensions: [ '.ts' ],
    })
    .bundle()
    .pipe(vSource('main.js'))
    .pipe(gulpIf(isProd, minifyJS()))
    .pipe(gulp.dest(CLIENT_OUT));
  return client;
}

// Compile server-side TypeScript
function server() {
  return tsProject.src()
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(tsProject()).js
    .pipe(sourcemaps.write('.'))
    .pipe(plumber.stop())
    .pipe(gulp.dest(SERVER_OUT));
}

// Minify Handlebars templates
function hbsDev() {
  const viewsPath = path.join(SRC_DIR, 'views');
  const glob = path.join(viewsPath, '**/*.hbs');
  return gulp.src(glob, { buffer: false })
    .pipe(gulp.dest(HBS_OUT));
}

// Bundle CSS together
function initCSS(isProd) {
  const entries = [
    path.join(PUBLIC_DIR, 'css/main.css'),
    path.join(PUBLIC_DIR, 'css/pages/*.css'),
  ];
  const postcssPlugins = [ cssImport ];

  if (isProd)
    postcssPlugins.push(cssNano);

  const css = () => gulp.src(entries)
    .pipe(plumber())
    .pipe(postcss(postcssPlugins))
    .pipe(plumber.stop())
    .pipe(gulp.dest(file => file.stem === 'main' ? CSS_OUT : CSS_PAGES_OUT));

  return css;
}

// Optimize SVG files
function initSVG(isProd) {
  const glob = path.join(PUBLIC_DIR, 'svg/*.svg');
  const svg = () => gulp.src(glob, { buffer: isProd })
    .pipe(gulpIf(isProd, optimizeSVG()))
    .pipe(gulp.dest(SVG_OUT));
  return svg;
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
// TODO: delete stale builds before production
function execBuild(isProd) {
  const clientSteps = [ initClient(isProd) ];
  const cssSteps = [ initCSS(isProd) ];

  // Production-specific optimizations
  if (isProd) {
    // JavaScript compression
    const jsArgs = [ path.join(PUBLIC_OUT, 'js/main.js'), CLIENT_OUT ];
    clientSteps.push(gulp.parallel(initGzip(...jsArgs), initBrotli(...jsArgs)));

    // CSS Compression
    const cssArgs = [ path.join(CSS_OUT, '**/*.css'), CSS_OUT ];
    cssSteps.push(gulp.parallel(initGzip(...cssArgs), initBrotli(...cssArgs)));
  }

  return gulp.parallel(
    gulp.series(cssSteps),
    initSVG(isProd),
    hbsDev,
    gulp.series(clientSteps),
    server,
    robots,
  );
}

module.exports = {
  dev: execBuild(false),
  prod: execBuild(true),
};
