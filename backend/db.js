import { GridFSBucket, MongoClient, ObjectId } from 'mongodb';

/** @type {MongoClient | null} */
let client = null;
/** @type {import('mongodb').Db | null} */
let db = null;
/** @type {GridFSBucket | null} */
let mediaBucket = null;

/**
 * Connect to MongoDB Atlas and prepare the media GridFS bucket.
 * @param {string} uri
 */
export async function connectDb(uri) {
  if (db && mediaBucket) return { db, mediaBucket };
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  mediaBucket = new GridFSBucket(db, { bucketName: 'media' });
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  return { db, mediaBucket };
}

/** @returns {import('mongodb').Db} */
export function getDb() {
  if (!db) throw new Error('Database not connected');
  return db;
}

/** @returns {GridFSBucket} */
export function getMediaBucket() {
  if (!mediaBucket) throw new Error('GridFS bucket not ready');
  return mediaBucket;
}

export { ObjectId };

export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    mediaBucket = null;
  }
}
