// app.js (optional wrapper for server setup)
import express from 'express';
import router from './routes/index';
import { json, urlencoded } from 'express';
import fileUpload from 'express-fileupload';
import dotenv from 'dotenv';
import './workers/imageProcessor';

dotenv.config();

const app = express();

app.use(json());
app.use(urlencoded({ extended: true }));
app.use(fileUpload());
app.use('/', router);

export default app;