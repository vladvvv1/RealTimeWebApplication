import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from "./routes/auth.js"
import bodyParser from 'body-parser';
import userRoutes from "./routes/user.js"

export const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Chat backend API running ✅' });
});
