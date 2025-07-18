// workers/imageProcessor.js
import { createReadStream, promises as fsPromises } from 'fs';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { promisify } from 'util';
import imageThumbnail from 'image-thumbnail';
import dbClient from '../utils/db';
import fileQueue from '../queue';

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId || !userId) return;

  const file = await dbClient.db.collection('files').findOne({ _id: dbClient.client.bson.ObjectId(fileId), userId });
  if (!file) return;

  if (file.type !== 'image') return;

  const sizes = [500, 250, 100];

  for (const size of sizes) {
    try {
      const thumbnail = await imageThumbnail(file.localPath, { width: size });
      const filePath = `${file.localPath}_${size}`;
      await writeFile(filePath, thumbnail);
    } catch (err) {
      console.error(`Failed to generate thumbnail for size ${size}:`, err);
    }
  }
});
