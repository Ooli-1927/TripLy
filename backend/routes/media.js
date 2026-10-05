import { Router } from 'express';
import { getMediaBucket, ObjectId } from '../db.js';
import { findUserById } from '../models/user.js';

const router = Router();

const DEST_KINDS = new Set(['hero', 'spot-1', 'spot-2', 'spot-3', 'spot-4']);
const DEST_ID_RE = /^[a-z0-9-]+$/;

/**
 * @param {import('express').Response} res
 * @param {import('mongodb').GridFSFile} file
 */
function streamFile(res, file) {
  const bucket = getMediaBucket();
  res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const stream = bucket.openDownloadStream(file._id);
  stream.on('error', () => {
    if (!res.headersSent) res.status(404).end();
    else res.end();
  });
  stream.pipe(res);
}

router.get('/dest/:destId/:kind', async (req, res) => {
  try {
    const destId = String(req.params.destId || '');
    const kind = String(req.params.kind || '');
    if (!DEST_ID_RE.test(destId) || !DEST_KINDS.has(kind)) {
      return res.status(404).end();
    }

    const bucket = getMediaBucket();
    const cursor = bucket.find({ 'metadata.destId': destId, 'metadata.kind': kind }).limit(1);
    const files = await cursor.toArray();
    if (!files.length) return res.status(404).end();
    return streamFile(res, files[0]);
  } catch (err) {
    console.error('media dest failed', err);
    return res.status(500).end();
  }
});

router.get('/avatar/:userId', async (req, res) => {
  try {
    const userId = String(req.params.userId || '');
    if (!ObjectId.isValid(userId)) return res.status(404).end();
    const user = await findUserById(userId);
    if (!user?.avatarFileId) return res.status(404).end();

    const bucket = getMediaBucket();
    const cursor = bucket.find({ _id: user.avatarFileId }).limit(1);
    const files = await cursor.toArray();
    if (!files.length) return res.status(404).end();
    return streamFile(res, files[0]);
  } catch (err) {
    console.error('media avatar failed', err);
    return res.status(500).end();
  }
});

export default router;
