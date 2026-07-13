const fs = require('fs')
const os = require('os')
const path = require('path')

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'season-spec-'))

process.once('exit', () => {
  fs.rmSync(directory, {recursive: true, force: true})
})

module.exports = {
  mkdirSync(prefix = 'temp-') {
    return fs.mkdtempSync(path.join(directory, prefix))
  }
}
