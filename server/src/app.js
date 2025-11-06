import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRoutes } from "./routes/auth.js"


export const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Chat backend API running ✅' });
});
