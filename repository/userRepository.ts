// src/repositories/userRepository.ts
import db from '../config/db';
import { UserInput } from '../models/users';

export const getAllUsers = async () => {
  const [rows] = await db.query('SELECT * FROM users');
  return rows;
};

export const createUser = async (user: UserInput) => {
  const sql = `
    INSERT INTO users (first_name, last_name, email, password, agreed_to_terms)
    VALUES (?, ?, ?, ?, ?)
  `;

  const values = [user.first_name, user.last_name, user.email, user.password, user.agreed_to_terms];

  const [result]: any = await db.query(sql, values);
  return result.insertId;
};
