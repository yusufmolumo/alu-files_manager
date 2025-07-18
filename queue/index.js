// queue/index.js
import Queue from 'bull';

const fileQueue = new Queue('fileQueue');

export default fileQueue;
