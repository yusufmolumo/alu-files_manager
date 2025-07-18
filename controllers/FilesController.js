// controllers/FilesController.js
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { fileQueue } from '../queue';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { name, type, parentId = 0, isPublic = false, data } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) return res.status(400).json({ error: 'Missing type' });
    if (!data && type !== 'folder') return res.status(400).json({ error: 'Missing data' });

    if (parentId !== 0) {
      const parent = await dbClient.db.collection('files').findOne({ _id: new ObjectId(parentId) });
      if (!parent) return res.status(400).json({ error: 'Parent not found' });
      if (parent.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    if (type === 'folder') {
      const folder = {
        userId: user._id,
        name,
        type,
        parentId,
        isPublic,
      };
      const result = await dbClient.db.collection('files').insertOne(folder);
      return res.status(201).json({ id: result.insertedId, userId: user._id, name, type, isPublic, parentId });
    }

    const localPath = path.join(FOLDER_PATH, uuidv4());
    const fileData = Buffer.from(data, 'base64');
    await fs.promises.mkdir(FOLDER_PATH, { recursive: true });
    await fs.promises.writeFile(localPath, fileData);

    const file = {
      userId: user._id,
      name,
      type,
      isPublic,
      parentId,
      localPath,
    };
    const result = await dbClient.db.collection('files').insertOne(file);

    if (type === 'image') await fileQueue.add({ userId: user._id.toString(), fileId: result.insertedId.toString() });

    return res.status(201).json({ id: result.insertedId, userId: user._id, name, type, isPublic, parentId });
  }

  static async getShow(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(req.params.id), userId: new ObjectId(userId) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json({ id: file._id, userId: file.userId, name: file.name, type: file.type, isPublic: file.isPublic, parentId: file.parentId });
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentId = req.query.parentId || 0;
    const page = parseInt(req.query.page || 0, 10);
    const files = await dbClient.db.collection('files')
      .aggregate([
        { $match: { userId: new ObjectId(userId), parentId: parentId === 0 ? 0 : new ObjectId(parentId) } },
        { $skip: page * 20 },
        { $limit: 20 },
      ]).toArray();

    return res.status(200).json(files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId
    })));
  }

  static async putPublish(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(req.params.id), userId: new ObjectId(userId) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.db.collection('files').updateOne({ _id: file._id }, { $set: { isPublic: true } });
    file.isPublic = true;
    return res.status(200).json({ id: file._id, userId: file.userId, name: file.name, type: file.type, isPublic: true, parentId: file.parentId });
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(req.params.id), userId: new ObjectId(userId) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.db.collection('files').updateOne({ _id: file._id }, { $set: { isPublic: false } });
    file.isPublic = false;
    return res.status(200).json({ id: file._id, userId: file.userId, name: file.name, type: file.type, isPublic: false, parentId: file.parentId });
  }

  static async getFile(req, res) {
    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(req.params.id) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    if (!file.isPublic) {
      const token = req.header('X-Token');
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId || file.userId.toString() !== userId) return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') return res.status(400).json({ error: "A folder doesn't have content" });
    if (!fs.existsSync(file.localPath)) return res.status(404).json({ error: 'Not found' });

    const size = req.query.size;
    const ext = size ? `_${size}` : '';
    const fullPath = file.type === 'image' ? `${file.localPath}${ext}` : file.localPath;

    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Not found' });

    const mimeType = mime.lookup(file.name);
    res.setHeader('Content-Type', mimeType);
    return res.status(200).sendFile(fullPath);
  }
}

export default FilesController;
