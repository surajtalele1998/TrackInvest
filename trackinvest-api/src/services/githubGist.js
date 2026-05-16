const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const GIST_API = 'https://api.github.com/gists';

async function backupToGist(data, description = 'TrackInvest Backup') {
  if (!config.github.token) {
    logger.warn('GitHub token not configured');
    return { sent: false, reason: 'GITHUB_TOKEN missing' };
  }

  const files = {};
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `trackinvest-backup-${timestamp}.json`;
  files[filename] = { content: JSON.stringify(data, null, 2) };

  try {
    if (config.github.gistId) {
      const { data: result } = await axios.patch(`${GIST_API}/${config.github.gistId}`, {
        description,
        files,
      }, { headers: { Authorization: `token ${config.github.token}` } });
      logger.info(`Backup updated in gist ${config.github.gistId}`);
      return { sent: true, id: config.github.gistId, url: result.html_url };
    } else {
      const { data: result } = await axios.post(GIST_API, {
        description,
        public: false,
        files,
      }, { headers: { Authorization: `token ${config.github.token}` } });
      const gistId = result.id;
      logger.info(`Backup created as new gist ${gistId}`);
      return { sent: true, id: gistId, url: result.html_url };
    }
  } catch (err) {
    logger.error('GitHub Gist backup failed: ' + (err.response?.data?.message || err.message));
    return { sent: false, error: err.message };
  }
}

async function restoreFromGist(gistId) {
  if (!config.github.token) throw new Error('GITHUB_TOKEN not configured');
  const { data } = await axios.get(`${GIST_API}/${gistId || config.github.gistId}`, {
    headers: { Authorization: `token ${config.github.token}` },
  });
  const files = Object.values(data.files);
  if (!files.length) throw new Error('Gist has no files');
  const content = JSON.parse(files[0].content);
  return content;
}

async function listGistBackups() {
  if (!config.github.token) return [];
  const { data } = await axios.get(`${GIST_API}`, {
    headers: { Authorization: `token ${config.github.token}` },
    params: { per_page: 20 },
  });
  return data
    .filter(g => g.description?.includes('TrackInvest'))
    .map(g => ({
      id: g.id,
      description: g.description,
      files: Object.keys(g.files),
      updatedAt: g.updated_at,
      url: g.html_url,
    }));
}

module.exports = { backupToGist, restoreFromGist, listGistBackups };
