export interface WebRTCOfferPayload {
  from: string;
  to: string;
  offer: any;
}

export interface WebRTCAnswerPayload {
  from: string;
  to: string;
  answer: any;
}

export interface WebRTCIceCandidatePayload {
  from: string;
  to: string;
  candidate: any;
}

export interface WebRTCUsersConnectedPayload {
  initiator: string;
  receiver: string;
}

export interface CallRequestPayload {
  from: string;
  to: string;
  type: "video" | "audio";
}

export interface CallResponsePayload {
  from: string;
  to: string;
  accepted: boolean;
}

export interface CallEndedPayload {
  from: string;
  to: string;
}
