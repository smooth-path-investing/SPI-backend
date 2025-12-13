// src/models/User.ts
export interface UserInput {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  agreed_to_terms: boolean | number;
}
