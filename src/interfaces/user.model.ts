export interface userI {
  id: string;
  email: string;
  name: string;
  username: string;
  password_hash: string;
  profile_picture?: string;
  save_messages_default?: boolean;
  last_login_at?: Date;
  verified_at?: Date;
  deleted_at?: Date;
  created_on?: Date;
  updated_on?: Date;
}
