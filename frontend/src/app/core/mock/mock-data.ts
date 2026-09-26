import { Achievement, AchievementMission, AppUser, PracticeSession, UserSettings } from "../models/app.models";

/** Shared demo fixtures. Keep mock values here so pages consume one source of truth. */
export const MOCK_USER: AppUser = {
  name: "Minh Anh", email: "minhanh@gmail.com", level: "B1", xp: 3420, streak: 12,
  avatar: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=80&h=80&fit=crop&auto=format",
  interests: ["Du lịch", "Công nghệ", "Ẩm thực"],
  goals: ["Giao tiếp tự nhiên", "Thuyết trình công việc"],
  weaknesses: ["Phát âm", "Tốc độ phản hồi"]
};

export const MOCK_SETTINGS: UserSettings = {
  notifications: true, dailyReminder: true, aiVoice: "female", aiSpeed: "normal", theme: "light"
};

export const THEME_OPTIONS = [
  { val: "light", label: "☀️ Sáng" },
  { val: "dark", label: "🌙 Tối" },
  { val: "system", label: "💻 Hệ thống" }
] as const;

export const MOCK_MISSIONS: AchievementMission[] = [
  { id: 1, label: "Hoàn thành 1 buổi AI Coach", xp: 50, done: true, icon: "🎙️" },
  { id: 2, label: "Luyện 1 tình huống mới", xp: 30, done: false, icon: "🎭" },
  { id: 3, label: "Tham gia Phòng cộng đồng", xp: 40, done: false, icon: "👥" },
  { id: 4, label: "Duy trì streak hôm nay", xp: 20, done: true, icon: "🔥" }
];

export const MOCK_SESSIONS: PracticeSession[] = [
  { topic: "Giới thiệu bản thân", date: "Hôm nay, 09:15", duration: "18 phút", score: 76, type: "ai-coach" },
  { topic: "Đặt phòng khách sạn", date: "Hôm qua, 20:30", duration: "12 phút", score: 82, type: "scenario" },
  { topic: "Small Talk at Work", date: "2 ngày trước", duration: "25 phút", score: 70, type: "community" }
];

export const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: 1, emoji: "🎙️", name: "Người nói đầu tiên", desc: "Hoàn thành buổi AI Coach đầu tiên", earned: true, date: "12/01/2025" },
  { id: 2, emoji: "🔥", name: "Streak 7 ngày", desc: "Học liên tục 7 ngày", earned: true, date: "08/03/2025" },
  { id: 3, emoji: "🌟", name: "B1 Achiever", desc: "Đạt level B1", earned: true, date: "15/03/2025" },
  { id: 4, emoji: "🏆", name: "Fluency Master", desc: "Đạt điểm Fluency ≥ 80", earned: false, progress: 72, total: 80 },
  { id: 5, emoji: "🎭", name: "Diễn viên xuất sắc", desc: "Hoàn thành 20 tình huống roleplay", earned: false, progress: 7, total: 20 },
  { id: 6, emoji: "👥", name: "Ngôi sao cộng đồng", desc: "Tham gia 10 Voice Room", earned: false, progress: 3, total: 10 },
  { id: 7, emoji: "🔥", name: "Streak 30 ngày", desc: "Học liên tục 30 ngày", earned: false, progress: 12, total: 30 },
  { id: 8, emoji: "📚", name: "Từ điển sống", desc: "Học 500 từ vựng mới", earned: false, progress: 210, total: 500 },
  { id: 9, emoji: "⚡", name: "Tốc độ ánh sáng", desc: "Đạt điểm Tốc độ P.H ≥ 80", earned: false, progress: 55, total: 80 }
];

export const USER_INTERESTS = ["Du lịch", "Công nghệ", "Ẩm thực", "Kinh doanh", "Thể thao", "Âm nhạc", "Phim & TV", "Khoa học"];
export const USER_GOALS = ["Giao tiếp hằng ngày tự nhiên", "Thuyết trình công việc", "Phỏng vấn xin việc", "Học tập ở nước ngoài", "Du lịch tự túc"];
