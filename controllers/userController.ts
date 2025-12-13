// src/controllers/userController.ts
import { Request, Response } from 'express';
import * as userService from '../services/userServices';

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email, password, agreed_to_terms } = req.body;

    // Basic validation
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields: first_name, last_name, email, and password are mandatory.',
      });
    }

    const newUserId = await userService.createUser({
      first_name,
      last_name,
      email,
      password,
      agreed_to_terms,
    });

    res.status(201).json({
      message: 'User added successfully',
      id: newUserId,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to add user.' });
  }
};
