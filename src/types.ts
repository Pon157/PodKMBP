export interface Admin {
  id: string;
  username: string; // login username
  passwordHash?: string; // stored plainly or simple hash
  nickname: string;
  role: string;
  aboutMe: string;
  hobbies: string;
  photoUrl: string;
  musicUrl: string; // URL to audio/song or name
  tgId: string; // telegram user id for bot alerts
  isInRest?: boolean;
}

export interface Take {
  id: string;
  type: 'take' | 'idea';
  content: string;
  imageUrl?: string;
  targetAdminId: string; // 'all' or specific admin ID
  status: 'pending' | 'taken' | 'resolved';
  takenBy?: string; // admin ID who took it
  createdAt: string;
  dialogue?: Array<{
    sender: 'user' | 'admin';
    text: string;
    createdAt: string;
  }>;
}

export interface Survey {
  id: string;
  source: string; // where did you learn about the project?
  sphere: string; // what sphere are you from?
  age: number; // how old are you?
  roleInterest: string; // what do you want to do?
  helpDescription: string; // how are you ready to help?
  tgUsername: string; // telegram username for contact
  createdAt: string;
}

export interface PriceItem {
  id: string;
  title: string;
  price: string;
  description: string;
}

export interface UnionItem {
  id: string;
  name: string;
  link: string;
  description: string;
}

export interface AppStats {
  activeUsers: number;
}
