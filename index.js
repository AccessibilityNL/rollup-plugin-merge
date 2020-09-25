const fs = require('fs');
const path = require('path');
const globby = require('globby');
const { promisify } = require('util');
const chokidar = require('chokidar');
const merge = require('merge');
const { name } = require('./package.json');

require('colors');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const createDirIfNotExist = to => {
  const dirs = [];
  let dir = path.dirname(to);

  while (dir !== path.dirname(dir)) {
    dirs.unshift(dir);
    dir = path.dirname(dir);
  }

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  });
};

const wrapWithKeys = (json, _pathSegments) => {
  return _pathSegments.reverse().reduce((result, current) => {
    return {
      [current]: result
    };
  }, json);
};

const getWrapStart = input => {
  const inputDirs = path.parse(input).dir.split(path.sep);

  return inputDirs.reduce((result, dir) => {
    if (dir.match(/\w+/g)) {
      return result + 1;
    }

    return result;
  }, 0);
};

module.exports = async ({
  dryrun = false,
  input,
  output,
  watch = false,
  verbose = false,
  recursive = false
}) => {
  const paths = await globby(input);

  paths.forEach((item, i) => {
    if (item === output) {
      paths.splice(i,1);
    }
  });

  const run = async () => {
    if (!Array.isArray(input)) {
      input = [input];
    }

    try {
      const files = await Promise.all(paths.map(i => readFileAsync(i)));

      const mergeFn = recursive ? merge.recursive : merge;

      if (!dryrun) {
        createDirIfNotExist(output);
      }

      if (dryrun) {
        console.log(
          '[MERGE][DRYRUN:OUTPUT]\n'.yellow,
          JSON.stringify(
            mergeFn(
              ...files.map((i, index) => {
                const currentPath = path.parse(paths[index]);
                const wrapStart = getWrapStart(input[0]);
                const wrapPath = [
                  ...currentPath.dir.split(path.sep).slice(wrapStart),
                  currentPath.name
                ];

                const parsedJSON = JSON.parse(i);
                const wrappedJSON = wrapWithKeys(parsedJSON, wrapPath);

                return wrappedJSON;
              })
            ),
            null,
            4
          )
        );
      } else {
        // parse json
        // wrap json files in paths objects - input root
        await writeFileAsync(
          output,
          JSON.stringify(
            mergeFn(
              ...files.map((i, index) => {
                const currentPath = path.parse(paths[index]);
                const wrapStart = getWrapStart(input[0]);
                const wrapPath = [
                  ...currentPath.dir.split(path.sep).slice(wrapStart),
                  currentPath.name
                ];

                const parsedJSON = JSON.parse(i);
                const wrappedJSON = wrapWithKeys(parsedJSON, wrapPath);

                return wrappedJSON;
              })
            ),
            null,
            4
          )
        );
      }

      if (verbose) {
        console.log('[MERGE][COMPLETE]'.yellow, output);
      }
    } catch (e) {
      console.log('[MERGE][ERROR]'.red, output);
      console.error(e);
    }
  };

  let once = true;
  return {
    name,
    buildStart() {
      if (once) {
        once = false;

        if (watch) {
          chokidar
            .watch(paths)
            .on('add', run)
            .on('change', run)
            .on('unlink', run)
            .on('error', e => console.error(e));
        } else {
          run();
        }
      }
    }
  };
};
