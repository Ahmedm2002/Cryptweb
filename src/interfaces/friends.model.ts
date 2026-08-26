export interface friendRequestI {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: Date;
  responded_at: Date | null;
}

export interface friendshipI {
  id: string;
  user_one_id: string;
  user_two_id: string;
  created_at: Date;
}

export interface conversationI {
  id: string;
  user_one_id: string;
  user_two_id: string;
  created_at: Date;
}

export interface conversationPreferenceI {
  id: string;
  conversation_id: string;
  user_id: string;
  save_messages: boolean;
  updated_at: Date;
}

export interface messageI {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  saved_for_sender: boolean;
  saved_for_receiver: boolean;
  created_at: Date;
}

export interface notificationI {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: Date;
}
