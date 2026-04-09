const path = require('path');
const fs = require('fs');

class PathManager {
  constructor(runId) {
    this.runId = runId;
    this.baseDir = path.join(__dirname, '../../outputs');
    
    // 生成 YYYY-MM-DD
    const dateStr = new Date().toISOString().split('T')[0];
    this.runDir = path.join(this.baseDir, dateStr, runId);
  }

  ensureRunDir() {
    if (!fs.existsSync(this.runDir)) {
      fs.mkdirSync(this.runDir, { recursive: true });
    }
  }

  getFilePath(filename) {
    this.ensureRunDir();
    return path.join(this.runDir, filename);
  }
}

module.exports = PathManager;
