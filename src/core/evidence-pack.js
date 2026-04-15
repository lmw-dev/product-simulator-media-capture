const fs = require('fs');
const logger = require('./logger');

class EvidencePackManager {
  constructor(pathManager, runInfo) {
    this.pathManager = pathManager;
    this.runId = runInfo.runId;
    this.sourceUrl = runInfo.sourceUrl;
    this.timestamp = runInfo.timestamp || new Date().toISOString();
    this.startedAtMs = Date.now();
    
    this.pack = {
      runId: this.runId,
      timestamp: this.timestamp,
      sourceUrl: this.sourceUrl,
      status: 'unknown',
      stage: 'initialized',
      runtime: {
        startedAt: this.timestamp,
        finishedAt: null,
        durationMs: null
      },
      artifacts: {
        resultPageScreenshot: null,
        articleScreenshot: null,
        tweetsScreenshot: null
      },
      content: {
        articleText: null,
        tweetsText: null
      },
      validation: {
        articlePresent: false,
        tweetsPresent: false,
        articleEmpty: false,
        tweetsEmpty: false,
        errorState: null
      },
      notes: {
        observation: '',
        nextAction: ''
      }
    };
  }

  updateStatus(status, stage, errorState = null) {
    this.pack.status = status;
    this.pack.stage = stage;
    if (errorState) {
      this.pack.validation.errorState = errorState;
    }
  }

  addArtifact(key, filename) {
    if (key in this.pack.artifacts) {
      this.pack.artifacts[key] = filename;
    }
  }

  addContent(key, text) {
    if (key in this.pack.content) {
      this.pack.content[key] = text;
      
      if (key === 'articleText') {
        const present = text !== null && text !== undefined;
        this.pack.validation.articlePresent = present;
        this.pack.validation.articleEmpty = present && text.trim().length === 0;
      } else if (key === 'tweetsText') {
        const present = text !== null && text !== undefined;
        this.pack.validation.tweetsPresent = present;
        this.pack.validation.tweetsEmpty = present && text.trim().length === 0;
      }
    }
  }

  setObservation(text) {
    this.pack.notes.observation = text;
  }

  save() {
    const finishedAt = new Date();
    this.pack.runtime.finishedAt = finishedAt.toISOString();
    this.pack.runtime.durationMs = Math.max(0, finishedAt.getTime() - this.startedAtMs);

    const jsonPath = this.pathManager.getFilePath('evidence-pack.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.pack, null, 2), 'utf-8');
    logger.info(`Evidence pack saved to ${jsonPath}`);
    
    this.generateRunSummary();
  }

  generateRunSummary() {
    const mdPath = this.pathManager.getFilePath('run-summary.md');
    
    const lines = [
      `# Run Summary: ${this.runId}`,
      `**Timestamp**: ${this.timestamp}`,
      `**Source URL**: ${this.sourceUrl}`,
      `**Status**: \`${this.pack.status}\``,
      `**Stage Reached**: \`${this.pack.stage}\``,
      '',
      `## Capture Validation`,
      `- **Article Captured**: ${this.pack.validation.articlePresent ? (this.pack.validation.articleEmpty ? 'Yes (But Empty)' : 'Yes') : 'No'}`,
      `- **Tweets Captured**: ${this.pack.validation.tweetsPresent ? (this.pack.validation.tweetsEmpty ? 'Yes (But Empty)' : 'Yes') : 'No'}`,
      '',
    ];

    if (this.pack.validation.errorState) {
      lines.push(`## Error / Timeout Information`);
      lines.push(`> ${this.pack.validation.errorState}`);
      lines.push('');
    }

    lines.push(`## Observation`);
    lines.push(this.pack.notes.observation || '*No manually provided observation.*');
    
    fs.writeFileSync(mdPath, lines.join('\n'), 'utf-8');
    logger.info(`Run summary saved to ${mdPath}`);
  }
}

module.exports = EvidencePackManager;
