#!/bin/zsh
set -e
cd "${0:A:h:h}"
exec /Users/kkstar/.nvm/versions/node/v24.17.0/bin/node --env-file-if-exists=.env server/index.js
