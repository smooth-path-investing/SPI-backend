import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 5050;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// app.get('/', (req, res) => {
//   res.send('Express server is running ✅');
// });

// Routes
app.use('/users', userRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
