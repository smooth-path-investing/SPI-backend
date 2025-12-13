// src/services/userService.ts
import { UserInput } from '../models/users';
import * as userRepo from '../repository/userRepository';

export const getAllUsers = async () => {
  return await userRepo.getAllUsers();
};

export const createUser = async (data: UserInput) => {
  const agreed = data.agreed_to_terms ? 1 : 0;

  // Example business logic (expand later):
  // - Hash password
  // - Check if email exists
  // - Validate email format

  return await userRepo.createUser({
    ...data,
    agreed_to_terms: agreed,
  });
};
