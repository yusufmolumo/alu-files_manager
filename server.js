// server.js
import express from 'express';
import router from './routes/index';
import { createServer } from 'http';
import { json, urlencoded } from 'express';
import fileUpload from 'express-fileupload';
import dotenv from 'dotenv';
import './workers/imageProcessor';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(json());
app.use(urlencoded({ extended: true }));
app.use(fileUpload());
app.use('/', router);

const server = createServer(app);

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
