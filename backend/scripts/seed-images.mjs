/**
 * Upload local destination photos from frontend/assets/img into MongoDB GridFS.
 * After seeding, the site loads them via MongoDB-backed URLs:
 *   /api/media/dest/<destId>/hero
 *   /api/media/dest/<destId>/spot-1 … spot-4
 *
 * Skips missing files. Re-run safe: replaces prior GridFS docs with same metadata.
 *
 * Usage: npm run seed:images
 */
import dotenv from 'dotenv';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, connectDb, getMediaBucket } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(backendRoot, '../frontend');

dotenv.config({ path: path.join(backendRoot, '.env') });

const DEST_IDS = [
  'coxs-bazar',
  'saint-martin',
  'bandarban',
  'rangamati',
  'sreemangal',
  'jaflong',
  'sonargaon',
  'sundarbans',
  'kuakata',
  'paharpur',
];

const KINDS = ['hero', 'spot-1', 'spot-2', 'spot-3', 'spot-4'];

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Missing MONGODB_URI in backend/.env');
  process.exit(1);
}

await connectDb(uri);
const bucket = getMediaBucket();

let uploaded = 0;
let skipped = 0;

for (const destId of DEST_IDS) {
  for (const kind of KINDS) {
    const filename = `${kind}.webp`;
    const filePath = path.join(frontendRoot, 'assets', 'img', destId, filename);
    if (!existsSync(filePath)) {
      skipped += 1;
      continue;
    }

    const existing = await bucket
      .find({ 'metadata.destId': destId, 'metadata.kind': kind })
      .toArray();
    for (const file of existing) {
      await bucket.delete(file._id);
    }

    await new Promise((resolve, reject) => {
      const stream = bucket.openUploadStream(`${destId}-${kind}.webp`, {
        contentType: 'image/webp',
        metadata: { destId, kind },
      });
      stream.on('finish', () => {
        uploaded += 1;
        console.log(`uploaded ${destId}/${kind} → /api/media/dest/${destId}/${kind}`);
        resolve();
      });
      stream.on('error', reject);
      createReadStream(filePath).pipe(stream);
    });
  }
}

console.log(`Done. uploaded=${uploaded} skipped(missing)=${skipped}`);
await closeDb();
