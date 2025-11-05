import http from 'http';
import mongoose from 'mongoose';
import {app} from './app.js';
import { PORT, MONGO_URL } from './config/config.js';
import Logger from './config/winston.js';
import { User }  from './models/user.js'

const server = http.createServer(app);

mongoose.connect(MONGO_URL)
    .then(() => {
        console.log('MongoDB connected.');
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}.`);
            Logger.info(`Server is running on port ${PORT}`)
        })
    })
    .catch(err => console.error(err));
