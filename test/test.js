const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const globby = require('globby');
const merge = require('merge');

require('colors');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const createDirIfNotExist = (to, config) => {
  console.log(to, config);

  const dirs = [];
  let dir = path.dirname(to);

  while (dir !== path.dirname(dir)) {
    dirs.unshift(dir);
    dir = path.dirname(dir);
  }

  dirs.forEach(dir => {
    if (config.dryrun) {
      console.log('create: ', dir);
    } else if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  });
};

const wrapWithKeys = (json, _pathSegments) => {
  console.log(_pathSegments);

  return _pathSegments.reverse().reduce((result, current) => {
    return {
      [current]: result
    };
  }, json);
};

const getWrapStart = (input) => {
  const inputDirs = path.parse(input).dir.split(path.sep);

  return inputDirs.reduce((result, dir) => {
    if (dir.match(/\w+/g)) {
      return result + 1;
    }

    return result;
  }, 0);
};

const run = async config => {
  let { input, output, recursive, verbose, dryrun } = config;

  if (!Array.isArray(input)) {
    input = [input];
  }

  try {
    const paths = await globby(input);

    console.log(paths);

    const files = await Promise.all(paths.map(i => readFileAsync(i)));

    const mergeFn = recursive ? merge.recursive : merge;

    createDirIfNotExist(output, config);

    if (dryrun) {
      console.log(
        '[MERGE][DRYRUN:OUTPUT]\n'.yellow,
        JSON.stringify(
          mergeFn(
            ...files.map((i, index) => {
              console.log(paths[index]);

              const currentPath = path.parse(paths[index]);
              const wrapStart = getWrapStart(input[0]);
              const wrapPath = [
                ...currentPath.dir.split(path.sep).slice(wrapStart),
                currentPath.name
              ];

              console.log(wrapPath);

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
              console.log(paths[index]);

              const currentPath = path.parse(paths[index]);
              const wrapStart = getWrapStart(input[0]);
              const wrapPath = [
                ...currentPath.dir.split(path.sep).slice(wrapStart),
                currentPath.name
              ];

              console.log(wrapPath);

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

// console.log(getWrapDepth('a/b/c/d.json', 'a/**/*.json'));

console.log(
  JSON.stringify(wrapWithKeys({ shallow: 'prop' }, ['deep', 'file']), null, 4)
);

run({
  dryrun: false,
  input: ['test/mockup/**/*.json', '!**/_*.json'],
  output: 'test/mockup/_output.json',
  recursive: true
});
