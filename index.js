// #!/usr/bin/env node

/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
// Inspired by: https://github.com/commitizen/cz-conventional-changelog and https://github.com/commitizen/cz-cli

const CZ_CONFIG_NAME = '.cz-config.js';
const findConfig = require('find-config');
const editor = require('editor');
const temp = require('temp').track();
const fs = require('fs');
const path = require('path');
const log = require('./logger');
const buildCommit = require('./buildCommit');

/* istanbul ignore next */
const readConfigFile = () => {
  // First try to find the .cz-config.js config file
  const czConfig = findConfig.require(CZ_CONFIG_NAME, { home: false });

  if (czConfig) {
    return czConfig;
  }

  // fallback to locating it using the config block in the nearest package.json
  let pkg = findConfig('package.json', { home: false });
  if (pkg) {
    const pkgDir = path.dirname(pkg);

    pkg = require(pkg);

    if (pkg.config && pkg.config['cz-customizable'] && pkg.config['cz-customizable'].config) {
      // resolve relative to discovered package.json
      const pkgPath = path.resolve(pkgDir, pkg.config['cz-customizable'].config);

      log.info('>>> Using cz-customizable config specified in your package.json: ', pkgPath);

      return require(pkgPath);
    }
  }

  log.warn(
    'Unable to find a configuration file. Please refer to documentation to learn how to ser up: https://github.com/leonardoanalista/cz-customizable#steps "'
  );
  return null;
};

module.exports = {
  prompter(cz, commit) {
    const config = readConfigFile();
    config.subjectLimit = config.subjectLimit || 100;
    log.info(`消息类型和描述总共不能超过${config.subjectLimit}个字符。`);

    const questions = require('./questions').getQuestions(config, cz);

    cz.prompt(questions).then(answers => {
      if (answers.confirmCommit === 'edit') {
        temp.open(null, (err, info) => {
          /* istanbul ignore else */
          if (!err) {
            fs.writeSync(info.fd, buildCommit(answers, config));
            fs.close(info.fd, () => {
              editor(info.path, code => {
                if (code === 0) {
                  const commitStr = fs.readFileSync(info.path, {
                    encoding: 'utf8',
                  });
                  commit(commitStr);
                } else {
                  log.info(`Editor returned non zero value. Commit message was:\n${buildCommit(answers, config)}`);
                }
              });
            });
          }
        });
      } else if (answers.confirmCommit === 'yes') {
        commit(buildCommit(answers, config));
      } else {
        log.info('本次提交已被取消。');
      }
    });
  },
};
